// ═══════════════════════════════════════════════════════════
// Stored todo data → valid Todo objects
// ═══════════════════════════════════════════════════════════
//
// Pure (no React, no Tauri) so the MCP server can read the app's data file too.

import type { RepeatType, Subtask, Todo } from "../types";
import { TODO_COLORS } from "../constants";
import { createId } from "./idUtils";

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
      const repeat = REPEAT_TYPES.includes(todo.repeat as RepeatType) ? todo.repeat as RepeatType : "none";

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
        repeatInterval: typeof todo.repeatInterval === "number" && todo.repeatInterval > 1
          ? Math.floor(todo.repeatInterval)
          : undefined,
        repeatDays: Array.isArray(todo.repeatDays)
          ? todo.repeatDays.filter(day => Number.isInteger(day) && day >= 0 && day <= 6)
          : undefined,
        monthlyMode: todo.monthlyMode === "weekday" ? "weekday" : undefined,
        reminderMinutes: typeof todo.reminderMinutes === "number" || todo.reminderMinutes === null
          ? todo.reminderMinutes
          : undefined,
        subtasks: normalizeSubtasks(todo.subtasks),
        kind: todo.kind === "todo" ? "todo" : "schedule",
      };
    });
};

const REPEAT_TYPES: RepeatType[] = ["none", "daily", "weekdays", "weekly", "monthly", "yearly"];

const normalizeSubtasks = (value: unknown): Subtask[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  const subtasks = value
    .filter((item): item is Partial<Subtask> => typeof item === "object" && item !== null)
    .filter(item => typeof item.title === "string" && item.title.trim() !== "")
    .map(item => ({
      id: typeof item.id === "string" ? item.id : createId("sub"),
      title: item.title as string,
      done: item.done === true,
    }));

  return subtasks.length > 0 ? subtasks : undefined;
};
