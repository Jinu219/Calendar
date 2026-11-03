// ═══════════════════════════════════════════════════════════
// Claude API — prompts, request bodies and response handling
// ═══════════════════════════════════════════════════════════
//
// Pure functions only: the network call itself happens in Rust (useClaude
// hook → `claude_messages` command) so the API key never enters the WebView.
// Everything Claude returns is validated here before it touches app state.

import type { ClaudeModelId, EventFormData, ItemKind, MonthlyMode, RepeatType } from "../types";
import { CLAUDE_MODELS } from "../constants";
import { getDefaultEndTime } from "./todoUtils";
import { parseLocalDate, timeToMinutes } from "./dateUtils";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const REPEAT_VALUES: RepeatType[] = ["none", "daily", "weekdays", "weekly", "monthly", "yearly"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export type ClaudeErrorCode =
  | "no-key"
  | "auth"
  | "rate"
  | "overloaded"
  | "refusal"
  | "truncated"
  | "network"
  | "bad-response"
  | "other";

export class ClaudeError extends Error {
  constructor(message: string, public code: ClaudeErrorCode) {
    super(message);
  }
}

export interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface ClaudeResult {
  text: string;
  model: string;
  usage: ClaudeUsage;
}

interface RequestOptions {
  model: ClaudeModelId;
  system: string;
  user: string;
  maxTokens: number;
  /** Structured output: the reply's text is JSON matching this schema. */
  schema?: Record<string, unknown>;
}

export const supportsFallback = (model: ClaudeModelId): boolean =>
  CLAUDE_MODELS.find(m => m.id === model)?.fallback ?? false;

/**
 * Messages API body. These are short, well-specified tasks, so effort is low
 * (Opus 5.5 always thinks; effort is the only dial). No `temperature`: API
 * version 2026-10-21 rejects it.
 */
export const buildClaudeRequest = ({ model, system, user, maxTokens, schema }: RequestOptions) => ({
  model,
  max_tokens: maxTokens,
  system,
  messages: [{ role: "user", content: user }],
  output_config: {
    effort: "low",
    ...(schema ? { format: { type: "json_schema", schema } } : {}),
  },
  // On a safety decline, Anthropic re-runs the request on its recommended fallback model.
  ...(supportsFallback(model) ? { fallbacks: "default" } : {}),
});

const describeHttpError = (status: number, apiMessage?: string): ClaudeError => {
  if (status === 401 || status === 403) {
    return new ClaudeError("API 키가 올바르지 않거나 권한이 없어요. 설정에서 키를 다시 저장해 주세요.", "auth");
  }
  if (status === 429) {
    return new ClaudeError("요청이 너무 많거나 크레딧이 부족해요. 잠시 후 다시 해 주세요.", "rate");
  }
  if (status === 529 || status === 503) {
    return new ClaudeError("Claude 서버가 바빠요. 잠시 후 다시 해 주세요.", "overloaded");
  }

  return new ClaudeError(`Claude 요청 실패 (${status})${apiMessage ? `: ${apiMessage}` : ""}`, "other");
};

/** Turn an HTTP status + body into the reply text, or a user-readable error. */
export const readClaudeResponse = (status: number, body: string): ClaudeResult => {
  let json: {
    content?: { type: string; text?: string }[];
    stop_reason?: string;
    model?: string;
    usage?: Partial<ClaudeUsage>;
    error?: { message?: string };
  };

  try {
    json = JSON.parse(body);
  } catch {
    throw status === 200
      ? new ClaudeError("Claude 응답을 읽지 못했어요.", "bad-response")
      : describeHttpError(status);
  }

  if (status !== 200) throw describeHttpError(status, json.error?.message);

  // Check the stop reason before reading content.
  if (json.stop_reason === "refusal") {
    throw new ClaudeError("Claude가 이 요청은 처리하지 않았어요. 표현을 바꿔 다시 해 보세요.", "refusal");
  }
  if (json.stop_reason === "max_tokens") {
    throw new ClaudeError("응답이 너무 길어 중간에 끊겼어요. 다시 해 주세요.", "truncated");
  }

  const text = (json.content ?? [])
    .filter(block => block.type === "text" && typeof block.text === "string")
    .map(block => block.text)
    .join("")
    .trim();

  if (!text) throw new ClaudeError("Claude가 빈 응답을 보냈어요.", "bad-response");

  return {
    text,
    model: json.model ?? "",
    usage: {
      input_tokens: json.usage?.input_tokens ?? 0,
      output_tokens: json.usage?.output_tokens ?? 0,
    },
  };
};

export const parseJsonReply = <T,>(text: string): T => {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ClaudeError("Claude 응답 형식이 올바르지 않아요.", "bad-response");
  }
};

/** Estimated cost in USD of one call (thinking tokens are included in output). */
export const estimateCostUsd = (model: ClaudeModelId, usage: ClaudeUsage): number => {
  const prices = CLAUDE_MODELS.find(m => m.id === model) ?? CLAUDE_MODELS[0];
  return (usage.input_tokens * prices.inputPerMTok + usage.output_tokens * prices.outputPerMTok) / 1_000_000;
};

// ───────────────────────────────────────────────────────────
// 1. A sentence → an item draft
// ───────────────────────────────────────────────────────────

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });

export const EVENT_DRAFT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    kind: { type: "string", enum: ["schedule", "todo"] },
    startDate: { type: "string", format: "date" },
    endDate: { type: "string", format: "date" },
    allDay: { type: "boolean" },
    startTime: nullable({ type: "string" }),
    endTime: nullable({ type: "string" }),
    repeat: { type: "string", enum: REPEAT_VALUES },
    repeatInterval: { type: "integer" },
    repeatDays: { type: "array", items: { type: "integer" } },
    monthlyMode: { type: "string", enum: ["date", "weekday"] },
    repeatEndDate: nullable({ type: "string", format: "date" }),
    reminderMinutes: nullable({ type: "integer" }),
  },
  required: [
    "title", "kind", "startDate", "endDate", "allDay", "startTime", "endTime",
    "repeat", "repeatInterval", "repeatDays", "monthlyMode", "repeatEndDate", "reminderMinutes",
  ],
  additionalProperties: false,
};

export interface EventParseContext {
  today: string;
  /** Current local time, "HH:MM". */
  now: string;
  selectedDate: string;
  defaultKind: ItemKind;
}

export const EVENT_PARSE_SYSTEM = [
  "당신은 한국어 캘린더 앱의 입력 도우미입니다. 사용자가 적은 한 줄을 일정 하나로 바꿔, 주어진 JSON 스키마로만 답합니다.",
  "",
  "규칙:",
  "- 날짜는 '오늘' 기준으로 해석합니다: 내일, 모레, 이번 주 금요일, 다음 주 화요일(다음 주 = 이번 주의 다음 주, 한 주는 월요일에 시작), 이번 달 말일 등. 연도가 없으면 오늘 이후로 가장 가까운 날짜입니다.",
  "- 날짜 표현이 전혀 없으면 '선택한 날짜'를 씁니다.",
  "- 'N일부터 M일까지'처럼 여러 날이면 startDate~endDate, 하루면 둘을 같게 둡니다.",
  "- 시각이 있으면 allDay=false, startTime/endTime은 24시간제 HH:MM입니다. 끝 시각이 없으면 1시간짜리입니다. 오전/오후 없이 1~6시면 오후로 봅니다(아침·새벽 같은 말이 있으면 오전).",
  "- 시각이 없으면 allDay=true, startTime/endTime은 null입니다.",
  "- '~까지', '마감', '제출' 같은 마감은 kind=\"todo\", allDay=true, startDate=오늘(마감일이 오늘보다 앞이면 마감일), endDate=마감일입니다. 그 외에는 '기본 종류'를 따릅니다.",
  "- 반복: 매일=daily, 평일=weekdays, 매주 월·수=weekly + repeatDays [1,3] (0=일요일 … 6=토요일), 격주=weekly + repeatInterval 2, 매월 15일=monthly + monthlyMode \"date\", 매월 첫째 월요일=monthly + monthlyMode \"weekday\", 매년=yearly. startDate는 첫 회차 날짜입니다.",
  "- 반복이 아니면 repeat=\"none\", repeatInterval=1, repeatDays=[], monthlyMode=\"date\"입니다. 반복 끝('12월까지')은 repeatEndDate, 없으면 null입니다.",
  "- '30분 전 알림'처럼 알림 말이 있으면 reminderMinutes(분), 없으면 null입니다.",
  "- title은 날짜·시각·반복·알림 표현을 뺀 짧은 제목입니다.",
].join("\n");

export const buildEventParseUser = (text: string, context: EventParseContext): string => {
  const weekday = WEEKDAYS[parseLocalDate(context.today).getDay()];

  return [
    `오늘: ${context.today} (${weekday}요일), 지금 ${context.now}, 시간대 Asia/Seoul`,
    `선택한 날짜: ${context.selectedDate}`,
    `기본 종류: ${context.defaultKind === "todo" ? "todo (할 일)" : "schedule (일정)"}`,
    "",
    `입력: ${text}`,
  ].join("\n");
};

const isValidDate = (value: unknown): value is string =>
  typeof value === "string" && DATE_RE.test(value) && !Number.isNaN(parseLocalDate(value).getTime());

/**
 * A safe form draft from Claude's JSON: anything malformed falls back to a
 * sensible default instead of reaching the form. The user still reviews it.
 */
export const toEventDraft = (raw: unknown, context: EventParseContext): Partial<EventFormData> => {
  const value = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const title = typeof value.title === "string" ? value.title.trim() : "";

  if (!title) throw new ClaudeError("일정 제목을 찾지 못했어요. 조금 더 자세히 적어 주세요.", "bad-response");

  const startDate = isValidDate(value.startDate) ? value.startDate : context.selectedDate;
  const endDate = isValidDate(value.endDate) && value.endDate >= startDate ? value.endDate : startDate;
  const kind: ItemKind = value.kind === "todo" ? "todo" : value.kind === "schedule" ? "schedule" : context.defaultKind;

  let startTime = typeof value.startTime === "string" && TIME_RE.test(value.startTime) ? value.startTime : undefined;
  let endTime = typeof value.endTime === "string" && TIME_RE.test(value.endTime) ? value.endTime : undefined;
  const allDay = kind === "todo" || value.allDay !== false || !startTime;

  if (!allDay && startTime) {
    if (!endTime || (endDate === startDate && timeToMinutes(endTime) <= timeToMinutes(startTime))) {
      endTime = getDefaultEndTime(startTime);
    }
  } else {
    startTime = undefined;
    endTime = undefined;
  }

  const repeat = REPEAT_VALUES.includes(value.repeat as RepeatType) ? value.repeat as RepeatType : "none";
  const repeatDays = Array.isArray(value.repeatDays)
    ? [...new Set(value.repeatDays.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    : [];
  const interval = typeof value.repeatInterval === "number" && Number.isInteger(value.repeatInterval)
    ? Math.min(99, Math.max(1, value.repeatInterval))
    : 1;
  const monthlyMode: MonthlyMode = value.monthlyMode === "weekday" ? "weekday" : "date";
  const reminder = typeof value.reminderMinutes === "number" && value.reminderMinutes >= 0
    ? Math.round(value.reminderMinutes)
    : undefined;

  return {
    title,
    kind,
    date: startDate,
    startDate,
    endDate,
    allDay,
    ...(startTime && endTime ? { startTime, endTime } : {}),
    repeat,
    repeatInterval: repeat === "none" ? 1 : interval,
    repeatDays: repeat === "weekly" && repeatDays.length > 0 ? repeatDays : [parseLocalDate(startDate).getDay()],
    monthlyMode,
    repeatEndDate: repeat !== "none" && isValidDate(value.repeatEndDate) && value.repeatEndDate >= startDate
      ? value.repeatEndDate
      : "",
    ...(reminder !== undefined ? { reminder } : {}),
  };
};

// ───────────────────────────────────────────────────────────
// 2. An item → checklist steps
// ───────────────────────────────────────────────────────────

export const SUBTASKS_SCHEMA = {
  type: "object",
  properties: { steps: { type: "array", items: { type: "string" } } },
  required: ["steps"],
  additionalProperties: false,
};

export const SUBTASKS_SYSTEM = [
  "당신은 할 일을 실행 가능한 단계로 나누는 도우미입니다. 주어진 JSON 스키마로만 답합니다.",
  "- 3~7개의 단계를 순서대로 씁니다.",
  "- 각 단계는 한국어로 20자 안팎, '~하기'처럼 바로 할 수 있는 행동으로 씁니다.",
  "- 이미 있는 단계는 다시 쓰지 않습니다.",
].join("\n");

export const buildSubtasksUser = (title: string, dueDate: string, existing: string[]): string => [
  `할 일: ${title}`,
  `마감: ${dueDate}`,
  existing.length > 0 ? `이미 있는 단계: ${existing.join(" / ")}` : "이미 있는 단계: 없음",
].join("\n");

export const toSubtaskTitles = (raw: unknown, existing: string[]): string[] => {
  const steps = (raw as { steps?: unknown })?.steps;
  if (!Array.isArray(steps)) throw new ClaudeError("단계 목록을 받지 못했어요.", "bad-response");

  const seen = new Set(existing.map(s => s.trim()));

  return steps
    .filter((s): s is string => typeof s === "string")
    .map(s => s.trim().replace(/^[-•\d.)\s]+/, ""))
    .filter(s => s && !seen.has(s) && seen.add(s))
    .slice(0, 10);
};

// ───────────────────────────────────────────────────────────
// 3. Today's briefing
// ───────────────────────────────────────────────────────────

export const BRIEFING_SYSTEM = [
  "당신은 개인 비서입니다. 사용자의 일정 목록을 보고 오늘 아침 브리핑을 한국어로 씁니다.",
  "- 5~8줄. 첫 줄은 오늘을 한 문장으로 요약합니다.",
  "- 이어지는 줄은 '• '로 시작합니다: 오늘 할 일(시간순), 놓치기 쉬운 마감·지난 할 일, 이번 주에 바쁜 날, 마지막으로 실천할 만한 제안 한 가지.",
  "- 목록에 없는 일정을 지어내지 않습니다. 마크다운 제목·굵게·표는 쓰지 않습니다.",
].join("\n");

export interface BriefingItem {
  date: string;
  time?: string;
  title: string;
  kind: ItemKind;
  done: boolean;
  repeat?: string;
}

export const buildBriefingUser = (input: {
  today: string;
  now: string;
  todayItems: BriefingItem[];
  weekItems: BriefingItem[];
  overdue: BriefingItem[];
  streaks: { title: string; current: number }[];
}): string => {
  const line = (item: BriefingItem) =>
    `- ${item.date}${item.time ? ` ${item.time}` : ""} [${item.kind === "todo" ? "할 일" : "일정"}${item.done ? ", 완료" : ""}${item.repeat ? `, ${item.repeat}` : ""}] ${item.title}`;
  const section = (title: string, items: string[]) =>
    [title, ...(items.length > 0 ? items : ["- 없음"])].join("\n");

  return [
    `오늘: ${input.today} (${WEEKDAYS[parseLocalDate(input.today).getDay()]}요일), 지금 ${input.now}`,
    section("오늘 일정:", input.todayItems.map(line)),
    section("앞으로 7일:", input.weekItems.map(line)),
    section("지난 할 일(미완료):", input.overdue.map(line)),
    section("반복 습관 연속 기록:", input.streaks.map(s => `- ${s.title}: ${s.current}회 연속`)),
  ].join("\n\n");
};
