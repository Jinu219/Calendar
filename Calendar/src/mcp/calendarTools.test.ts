import { describe, expect, it } from "vitest";
import type { Todo } from "../types";
import { listEvents, prepareAdd, TOOLS } from "./calendarTools";

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

describe("add_calendar_events", () => {
  it("summarises every valid item", () => {
    const result = prepareAdd({
      events: [
        { title: "치과", date: "2026-11-10", time: "15:00" },
        { title: "헬스", date: "2026-11-09", time: "07:00", repeat: "weekly", repeatDays: [1, 3, 5], repeatUntil: "2026-12-31" },
      ],
    }, {});

    expect(result).toEqual({
      ok: true,
      items: expect.any(Array),
      summary: ["11/10(화) 15:00 치과", "11/9(월) 07:00 헬스 · 매주 월·수·금 (~12/31(목))"],
    });
  });

  it("adds nothing when any item is invalid, and says what to fix", () => {
    const result = prepareAdd({ events: [{ title: "ok", date: "2026-11-10" }, { title: "bad", date: "11/10" }] }, {});
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain("\"bad\": date");
  });

  it("requires at least one event", () => {
    expect(prepareAdd({}, {}).ok).toBe(false);
  });

  it("declares both tools with object schemas", () => {
    expect(TOOLS.map(tool => tool.name)).toEqual(["add_calendar_events", "list_calendar_events"]);
    expect(TOOLS.every(tool => tool.inputSchema.type === "object")).toBe(true);
  });
});

describe("list_calendar_events", () => {
  const todos = [
    todo({ id: "a", title: "스터디", date: "2026-11-04", allDay: false, startTime: "19:00", endTime: "21:00", repeat: "weekly" }),
    todo({ id: "b", title: "대동제", date: "2026-11-11", startDate: "2026-11-11", endDate: "2026-11-13", color: "#a5f3fc" }),
    todo({ id: "c", title: "구독", date: "2026-11-05", sourceId: "feed" }),
  ];

  it("lists own items per day, a multi-day item once", () => {
    const { text, isError } = listEvents({
      todos,
      args: { from: "2026-11-10", to: "2026-11-13" },
      today: "2026-11-03",
      pending: [{ title: "치과", date: "2026-11-20", time: "15:00" }],
      colorLabels: { "#a5f3fc": "축제" },
    });

    expect(isError).toBe(false);
    expect(text).toContain("오늘: 2026-11-03 (화)");
    expect(text).toContain("카테고리: 분홍, 축제(하늘)");
    expect(text).toContain("2026-11-11 (수)\n  - 종일 대동제 (~11/13(금)) [일정·축제]");
    expect(text.match(/대동제/g)).toHaveLength(1);
    expect(text).toContain("2026-11-11 (수)");
    expect(text).toContain("- 2026-11-20 15:00 치과");
    expect(text).not.toContain("구독");
  });

  it("defaults to two weeks from today and limits the range", () => {
    const { text } = listEvents({ todos, args: {}, today: "2026-11-03", pending: [], colorLabels: {} });
    expect(text).toContain("19:00 – 21:00 스터디 [일정·분홍] · 매주 수");

    expect(listEvents({ todos, args: { from: "2026-01-01", to: "2026-12-31" }, today: "2026-11-03", pending: [], colorLabels: {} }).isError)
      .toBe(true);
  });
});
