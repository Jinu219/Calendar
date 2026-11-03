import { describe, expect, it } from "vitest";
import { colorForCategory, parseInboxEvent, readInboxFiles } from "./inboxUtils";

const labels = { "#a5f3fc": "수업" };

const parse = (raw: unknown) => {
  const result = parseInboxEvent(raw, labels);
  if (!result.ok) throw new Error(result.error);
  return result.input;
};

describe("inbox items", () => {
  it("makes an all-day schedule by default", () => {
    expect(parse({ title: " 대동제 ", date: "2026-11-11", endDate: "2026-11-13" })).toMatchObject({
      title: "대동제",
      date: "2026-11-11",
      options: { kind: "schedule", allDay: true, startDate: "2026-11-11", endDate: "2026-11-13", repeat: "none" },
    });
  });

  it("times a schedule, defaulting to one hour", () => {
    expect(parse({ title: "치과", date: "2026-11-10", time: "15:00" }).options)
      .toMatchObject({ allDay: false, startTime: "15:00", endTime: "16:00" });
  });

  it("gives a todo a due time instead", () => {
    expect(parse({ title: "보고서", date: "2026-11-05", time: "18:00", kind: "todo" }).options)
      .toMatchObject({ kind: "todo", allDay: true, todoTime: "18:00" });
  });

  it("maps repeat, reminder, category and checklist", () => {
    const weekly = parse({
      title: "스터디",
      date: "2026-11-04",
      time: "19:00",
      repeat: "weekly",
      repeatDays: [3, 1, 3],
      repeatUntil: "2026-12-31",
      reminderMinutes: null,
      category: "수업",
    }).options;
    expect(weekly).toMatchObject({ repeat: "weekly", repeatDays: [1, 3], repeatEndDate: "2026-12-31", reminderMinutes: null, color: "#a5f3fc" });

    const steps = parse({ title: "발표 준비", date: "2026-11-06", checklist: ["자료", " ", "리허설"] }).options;
    expect(steps.subtasks?.map(s => s.title)).toEqual(["자료", "리허설"]);
  });

  it.each([
    [{ date: "2026-11-05" }, "title"],
    [{ title: "x", date: "2026-02-30" }, "date"],
    [{ title: "x", date: "2026-11-05", endDate: "2026-11-04" }, "endDate"],
    [{ title: "x", date: "2026-11-05", time: "25:00" }, "time"],
    [{ title: "x", date: "2026-11-05", time: "15:00", endTime: "14:00" }, "endTime"],
    [{ title: "x", date: "2026-11-05", repeatDays: [1] }, "repeatDays"],
    [{ title: "x", date: "2026-11-05", repeat: "daily", checklist: ["a"] }, "checklist"],
    [{ title: "x", date: "2026-11-05", reminderMinutes: -5 }, "reminderMinutes"],
  ])("rejects %j (%s)", (raw, field) => {
    const result = parseInboxEvent(raw, labels);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain(field);
  });

  it("finds categories by the user's label or the color name", () => {
    expect(colorForCategory("수업", labels)).toBe("#a5f3fc");
    expect(colorForCategory("연두", labels)).toBe("#bbf7d0");
    expect(colorForCategory("없는 이름", labels)).toBeUndefined();
  });

  it("skips broken files and items but keeps the rest", () => {
    const { inputs, errors } = readInboxFiles([
      "not json",
      JSON.stringify({ version: 1, items: [{ title: "a", date: "2026-11-05" }, { title: "", date: "2026-11-05" }] }),
    ], labels);

    expect(inputs.map(input => input.title)).toEqual(["a"]);
    expect(errors).toHaveLength(2);
  });
});
