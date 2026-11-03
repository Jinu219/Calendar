// ═══════════════════════════════════════════════════════════
// Notion export — database schema, page properties, response handling
// ═══════════════════════════════════════════════════════════
//
// One-way export: each own item becomes one page in the user's database and
// is updated in place on later exports. Pure functions only; requests go
// through Rust (`notion_request`), which holds the integration token.

import type { Todo } from "../types";
import { COLOR_NAMES } from "../constants";
import { getTodoStartDate, describeRepeat } from "./todoUtils";
import { parseLocalDate, shiftDate } from "./dateUtils";

/** Property names the export writes (created in the database when missing). */
export const NOTION_PROPS = {
  date: "날짜",
  done: "완료",
  kind: "종류",
  category: "카테고리",
  repeat: "반복",
  id: "Calendar ID",
} as const;

const REQUIRED_SCHEMA: Record<string, { type: string; schema: Record<string, unknown> }> = {
  [NOTION_PROPS.date]: { type: "date", schema: { date: {} } },
  [NOTION_PROPS.done]: { type: "checkbox", schema: { checkbox: {} } },
  [NOTION_PROPS.kind]: { type: "select", schema: { select: { options: [{ name: "일정" }, { name: "할 일" }] } } },
  [NOTION_PROPS.category]: { type: "select", schema: { select: { options: [] } } },
  [NOTION_PROPS.repeat]: { type: "rich_text", schema: { rich_text: {} } },
  [NOTION_PROPS.id]: { type: "rich_text", schema: { rich_text: {} } },
};

export type NotionExportScope = "upcoming" | "recent" | "all";

export type NotionErrorCode = "auth" | "forbidden" | "not-found" | "rate" | "invalid" | "server" | "network" | "setup";

export class NotionError extends Error {
  constructor(message: string, public code: NotionErrorCode, public status = 0) {
    super(message);
  }
}

/**
 * The database id from whatever the user pasted: a full URL (with or without
 * the `?v=` view id), a dashed UUID, or 32 hex characters.
 */
export const parseNotionId = (input: string): string | null => {
  const withoutQuery = input.trim().split(/[?#]/)[0];
  const matches = withoutQuery.replace(/-/g, "").match(/[0-9a-f]{32}/gi);
  const hex = matches?.[matches.length - 1]?.toLowerCase();

  return hex
    ? `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    : null;
};

type NotionProperties = Record<string, { type?: string }>;

export const findTitleProperty = (properties: NotionProperties): string | null =>
  Object.entries(properties).find(([, prop]) => prop.type === "title")?.[0] ?? null;

/** Properties to add, and same-named properties of the wrong type (the user must rename those). */
export const planSchemaChanges = (properties: NotionProperties) => {
  const missing: Record<string, Record<string, unknown>> = {};
  const conflicts: string[] = [];

  for (const [name, { type, schema }] of Object.entries(REQUIRED_SCHEMA)) {
    const existing = properties[name];
    if (!existing) missing[name] = schema;
    else if (existing.type !== type) conflicts.push(name);
  }

  return { missing, conflicts };
};

/** "+09:00" for the local time zone on that date. */
const offsetOf = (dateStr: string): string => {
  const minutes = -parseLocalDate(dateStr).getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
};

export const toNotionDate = (todo: Todo): { start: string; end: string | null } => {
  const startDate = getTodoStartDate(todo);
  const endDate = todo.endDate && todo.endDate > startDate ? todo.endDate : startDate;

  if (todo.allDay || !todo.startTime) {
    return { start: startDate, end: endDate !== startDate ? endDate : null };
  }

  return {
    start: `${startDate}T${todo.startTime}:00${offsetOf(startDate)}`,
    end: todo.endTime ? `${endDate}T${todo.endTime}:00${offsetOf(endDate)}` : null,
  };
};

const text = (content: string) => [{ type: "text", text: { content: content.slice(0, 2000) } }];

export const buildPageProperties = (
  todo: Todo,
  titleProperty: string,
  colorLabels: Record<string, string>
): Record<string, unknown> => {
  const category = colorLabels[todo.color] || COLOR_NAMES[todo.color];

  return {
    [titleProperty]: { title: text(todo.title) },
    [NOTION_PROPS.date]: { date: toNotionDate(todo) },
    // A series has no single done state; per-occurrence completion stays in the app.
    [NOTION_PROPS.done]: { checkbox: todo.repeat === "none" && todo.done },
    [NOTION_PROPS.kind]: { select: { name: todo.kind === "todo" ? "할 일" : "일정" } },
    [NOTION_PROPS.category]: { select: category ? { name: category } : null },
    [NOTION_PROPS.repeat]: { rich_text: todo.repeat === "none" ? [] : text(describeRepeat(todo)) },
    [NOTION_PROPS.id]: { rich_text: text(todo.id) },
  };
};

/** The checklist as to-do blocks; written once, when the page is created. */
export const buildPageChildren = (todo: Todo) =>
  (todo.subtasks ?? []).map(subtask => ({
    object: "block",
    type: "to_do",
    to_do: { rich_text: text(subtask.title), checked: subtask.done },
  }));

/** Short stable hash, so unchanged items aren't sent again. */
export const fingerprint = (value: unknown): string => {
  const json = JSON.stringify(value);
  let hash = 5381;
  for (let i = 0; i < json.length; i++) hash = ((hash << 5) + hash + json.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
};

/** Own items worth exporting for the chosen scope (subscribed calendars are skipped). */
export const selectTodosForExport = (todos: Todo[], scope: NotionExportScope, today: string): Todo[] => {
  const own = todos.filter(todo => !todo.sourceId);
  if (scope === "all") return own;

  const from = scope === "recent" ? shiftDate(today, -30) : today;

  return own.filter(todo => {
    if (todo.repeat !== "none") return !todo.repeatEndDate || todo.repeatEndDate >= from;

    const end = todo.endDate || getTodoStartDate(todo);
    // Unfinished todos stay relevant until they're done, however late.
    return end >= from || (todo.kind === "todo" && !todo.done);
  });
};

export const readNotionResponse = <T,>(status: number, body: string): T => {
  let json: { message?: string } & Record<string, unknown> = {};

  try {
    json = body ? JSON.parse(body) : {};
  } catch {
    if (status >= 200 && status < 300) throw new NotionError("Notion 응답을 읽지 못했어요.", "invalid", status);
  }

  if (status >= 200 && status < 300) return json as T;

  switch (status) {
    case 401:
      throw new NotionError("Notion 토큰이 올바르지 않아요. 설정에서 다시 저장해 주세요.", "auth", status);
    case 403:
      throw new NotionError("이 통합에 쓰기 권한이 없어요. 통합 설정에서 콘텐츠 입력 권한을 켜 주세요.", "forbidden", status);
    case 404:
      throw new NotionError(
        "데이터베이스나 페이지를 찾을 수 없어요. 데이터베이스 ··· → 연결에서 이 통합을 추가했는지 확인해 주세요.",
        "not-found",
        status
      );
    case 429:
      throw new NotionError("Notion 요청이 너무 많아요. 잠시 후 다시 해 주세요.", "rate", status);
    default:
      throw status >= 500
        ? new NotionError("Notion 서버에 문제가 있어요. 잠시 후 다시 해 주세요.", "server", status)
        : new NotionError(`Notion 요청 실패: ${json.message ?? status}`, "invalid", status);
  }
};

export const notionTitleOf = (database: { title?: { plain_text?: string }[] }): string =>
  database.title?.map(part => part.plain_text ?? "").join("").trim() || "(제목 없는 데이터베이스)";
