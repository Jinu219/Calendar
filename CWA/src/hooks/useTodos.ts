// ═══════════════════════════════════════════════════════════
// useTodos Hook
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useReducer } from "react";
import type { AddTodoOptions, Todo } from "../types";
import {
  addDays,
  createId,
  differenceInCalendarDays,
  fmtDate,
  loadJson,
  parseLocalDate,
} from "../utils";
import { TODO_COLORS, TODOS_KEY } from "../constants";

const isStoredTodo = (value: unknown): value is Partial<Todo> =>
  typeof value === "object" && value !== null;

const loadTodos = (): Todo[] => {
  const stored = loadJson<unknown>(TODOS_KEY, []);

  if (!Array.isArray(stored)) return [];

  return stored
    .filter(isStoredTodo)
    .filter(todo => Boolean(todo.id && todo.date && todo.title))
    .map((todo, index): Todo => ({
      id: todo.id as string,
      date: todo.date as string,
      title: todo.title as string,
      done: todo.done ?? false,
      color: todo.color ?? TODO_COLORS[0],
      allDay: todo.allDay ?? true,
      repeat: todo.repeat ?? "none",
      sortOrder: todo.sortOrder ?? index,
      startDate: todo.startDate,
      endDate: todo.endDate,
      startTime: todo.startTime,
      endTime: todo.endTime,
      todoTime: todo.todoTime,
      repeatEndDate: todo.repeatEndDate,
      exceptions: Array.isArray(todo.exceptions) ? todo.exceptions : undefined,
    }));
};

const HISTORY_LIMIT = 50;

interface TodosState {
  todos: Todo[];
  past: Todo[][];
  future: Todo[][];
}

type Action =
  | { type: "MUTATE"; updater: (todos: Todo[]) => Todo[] }
  | { type: "UNDO" }
  | { type: "REDO" };

const reducer = (state: TodosState, action: Action): TodosState => {
  switch (action.type) {
    case "MUTATE": {
      const next = action.updater(state.todos);
      if (next === state.todos) return state;

      return {
        todos: next,
        past: [...state.past, state.todos].slice(-HISTORY_LIMIT),
        future: [],
      };
    }

    case "UNDO": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];

      return {
        todos: previous,
        past: state.past.slice(0, -1),
        future: [...state.future, state.todos].slice(-HISTORY_LIMIT),
      };
    }

    case "REDO": {
      if (state.future.length === 0) return state;
      const next = state.future[state.future.length - 1];

      return {
        todos: next,
        past: [...state.past, state.todos].slice(-HISTORY_LIMIT),
        future: state.future.slice(0, -1),
      };
    }

    default:
      return state;
  }
};

const initState = (): TodosState => ({
  todos: loadTodos(),
  past: [],
  future: [],
});

export function useTodos() {
  const [state, dispatch] = useReducer(reducer, undefined, initState);
  const { todos, past, future } = state;

  // Persist todos
  useEffect(() => {
    try {
      localStorage.setItem(TODOS_KEY, JSON.stringify(todos));
    } catch (error) {
      console.error("Failed to persist todos:", error);
    }
  }, [todos]);

  const mutate = useCallback((updater: (prev: Todo[]) => Todo[]) => {
    dispatch({ type: "MUTATE", updater });
  }, []);

  const addTodo = useCallback((title: string, date: string, options?: AddTodoOptions) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    mutate(prev => {
      const maxOrder = prev
        .filter(todo => todo.date === date)
        .reduce((max, todo) => Math.max(max, todo.sortOrder), -1);

      return [
        ...prev,
        {
          id: createId("todo"),
          date,
          title: trimmedTitle,
          done: false,
          color: options?.color ?? TODO_COLORS[0],
          allDay: options?.allDay ?? true,
          todoTime: options?.todoTime,
          repeat: options?.repeat ?? "none",
          startTime: options?.startTime,
          endTime: options?.endTime,
          startDate: options?.startDate,
          endDate: options?.endDate,
          repeatEndDate: options?.repeatEndDate,
          sortOrder: maxOrder + 1,
        },
      ];
    });
  }, [mutate]);

  const updateTodo = useCallback((id: string, updates: Partial<Todo>) => {
    mutate(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, [mutate]);

  const toggleDone = useCallback((id: string) => {
    mutate(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }, [mutate]);

  const deleteTodo = useCallback((id: string) => {
    mutate(prev => prev.filter(t => t.id !== id));
  }, [mutate]);

  const moveTodo = useCallback((fromId: string, toId: string) => {
    mutate(prev => {
      const arr = [...prev];
      const fromIdx = arr.findIndex(t => t.id === fromId);
      const toIdx = arr.findIndex(t => t.id === toId);

      if (fromIdx < 0 || toIdx < 0) return prev;

      const [item] = arr.splice(fromIdx, 1);
      const targetDate = arr[Math.min(toIdx, arr.length - 1)]?.date ?? item.date;
      arr.splice(toIdx, 0, { ...item, date: targetDate });

      return arr.map((t, i) => ({ ...t, sortOrder: i }));
    });
  }, [mutate]);

  const updateTodoDate = useCallback((id: string, newDate: string) => {
    mutate(prev =>
      prev.map(t => {
        if (t.id !== id) return t;

        const currentStartDate = t.startDate || t.date;
        const currentEndDate = t.endDate || currentStartDate;

        const spanDays = Math.max(
          0,
          differenceInCalendarDays(
            parseLocalDate(currentStartDate),
            parseLocalDate(currentEndDate)
          )
        );

        const newEndDate = fmtDate(addDays(parseLocalDate(newDate), spanDays));

        return {
          ...t,
          date: newDate,
          startDate: newDate,
          endDate: newEndDate,
        };
      })
    );
  }, [mutate]);

  /** Skip only this occurrence of a recurring todo, keeping the rest of the series. */
  const deleteOccurrence = useCallback((id: string, occurrenceDate: string) => {
    mutate(prev => prev.map(t => {
      if (t.id !== id) return t;

      const exceptions = Array.from(new Set([...(t.exceptions ?? []), occurrenceDate]));
      return { ...t, exceptions };
    }));
  }, [mutate]);

  /** Detach one occurrence of a recurring todo into its own one-off todo with edits applied. */
  const editOccurrence = useCallback((id: string, occurrenceDate: string, updates: Partial<Todo>) => {
    mutate(prev => {
      const base = prev.find(t => t.id === id);
      if (!base) return prev;

      const exceptions = Array.from(new Set([...(base.exceptions ?? []), occurrenceDate]));
      const detached: Todo = {
        ...base,
        ...updates,
        id: createId("todo"),
        repeat: "none",
        repeatEndDate: undefined,
        exceptions: undefined,
        sortOrder: base.sortOrder,
      };

      return prev
        .map(t => t.id === id ? { ...t, exceptions } : t)
        .concat(detached);
    });
  }, [mutate]);

  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);

  return {
    todos,
    addTodo,
    updateTodo,
    toggleDone,
    deleteTodo,
    moveTodo,
    updateTodoDate,
    deleteOccurrence,
    editOccurrence,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
