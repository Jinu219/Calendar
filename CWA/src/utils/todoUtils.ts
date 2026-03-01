// ═══════════════════════════════════════════════════════════
// Todo Utility Functions
// ═══════════════════════════════════════════════════════════

import { EventInput } from "@fullcalendar/core";
import type { Todo, RepeatType } from "../types";
import { addDays, addMonths, fmtDate } from "./dateUtils";

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
    const base = new Date(t.date + "T00:00:00");
    const cap = t.repeatEndDate
      ? new Date(Math.min(new Date(t.repeatEndDate + "T00:00:00").getTime(), rangeEnd.getTime()))
      : rangeEnd;

    const push = (d: Date) => {
      events.push({
        id: `${t.id}__${fmtDate(d)}`,
        title: t.done ? `✅ ${t.title}` : `🟦 ${t.title}`,
        ...(t.allDay
          ? { date: fmtDate(d), allDay: true }
          : {
              start: `${fmtDate(d)}T${t.startTime}`,
              end: t.endTime ? `${fmtDate(d)}T${t.endTime}` : undefined,
              allDay: false
            }),
        backgroundColor: t.color,
        borderColor: "transparent",
        textColor: "#1a1a2e",
        extendedProps: { todoId: t.id },
      });
    };

    if (t.repeat === "none") {
      push(base);
      continue;
    }

    let cur = new Date(base);
    let safety = 0;
    while (cur <= cap && safety++ < 5000) {
      if (cur >= rangeStart) push(cur);
      if (t.repeat === "daily") cur = addDays(cur, 1);
      else if (t.repeat === "weekly") cur = addDays(cur, 7);
      else if (t.repeat === "monthly") cur = addMonths(cur, 1);
    }
  }

  // Add holidays as background events
  const [y1, y2] = [now.getFullYear() - 1, now.getFullYear() + 2];
  for (const [date, name] of Object.entries(holidays)) {
    const yr = parseInt(date.slice(0, 4));
    if (yr >= y1 && yr <= y2) {
      events.push({
        id: `holiday-${date}`,
        title: `🎌 ${name}`,
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
    case "daily": return "매일";
    case "weekly": return "매주";
    case "monthly": return "매월";
    default: return "";
  }
};

/** Get repeat label for todo item */
export const getTodoRepeatLabel = (todo: Todo): string => {
  if (todo.repeat === "none") return "";
  return `🔁 ${getRepeatLabel(todo.repeat)}`;
};

/** Get time display for todo */
export const getTodoTimeDisplay = (todo: Todo): string => {
  if (todo.todoTime) return `🕐 ${todo.todoTime}`;
  if (!todo.allDay && todo.startTime) {
    return `🕐 ${todo.startTime}${todo.endTime ? ` – ${todo.endTime}` : ""}`;
  }
  return "";
};
