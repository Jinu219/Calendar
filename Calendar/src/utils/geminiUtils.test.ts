import { describe, expect, it } from "vitest";
import { buildGeminiRequest, GeminiError, readGeminiResponse } from "./geminiUtils";

const ok = (text: string, finishReason = "STOP") =>
  JSON.stringify({ candidates: [{ finishReason, content: { parts: [{ text }] } }] });

describe("Gemini request", () => {
  it("sends the sentence with today, the selected day and the categories only", () => {
    const body = buildGeminiRequest(" 내일 3시 치과 ", {
      today: "2026-11-03",
      now: "18:20",
      selectedDate: "2026-11-05",
      defaultKind: "schedule",
      categories: ["수업", "하늘"],
    });

    expect(body.contents[0].parts[0].text).toBe(
      "오늘: 2026-11-03 (화) 18:20\n선택한 날짜: 2026-11-05 (목)\n기본 종류: schedule\n카테고리: 수업, 하늘\n문장: 내일 3시 치과"
    );
    expect(body.generationConfig).toMatchObject({ responseMimeType: "application/json" });
    expect(body.generationConfig.responseJsonSchema.required).toEqual(["events"]);
  });
});

describe("Gemini response", () => {
  it("returns the events, dropping nulls and thought parts", () => {
    const body = JSON.stringify({
      candidates: [{
        finishReason: "STOP",
        content: { parts: [{ text: "thinking…", thought: true }, { text: "{\"events\":[{\"title\":\"치과\",\"date\":\"2026-11-04\",\"time\":\"15:00\",\"endDate\":null}]}" }] },
      }],
    });

    expect(readGeminiResponse(200, body)).toEqual([{ title: "치과", date: "2026-11-04", time: "15:00" }]);
  });

  it.each([
    [400, JSON.stringify({ error: { message: "API key not valid. Please pass a valid API key." } }), "auth"],
    [403, "{}", "auth"],
    [404, "{}", "model"],
    [429, JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED" } }), "quota"],
    [503, "{}", "server"],
    [400, JSON.stringify({ error: { message: "Invalid JSON payload" } }), "invalid"],
  ])("maps HTTP %i to %s", (status, body, code) => {
    expect(() => readGeminiResponse(status, body)).toThrowError(expect.objectContaining({ code }));
  });

  it("reports blocked, cut-off and unreadable answers", () => {
    expect(() => readGeminiResponse(200, JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } })))
      .toThrowError(expect.objectContaining({ code: "blocked" }));
    expect(() => readGeminiResponse(200, ok("{\"events\":[", "MAX_TOKENS"))).toThrowError(GeminiError);
    expect(() => readGeminiResponse(200, ok("not json"))).toThrowError(expect.objectContaining({ code: "invalid" }));
    expect(readGeminiResponse(200, ok("{\"events\":[]}"))).toEqual([]);
  });
});
