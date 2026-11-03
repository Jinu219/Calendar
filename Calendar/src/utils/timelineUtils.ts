// ═══════════════════════════════════════════════════════════
// Timeline — which days a span shows, and where a timed item sits in a day
// ═══════════════════════════════════════════════════════════

import type { AgendaItem, TimelineSpan } from "../types";
import { fmtDate, parseLocalDate, shiftDate, timeToMinutes } from "./dateUtils";

/** The day view is cut into half-hour columns. */
export const DAY_SLOT_MINUTES = 30;
export const DAY_SLOT_COUNT = (24 * 60) / DAY_SLOT_MINUTES;

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** First and last day (inclusive) on screen. Weeks run Sunday–Saturday like the calendar. */
export const getTimelineRange = (anchor: string, span: TimelineSpan): { start: string; end: string } => {
  if (span === "day") return { start: anchor, end: anchor };

  if (span === "week") {
    const start = shiftDate(anchor, -parseLocalDate(anchor).getDay());
    return { start, end: shiftDate(start, 6) };
  }

  const d = parseLocalDate(anchor);
  return {
    start: fmtDate(new Date(d.getFullYear(), d.getMonth(), 1)),
    end: fmtDate(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  };
};

/** One day / week / month earlier (-1) or later (+1). */
export const shiftTimelineAnchor = (anchor: string, span: TimelineSpan, step: 1 | -1): string => {
  if (span === "day") return shiftDate(anchor, step);
  if (span === "week") return shiftDate(anchor, 7 * step);

  const d = parseLocalDate(anchor);
  return fmtDate(new Date(d.getFullYear(), d.getMonth() + step, 1));
};

/** "11월 3일 (화)", "11월 1일 – 7일", "10월 29일 – 11월 4일", "2026년 11월". */
export const formatTimelineTitle = (anchor: string, span: TimelineSpan): string => {
  const { start, end } = getTimelineRange(anchor, span);
  const s = parseLocalDate(start);
  const e = parseLocalDate(end);

  if (span === "day") return `${s.getMonth() + 1}월 ${s.getDate()}일 (${WEEKDAYS[s.getDay()]})`;
  if (span === "month") return `${s.getFullYear()}년 ${s.getMonth() + 1}월`;

  return s.getMonth() === e.getMonth()
    ? `${s.getMonth() + 1}월 ${s.getDate()}일 – ${e.getDate()}일`
    : `${s.getMonth() + 1}월 ${s.getDate()}일 – ${e.getMonth() + 1}월 ${e.getDate()}일`;
};

/**
 * Half-hour columns [first, last] an agenda item covers on its day. All-day
 * items (and days in the middle of a multi-day item) fill the whole day; a
 * todo with only a due time gets one slot.
 */
export const getDaySlots = (item: AgendaItem, day: string): { first: number; last: number; allDay: boolean } => {
  const { todo } = item;
  const lastSlot = DAY_SLOT_COUNT - 1;

  if (todo.todoTime) {
    const slot = Math.floor(timeToMinutes(todo.todoTime) / DAY_SLOT_MINUTES);
    return { first: slot, last: slot, allDay: false };
  }

  if (todo.allDay || !todo.startTime) return { first: 0, last: lastSlot, allDay: true };

  const startsToday = item.occurrenceDate === day;
  const endsToday = item.occurrenceEndDate === day;
  const start = startsToday ? timeToMinutes(todo.startTime) : 0;
  const end = endsToday
    ? (todo.endTime ? timeToMinutes(todo.endTime) : start + 60)
    : 24 * 60;

  const first = Math.min(lastSlot, Math.floor(start / DAY_SLOT_MINUTES));
  const last = Math.min(lastSlot, Math.max(first, Math.ceil(end / DAY_SLOT_MINUTES) - 1));

  return { first, last, allDay: false };
};
