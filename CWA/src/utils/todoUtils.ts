// ═══════════════════════════════════════════════════════════
// Todo Utility Functions
// ═══════════════════════════════════════════════════════════

import { EventInput } from "@fullcalendar/core";
import type { Todo, RepeatType } from "../types";
import { addDays, addMonths, fmtDate } from "./dateUtils";

const DAY_MS = 1000 * 60 * 60 * 24;

const toLocalDate = (dateStr: string): Date => {
  return new Date(`${dateStr}T00:00:00`);
};

const diffInDays = (from: Date, to: Date): number => {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
};

const getExclusiveEndDate = (dateStr: string): string => {
  return fmtDate(addDays(toLocalDate(dateStr), 1));
};

const isSameOrAfter = (target: string, base: string): boolean => {
  return toLocalDate(target).getTime() >= toLocalDate(base).getTime();
};

const isSameOrBefore = (target: string, cap: string): boolean => {
  return toLocalDate(target).getTime() <= toLocalDate(cap).getTime();
};

const isDateInRange = (dateStr: string, startDate: string, endDate: string): boolean => {
  return isSameOrAfter(dateStr, startDate) && isSameOrBefore(dateStr, endDate);
};

/**
 * Check whether a todo occurs on a specific date.
 *
 * Current policy:
 * - repeat none: show only on date, or across startDate~endDate if present
 * - daily: show every day from base date to repeatEndDate
 * - weekly: show every 7 days from base date
 * - monthly: show on the same day-of-month as base date
 */
export const doesTodoOccurOnDate = (todo: Todo, dateStr: string): boolean => {
  const baseDate = todo.startDate || todo.date;
  const endDate = todo.endDate || baseDate;

  if (todo.repeat === "none") {
    return isDateInRange(dateStr, baseDate, endDate);
  }

  if (!isSameOrAfter(dateStr, baseDate)) {
    return false;
  }

  if (todo.repeatEndDate && !isSameOrBefore(dateStr, todo.repeatEndDate)) {
    return false;
  }

  const base = toLocalDate(baseDate);
  const target = toLocalDate(dateStr);
  const diff = diffInDays(base, target);

  if (diff < 0) {
    return false;
  }

  switch (todo.repeat) {
    case "daily":
      return true;

    case "weekly":
      return diff % 7 === 0;

    case "monthly":
      return base.getDate() === target.getDate();

    default:
      return todo.date === dateStr;
  }
};

/**
 * Get todos that should be displayed in TodoPanel for the selected date.
 */
export const getTodosForDate = (todos: Todo[], dateStr: string): Todo[] => {
  return todos
    .filter(todo => doesTodoOccurOnDate(todo, dateStr))
    .sort((a, b) => {
      if (a.allDay !== b.allDay) {
        return a.allDay ? -1 : 1;
      }

      const aTime = a.todoTime || a.startTime || "99:99";
      const bTime = b.todoTime || b.startTime || "99:99";

      if (aTime !== bTime) {
        return aTime.localeCompare(bTime);
      }

      return a.sortOrder - b.sortOrder;
    });
};

/** Expand recurring todos into calendar events */
export function expandTodos(
  todos: Todo[],
  holidays: Record<string, string>
): EventInput[] {
  const events: EventInput[] = [];

  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 6, 0);

  for (const t of todos) {
    const baseDateStr = t.startDate || t.date;
    const originalEndDateStr = t.endDate || baseDateStr;
    const base = toLocalDate(baseDateStr);
    const originalEnd = toLocalDate(originalEndDateStr);
    const spanDays = Math.max(0, diffInDays(base, originalEnd));

    const cap = t.repeatEndDate
      ? new Date(Math.min(toLocalDate(t.repeatEndDate).getTime(), rangeEnd.getTime()))
      : rangeEnd;

    const push = (d: Date) => {
      const occurrenceStartDate = fmtDate(d);
      const occurrenceEndDate = fmtDate(addDays(d, spanDays));

      events.push({
        id: `${t.id}__${occurrenceStartDate}`,
        title: t.done ? `✅ ${t.title}` : ` ${t.title}`,
        ...(t.allDay
          ? occurrenceEndDate !== occurrenceStartDate
            ? {
                start: occurrenceStartDate,
                end: getExclusiveEndDate(occurrenceEndDate),
                allDay: true,
              }
            : {
                date: occurrenceStartDate,
                allDay: true,
              }
          : {
              start: `${occurrenceStartDate}T${t.startTime || "09:00"}`,
              end: t.endTime
                ? `${occurrenceEndDate}T${t.endTime}`
                : undefined,
              allDay: false,
            }),
        backgroundColor: t.color,
        borderColor: "transparent",
        textColor: "#1a1a2e",
        extendedProps: {
          todoId: t.id,
        },
      });
    };

    if (t.repeat === "none") {
      push(base);
      continue;
    }

    let cur = new Date(base);
    let safety = 0;

    while (cur <= cap && safety++ < 5000) {
      if (cur >= rangeStart) {
        push(cur);
      }

      if (t.repeat === "daily") {
        cur = addDays(cur, 1);
      } else if (t.repeat === "weekly") {
        cur = addDays(cur, 7);
      } else if (t.repeat === "monthly") {
        cur = addMonths(cur, 1);
      }
    }
  }

  // Add holidays as background events
  const [y1, y2] = [now.getFullYear() - 1, now.getFullYear() + 2];

  for (const [date, name] of Object.entries(holidays)) {
    const yr = parseInt(date.slice(0, 4));

    if (yr >= y1 && yr <= y2) {
      events.push({
        id: `holiday-${date}`,
        title: ` ${name}`,
        date,
        allDay: true,
        backgroundColor: "rgba(239,68,68,0.18)",
        borderColor: "transparent",
        textColor: "#dc2626",
        classNames: ["holiday-event"],
        display: "block",
      });
    }
  }

  return events;
}

/** Get repeat label in Korean */
export const getRepeatLabel = (repeat: RepeatType): string => {
  switch (repeat) {
    case "daily":
      return "매일";
    case "weekly":
      return "매주";
    case "monthly":
      return "매월";
    default:
      return "";
  }
};

/** Get repeat label for todo item */
export const getTodoRepeatLabel = (todo: Todo): string => {
  if (todo.repeat === "none") return "";

  return ` ${getRepeatLabel(todo.repeat)}`;
};

/** Get time display for todo */
export const getTodoTimeDisplay = (todo: Todo): string => {
  if (todo.todoTime) return ` ${todo.todoTime}`;

  if (!todo.allDay && todo.startTime) {
    return ` ${todo.startTime}${todo.endTime ? ` – ${todo.endTime}` : ""}`;
  }

  return "";
};