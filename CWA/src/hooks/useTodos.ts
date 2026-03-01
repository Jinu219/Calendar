// ═══════════════════════════════════════════════════════════
// useTodos Hook
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import type { Todo, RepeatType } from "../types";
import { loadJson, getLocalToday } from "../utils";
import { TODOS_KEY } from "../constants";

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>(() => loadJson(TODOS_KEY, []));

  // Persist todos
  useEffect(() => {
    localStorage.setItem(TODOS_KEY, JSON.stringify(todos));
  }, [todos]);

  const addTodo = useCallback((
    title: string,
    date: string,
    options?: {
      color?: string;
      allDay?: boolean;
      todoTime?: string;
      repeat?: RepeatType;
      startTime?: string;
      endTime?: string;
      startDate?: string;
      endDate?: string;
      repeatEndDate?: string;
    }
  ) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const maxOrder = todos
      .filter(t => t.date === date)
      .reduce((max, t) => Math.max(max, t.sortOrder), -1);

    const newTodo: Todo = {
      id: crypto.randomUUID(),
      date,
      title: trimmedTitle,
      done: false,
      color: options?.color || "#f9a8d4",
      allDay: options?.allDay ?? true,
      todoTime: options?.todoTime,
      repeat: options?.repeat || "none",
      startTime: options?.startTime,
      endTime: options?.endTime,
      startDate: options?.startDate,
      endDate: options?.endDate,
      repeatEndDate: options?.repeatEndDate,
      sortOrder: maxOrder + 1,
    };

    setTodos(prev => [...prev, newTodo]);
  }, [todos]);

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
      item.date = arr[toIdx >= arr.length ? arr.length - 1 : toIdx]?.date ?? item.date;
      arr.splice(toIdx, 0, item);
      
      return arr.map((t, i) => ({ ...t, sortOrder: i }));
    });
  }, []);

  const updateTodoDate = useCallback((id: string, newDate: string) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, date: newDate } : t));
  }, []);

  const getTodosByDate = useCallback((date: string): Todo[] => {
    return todos.filter(t => t.date === date).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [todos]);

  return {
    todos,
    setTodos,
    addTodo,
    updateTodo,
    toggleDone,
    deleteTodo,
    moveTodo,
    updateTodoDate,
    getTodosByDate,
  };
}
