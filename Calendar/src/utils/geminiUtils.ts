// ═══════════════════════════════════════════════════════════
// Gemini (Google AI Studio, free tier) — a sentence → calendar items
// ═══════════════════════════════════════════════════════════
//
// Used only when the user presses ✨ or Shift+Enter. A request carries the
// sentence, today's date and time, the selected day and the category names —
// nothing else from the calendar. Requests go through Rust (`gemini_generate`),
// which holds the API key. The answer is validated by parseInboxEvent like
// everything else that adds items from outside.

import type { ItemKind } from "../types";
import { INBOX_MAX_ITEMS, type InboxEventInput } from "./inboxUtils";
import { parseLocalDate } from "./dateUtils";

export type GeminiErrorCode = "auth" | "quota" | "model" | "blocked" | "invalid" | "server" | "network" | "setup";

export class GeminiError extends Error {
  constructor(message: string, public code: GeminiErrorCode, public status = 0) {
    super(message);
  }
}

const WEEKDAYS = "일월화수목금토";

// Optional fields are simply left out by the model (no nulls), so "not said"
// stays distinguishable from a value.
const DATE = { type: "string", format: "date", description: "YYYY-MM-DD" };
const TIME = { type: "string", description: "HH:MM, 24-hour" };

const EVENT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Short title in the user's language, without the date/time words." },
    date: { ...DATE, description: "Start day, YYYY-MM-DD." },
    endDate: { ...DATE, description: "Last day of a multi-day item (inclusive). Only if it spans days." },
    time: { ...TIME, description: "Start time (schedule) or due time (todo), HH:MM 24-hour. Omit for all-day." },
    endTime: { ...TIME, description: "End time, HH:MM 24-hour. Only if said." },
    kind: { type: "string", enum: ["schedule", "todo"] },
    repeat: { type: "string", enum: ["none", "daily", "weekdays", "weekly", "monthly", "yearly"] },
    repeatInterval: { type: "integer", minimum: 1, maximum: 99, description: "Every N periods; 2 = every other." },
    repeatDays: {
      type: "array",
      items: { type: "integer", minimum: 0, maximum: 6 },
      description: "Weekly only: 0=Sunday … 6=Saturday.",
    },
    repeatUntil: { ...DATE, description: "Last day a repeating item may occur." },
    reminderMinutes: { type: "integer", minimum: 0, maximum: 1440, description: "Only if a reminder was asked for." },
    category: { type: "string", description: "One of the given category names, only if clearly meant." },
    checklist: { type: "array", items: { type: "string" }, maxItems: 20, description: "Sub-steps, only for non-repeating items." },
  },
  required: ["title", "date"],
  additionalProperties: false,
};

export const GEMINI_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    events: { type: "array", items: EVENT_SCHEMA, maxItems: INBOX_MAX_ITEMS },
  },
  required: ["events"],
  additionalProperties: false,
};

const SYSTEM_INSTRUCTION = [
  "You turn one sentence (usually Korean) into items for a Korean desktop calendar app.",
  "- Resolve relative dates (내일, 다음 주 화요일, 이번 주말, 15일) against the given today; weeks run Sunday to Saturday.",
  "- A sentence may hold several items (\"월수금 7시 헬스, 금요일 6시 저녁 약속\"): return each one.",
  "- Without a date, use the selected day. Without 오전/오후, 1–6시 means the afternoon.",
  "- kind 'todo' for tasks with a deadline (마감, 제출, ~까지 할 일); otherwise use the default kind.",
  "- Keep titles short and in the user's language; don't repeat the date or time in the title.",
  "- Only include optional fields the sentence actually implies. If there is nothing to schedule, return an empty list.",
].join("\n");

export interface GeminiContext {
  today: string;
  /** "HH:MM" */
  now: string;
  selectedDate: string;
  defaultKind: ItemKind;
  categories: string[];
}

const withWeekday = (date: string) => `${date} (${WEEKDAYS[parseLocalDate(date).getDay()]})`;

/** The generateContent request body. */
export const buildGeminiRequest = (text: string, ctx: GeminiContext) => ({
  systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
  contents: [{
    role: "user",
    parts: [{
      text: [
        `오늘: ${withWeekday(ctx.today)} ${ctx.now}`,
        `선택한 날짜: ${withWeekday(ctx.selectedDate)}`,
        `기본 종류: ${ctx.defaultKind}`,
        `카테고리: ${ctx.categories.join(", ")}`,
        `문장: ${text.trim()}`,
      ].join("\n"),
    }],
  }],
  generationConfig: {
    responseMimeType: "application/json",
    responseJsonSchema: GEMINI_RESPONSE_SCHEMA,
  },
});

interface GeminiErrorBody {
  error?: { message?: string; status?: string; details?: { reason?: string }[] };
}

interface GeminiBody {
  promptFeedback?: { blockReason?: string };
  candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
}

/** Drop nulls, so optional fields the model filled with null count as "not said". */
const withoutNulls = (value: unknown): unknown =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).filter(([, v]) => v !== null))
    : value;

/** The items from a generateContent response, or a GeminiError explaining what went wrong. */
export const readGeminiResponse = (status: number, body: string): InboxEventInput[] => {
  let json: GeminiBody & GeminiErrorBody = {};
  try {
    json = body ? JSON.parse(body) : {};
  } catch {
    // Not JSON (a proxy page?): handled by the status below.
  }

  if (status < 200 || status >= 300) {
    const message = json.error?.message ?? "";
    const badKey = /API key|API_KEY/i.test(message) || json.error?.details?.some(d => d.reason === "API_KEY_INVALID");

    if ((status === 400 && badKey) || status === 401) {
      throw new GeminiError("Gemini API 키가 올바르지 않아요. 설정에서 다시 저장해 주세요.", "auth", status);
    }
    if (status === 403) throw new GeminiError("이 키로는 Gemini를 쓸 수 없어요. AI Studio에서 새 키를 만들어 주세요.", "auth", status);
    if (status === 404) throw new GeminiError("선택한 Gemini 모델을 찾을 수 없어요. 설정에서 다른 모델을 골라 주세요.", "model", status);
    if (status === 429) {
      throw new GeminiError("Gemini 무료 한도에 걸렸어요. 잠시 후(하루 한도라면 내일) 다시 해 주세요. Enter 입력은 계속 쓸 수 있어요.", "quota", status);
    }
    if (status >= 500) throw new GeminiError("Gemini 서버가 바빠요. 잠시 후 다시 해 주세요.", "server", status);
    throw new GeminiError(`Gemini 요청 실패: ${message || status}`, "invalid", status);
  }

  if (json.promptFeedback?.blockReason) {
    throw new GeminiError("Gemini가 이 문장을 처리하지 않았어요. 표현을 바꿔 보세요.", "blocked", status);
  }

  const candidate = json.candidates?.[0];
  if (!candidate) throw new GeminiError("Gemini 응답이 비어 있어요.", "invalid", status);
  if (candidate.finishReason && candidate.finishReason !== "STOP") {
    throw candidate.finishReason === "MAX_TOKENS"
      ? new GeminiError("Gemini 응답이 중간에 끊겼어요. 문장을 나눠서 해 보세요.", "invalid", status)
      : new GeminiError("Gemini가 이 문장을 처리하지 않았어요. 표현을 바꿔 보세요.", "blocked", status);
  }

  const text = (candidate.content?.parts ?? []).filter(part => !part.thought).map(part => part.text ?? "").join("");

  let parsed: { events?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GeminiError("Gemini 응답을 읽지 못했어요.", "invalid", status);
  }

  if (!Array.isArray(parsed.events)) throw new GeminiError("Gemini 응답 형식이 달라요.", "invalid", status);
  return parsed.events.slice(0, INBOX_MAX_ITEMS).map(withoutNulls) as InboxEventInput[];
};
