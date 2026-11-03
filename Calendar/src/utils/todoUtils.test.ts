import { describe, expect, it } from "vitest";
import type { Todo } from "../types";
import {
  describeRepeat,
  doesOccurrenceStartOn,
  endSeriesBefore,
  expandTodos,
  getAgendaForDate,
  getOccurrenceStartOn,
  isOccurrenceDone,
  listOccurrenceStarts,
  shiftTodoToTiming,
} from "./todoUtils";

const base: Todo = {
  id: "a",
  date: "2026-11-02",
  title: "x",
  done: false,
  color: "#fff",
  allDay: true,
  repeat: "none",
  sortOrder: 0,
};
const todo = (patch: Partial<Todo>): Todo => ({ ...base, ...patch });

describe("occurrences", () => {
  it("covers every day of a recurring multi-day item", () => {
    const weekly2day = todo({ repeat: "weekly", startDate: "2026-11-02", endDate: "2026-11-03" });

    expect(getOccurrenceStartOn(weekly2day, "2026-11-03")).toBe("2026-11-02");
    expect(getOccurrenceStartOn(weekly2day, "2026-11-10")).toBe("2026-11-09");
    expect(getOccurrenceStartOn(weekly2day, "2026-11-11")).toBeNull();
    expect(listOccurrenceStarts(weekly2day, "2026-11-03", "2026-11-17"))
      .toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
  });

  it("clamps monthly dates to short months", () => {
    const monthly31 = todo({ repeat: "monthly", date: "2026-01-31", startDate: "2026-01-31", endDate: "2026-01-31" });

    expect(listOccurrenceStarts(monthly31, "2026-02-01", "2026-04-30"))
      .toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("honours exceptions, end of repetition and per-occurrence completion", () => {
    const daily = todo({
      repeat: "daily",
      exceptions: ["2026-11-04"],
      repeatEndDate: "2026-11-06",
      doneDates: ["2026-11-03"],
    });

    expect(listOccurrenceStarts(daily, "2026-11-01", "2026-11-30"))
      .toEqual(["2026-11-02", "2026-11-03", "2026-11-05", "2026-11-06"]);
    expect(isOccurrenceDone(daily, "2026-11-03")).toBe(true);
    expect(isOccurrenceDone(daily, "2026-11-05")).toBe(false);
  });

  it("reports the day index of a multi-day item", () => {
    const [item] = getAgendaForDate([todo({ startDate: "2026-11-02", endDate: "2026-11-04" })], "2026-11-03");
    expect(item.dayIndex).toBe(2);
    expect(item.totalDays).toBe(3);
  });
});

describe("extended repeat rules", () => {
  it("repeats every N days", () => {
    const everyThird = todo({ repeat: "daily", repeatInterval: 3 });
    expect(listOccurrenceStarts(everyThird, "2026-11-01", "2026-11-12"))
      .toEqual(["2026-11-02", "2026-11-05", "2026-11-08", "2026-11-11"]);
  });

  it("repeats on weekdays only", () => {
    // 2026-11-06 is a Friday.
    const weekdays = todo({ repeat: "weekdays", date: "2026-11-06" });
    expect(listOccurrenceStarts(weekdays, "2026-11-06", "2026-11-10"))
      .toEqual(["2026-11-06", "2026-11-09", "2026-11-10"]);
  });

  it("repeats biweekly on chosen weekdays", () => {
    // Monday 2026-11-02, every 2 weeks on Mon and Wed.
    const biweekly = todo({ repeat: "weekly", repeatInterval: 2, repeatDays: [1, 3] });
    expect(listOccurrenceStarts(biweekly, "2026-11-01", "2026-11-30"))
      .toEqual(["2026-11-02", "2026-11-04", "2026-11-16", "2026-11-18", "2026-11-30"]);
    expect(describeRepeat(biweekly)).toBe("격주 월·수");
  });

  it("repeats on the nth weekday of the month", () => {
    // 2026-11-03 is the first Tuesday of November.
    const firstTuesday = todo({ repeat: "monthly", monthlyMode: "weekday", date: "2026-11-03" });
    expect(doesOccurrenceStartOn(firstTuesday, "2026-12-01")).toBe(true);
    expect(doesOccurrenceStartOn(firstTuesday, "2027-01-05")).toBe(true);
    expect(doesOccurrenceStartOn(firstTuesday, "2026-12-08")).toBe(false);
    expect(describeRepeat(firstTuesday)).toBe("매월 첫째 화요일");
  });

  it("repeats on the last weekday of the month", () => {
    // 2026-10-30 is the last (5th) Friday of October.
    const lastFriday = todo({ repeat: "monthly", monthlyMode: "weekday", date: "2026-10-30" });
    expect(listOccurrenceStarts(lastFriday, "2026-11-01", "2027-01-31"))
      .toEqual(["2026-11-27", "2026-12-25", "2027-01-29"]);
  });

  it("repeats yearly, moving Feb 29 to Feb 28", () => {
    const birthday = todo({ repeat: "yearly", date: "2028-02-29" });
    expect(doesOccurrenceStartOn(birthday, "2029-02-28")).toBe(true);
    expect(doesOccurrenceStartOn(birthday, "2032-02-29")).toBe(true);
    expect(describeRepeat(todo({ repeat: "yearly", date: "2026-11-03" }))).toBe("매년 11월 3일");
  });
});

describe("moving a series", () => {
  it("shifts the series bookkeeping with it", () => {
    const daily = todo({
      repeat: "daily",
      exceptions: ["2026-11-04"],
      repeatEndDate: "2026-11-06",
      doneDates: ["2026-11-03"],
    });
    const shifted = shiftTodoToTiming(daily, "2026-11-05", {
      startDate: "2026-11-06",
      endDate: "2026-11-06",
      allDay: false,
      startTime: "10:00",
      endTime: "11:00",
    });

    expect(shifted.startDate).toBe("2026-11-03");
    expect(shifted.repeatEndDate).toBe("2026-11-07");
    expect(shifted.exceptions).toEqual(["2026-11-05"]);
    expect(shifted.doneDates).toEqual(["2026-11-04"]);
    expect(shifted.allDay).toBe(false);
    expect(shifted.startTime).toBe("10:00");
  });

  it("rotates weekly weekdays", () => {
    const monSat = todo({ repeat: "weekly", repeatDays: [1, 6] });
    const shifted = shiftTodoToTiming(monSat, "2026-11-02", { startDate: "2026-11-03", endDate: "2026-11-03", allDay: true });
    expect(shifted.repeatDays).toEqual([2, 0]);
  });
});

describe("calendar events", () => {
  it("marks completed occurrences and keeps feed items read-only", () => {
    const daily = todo({ repeat: "daily", repeatEndDate: "2026-11-05", doneDates: ["2026-11-03"] });
    const events = expandTodos([daily, todo({ id: "f", sourceId: "feed" })], new Date(2026, 10, 1), new Date(2026, 11, 1));

    expect(events.filter(e => e.extendedProps?.todoId === "a")).toHaveLength(4);
    expect(events[1].title).toBe("✓ x");
    expect(events.find(e => e.extendedProps?.todoId === "f")?.editable).toBe(false);
  });
});

describe("delete this and following", () => {
  const weekly = todo({
    repeat: "weekly",
    date: "2026-11-02",
    startDate: "2026-11-02",
    endDate: "2026-11-02",
    exceptions: ["2026-11-09", "2026-11-23"],
    doneDates: ["2026-11-02", "2026-11-30"],
  });

  it("ends the series the day before and drops later bookkeeping", () => {
    const kept = endSeriesBefore(weekly, "2026-11-16");

    expect(kept).toMatchObject({ repeatEndDate: "2026-11-15", exceptions: ["2026-11-09"], doneDates: ["2026-11-02"] });
    expect(listOccurrenceStarts(kept!, "2026-11-01", "2026-12-31")).toEqual(["2026-11-02"]);
  });

  it("keeps an earlier end date", () => {
    expect(endSeriesBefore({ ...weekly, repeatEndDate: "2026-11-10" }, "2026-11-30")?.repeatEndDate).toBe("2026-11-10");
  });

  it("leaves nothing when there is no occurrence before that day", () => {
    expect(endSeriesBefore(weekly, "2026-11-02")).toBeNull();
    // 11/9 is skipped, so 11/16 is the second real occurrence: 11/2 stays.
    expect(endSeriesBefore(weekly, "2026-11-16")).not.toBeNull();
    expect(endSeriesBefore({ ...weekly, exceptions: ["2026-11-02"] }, "2026-11-09")).toBeNull();
  });
});
