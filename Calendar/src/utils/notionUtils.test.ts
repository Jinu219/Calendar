import { describe, expect, it } from "vitest";
import type { Todo } from "../types";
import {
  buildPageChildren,
  buildPageProperties,
  findTitleProperty,
  fingerprint,
  NotionError,
  parseNotionId,
  planSchemaChanges,
  readNotionResponse,
  selectTodosForExport,
  toNotionDate,
} from "./notionUtils";

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

describe("database ids", () => {
  it.each([
    ["https://www.notion.so/ws/Tasks-1a2b3c4d5e6f708192a3b4c5d6e7f809?v=0123456789abcdef0123456789abcdef", "1a2b3c4d-5e6f-7081-92a3-b4c5d6e7f809"],
    ["1a2b3c4d-5e6f-7081-92a3-b4c5d6e7f809", "1a2b3c4d-5e6f-7081-92a3-b4c5d6e7f809"],
    ["1A2B3C4D5E6F708192A3B4C5D6E7F809", "1a2b3c4d-5e6f-7081-92a3-b4c5d6e7f809"],
  ])("parses %s", (input, expected) => {
    expect(parseNotionId(input)).toBe(expected);
  });

  it("rejects text without an id", () => {
    expect(parseNotionId("https://www.notion.so/my-page")).toBeNull();
  });
});

describe("schema", () => {
  it("finds the title property and plans missing columns", () => {
    const properties = { 이름: { type: "title" }, 날짜: { type: "date" }, 완료: { type: "rich_text" } };

    expect(findTitleProperty(properties)).toBe("이름");
    const plan = planSchemaChanges(properties);
    expect(Object.keys(plan.missing)).toEqual(["종류", "카테고리", "반복", "Calendar ID"]);
    expect(plan.conflicts).toEqual(["완료"]);
  });
});

describe("page properties", () => {
  it("writes all-day ranges as dates and timed items with the local offset", () => {
    expect(toNotionDate(todo({ startDate: "2026-11-03", endDate: "2026-11-05" })))
      .toEqual({ start: "2026-11-03", end: "2026-11-05" });

    const timed = toNotionDate(todo({ allDay: false, startTime: "14:30", endTime: "15:30" }));
    expect(timed.start).toMatch(/^2026-11-03T14:30:00[+-]\d{2}:\d{2}$/);
    expect(timed.end).toMatch(/^2026-11-03T15:30:00/);
  });

  it("maps fields, using category names when set", () => {
    const props = buildPageProperties(
      todo({ kind: "todo", done: true, repeat: "none" }),
      "이름",
      { "#f9a8d4": "수업" }
    );

    expect(props).toMatchObject({
      이름: { title: [{ text: { content: "회의" } }] },
      완료: { checkbox: true },
      종류: { select: { name: "할 일" } },
      카테고리: { select: { name: "수업" } },
      반복: { rich_text: [] },
      "Calendar ID": { rich_text: [{ text: { content: "t1" } }] },
    });
  });

  it("describes a series and never marks it done", () => {
    const props = buildPageProperties(todo({ repeat: "weekly", repeatDays: [1, 3], done: true }), "Name", {});
    expect(props).toMatchObject({ 완료: { checkbox: false }, 반복: { rich_text: [{ text: { content: "매주 월·수" } }] } });
  });

  it("turns the checklist into to-do blocks", () => {
    expect(buildPageChildren(todo({ subtasks: [{ id: "s", title: "자료 찾기", done: true }] })))
      .toEqual([{ object: "block", type: "to_do", to_do: { rich_text: [{ type: "text", text: { content: "자료 찾기" } }], checked: true } }]);
  });

  it("fingerprints identically for identical content", () => {
    expect(fingerprint({ a: 1 })).toBe(fingerprint({ a: 1 }));
    expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 2 }));
  });
});

describe("export scope", () => {
  const items = [
    todo({ id: "past", date: "2026-10-01" }),
    todo({ id: "recent", date: "2026-10-20" }),
    todo({ id: "late-todo", date: "2026-09-01", kind: "todo" }),
    todo({ id: "future", date: "2026-11-10" }),
    todo({ id: "series", date: "2026-01-01", repeat: "daily" }),
    todo({ id: "ended", date: "2026-01-01", repeat: "daily", repeatEndDate: "2026-02-01" }),
    todo({ id: "feed", date: "2026-11-10", sourceId: "school" }),
  ];

  it("keeps upcoming items, ongoing series and unfinished todos", () => {
    expect(selectTodosForExport(items, "upcoming", "2026-11-03").map(t => t.id))
      .toEqual(["late-todo", "future", "series"]);
  });

  it("widens to the last 30 days, and 'all' skips only subscribed items", () => {
    expect(selectTodosForExport(items, "recent", "2026-11-03").map(t => t.id)).toContain("recent");
    expect(selectTodosForExport(items, "all", "2026-11-03")).toHaveLength(6);
  });
});

describe("responses", () => {
  it.each([
    [401, "auth"],
    [403, "forbidden"],
    [404, "not-found"],
    [429, "rate"],
    [400, "invalid"],
    [502, "server"],
  ])("maps HTTP %i to %s", (status, code) => {
    expect(() => readNotionResponse(status, JSON.stringify({ message: "x" })))
      .toThrowError(expect.objectContaining({ code }));
  });

  it("returns the body on success", () => {
    expect(readNotionResponse<{ id: string }>(200, "{\"id\":\"p1\"}").id).toBe("p1");
    expect(() => readNotionResponse(200, "<html>")).toThrowError(NotionError);
  });
});
