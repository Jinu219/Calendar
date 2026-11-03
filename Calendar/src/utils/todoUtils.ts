// ═══════════════════════════════════════════════════════════
// Todo Utility Functions
// ═══════════════════════════════════════════════════════════
//
// Every view (calendar, timeline, todo panel, reminders) asks the same
// questions about a todo: "does it appear on this day?", "which occurrence is
// that?", "is that occurrence done?". They are all answered here so the views
// can never disagree with each other.

import type { EventInput } from "@fullcalendar/core";
import type { AgendaItem, EventTiming, RepeatType, Todo } from "../types";
import {
  addDays,
  addMonths,
  daysBetween,
  fmtDate,
  formatTimeLabel,
  parseLocalDate,
  shiftDate,
  timeToMinutes,
  minutesToTime,
} from "./dateUtils";

const MAX_OCCURRENCES = 5000;

/** First day of a todo (or of a recurring series). */
export const getTodoStartDate = (todo: Todo): string => todo.startDate || todo.date;

/** How many days after its start a single occurrence ends (0 for a one-day item). */
export const getTodoSpanDays = (todo: Todo): number => {
  const start = getTodoStartDate(todo);
  return Math.max(0, daysBetween(start, todo.endDate || start));
};

/** Start time used for sorting and reminders, if the todo has one. */
export const getTodoStartTime = (todo: Todo): string | undefined => {
  if (todo.todoTime) return todo.todoTime;
  if (!todo.allDay && todo.startTime) return todo.startTime;
  return undefined;
};

/** Whether an occurrence of the todo starts exactly on dateStr. */
export const doesOccurrenceStartOn = (todo: Todo, dateStr: string): boolean => {
  const base = getTodoStartDate(todo);

  if (todo.repeat === "none") return dateStr === base;
  if (dateStr < base) return false;
  if (todo.repeatEndDate && dateStr > todo.repeatEndDate) return false;
  if (todo.exceptions?.includes(dateStr)) return false;

  switch (todo.repeat) {
    case "daily":
      return true;

    case "weekly":
      return daysBetween(base, dateStr) % 7 === 0;

    case "monthly": {
      const baseDate = parseLocalDate(base);
      const target = parseLocalDate(dateStr);
      const monthOffset = (target.getFullYear() - baseDate.getFullYear()) * 12
        + target.getMonth() - baseDate.getMonth();

      return fmtDate(addMonths(baseDate, monthOffset)) === dateStr;
    }

    default:
      return false;
  }
};

/**
 * Start date of the occurrence that covers dateStr — a multi-day occurrence
 * covers several days — or null when the todo doesn't appear that day.
 */
export const getOccurrenceStartOn = (todo: Todo, dateStr: string): string | null => {
  const span = getTodoSpanDays(todo);

  if (todo.repeat === "none") {
    const base = getTodoStartDate(todo);
    return dateStr >= base && daysBetween(base, dateStr) <= span ? base : null;
  }

  for (let back = 0; back <= span; back++) {
    const candidate = shiftDate(dateStr, -back);
    if (doesOccurrenceStartOn(todo, candidate)) return candidate;
  }

  return null;
};

export const doesTodoOccurOnDate = (todo: Todo, dateStr: string): boolean =>
  getOccurrenceStartOn(todo, dateStr) !== null;

/** Completion of one occurrence. Recurring todos keep a done flag per occurrence. */
export const isOccurrenceDone = (todo: Todo, occurrenceDate: string): boolean =>
  todo.repeat === "none"
    ? todo.done
    : todo.doneDates?.includes(occurrenceDate) ?? false;

/** Start dates of every occurrence overlapping [rangeStart, rangeEnd] (both inclusive). */
export const listOccurrenceStarts = (
  todo: Todo,
  rangeStart: string,
  rangeEnd: string
): string[] => {
  const base = getTodoStartDate(todo);
  // An occurrence that starts up to `span` days before the range still overlaps it.
  const scanStart = shiftDate(rangeStart, -getTodoSpanDays(todo));

  if (todo.repeat === "none") {
    return base >= scanStart && base <= rangeEnd ? [base] : [];
  }

  const last = todo.repeatEndDate && todo.repeatEndDate < rangeEnd
    ? todo.repeatEndDate
    : rangeEnd;
  const from = scanStart > base ? scanStart : base;
  const starts: string[] = [];

  if (last < from) return starts;

  const keep = (dateStr: string) => {
    if (dateStr >= scanStart && !todo.exceptions?.includes(dateStr)) {
      starts.push(dateStr);
    }
  };

  if (todo.repeat === "monthly") {
    const baseDate = parseLocalDate(base);
    const fromDate = parseLocalDate(from);
    let offset = Math.max(
      0,
      (fromDate.getFullYear() - baseDate.getFullYear()) * 12
        + fromDate.getMonth() - baseDate.getMonth() - 1
    );

    for (let i = 0; i < MAX_OCCURRENCES; i++, offset++) {
      const dateStr = fmtDate(addMonths(baseDate, offset));
      if (dateStr > last) break;
      keep(dateStr);
    }

    return starts;
  }

  const step = todo.repeat === "weekly" ? 7 : 1;
  let cursor = shiftDate(base, Math.ceil(daysBetween(base, from) / step) * step);

  for (let i = 0; i < MAX_OCCURRENCES && cursor <= last; i++) {
    keep(cursor);
    cursor = shiftDate(cursor, step);
  }

  return starts;
};

/** Where one occurrence of a todo currently sits. */
export const getOccurrenceTiming = (todo: Todo, occurrenceDate: string): EventTiming => ({
  startDate: occurrenceDate,
  endDate: shiftDate(occurrenceDate, getTodoSpanDays(todo)),
  allDay: todo.allDay,
  startTime: todo.allDay ? undefined : todo.startTime,
  endTime: todo.allDay ? undefined : todo.endTime,
});

/**
 * Fields that move a whole todo — a one-off, or an entire recurring series — so
 * the occurrence that started on `occurrenceDate` lands at `timing`. A series'
 * bookkeeping (skipped/completed dates, end of repetition) moves along with it.
 */
export const shiftTodoToTiming = (
  todo: Todo,
  occurrenceDate: string,
  timing: EventTiming
): Partial<Todo> => {
  const delta = daysBetween(occurrenceDate, timing.startDate);
  const span = Math.max(0, daysBetween(timing.startDate, timing.endDate));
  const startDate = shiftDate(getTodoStartDate(todo), delta);
  const shiftAll = (dates?: string[]) => dates?.map(d => shiftDate(d, delta));

  return {
    date: startDate,
    startDate,
    endDate: shiftDate(startDate, span),
    allDay: timing.allDay,
    startTime: timing.allDay ? undefined : timing.startTime,
    endTime: timing.allDay ? undefined : timing.endTime,
    todoTime: timing.allDay ? todo.todoTime : undefined,
    ...(todo.repeat === "none"
      ? {}
      : {
          repeatEndDate: todo.repeatEndDate ? shiftDate(todo.repeatEndDate, delta) : undefined,
          exceptions: shiftAll(todo.exceptions),
          doneDates: shiftAll(todo.doneDates),
        }),
  };
};

/** The timing fields of a todo set to exactly `timing` (used for detached occurrences). */
export const timingToFields = (timing: EventTiming): Partial<Todo> => ({
  date: timing.startDate,
  startDate: timing.startDate,
  endDate: timing.endDate < timing.startDate ? timing.startDate : timing.endDate,
  allDay: timing.allDay,
  startTime: timing.allDay ? undefined : timing.startTime,
  endTime: timing.allDay ? undefined : timing.endTime,
});

const compareAgendaItems = (a: AgendaItem, b: AgendaItem): number => {
  if (a.todo.allDay !== b.todo.allDay) {
    return a.todo.allDay ? -1 : 1;
  }

  const aTime = getTodoStartTime(a.todo) ?? "99:99";
  const bTime = getTodoStartTime(b.todo) ?? "99:99";

  if (aTime !== bTime) {
    return aTime.localeCompare(bTime);
  }

  return a.todo.sortOrder - b.todo.sortOrder;
};

/** Everything shown for one day in the todo panel, in display order. */
export const getAgendaForDate = (todos: Todo[], dateStr: string): AgendaItem[] =>
  todos
    .flatMap((todo): AgendaItem[] => {
      const occurrenceDate = getOccurrenceStartOn(todo, dateStr);
      if (!occurrenceDate) return [];

      const totalDays = getTodoSpanDays(todo) + 1;

      return [{
        todo,
        occurrenceDate,
        occurrenceEndDate: shiftDate(occurrenceDate, totalDays - 1),
        done: isOccurrenceDone(todo, occurrenceDate),
        dayIndex: daysBetween(occurrenceDate, dateStr) + 1,
        totalDays,
      }];
    })
    .sort(compareAgendaItems);

/** Expand todos (including every recurring occurrence) into calendar events. */
export function expandTodos(
  todos: Todo[],
  visibleStart: Date,
  visibleEnd: Date
): EventInput[] {
  const rangeStart = fmtDate(visibleStart);
  const rangeEnd = fmtDate(addDays(visibleEnd, -1));
  const events: EventInput[] = [];

  for (const todo of todos) {
    const span = getTodoSpanDays(todo);

    for (const occurrenceDate of listOccurrenceStarts(todo, rangeStart, rangeEnd)) {
      const done = isOccurrenceDone(todo, occurrenceDate);
      const endDate = shiftDate(occurrenceDate, span);

      events.push({
        id: `${todo.id}__${occurrenceDate}`,
        title: done ? `✓ ${todo.title}` : todo.title,
        ...(todo.allDay
          ? {
              start: occurrenceDate,
              end: shiftDate(endDate, 1),
              allDay: true,
            }
          : {
              start: `${occurrenceDate}T${todo.startTime || "09:00"}`,
              end: todo.endTime ? `${endDate}T${todo.endTime}` : undefined,
              allDay: false,
            }),
        backgroundColor: todo.color,
        borderColor: "transparent",
        textColor: "#1a1a2e",
        classNames: [
          done ? "is-done" : "",
          todo.repeat !== "none" ? "is-recurring" : "",
          todo.kind === "todo" ? "kind-todo" : "kind-schedule",
        ].filter(Boolean),
        extendedProps: {
          todoId: todo.id,
          occurrenceDate,
        },
      });
    }
  }

  return events;
}

/** Public holidays as non-editable calendar events (used where day cells don't show names). */
export function getHolidayEvents(
  holidays: Record<string, string>,
  visibleStart: Date,
  visibleEnd: Date
): EventInput[] {
  const rangeStart = fmtDate(visibleStart);
  const rangeEnd = fmtDate(addDays(visibleEnd, -1));

  return Object.entries(holidays)
    .filter(([date]) => date >= rangeStart && date <= rangeEnd)
    .map(([date, name]) => ({
      id: `holiday-${date}`,
      title: name,
      start: date,
      allDay: true,
      editable: false,
      startEditable: false,
      durationEditable: false,
      backgroundColor: "rgba(239,68,68,0.18)",
      borderColor: "transparent",
      textColor: "#b91c1c",
      classNames: ["holiday-event"],
      display: "block",
      extendedProps: {
        isHoliday: true,
      },
    }));
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

/** "09:00 – 10:00", "오전 9:00", or "" for an all-day item. */
export const getTodoTimeLabel = (todo: Todo, use24Hour: boolean): string => {
  if (todo.todoTime) return formatTimeLabel(todo.todoTime, use24Hour);

  if (!todo.allDay && todo.startTime) {
    const start = formatTimeLabel(todo.startTime, use24Hour);
    return todo.endTime ? `${start} – ${formatTimeLabel(todo.endTime, use24Hour)}` : start;
  }

  return "";
};

// ───────────────────────────────────────────────────────────
// Quick add: "14:30 회의", "오후 3시 반 미팅", "회의 14:00~15:30"
// ───────────────────────────────────────────────────────────

export interface QuickAddResult {
  title: string;
  startTime?: string;
  endTime?: string;
}

// meridiem, hour, then either ":MM" or "시" with an optional "반" / "N분".
// "시간" (duration) is not a time of day, hence the lookahead.
const TIME_PATTERN = String.raw`(?:(오전|오후)\s*)?(\d{1,2})(?::(\d{2})|\s*시(?!간)(?:\s*(반|\d{1,2}\s*분))?)`;
const QUICK_ADD_RE = new RegExp(`${TIME_PATTERN}(?:\\s*[~\\-–]\\s*${TIME_PATTERN})?`);

const toMinutesOfDay = (
  meridiem: string | undefined,
  hourText: string,
  colonMinutes: string | undefined,
  siMinutes: string | undefined
): number | null => {
  let hours = Number(hourText);
  const minutes = colonMinutes !== undefined
    ? Number(colonMinutes)
    : siMinutes === "반"
      ? 30
      : siMinutes
        ? parseInt(siMinutes, 10)
        : 0;

  if (hours > 24 || minutes > 59) return null;

  if (meridiem === "오후" && hours < 12) hours += 12;
  if (meridiem === "오전" && hours === 12) hours = 0;

  // "3시 회의" without 오전/오후 almost always means the afternoon.
  if (!meridiem && colonMinutes === undefined && hours >= 1 && hours <= 6) hours += 12;

  return (hours % 24) * 60 + minutes;
};

export const parseQuickAdd = (text: string): QuickAddResult => {
  const trimmed = text.trim();
  const match = QUICK_ADD_RE.exec(trimmed);

  if (!match) return { title: trimmed };

  const start = toMinutesOfDay(match[1], match[2], match[3], match[4]);
  if (start === null) return { title: trimmed };

  let end: number | null = null;

  if (match[6] !== undefined) {
    // "오후 2시~4시": the end time inherits the start's 오전/오후.
    end = toMinutesOfDay(match[5] ?? match[1], match[6], match[7], match[8]);

    if (end !== null && end <= start && end + 720 > start) {
      end += 720;
    }
  }

  const title = (trimmed.slice(0, match.index) + trimmed.slice(match.index + match[0].length))
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!title) return { title: trimmed };

  return {
    title,
    startTime: minutesToTime(start),
    endTime: end !== null && end > start
      ? minutesToTime(Math.min(end, 23 * 60 + 59))
      : getDefaultEndTime(minutesToTime(start)),
  };
};

/** Default end time one hour after a start time, capped at 23:59. */
export const getDefaultEndTime = (startTime: string): string =>
  minutesToTime(Math.min(timeToMinutes(startTime) + 60, 23 * 60 + 59));
