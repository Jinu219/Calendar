// ═══════════════════════════════════════════════════════════
// useTodos Hook
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useReducer } from "react";
import type { AddTodoOptions, EventTiming, OccurrenceRef, RecurrenceScope, Todo } from "../types";
import {
  createId,
  getTodoStartDate,
  isOccurrenceDone,
  loadJson,
  shiftTodoToTiming,
  timingToFields,
} from "../utils";
import { TODO_COLORS, TODOS_KEY } from "../constants";

const isStoredTodo = (value: unknown): value is Partial<Todo> =>
  typeof value === "object" && value !== null;

const isDateString = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

const dateList = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const dates = value.filter(isDateString);
  return dates.length > 0 ? dates : undefined;
};

/** Normalize stored (possibly older or hand-edited) todo data. */
export const normalizeTodos = (stored: unknown): Todo[] => {
  if (!Array.isArray(stored)) return [];

  return stored
    .filter(isStoredTodo)
    .filter(todo => typeof todo.id === "string" && isDateString(todo.date) && typeof todo.title === "string" && todo.title)
    .map((todo, index): Todo => {
      const repeat = todo.repeat === "daily" || todo.repeat === "weekly" || todo.repeat === "monthly"
        ? todo.repeat
        : "none";

      return {
        id: todo.id as string,
        date: todo.date as string,
        title: todo.title as string,
        // Recurring todos used to share one done flag across every occurrence;
        // completion is per occurrence now (doneDates).
        done: repeat === "none" ? todo.done ?? false : false,
        color: todo.color ?? TODO_COLORS[0],
        allDay: todo.allDay ?? true,
        repeat,
        sortOrder: typeof todo.sortOrder === "number" ? todo.sortOrder : index,
        startDate: isDateString(todo.startDate) ? todo.startDate : undefined,
        endDate: isDateString(todo.endDate) ? todo.endDate : undefined,
        startTime: todo.startTime,
        endTime: todo.endTime,
        todoTime: todo.todoTime,
        repeatEndDate: isDateString(todo.repeatEndDate) ? todo.repeatEndDate : undefined,
        exceptions: dateList(todo.exceptions),
        doneDates: repeat === "none" ? undefined : dateList(todo.doneDates),
        kind: todo.kind === "todo" ? "todo" : "schedule",
      };
    });
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
  todos: normalizeTodos(loadJson<unknown>(TODOS_KEY, [])),
  past: [],
  future: [],
});

const withDate = (dates: string[] | undefined, date: string): string[] =>
  Array.from(new Set([...(dates ?? []), date]));

const withoutDate = (dates: string[] | undefined, date: string): string[] | undefined => {
  const next = dates?.filter(d => d !== date);
  return next && next.length > 0 ? next : undefined;
};

/**
 * Split one occurrence out of a recurring series into its own one-off todo.
 * The series skips that date from now on; the copy keeps its completion state.
 */
const detachOccurrence = (
  todos: Todo[],
  id: string,
  occurrenceDate: string,
  updates: Partial<Todo>
): Todo[] => {
  const base = todos.find(t => t.id === id);
  if (!base) return todos;

  const detached: Todo = {
    ...base,
    done: isOccurrenceDone(base, occurrenceDate),
    ...updates,
    id: createId("todo"),
    repeat: "none",
    repeatEndDate: undefined,
    exceptions: undefined,
    doneDates: undefined,
    sortOrder: base.sortOrder,
  };

  return todos
    .map(t => t.id === id
      ? {
          ...t,
          exceptions: withDate(t.exceptions, occurrenceDate),
          doneDates: withoutDate(t.doneDates, occurrenceDate),
        }
      : t)
    .concat(detached);
};

const createTodo = (
  title: string,
  date: string,
  options: AddTodoOptions | undefined,
  sortOrder: number
): Todo => ({
  id: createId("todo"),
  date,
  title,
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
  kind: options?.kind ?? "schedule",
  sortOrder,
});

export interface NewTodoInput {
  title: string;
  date: string;
  options?: AddTodoOptions;
}

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

  /** Add several todos as a single undo step. */
  const addTodos = useCallback((inputs: NewTodoInput[]) => {
    const valid = inputs
      .map(input => ({ ...input, title: input.title.trim() }))
      .filter(input => input.title);

    if (valid.length === 0) return;

    mutate(prev => {
      let maxOrder = prev.reduce((max, todo) => Math.max(max, todo.sortOrder), -1);
      return [
        ...prev,
        ...valid.map(input => createTodo(input.title, input.date, input.options, ++maxOrder)),
      ];
    });
  }, [mutate]);

  const addTodo = useCallback((title: string, date: string, options?: AddTodoOptions) => {
    addTodos([{ title, date, options }]);
  }, [addTodos]);

  const updateTodo = useCallback((id: string, updates: Partial<Todo>) => {
    mutate(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, [mutate]);

  /** Toggle completion of one occurrence (the whole todo when it doesn't repeat). */
  const toggleDone = useCallback((id: string, occurrenceDate?: string) => {
    mutate(prev => prev.map(t => {
      if (t.id !== id) return t;
      if (t.repeat === "none") return { ...t, done: !t.done };

      const date = occurrenceDate ?? getTodoStartDate(t);
      return {
        ...t,
        doneDates: isOccurrenceDone(t, date)
          ? withoutDate(t.doneDates, date)
          : withDate(t.doneDates, date),
      };
    }));
  }, [mutate]);

  const deleteTodo = useCallback((id: string) => {
    mutate(prev => prev.filter(t => t.id !== id));
  }, [mutate]);

  /**
   * Remove specific occurrences as one undo step: a one-off todo is deleted, a
   * recurring todo only skips that date and keeps the rest of the series.
   */
  const removeOccurrences = useCallback((refs: OccurrenceRef[]) => {
    if (refs.length === 0) return;

    mutate(prev => {
      const deletedIds = new Set<string>();
      const skipped = new Map<string, string[]>();

      for (const ref of refs) {
        const todo = prev.find(t => t.id === ref.todoId);
        if (!todo) continue;

        if (todo.repeat === "none") {
          deletedIds.add(todo.id);
        } else {
          skipped.set(todo.id, [...(skipped.get(todo.id) ?? []), ref.occurrenceDate]);
        }
      }

      if (deletedIds.size === 0 && skipped.size === 0) return prev;

      return prev
        .filter(t => !deletedIds.has(t.id))
        .map(t => {
          const dates = skipped.get(t.id);
          if (!dates) return t;

          return {
            ...t,
            exceptions: Array.from(new Set([...(t.exceptions ?? []), ...dates])),
            doneDates: t.doneDates?.filter(d => !dates.includes(d)),
          };
        });
    });
  }, [mutate]);

  /** Reorder within the todo panel. Only the order changes — never the dates. */
  const moveTodo = useCallback((fromId: string, toId: string) => {
    mutate(prev => {
      const ordered = [...prev].sort((a, b) => a.sortOrder - b.sortOrder);
      const from = ordered.findIndex(t => t.id === fromId);
      const to = ordered.findIndex(t => t.id === toId);

      if (from < 0 || to < 0 || from === to) return prev;

      // Moving down lands after the target, moving up lands before it.
      const [item] = ordered.splice(from, 1);
      ordered.splice(to, 0, item);

      const orderById = new Map(ordered.map((t, i) => [t.id, i]));
      return prev.map(t => ({ ...t, sortOrder: orderById.get(t.id) ?? t.sortOrder }));
    });
  }, [mutate]);

  /**
   * Move/resize an occurrence (calendar drag & drop). "this" splits a recurring
   * occurrence off on its own; "all" shifts the whole series by the same amount.
   */
  const applyTiming = useCallback((
    id: string,
    occurrenceDate: string,
    timing: EventTiming,
    scope: RecurrenceScope = "all"
  ) => {
    mutate(prev => {
      const todo = prev.find(t => t.id === id);
      if (!todo) return prev;

      if (scope === "this" && todo.repeat !== "none") {
        return detachOccurrence(prev, id, occurrenceDate, timingToFields(timing));
      }

      const fields = shiftTodoToTiming(todo, occurrenceDate, timing);
      return prev.map(t => t.id === id ? { ...t, ...fields } : t);
    });
  }, [mutate]);

  /** Detach one occurrence of a recurring todo into its own one-off todo with edits applied. */
  const editOccurrence = useCallback((id: string, occurrenceDate: string, updates: Partial<Todo>) => {
    mutate(prev => detachOccurrence(prev, id, occurrenceDate, updates));
  }, [mutate]);

  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);

  return {
    todos,
    addTodo,
    addTodos,
    updateTodo,
    toggleDone,
    deleteTodo,
    removeOccurrences,
    moveTodo,
    applyTiming,
    editOccurrence,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
