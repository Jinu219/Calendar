import { describe, expect, it } from "vitest";
import type { AgendaItem, Todo } from "../types";
import { formatTimelineTitle, getDaySlots, getTimelineRange, shiftTimelineAnchor } from "./timelineUtils";

const todo = (patch: Partial<Todo>): Todo => ({
  id: "t1",
  date: "2026-11-03",
  title: "회의",
  done: false,
  color: "#f9a8d4",
  allDay: true,
  repeat: "none",
  sortOrder: 0,
  ...patch,
});

const item = (patch: Partial<Todo>, occurrenceDate = "2026-11-03", occurrenceEndDate = occurrenceDate): AgendaItem => ({
  todo: todo(patch),
  occurrenceDate,
  occurrenceEndDate,
  done: false,
  dayIndex: 1,
  totalDays: 1,
});

describe("timeline range", () => {
  it("covers one day, the Sunday-to-Saturday week, or the calendar month", () => {
    expect(getTimelineRange("2026-11-03", "day")).toEqual({ start: "2026-11-03", end: "2026-11-03" });
    expect(getTimelineRange("2026-11-03", "week")).toEqual({ start: "2026-11-01", end: "2026-11-07" });
    expect(getTimelineRange("2026-02-14", "month")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });

  it("steps by the span", () => {
    expect(shiftTimelineAnchor("2026-11-03", "day", -1)).toBe("2026-11-02");
    expect(shiftTimelineAnchor("2026-11-03", "week", 1)).toBe("2026-11-10");
    expect(shiftTimelineAnchor("2026-01-31", "month", 1)).toBe("2026-02-01");
  });

  it("titles each span", () => {
    expect(formatTimelineTitle("2026-11-03", "day")).toBe("11월 3일 (화)");
    expect(formatTimelineTitle("2026-11-03", "week")).toBe("11월 1일 – 7일");
    expect(formatTimelineTitle("2026-10-29", "week")).toBe("10월 25일 – 31일");
    expect(formatTimelineTitle("2026-12-01", "week")).toBe("11월 29일 – 12월 5일");
    expect(formatTimelineTitle("2026-11-03", "month")).toBe("2026년 11월");
  });
});

describe("day slots", () => {
  it("places timed items on half-hour columns", () => {
    expect(getDaySlots(item({ allDay: false, startTime: "14:30", endTime: "15:30" }), "2026-11-03"))
      .toEqual({ first: 29, last: 30, allDay: false });
    expect(getDaySlots(item({ allDay: false, startTime: "09:10" }), "2026-11-03"))
      .toEqual({ first: 18, last: 20, allDay: false });
  });

  it("fills the day for all-day items and the middle of multi-day ones", () => {
    expect(getDaySlots(item({}), "2026-11-03")).toEqual({ first: 0, last: 47, allDay: true });
    expect(getDaySlots(
      item({ allDay: false, startTime: "20:00", endTime: "09:00" }, "2026-11-02", "2026-11-04"),
      "2026-11-03"
    )).toEqual({ first: 0, last: 47, allDay: false });
  });

  it("gives a todo's due time a single slot", () => {
    expect(getDaySlots(item({ kind: "todo", todoTime: "18:00" }), "2026-11-03"))
      .toEqual({ first: 36, last: 36, allDay: false });
  });
});
