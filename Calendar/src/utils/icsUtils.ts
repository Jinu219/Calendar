// ═══════════════════════════════════════════════════════════
// ICS (iCalendar) parsing for subscribed, read-only calendars
// ═══════════════════════════════════════════════════════════
//
// Covers what Google Calendar / Outlook / school calendars actually publish:
// all-day and timed VEVENTs, UTC / TZID / floating times, RRULE (the subset
// our repeat model can express), EXDATE and moved instances (RECURRENCE-ID).

import type { MonthlyMode, RepeatType, Todo } from "../types";
import { doesOccurrenceStartOn } from "./todoUtils";
import { fmtDate, formatClock, shiftDate } from "./dateUtils";

interface IcsProperty {
  params: Record<string, string>;
  value: string;
}

type IcsEvent = Record<string, IcsProperty[]>;

interface IcsDate {
  date: string;
  /** "HH:MM" local time; absent for all-day values. */
  time?: string;
}

export interface FeedSource {
  id: string;
  color: string;
}

const BYDAY_INDEX: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
const MAX_COUNT_SCAN_DAYS = 365 * 5;

const unescapeText = (value: string): string =>
  value.replace(/\\([nN,;\\])/g, (_, ch: string) => (ch === "n" || ch === "N" ? "\n" : ch));

/** Split the file into VEVENT property maps, handling folded (continued) lines. */
const readEvents = (text: string): IcsEvent[] => {
  const lines = text.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const events: IcsEvent[] = [];
  let current: IcsEvent | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }

    if (line === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
      continue;
    }

    if (!current) continue;

    const colon = line.indexOf(":");
    if (colon < 0) continue;

    const [rawName, ...rawParams] = line.slice(0, colon).split(";");
    const params = Object.fromEntries(
      rawParams.map(param => {
        const eq = param.indexOf("=");
        return [param.slice(0, eq).toUpperCase(), param.slice(eq + 1).replace(/^"|"$/g, "")];
      })
    );
    const name = rawName.toUpperCase();

    (current[name] ??= []).push({ params, value: line.slice(colon + 1) });
  }

  return events;
};

/** Offset of `timeZone` from UTC at a given instant, in ms. */
const zoneOffsetMs = (timeZone: string, instant: number): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value);

  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - instant;
};

/** Parse a DTSTART/DTEND/EXDATE value into a local date (and time). */
export const parseIcsDate = (property: IcsProperty): IcsDate | null => {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(property.value.trim());
  if (!match) return null;

  const [, y, mo, d, h, mi, s, utc] = match;

  if (h === undefined || property.params.VALUE === "DATE") {
    return { date: `${y}-${mo}-${d}` };
  }

  const wall = Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0));
  let local: Date;

  if (utc) {
    local = new Date(wall);
  } else if (property.params.TZID) {
    try {
      // Two passes settle the offset around DST changes.
      const first = wall - zoneOffsetMs(property.params.TZID, wall);
      local = new Date(wall - zoneOffsetMs(property.params.TZID, first));
    } catch {
      // A zone Intl doesn't know (e.g. Windows names from Outlook): treat as local.
      local = new Date(+y, +mo - 1, +d, +h, +mi);
    }
  } else {
    local = new Date(+y, +mo - 1, +d, +h, +mi);
  }

  return { date: fmtDate(local), time: formatClock(local) };
};

const parseRule = (value: string): Record<string, string> =>
  Object.fromEntries(value.split(";").map(part => {
    const eq = part.indexOf("=");
    return [part.slice(0, eq).toUpperCase(), part.slice(eq + 1)];
  }));

interface RepeatFields {
  repeat: RepeatType;
  repeatInterval?: number;
  repeatDays?: number[];
  monthlyMode?: MonthlyMode;
  repeatEndDate?: string;
}

/** Map an RRULE onto our repeat model (best effort for parts it can't express). */
const toRepeat = (rrule: string, start: string): RepeatFields | null => {
  const rule = parseRule(rrule);
  const interval = Math.max(1, Number(rule.INTERVAL) || 1);
  const byDay = (rule.BYDAY ?? "").split(",").filter(Boolean);
  const weekdays = byDay.map(day => BYDAY_INDEX[day.slice(-2)]).filter(day => day !== undefined);
  const isWorkweek = weekdays.length === 5 && [1, 2, 3, 4, 5].every(day => weekdays.includes(day));

  let fields: RepeatFields;

  switch (rule.FREQ) {
    case "DAILY":
      fields = isWorkweek && interval === 1 ? { repeat: "weekdays" } : { repeat: "daily", repeatInterval: interval };
      break;
    case "WEEKLY":
      fields = isWorkweek && interval === 1
        ? { repeat: "weekdays" }
        : { repeat: "weekly", repeatInterval: interval, repeatDays: weekdays.length ? weekdays : undefined };
      break;
    case "MONTHLY":
      // "1TU", "-1FR", or BYDAY=TU;BYSETPOS=1 → same weekday each month.
      fields = {
        repeat: "monthly",
        repeatInterval: interval,
        monthlyMode: byDay.length === 1 && (/^-?\d/.test(byDay[0]) || rule.BYSETPOS) ? "weekday" : "date",
      };
      break;
    case "YEARLY":
      fields = { repeat: "yearly", repeatInterval: interval };
      break;
    default:
      return null;
  }

  if (fields.repeatInterval === 1) delete fields.repeatInterval;

  if (rule.UNTIL) {
    const until = parseIcsDate({ params: {}, value: rule.UNTIL });
    if (until) fields.repeatEndDate = until.date;
  } else if (rule.COUNT) {
    fields.repeatEndDate = nthOccurrence(fields, start, Number(rule.COUNT));
  }

  return fields;
};

/** Start date of the COUNT-th occurrence, used as the end of a counted series. */
const nthOccurrence = (fields: RepeatFields, start: string, count: number): string | undefined => {
  const probe = { id: "", date: start, title: "", done: false, color: "", allDay: true, sortOrder: 0, ...fields, repeatEndDate: undefined } as Todo;
  let seen = 0;

  for (let i = 0, d = start; i < MAX_COUNT_SCAN_DAYS; i++, d = shiftDate(d, 1)) {
    if (doesOccurrenceStartOn(probe, d) && ++seen === count) return d;
  }

  return undefined;
};

/** Read-only todos for every event in an ICS file. */
export function parseIcs(text: string, source: FeedSource): Todo[] {
  const events = readEvents(text);
  const todos: Todo[] = [];
  const movedInstances = new Map<string, string[]>();

  for (const event of events) {
    const first = (name: string) => event[name]?.[0];

    if (first("STATUS")?.value.toUpperCase() === "CANCELLED") continue;

    const startProp = first("DTSTART");
    const start = startProp && parseIcsDate(startProp);
    if (!start) continue;

    const endProp = first("DTEND");
    const end = endProp ? parseIcsDate(endProp) : null;
    const uid = first("UID")?.value ?? `${start.date}-${todos.length}`;
    const recurrenceId = first("RECURRENCE-ID");
    const allDay = start.time === undefined;

    let endDate = start.date;
    let endTime: string | undefined;

    if (end) {
      if (allDay) {
        // All-day DTEND is exclusive.
        endDate = end.date > start.date ? shiftDate(end.date, -1) : start.date;
      } else {
        endDate = end.date;
        endTime = end.time;

        // Ending exactly at midnight belongs to the previous day.
        if (endTime === "00:00" && endDate > start.date) {
          endDate = shiftDate(endDate, -1);
          endTime = "23:59";
        }
      }
    }

    const rrule = recurrenceId ? undefined : first("RRULE")?.value;
    const repeat = rrule ? toRepeat(rrule, start.date) : null;
    const exceptions = (event.EXDATE ?? [])
      .flatMap(prop => prop.value.split(",").map(value => parseIcsDate({ params: prop.params, value })))
      .filter((d): d is IcsDate => d !== null)
      .map(d => d.date);

    if (recurrenceId) {
      // A moved/edited instance replaces that date of its series.
      const original = parseIcsDate(recurrenceId);
      if (original) movedInstances.set(uid, [...(movedInstances.get(uid) ?? []), original.date]);
    }

    todos.push({
      id: `${source.id}:${uid}${recurrenceId ? `:${recurrenceId.value}` : ""}`,
      sourceId: source.id,
      title: unescapeText(first("SUMMARY")?.value ?? "") || "(제목 없음)",
      date: start.date,
      startDate: start.date,
      endDate,
      allDay,
      startTime: start.time,
      endTime: allDay ? undefined : endTime,
      color: source.color,
      kind: "schedule",
      done: false,
      sortOrder: 0,
      repeat: repeat?.repeat ?? "none",
      repeatInterval: repeat?.repeatInterval,
      repeatDays: repeat?.repeatDays,
      monthlyMode: repeat?.monthlyMode,
      repeatEndDate: repeat?.repeatEndDate,
      exceptions: exceptions.length > 0 ? exceptions : undefined,
    });
  }

  // Skip the original dates of instances that were moved or edited.
  for (const todo of todos) {
    if (todo.repeat === "none") continue;

    const uid = todo.id.slice(source.id.length + 1);
    const moved = movedInstances.get(uid);
    if (moved) todo.exceptions = [...(todo.exceptions ?? []), ...moved];
  }

  return todos;
}
