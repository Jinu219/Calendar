import { useEffect, useRef } from "react";
import type { AddTodoOptions, Todo } from "../types";
import {
  addDays,
  differenceInCalendarDays,
  fmtDate,
  parseLocalDate,
} from "../utils";

interface UseCalendarKeyboardShortcutsParams {
  todos: Todo[];
  selectedDate: string;
  addTodo: (
    title: string,
    date: string,
    options?: AddTodoOptions
  ) => void;
  deleteTodo: (id: string) => void;
  selectedTodoIds: string[];
  clearSelection: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const useCalendarKeyboardShortcuts = ({
  todos,
  selectedDate,
  addTodo,
  deleteTodo,
  selectedTodoIds,
  clearSelection,
  onUndo,
  onRedo,
}: UseCalendarKeyboardShortcutsParams) => {
  const copiedTodoIds = useRef<string[]>([]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;

      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedTodoIds.length > 0) {
          e.preventDefault();
          selectedTodoIds.forEach(id => deleteTodo(id));
          clearSelection();
        }
      }

      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "z") {
        if (onUndo) {
          e.preventDefault();
          onUndo();
        }
        return;
      }

      if (
        onRedo &&
        ((e.ctrlKey && e.key.toLowerCase() === "y") ||
          (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "z"))
      ) {
        e.preventDefault();
        onRedo();
        return;
      }

      if (e.ctrlKey && e.key.toLowerCase() === "c") {
        if (selectedTodoIds.length > 0) {
          copiedTodoIds.current = selectedTodoIds;
        }
      }

      if (e.ctrlKey && e.key.toLowerCase() === "v") {
        if (copiedTodoIds.current.length === 0) return;

        e.preventDefault();

        copiedTodoIds.current.forEach(id => {
          const original = todos.find(t => t.id === id);

          if (!original) return;

          const originalStart = original.startDate ?? original.date;
          const originalEnd = original.endDate ?? originalStart;
          const spanDays = Math.max(
            0,
            differenceInCalendarDays(
              parseLocalDate(originalStart),
              parseLocalDate(originalEnd)
            )
          );

          addTodo(original.title, selectedDate, {
            color: original.color,
            allDay: original.allDay,
            todoTime: original.todoTime,
            startTime: original.startTime,
            endTime: original.endTime,
            startDate: selectedDate,
            endDate: fmtDate(addDays(parseLocalDate(selectedDate), spanDays)),
            repeat: original.repeat,
            repeatEndDate: original.repeatEndDate,
          });
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    addTodo,
    clearSelection,
    deleteTodo,
    onRedo,
    onUndo,
    selectedDate,
    selectedTodoIds,
    todos,
  ]);
};
