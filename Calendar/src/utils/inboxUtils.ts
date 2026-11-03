// ═══════════════════════════════════════════════════════════
// Inbox — items Claude adds from a conversation
// ═══════════════════════════════════════════════════════════
//
// The MCP server (mcp/server.mjs) validates Claude's request with these same
// functions and drops one JSON file per request into `<app data>/inbox/`. The
// running app takes the files (Rust `take_inbox`), validates again and adds the
// items as one undo step. Pure: no React, no Tauri.

import type { AddTodoOptions, ItemKind, RepeatType } from "../types";
import { COLOR_NAMES, TODO_COLORS } from "../constants";
import { createId } from "./idUtils";
import { parseLocalDate, timeToMinutes } from "./dateUtils";
import { getDefaultEndTime } from "./todoUtils";

export const INBOX_VERSION = 1;
export const INBOX_MAX_ITEMS = 20;

/** One item as Claude sends it (the MCP tool's input, and an inbox file's item). */
export interface InboxEventInput {
  title: string;
  /** Start day, YYYY-MM-DD. */
  date: string;
  /** Last day of a multi-day item (inclusive). */
  endDate?: string;
  /** HH:MM. A schedule's start time, or a todo's due time. Omit for all-day. */
  time?: string;
  endTime?: string;
  kind?: ItemKind;
  repeat?: RepeatType;
  /** Every N days/weeks/months/years (2 = 격주). */
  repeatInterval?: number;
  /** Weekly rules: 0 = Sunday … 6 = Saturday. */
  repeatDays?: number[];
  repeatUntil?: string;
  /** null = no reminder; omitted = the user's default. */
  reminderMinutes?: number | null;
  /** A category name the user gave a color (or the color's own name). */
  category?: string;
  checklist?: string[];
}

export interface InboxFile {
  version: number;
  createdAt: string;
  items: InboxEventInput[];
}

/** Same shape as useTodos' NewTodoInput. */
export interface InboxTodoInput {
  title: string;
  date: string;
  options: AddTodoOptions;
}

export type InboxParseResult = { ok: true; input: InboxTodoInput } | { ok: false; error: string };

const REPEATS: RepeatType[] = ["none", "daily", "weekdays", "weekly", "monthly", "yearly"];
const MAX_TITLE = 200;

const isDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = parseLocalDate(value);
  return !Number.isNaN(d.getTime()) && d.getDate() === Number(value.slice(8));
};

const isTime = (value: unknown): value is string =>
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

/** Color for a category name: the user's own labels first, then the color names. */
export const colorForCategory = (name: string | undefined, colorLabels: Record<string, string>): string | undefined => {
  const wanted = name?.trim().toLowerCase();
  if (!wanted) return undefined;

  const byLabel = Object.entries(colorLabels).find(([, label]) => label.trim().toLowerCase() === wanted);
  if (byLabel) return byLabel[0];

  return TODO_COLORS.find(color => COLOR_NAMES[color] === name?.trim());
};

/** Check one item and turn it into what `addTodos` takes. Errors are in Korean for the chat. */
export const parseInboxEvent = (raw: unknown, colorLabels: Record<string, string>): InboxParseResult => {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "일정 형식이 아니에요." };
  const e = raw as Record<string, unknown>;
  const fail = (error: string): InboxParseResult => ({ ok: false, error });

  const title = typeof e.title === "string" ? e.title.trim() : "";
  if (!title) return fail("title(제목)이 비어 있어요.");
  if (title.length > MAX_TITLE) return fail(`제목은 ${MAX_TITLE}자까지예요.`);

  if (!isDate(e.date)) return fail(`"${title}": date는 YYYY-MM-DD 형식의 실제 날짜여야 해요.`);
  const date = e.date;

  if (e.endDate !== undefined && !isDate(e.endDate)) return fail(`"${title}": endDate는 YYYY-MM-DD 형식이어야 해요.`);
  const endDate = (e.endDate as string | undefined) ?? date;
  if (endDate < date) return fail(`"${title}": endDate가 date보다 빨라요.`);

  const kind: ItemKind = e.kind === "todo" ? "todo" : "schedule";
  if (e.kind !== undefined && e.kind !== "todo" && e.kind !== "schedule") return fail(`"${title}": kind는 schedule 또는 todo예요.`);

  if (e.time !== undefined && !isTime(e.time)) return fail(`"${title}": time은 HH:MM(24시간) 형식이어야 해요.`);
  if (e.endTime !== undefined && !isTime(e.endTime)) return fail(`"${title}": endTime은 HH:MM(24시간) 형식이어야 해요.`);
  if (e.endTime !== undefined && e.time === undefined) return fail(`"${title}": endTime만 있고 time이 없어요.`);

  const repeat = (e.repeat ?? "none") as RepeatType;
  if (!REPEATS.includes(repeat)) return fail(`"${title}": repeat는 ${REPEATS.join("/")} 중 하나예요.`);

  const interval = e.repeatInterval;
  const badInterval = !Number.isInteger(interval) || (interval as number) < 1 || (interval as number) > 99
    || ((interval as number) > 1 && (repeat === "none" || repeat === "weekdays"));
  if (interval !== undefined && badInterval) {
    return fail(`"${title}": repeatInterval은 반복 일정에 쓰는 1~99 정수예요.`);
  }

  let repeatDays: number[] | undefined;
  if (e.repeatDays !== undefined) {
    if (repeat !== "weekly") return fail(`"${title}": repeatDays는 repeat가 weekly일 때만 써요.`);
    if (!Array.isArray(e.repeatDays) || !e.repeatDays.every(day => Number.isInteger(day) && day >= 0 && day <= 6)) {
      return fail(`"${title}": repeatDays는 0(일)~6(토) 숫자 목록이에요.`);
    }
    repeatDays = [...new Set(e.repeatDays as number[])].sort((a, b) => a - b);
  }

  if (e.repeatUntil !== undefined && (!isDate(e.repeatUntil) || repeat === "none" || e.repeatUntil < date)) {
    return fail(`"${title}": repeatUntil은 반복 일정의 시작일 이후 YYYY-MM-DD여야 해요.`);
  }

  const reminder = e.reminderMinutes;
  if (reminder !== undefined && reminder !== null && !(Number.isInteger(reminder) && (reminder as number) >= 0 && (reminder as number) <= 1440)) {
    return fail(`"${title}": reminderMinutes는 0~1440 정수나 null이에요.`);
  }

  let checklist: string[] = [];
  if (e.checklist !== undefined) {
    if (!Array.isArray(e.checklist) || !e.checklist.every(step => typeof step === "string")) {
      return fail(`"${title}": checklist는 문자열 목록이에요.`);
    }
    checklist = (e.checklist as string[]).map(step => step.trim()).filter(Boolean).slice(0, 20);
    // Recurring items keep one completion state per occurrence, so no checklist.
    if (checklist.length > 0 && repeat !== "none") return fail(`"${title}": 반복 일정에는 checklist를 넣을 수 없어요.`);
  }

  const options: AddTodoOptions = {
    kind,
    allDay: true,
    startDate: date,
    endDate,
    repeat,
    color: colorForCategory(e.category as string | undefined, colorLabels),
  };

  if (typeof e.time === "string") {
    if (kind === "todo") {
      options.todoTime = e.time;
    } else {
      const endTime = (e.endTime as string | undefined) ?? getDefaultEndTime(e.time);
      if (endDate === date && timeToMinutes(endTime) <= timeToMinutes(e.time)) {
        return fail(`"${title}": endTime이 time보다 늦어야 해요(밤을 넘기면 endDate를 다음 날로).`);
      }
      options.allDay = false;
      options.startTime = e.time;
      options.endTime = endTime;
    }
  }

  if (typeof interval === "number" && interval > 1) options.repeatInterval = interval;
  if (repeatDays) options.repeatDays = repeatDays;
  if (typeof e.repeatUntil === "string") options.repeatEndDate = e.repeatUntil;
  if (reminder !== undefined) options.reminderMinutes = reminder as number | null;
  if (checklist.length > 0) options.subtasks = checklist.map(step => ({ id: createId("sub"), title: step, done: false }));

  return { ok: true, input: { title, date, options } };
};

/** Every valid item from the inbox files' contents; broken files and items are skipped. */
export const readInboxFiles = (
  contents: string[],
  colorLabels: Record<string, string>
): { inputs: InboxTodoInput[]; errors: string[] } => {
  const inputs: InboxTodoInput[] = [];
  const errors: string[] = [];

  for (const text of contents) {
    let file: Partial<InboxFile>;
    try {
      file = JSON.parse(text) as Partial<InboxFile>;
    } catch {
      errors.push("읽을 수 없는 요청 파일");
      continue;
    }

    for (const item of (Array.isArray(file.items) ? file.items : []).slice(0, INBOX_MAX_ITEMS)) {
      const result = parseInboxEvent(item, colorLabels);
      if (result.ok) inputs.push(result.input);
      else errors.push(result.error);
    }
  }

  return { inputs, errors };
};
