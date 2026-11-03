// ═══════════════════════════════════════════════════════════
// MCP tools — what Claude can do with the calendar from a conversation
// ═══════════════════════════════════════════════════════════
//
// Pure functions over already-loaded data; mcp/server.mjs does the file I/O
// and the JSON-RPC. Imports go to the util files directly (not the utils
// barrel), which would pull in Tauri.

import type { Todo } from "../types";
import { COLOR_NAMES, TODO_COLORS } from "../constants";
import { INBOX_MAX_ITEMS, parseInboxEvent, type InboxEventInput } from "../utils/inboxUtils";
import { describeRepeat, getAgendaForDate, getTodoTimeLabel } from "../utils/todoUtils";
import { daysBetween, parseLocalDate, shiftDate } from "../utils/dateUtils";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const DEFAULT_LIST_DAYS = 14;
const MAX_LIST_DAYS = 93;
const DATE = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" };
const TIME = { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" };

export const SERVER_INSTRUCTIONS =
  "The user's own desktop Calendar app (Korean UI). When the user asks to put something on their " +
  "calendar or schedule (일정, 할 일, 캘린더에 넣어줘), call add_calendar_events. Resolve relative " +
  "dates like '다음 주 화요일' to absolute YYYY-MM-DD yourself. Call list_calendar_events first " +
  "when you need to check what is already planned or to avoid duplicates.";

export const TOOLS = [
  {
    name: "add_calendar_events",
    title: "캘린더에 일정 추가",
    description:
      "Add one or more items to the user's Calendar app. Use kind 'schedule' for appointments " +
      "(일정) and 'todo' for tasks with a deadline (할 일). Omit time for all-day items. Nothing is " +
      "added if any item is invalid; fix the reported problem and call again. The app shows an " +
      "undo button, so add what the user asked without asking for confirmation twice.",
    inputSchema: {
      type: "object",
      properties: {
        events: {
          type: "array",
          minItems: 1,
          maxItems: INBOX_MAX_ITEMS,
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Short title in the user's language, e.g. '치과'." },
              date: { ...DATE, description: "Start day (absolute)." },
              endDate: { ...DATE, description: "Last day of a multi-day item, inclusive. Omit for one day." },
              time: { ...TIME, description: "24h start time; for a todo, its due time. Omit for all-day." },
              endTime: { ...TIME, description: "24h end time (default: one hour after time)." },
              kind: { type: "string", enum: ["schedule", "todo"], description: "Default 'schedule'." },
              repeat: { type: "string", enum: ["none", "daily", "weekdays", "weekly", "monthly", "yearly"] },
              repeatInterval: { type: "integer", minimum: 1, maximum: 99, description: "Every N periods (2 = every other week). Default 1." },
              repeatDays: {
                type: "array",
                items: { type: "integer", minimum: 0, maximum: 6 },
                description: "Weekly only. 0=Sunday … 6=Saturday. Default: the weekday of date.",
              },
              repeatUntil: { ...DATE, description: "Last day the repetition may occur." },
              reminderMinutes: {
                type: ["integer", "null"],
                minimum: 0,
                maximum: 1440,
                description: "Minutes before the start to notify; null for none. Omit to use the user's default.",
              },
              category: { type: "string", description: "One of the category names from list_calendar_events." },
              checklist: {
                type: "array",
                items: { type: "string" },
                maxItems: 20,
                description: "Sub-steps. Only for items that don't repeat.",
              },
            },
            required: ["title", "date"],
            additionalProperties: false,
          },
        },
      },
      required: ["events"],
      additionalProperties: false,
    },
  },
  {
    name: "list_calendar_events",
    title: "캘린더 일정 보기",
    description:
      `List what is on the user's calendar between two days (default: today and the next ${DEFAULT_LIST_DAYS - 1} days, ` +
      `at most ${MAX_LIST_DAYS} days). Also returns today's date and the category names.`,
    inputSchema: {
      type: "object",
      properties: {
        from: { ...DATE, description: "First day (default: today)." },
        to: { ...DATE, description: "Last day, inclusive." },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
];

const dayLabel = (date: string) => {
  const d = parseLocalDate(date);
  return `${date} (${WEEKDAYS[d.getDay()]})`;
};

const shortDay = (date: string) => {
  const d = parseLocalDate(date);
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
};

const categoryOf = (color: string, colorLabels: Record<string, string>) =>
  colorLabels[color] || COLOR_NAMES[color] || "";

/** "수업(분홍), 과제(하늘), 연두, …" — what `category` may be. */
export const describeCategories = (colorLabels: Record<string, string>): string =>
  TODO_COLORS.map(color => colorLabels[color] ? `${colorLabels[color]}(${COLOR_NAMES[color]})` : COLOR_NAMES[color]).join(", ");

const isDateString = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** The calendar between two days as plain text for Claude. */
export const listEvents = ({
  todos,
  args,
  today,
  pending,
  colorLabels,
}: {
  todos: Todo[];
  args: { from?: unknown; to?: unknown };
  today: string;
  pending: InboxEventInput[];
  colorLabels: Record<string, string>;
}): { text: string; isError: boolean } => {
  const from = args.from === undefined ? today : args.from;
  if (!isDateString(from)) return { text: "from은 YYYY-MM-DD 형식이어야 해요.", isError: true };

  const to = args.to === undefined ? shiftDate(from, DEFAULT_LIST_DAYS - 1) : args.to;
  if (!isDateString(to) || to < from) return { text: "to는 from 이후의 YYYY-MM-DD여야 해요.", isError: true };
  if (daysBetween(from, to) >= MAX_LIST_DAYS) return { text: `한 번에 ${MAX_LIST_DAYS}일까지 볼 수 있어요.`, isError: true };

  const own = todos.filter(todo => !todo.sourceId);
  const lines = [`오늘: ${dayLabel(today)}`, `카테고리: ${describeCategories(colorLabels)}`, ""];
  let count = 0;

  for (let day = from; day <= to; day = shiftDate(day, 1)) {
    // A multi-day item is listed on its first day (or the first day shown).
    const items = getAgendaForDate(own, day).filter(item => item.dayIndex === 1 || day === from);
    if (items.length === 0) continue;

    lines.push(dayLabel(day));
    for (const item of items) {
      const { todo } = item;
      const time = getTodoTimeLabel(todo, true) || "종일";
      const span = item.totalDays > 1 ? ` (~${shortDay(item.occurrenceEndDate)})` : "";
      const tags = [todo.kind === "todo" ? "할 일" : "일정", categoryOf(todo.color, colorLabels)].filter(Boolean).join("·");
      const repeat = todo.repeat !== "none" ? ` · ${describeRepeat(todo)}` : "";
      lines.push(`  - ${time} ${todo.title}${span} [${tags}]${repeat}${item.done ? " ✓완료" : ""}`);
      count++;
    }
  }

  if (count === 0) lines.push(`${from} ~ ${to}: 일정 없음`);

  if (pending.length > 0) {
    lines.push("", "앱에 아직 반영되지 않은 추가 요청(앱이 꺼져 있음):");
    for (const item of pending) lines.push(`  - ${item.date}${item.time ? ` ${item.time}` : ""} ${item.title}`);
  }

  return { text: lines.join("\n"), isError: false };
};

/**
 * Validate an add request as a whole: every item must pass, so a fixed retry
 * never duplicates the ones that were fine.
 */
export const prepareAdd = (
  args: { events?: unknown },
  colorLabels: Record<string, string>
): { ok: true; items: InboxEventInput[]; summary: string[] } | { ok: false; error: string } => {
  if (!Array.isArray(args.events) || args.events.length === 0) {
    return { ok: false, error: "events에 일정을 하나 이상 넣어 주세요." };
  }
  if (args.events.length > INBOX_MAX_ITEMS) {
    return { ok: false, error: `한 번에 ${INBOX_MAX_ITEMS}개까지 추가할 수 있어요.` };
  }

  const errors: string[] = [];
  const summary: string[] = [];

  for (const raw of args.events) {
    const result = parseInboxEvent(raw, colorLabels);
    if (!result.ok) {
      errors.push(result.error);
      continue;
    }

    const { title, date, options } = result.input;
    const time = options.startTime ?? options.todoTime;
    const until = options.endDate && options.endDate !== date ? `~${shortDay(options.endDate)}` : "";
    const repeat = options.repeat && options.repeat !== "none"
      ? ` · ${describeRepeat({ date, startDate: date, repeat: options.repeat, repeatDays: options.repeatDays })}` +
        (options.repeatEndDate ? ` (~${shortDay(options.repeatEndDate)})` : "")
      : "";
    summary.push(`${shortDay(date)}${until}${time ? ` ${time}` : ""} ${title}${repeat}`);
  }

  return errors.length > 0
    ? { ok: false, error: `추가하지 않았어요. 고칠 점:\n- ${errors.join("\n- ")}` }
    : { ok: true, items: args.events as InboxEventInput[], summary };
};
