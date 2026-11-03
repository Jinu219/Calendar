import { describe, expect, it } from "vitest";
import {
  buildClaudeRequest,
  ClaudeError,
  estimateCostUsd,
  readClaudeResponse,
  toEventDraft,
  toSubtaskTitles,
} from "./claudeUtils";

const context = { today: "2026-11-03", now: "10:00", selectedDate: "2026-11-05", defaultKind: "schedule" as const };

describe("request bodies", () => {
  it("asks for low effort, structured output and fallback on Opus", () => {
    const body = buildClaudeRequest({
      model: "claude-opus-5-5",
      system: "s",
      user: "u",
      maxTokens: 4000,
      schema: { type: "object" },
    });

    expect(body).toMatchObject({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      messages: [{ role: "user", content: "u" }],
      output_config: { effort: "low", format: { type: "json_schema", schema: { type: "object" } } },
      fallbacks: "default",
    });
    expect(body).not.toHaveProperty("temperature");
  });

  it("omits server-side fallback for Haiku", () => {
    const body = buildClaudeRequest({ model: "claude-haiku-5-5", system: "s", user: "u", maxTokens: 100 });
    expect(body).not.toHaveProperty("fallbacks");
    expect(body.output_config).not.toHaveProperty("format");
  });
});

describe("responses", () => {
  const ok = (content: unknown[], stop = "end_turn") =>
    JSON.stringify({ model: "claude-opus-5-5", stop_reason: stop, content, usage: { input_tokens: 500, output_tokens: 200 } });

  it("reads the text blocks and skips thinking blocks", () => {
    const result = readClaudeResponse(200, ok([{ type: "thinking", thinking: "" }, { type: "text", text: "{\"a\":1}" }]));
    expect(result.text).toBe("{\"a\":1}");
    expect(result.usage).toEqual({ input_tokens: 500, output_tokens: 200 });
  });

  it.each([
    [401, "auth"],
    [429, "rate"],
    [529, "overloaded"],
    [400, "other"],
  ])("maps HTTP %i to %s", (status, code) => {
    expect(() => readClaudeResponse(status, JSON.stringify({ error: { message: "x" } })))
      .toThrowError(expect.objectContaining({ code }));
  });

  it("treats refusals and truncation as errors", () => {
    expect(() => readClaudeResponse(200, ok([], "refusal"))).toThrowError(ClaudeError);
    expect(() => readClaudeResponse(200, ok([{ type: "text", text: "{" }], "max_tokens")))
      .toThrowError(expect.objectContaining({ code: "truncated" }));
  });

  it("estimates cost from token usage", () => {
    expect(estimateCostUsd("claude-opus-5-5", { input_tokens: 1_000_000, output_tokens: 100_000 })).toBeCloseTo(6);
    expect(estimateCostUsd("claude-haiku-5-5", { input_tokens: 1_000_000, output_tokens: 0 })).toBeCloseTo(0.1);
  });
});

describe("event drafts", () => {
  it("keeps a valid timed weekly draft", () => {
    expect(toEventDraft({
      title: "치과",
      kind: "schedule",
      startDate: "2026-11-10",
      endDate: "2026-11-10",
      allDay: false,
      startTime: "15:00",
      endTime: "16:00",
      repeat: "weekly",
      repeatInterval: 2,
      repeatDays: [2],
      monthlyMode: "date",
      repeatEndDate: "2026-12-31",
      reminderMinutes: 30,
    }, context)).toMatchObject({
      title: "치과",
      startDate: "2026-11-10",
      allDay: false,
      startTime: "15:00",
      endTime: "16:00",
      repeat: "weekly",
      repeatInterval: 2,
      repeatDays: [2],
      repeatEndDate: "2026-12-31",
      reminder: 30,
    });
  });

  it("repairs malformed fields instead of passing them on", () => {
    const draft = toEventDraft({
      title: "  회의 ",
      kind: "meeting",
      startDate: "next tuesday",
      endDate: "2026-11-01",
      allDay: false,
      startTime: "25:00",
      endTime: null,
      repeat: "hourly",
      repeatInterval: 0,
      repeatDays: [9],
      monthlyMode: "x",
      repeatEndDate: "bad",
      reminderMinutes: -5,
    }, context);

    expect(draft).toMatchObject({
      title: "회의",
      kind: "schedule",
      startDate: "2026-11-05",
      endDate: "2026-11-05",
      allDay: true,
      repeat: "none",
      repeatInterval: 1,
      repeatEndDate: "",
    });
    expect(draft).not.toHaveProperty("startTime");
    expect(draft).not.toHaveProperty("reminder");
  });

  it("fixes an end time that isn't after the start", () => {
    const draft = toEventDraft({
      title: "스터디", kind: "schedule", startDate: "2026-11-05", endDate: "2026-11-05", allDay: false,
      startTime: "14:00", endTime: "13:00", repeat: "none", repeatInterval: 1, repeatDays: [],
      monthlyMode: "date", repeatEndDate: null, reminderMinutes: null,
    }, context);

    expect(draft.endTime).toBe("15:00");
  });

  it("requires a title", () => {
    expect(() => toEventDraft({ title: " " }, context)).toThrowError(ClaudeError);
  });
});

describe("subtask suggestions", () => {
  it("cleans bullets and drops duplicates", () => {
    expect(toSubtaskTitles({ steps: ["1. 자료 찾기", "- 개요 쓰기", "자료 찾기", "", "초안 쓰기"] }, ["초안 쓰기"]))
      .toEqual(["자료 찾기", "개요 쓰기"]);
  });
});
