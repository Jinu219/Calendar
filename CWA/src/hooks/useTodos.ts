// ═══════════════════════════════════════════════════════════
// useTodos Hook
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
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
    }));
};

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>(loadTodos);

  // Persist todos
  useEffect(() => {
    try {
      localStorage.setItem(TODOS_KEY, JSON.stringify(todos));
    } catch (error) {
      console.error("Failed to persist todos:", error);
    }
  }, [todos]);

  const addTodo = useCallback((title: string, date: string, options?: AddTodoOptions) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    setTodos(prev => {
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
  }, []);

  const updateTodo = useCallback((id: string, updates: Partial<Todo>) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const toggleDone = useCallback((id: string) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }, []);

  const deleteTodo = useCallback((id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id));
  }, []);

  const moveTodo = useCallback((fromId: string, toId: string) => {
    setTodos(prev => {
      const arr = [...prev];
      const fromIdx = arr.findIndex(t => t.id === fromId);
      const toIdx = arr.findIndex(t => t.id === toId);
      
      if (fromIdx < 0 || toIdx < 0) return prev;
      
      const [item] = arr.splice(fromIdx, 1);
      const targetDate = arr[Math.min(toIdx, arr.length - 1)]?.date ?? item.date;
      arr.splice(toIdx, 0, { ...item, date: targetDate });
      
      return arr.map((t, i) => ({ ...t, sortOrder: i }));
    });
  }, []);

  const updateTodoDate = useCallback((id: string, newDate: string) => {
    setTodos(prev =>
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
  }, []);

  return {
    todos,
    addTodo,
    updateTodo,
    toggleDone,
    deleteTodo,
    moveTodo,
    updateTodoDate,
  };
}
