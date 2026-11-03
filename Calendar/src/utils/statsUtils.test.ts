import { describe, expect, it } from "vitest";
import type { Todo } from "../types";
import { getCompletionRate, getHabitStreaks, getWeekStats } from "./statsUtils";
import { getOverdueTodos } from "./todoUtils";

const todo = (patch: Partial<Todo>): Todo => ({
  id: "t",
  date: "2026-11-02",
  title: "x",
  done: false,
  color: "#fff",
  allDay: true,
  repeat: "none",
  sortOrder: 0,
  ...patch,
});

describe("statistics", () => {
  it("counts the week's items per start day", () => {
    const week = getWeekStats([
      todo({ id: "a", date: "2026-11-02", done: true }),
      todo({ id: "b", date: "2026-11-03" }),
      todo({ id: "c", date: "2026-11-03", startDate: "2026-11-03", endDate: "2026-11-05", done: true }),
      todo({ id: "feed", date: "2026-11-03", sourceId: "school" }),
    ], "2026-11-04");

    expect(week.map(day => day.date)[0]).toBe("2026-11-01");
    expect(week[1]).toMatchObject({ total: 1, done: 1 });
    expect(week[2]).toMatchObject({ total: 2, done: 1 });
    expect(week[4]).toMatchObject({ total: 0, future: true });
  });

  it("computes the completion rate over a window", () => {
    expect(getCompletionRate([
      todo({ id: "a", date: "2026-11-02", done: true }),
      todo({ id: "b", date: "2026-11-03" }),
      todo({ id: "old", date: "2026-10-01", done: true }),
    ], "2026-11-04", 7)).toEqual({ done: 1, total: 2 });
  });

  it("tracks habit streaks without breaking on an unfinished today", () => {
    const habit = todo({
      id: "run",
      repeat: "daily",
      date: "2026-10-28",
      doneDates: ["2026-10-29", "2026-10-30", "2026-11-01", "2026-11-02", "2026-11-03"],
    });

    const [streak] = getHabitStreaks([habit], "2026-11-04");
    expect(streak.current).toBe(3);
    expect(streak.best).toBe(3);
    expect(streak.done).toBe(5);
    expect(streak.total).toBe(7);
  });
});

describe("overdue todos", () => {
  it("lists unfinished one-off todos past their deadline", () => {
    const overdue = getOverdueTodos([
      todo({ id: "late", kind: "todo", date: "2026-11-01" }),
      todo({ id: "done", kind: "todo", date: "2026-11-01", done: true }),
      todo({ id: "running", kind: "todo", date: "2026-11-01", endDate: "2026-11-05" }),
      todo({ id: "schedule", kind: "schedule", date: "2026-11-01" }),
    ], "2026-11-04");

    expect(overdue.map(t => t.id)).toEqual(["late"]);
  });
});
