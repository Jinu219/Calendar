import { useEffect } from "react";
import type { Todo, RepeatType } from "../types";

interface AddTodoOptions {
  color?: string;
  allDay?: boolean;
  todoTime?: string;
  startTime?: string;
  endTime?: string;
  startDate?: string;
  endDate?: string;
  repeat?: RepeatType;
  repeatEndDate?: string;
}

interface UseCalendarKeyboardShortcutsParams {
  todos: Todo[];
  selectedDate: string;
  addTodo: (
    title: string,
    date: string,
    options?: AddTodoOptions
  ) => void;
  deleteTodo: (id: string) => void;
}

export const useCalendarKeyboardShortcuts = ({
  todos,
  selectedDate,
  addTodo,
  deleteTodo,
}: UseCalendarKeyboardShortcutsParams) => {
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

      const calendarWindow = window as any;

      const selectedEvents = (calendarWindow.__selectedEvents || []) as string[];
      const selectedEventId = calendarWindow.__selectedEventId as string | undefined;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedEvents.length > 0) {
          e.preventDefault();

          selectedEvents.forEach(id => deleteTodo(id));

          calendarWindow.__selectedEvents = [];
          calendarWindow.__selectedEventId = null;

          return;
        }

        if (selectedEventId) {
          e.preventDefault();

          deleteTodo(selectedEventId);

          calendarWindow.__selectedEventId = null;
        }
      }

      if (e.ctrlKey && e.key.toLowerCase() === "c") {
        if (selectedEvents.length > 0 || selectedEventId) {
          const idsToCopy = selectedEvents.length > 0
            ? selectedEvents
            : [selectedEventId];

          calendarWindow.__copiedEvents = idsToCopy;
        }
      }

      if (e.ctrlKey && e.key.toLowerCase() === "v") {
        const copiedEvents = (calendarWindow.__copiedEvents || []) as string[];

        if (copiedEvents.length === 0) return;

        e.preventDefault();

        copiedEvents.forEach(id => {
          const original = todos.find(t => t.id === id);

          if (!original) return;

          addTodo(original.title, selectedDate, {
            color: original.color,
            allDay: original.allDay,
            todoTime: original.todoTime,
            startTime: original.startTime,
            endTime: original.endTime,
            startDate: selectedDate,
            endDate: selectedDate,
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
  }, [addTodo, deleteTodo, selectedDate, todos]);
};