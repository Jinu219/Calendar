// ═══════════════════════════════════════════════════════════
// Schedule sentences → an item, without AI
// ═══════════════════════════════════════════════════════════
//
// "다음 주 화요일 3시 치과", "매주 월수금 7시 헬스 12월 31일까지",
// "금요일까지 보고서", "11/11~11/13 대동제 #축제", "내일 오후 2시~4시 스터디
// 30분 전 알림". Each phrase that is understood is cut out of the sentence and
// what remains is the title. The result is an InboxEventInput, so it goes
// through the same validation (parseInboxEvent) as items Claude or Gemini send.
// Pure and offline: the quick-add box uses it on every keystroke.

import type { ItemKind, RepeatType } from "../types";
import type { InboxEventInput } from "./inboxUtils";
import { daysBetween, fmtDate, minutesToTime, parseLocalDate, shiftDate } from "./dateUtils";
import { describeRepeat, getDefaultEndTime } from "./todoUtils";

export interface ScheduleParseContext {
  today: string;
  /** The day an item without a date in the sentence goes on. */
  selectedDate: string;
  defaultKind: ItemKind;
}

export interface ParsedSchedule {
  event: InboxEventInput;
  /** What was understood, for the preview under the input ("11/10(화)", "15:00–16:00"). */
  understood: string[];
  /** Whether any date, time, repeat or reminder was found (else: just a title). */
  recognized: boolean;
}

const WEEKDAYS = "일월화수목금토";
const DAY_CHAR = `[${WEEKDAYS}]`;
/** "월수금", "월, 수", "화·목" */
const DAY_LIST = `${DAY_CHAR}(?:\\s*[,·/]?\\s*${DAY_CHAR})*`;

// ───────────────────────────────────────────────────────────
// Dates
// ───────────────────────────────────────────────────────────

const ymd = (year: number, month: number, day: number): string | null => {
  const d = new Date(year, month - 1, day);
  return d.getMonth() === month - 1 && d.getDate() === day ? fmtDate(d) : null;
};

/** This year's date, or next year's when it was more than a month ago ("1/5" said in December). */
const upcomingMonthDay = (month: number, day: number, today: string): string | null => {
  const year = parseLocalDate(today).getFullYear();
  const date = ymd(year, month, day);
  return date && daysBetween(date, today) > 30 ? ymd(year + 1, month, day) : date;
};

/** This month's day, or next month's when it has passed. */
const upcomingDayOfMonth = (day: number, today: string): string | null => {
  const t = parseLocalDate(today);
  const date = ymd(t.getFullYear(), t.getMonth() + 1, day);
  return date && date < today ? ymd(t.getFullYear(), t.getMonth() + 2, day) : date;
};

/** The nearest such weekday on or after `from`. */
const nextWeekday = (from: string, weekday: number): string =>
  shiftDate(from, (weekday - parseLocalDate(from).getDay() + 7) % 7);

/** Weeks run Sunday–Saturday, like the calendar. */
const weekdayInWeek = (today: string, weeksAhead: number, weekday: number): string =>
  shiftDate(today, weeksAhead * 7 - parseLocalDate(today).getDay() + weekday);

const WEEK_OFFSETS: Record<string, number> = { 이번: 0, 금: 0, 다음: 1, 담: 1, 차: 1, 다다음: 2 };

interface DateRule {
  re: RegExp;
  resolve: (m: RegExpExecArray, today: string) => string | null;
}

// Earlier rules win when two match at the same place.
const DATE_RULES: DateRule[] = [
  { re: /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/, resolve: m => ymd(+m[1], +m[2], +m[3]) },
  { re: /(\d{1,2})\s*월\s*(\d{1,2})\s*일/, resolve: (m, t) => upcomingMonthDay(+m[1], +m[2], t) },
  { re: /(?<![\d:/.])(\d{1,2})\/(\d{1,2})(?![\d:/])/, resolve: (m, t) => upcomingMonthDay(+m[1], +m[2], t) },
  {
    re: /(오늘|금일|내일|모레|글피|(?<![가-힣])낼(?![가-힣]))/,
    resolve: (m, t) => shiftDate(t, { 오늘: 0, 금일: 0, 내일: 1, 낼: 1, 모레: 2, 글피: 3 }[m[1]] ?? 0),
  },
  { re: /(\d{1,3})\s*(일|주)\s*(?:후|뒤)/, resolve: (m, t) => shiftDate(t, +m[1] * (m[2] === "주" ? 7 : 1)) },
  {
    re: new RegExp(`(다다음|다음|이번|담|차|금)\\s*주\\s*(?:(${DAY_CHAR})요일|(${DAY_CHAR})(?![가-힣])|(주말))`),
    resolve: (m, t) => weekdayInWeek(t, WEEK_OFFSETS[m[1]], m[4] ? 6 : WEEKDAYS.indexOf(m[2] ?? m[3])),
  },
  {
    re: /(이번|다음)\s*달\s*(\d{1,2})\s*일/,
    resolve: (m, t) => {
      const d = parseLocalDate(t);
      return ymd(d.getFullYear(), d.getMonth() + 1 + (m[1] === "다음" ? 1 : 0), +m[2]);
    },
  },
  { re: /(?:이번\s*)?주말/, resolve: (_m, t) => nextWeekday(t, 6) },
  { re: new RegExp(`(${DAY_CHAR})요일`), resolve: (m, t) => nextWeekday(t, WEEKDAYS.indexOf(m[1])) },
  {
    re: /(?<![\d/.\-])(\d{1,2})\s*일(?!\s*(?:마다|후|뒤|간|째|동안|정도))/,
    resolve: (m, t) => upcomingDayOfMonth(+m[1], t),
  },
];

interface Found {
  index: number;
  end: number;
  value: string;
}

/** The earliest date phrase in `text` (ties: the earlier, more specific rule). */
const findDate = (text: string, today: string): Found | null => {
  let best: Found | null = null;

  for (const rule of DATE_RULES) {
    const m = rule.re.exec(text);
    if (!m || (best && m.index >= best.index)) continue;
    const value = rule.resolve(m, today);
    if (value) best = { index: m.index, end: m.index + m[0].length, value };
  }

  return best;
};

// ───────────────────────────────────────────────────────────
// Times
// ───────────────────────────────────────────────────────────

// 오전/오후 or a time-of-day word, the hour, then ":MM" or "시" with an
// optional "반" / "N분". The hour isn't part of a date ("11/20"), and "시"
// must end there or be followed by a particle — not "시간", "시험", "시작".
// "반" likewise ends the word ("3시 반에"), so "3시 반복…" stays 3시.
const PARTICLE_AHEAD = String.raw`(?=$|[\s~\-–,.!?)]|에|부터|까지|쯤|경)`;
const SI = String.raw`시(?=$|[\s~\-–,.!?)]|\d|반|에|부터|까지|쯤|경|정각|전|후|이후|이전)`;
const TIME = String.raw`(?:(오전|오후|아침|새벽|낮|점심|저녁|밤)\s*)?(?<![\d/.:])(\d{1,2})(?::(\d{2})|\s*${SI}(?:\s*(반${PARTICLE_AHEAD}|\d{1,2}\s*분))?)`;
const TIME_RE = new RegExp(`${TIME}(?:\\s*(?:[~\\-–]|부터)\\s*${TIME})?(\\s*까지)?`);
const NOON_RE = /정오/;
const AFTERNOON = new Set(["오후", "낮", "점심", "저녁", "밤"]);
const MORNING = new Set(["오전", "아침", "새벽"]);

const toMinutesOfDay = (
  meridiem: string | undefined,
  hourText: string,
  colonMinutes: string | undefined,
  siMinutes: string | undefined
): number | null => {
  let hours = Number(hourText);
  const minutes = colonMinutes !== undefined
    ? Number(colonMinutes)
    : siMinutes === "반"
      ? 30
      : siMinutes
        ? parseInt(siMinutes, 10)
        : 0;

  if (hours > 24 || minutes > 59) return null;

  if (meridiem && AFTERNOON.has(meridiem) && hours < 12) hours += 12;
  if (meridiem === "밤" && hours === 12) hours = 0;
  if (meridiem && MORNING.has(meridiem) && hours === 12) hours = 0;

  // "3시 회의" without 오전/오후 almost always means the afternoon.
  if (!meridiem && colonMinutes === undefined && hours >= 1 && hours <= 6) hours += 12;

  return (hours % 24) * 60 + minutes;
};

interface FoundTime {
  index: number;
  end: number;
  start: string;
  end_: string | undefined;
  /** "6시까지 제출": a deadline rather than a start. */
  deadline: boolean;
}

const findTime = (text: string): FoundTime | null => {
  const noon = NOON_RE.exec(text);
  const m = TIME_RE.exec(text);

  if (noon && (!m || noon.index < m.index)) {
    return { index: noon.index, end: noon.index + noon[0].length, start: "12:00", end_: undefined, deadline: false };
  }
  if (!m) return null;

  const start = toMinutesOfDay(m[1], m[2], m[3], m[4]);
  if (start === null) return null;

  let end: number | null = null;
  if (m[6] !== undefined) {
    // "오후 2시~4시": the end inherits the start's 오전/오후.
    end = toMinutesOfDay(m[5] ?? m[1], m[6], m[7], m[8]);
    if (end !== null && end <= start && end + 720 > start) end += 720;
  }

  return {
    index: m.index,
    end: m.index + m[0].length,
    start: minutesToTime(start),
    end_: end !== null && end > start ? minutesToTime(Math.min(end, 23 * 60 + 59)) : undefined,
    deadline: m[6] === undefined && m[9] !== undefined,
  };
};

// ───────────────────────────────────────────────────────────
// Repeats and reminders
// ───────────────────────────────────────────────────────────

interface Repeat {
  repeat: RepeatType;
  interval?: number;
  days?: number[];
  monthDay?: number;
}

const daysOf = (list: string): number[] =>
  [...new Set([...list].map(ch => WEEKDAYS.indexOf(ch)).filter(day => day >= 0))].sort((a, b) => a - b);

const REPEAT_RULES: { re: RegExp; read: (m: RegExpExecArray) => Repeat }[] = [
  { re: /매주\s*주말|주말\s*마다/, read: () => ({ repeat: "weekly", days: [0, 6] }) },
  { re: /매주\s*평일|평일\s*마다|매\s*평일|평일(?:에)?(?![가-힣])/, read: () => ({ repeat: "weekdays" }) },
  {
    re: new RegExp(`(?:(격주)|매주|(\\d{1,2})\\s*주\\s*마다)\\s*(${DAY_LIST})(?:요일)?(?:\\s*마다)?(?![가-힣])`),
    read: m => ({ repeat: "weekly", interval: m[1] ? 2 : m[2] ? +m[2] : undefined, days: daysOf(m[3]) }),
  },
  // Not "3일마다" (every 3 days).
  { re: new RegExp(`(?<![\\d가-힣])(${DAY_LIST})\\s*(?:요일)?\\s*마다`), read: m => ({ repeat: "weekly", days: daysOf(m[1]) }) },
  { re: /(격주)|매주|(\d{1,2})\s*주\s*마다/, read: m => ({ repeat: "weekly", interval: m[1] ? 2 : m[2] ? +m[2] : undefined }) },
  { re: /매일|날마다|(\d{1,3})\s*일\s*마다/, read: m => ({ repeat: "daily", interval: m[1] ? +m[1] : undefined }) },
  {
    re: /(?:매달|매월|(\d{1,2})\s*(?:개월|달)\s*마다)(?:\s*(\d{1,2})\s*일)?/,
    read: m => ({ repeat: "monthly", interval: m[1] ? +m[1] : undefined, monthDay: m[2] ? +m[2] : undefined }),
  },
  { re: /매년|해마다/, read: () => ({ repeat: "yearly" }) },
];

const REMINDER_RULES: { re: RegExp; read: (m: RegExpExecArray) => number | null }[] = [
  { re: /알림\s*(?:없이|없음|끄고|빼고|X)/, read: () => null },
  { re: /(?:하루|1일)\s*전(?:에)?\s*(?:알림|알려\s*줘|알람)/, read: () => 1440 },
  { re: /(\d{1,3})\s*(분|시간)\s*전(?:에)?\s*(?:알림|알려\s*줘|알람)/, read: m => +m[1] * (m[2] === "시간" ? 60 : 1) },
  { re: /(?:알림|알람)\s*(\d{1,3})\s*(분|시간)\s*전/, read: m => +m[1] * (m[2] === "시간" ? 60 : 1) },
  { re: /(?:정각|정시)(?:에)?\s*(?:알림|알람)/, read: () => 0 },
];

// ───────────────────────────────────────────────────────────
// Title clean-up
// ───────────────────────────────────────────────────────────

// Requests to the assistant and particles left behind by removed phrases.
const REQUEST_TAIL = /\s*(?:일정\s*(?:으로)?\s*)?(?:추가|등록|저장|넣어|잡아|만들어)\s*(?:해\s*)?(?:줘|주세요|줄래|요)?\s*[.!]*$/;
const LONE_PARTICLE = /(^|\s)(?:에|에서|에는|은|는|이|가|을|를|부터|까지|쯤|경|마다|에게|으로|로|,|·|~|-)(?=\s|$)/g;

const cleanTitle = (text: string): string => {
  let title = text.replace(/\s+/g, " ").trim();
  title = title.replace(REQUEST_TAIL, "");
  for (let i = 0; i < 3; i++) title = title.replace(LONE_PARTICLE, "$1").replace(/\s+/g, " ").trim();
  return title.replace(/^[,·:\-\s]+|[,·:\-\s]+$/g, "");
};

const shortDay = (date: string): string => {
  const d = parseLocalDate(date);
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
};

// ───────────────────────────────────────────────────────────
// The parser
// ───────────────────────────────────────────────────────────

export const parseScheduleText = (text: string, ctx: ScheduleParseContext): ParsedSchedule => {
  const original = text.trim();
  let rest = original;
  /** Remove [index, end) from `rest`, leaving a space so neighbours don't merge. */
  const cut = (index: number, end: number) => {
    rest = `${rest.slice(0, index)} ${rest.slice(end)}`;
  };
  const take = (re: RegExp): RegExpExecArray | null => {
    const m = re.exec(rest);
    if (m) cut(m.index, m.index + m[0].length);
    return m;
  };

  let kind: ItemKind = ctx.defaultKind;
  const prefix = take(/^\s*할\s*일\s*[:：]?/);
  if (prefix) kind = "todo";
  if (/마감/.test(rest)) kind = "todo";

  const category = take(/#(\S+)/)?.[1];

  let reminder: number | null | undefined;
  for (const rule of REMINDER_RULES) {
    const m = take(rule.re);
    if (m) {
      reminder = rule.read(m);
      break;
    }
  }

  let repeat: Repeat | undefined;
  for (const rule of REPEAT_RULES) {
    const m = take(rule.re);
    if (m) {
      repeat = rule.read(m);
      break;
    }
  }

  // Times before dates, so "3시" is never read as part of a date.
  const time = findTime(rest);
  if (time) cut(time.index, time.end);

  // Every date phrase, in order. "A~B" / "A부터 B까지" with B right after A is a range.
  const dates: (Found & { rangeStart: boolean; until: boolean })[] = [];
  let openRangeAt = -1;
  for (let found = findDate(rest, ctx.today); found; found = findDate(rest, ctx.today)) {
    const tail = rest.slice(found.end);
    const until = /^\s*까지/.exec(tail);
    const separator = until ? null : /^\s*(?:~|–|-|부터)\s*/.exec(tail);

    if (openRangeAt >= 0 && rest.slice(openRangeAt, found.index).trim() === "") {
      dates[dates.length - 1].rangeStart = true;
    }
    cut(found.index, found.end + (until?.[0].length ?? separator?.[0].length ?? 0));
    dates.push({ ...found, until: Boolean(until), rangeStart: false });
    openRangeAt = separator ? found.index + 1 : -1;
  }

  let date: string | undefined;
  let endDate: string | undefined;
  let repeatUntil: string | undefined;

  const rangeAt = dates.findIndex(d => d.rangeStart);
  if (rangeAt >= 0) {
    date = dates[rangeAt].value;
    const last = dates[rangeAt + 1].value;
    if (repeat) repeatUntil = last;
    else if (last > date) endDate = last;
  }

  for (const d of dates) {
    if (date !== undefined && (d.value === date || d.value === endDate || d.value === repeatUntil)) continue;
    if (d.until) {
      if (repeat) repeatUntil = d.value;
      else if (date === undefined) {
        // "금요일까지 보고서": a deadline.
        date = d.value;
        kind = "todo";
      }
    } else if (date === undefined) {
      date = d.value;
    }
  }

  if (time?.deadline) kind = "todo";

  const title = cleanTitle(rest);
  const recognized = Boolean(time || dates.length > 0 || repeat || reminder !== undefined);

  // Nothing left for a title ("14:00"): the whole sentence is the title.
  if (!title) {
    return { event: { title: original, date: ctx.selectedDate, kind: ctx.defaultKind }, understood: [], recognized: false };
  }

  // A repeat without a date starts at its first occurrence from the selected day.
  if (date === undefined && repeat?.days?.length) {
    const from = ctx.selectedDate;
    date = repeat.days
      .map(day => nextWeekday(from, day))
      .sort()[0];
  } else if (date === undefined && repeat?.monthDay) {
    date = upcomingDayOfMonth(repeat.monthDay, ctx.selectedDate < ctx.today ? ctx.today : ctx.selectedDate) ?? undefined;
  }
  date ??= ctx.selectedDate;

  const event: InboxEventInput = { title, date, kind };
  if (endDate) event.endDate = endDate;
  if (time) {
    event.time = time.start;
    if (kind === "schedule") event.endTime = time.end_ ?? getDefaultEndTime(time.start);
  }
  if (repeat) {
    event.repeat = repeat.repeat;
    if (repeat.interval && repeat.interval > 1) event.repeatInterval = repeat.interval;
    if (repeat.repeat === "weekly" && repeat.days?.length) event.repeatDays = repeat.days;
    if (repeatUntil && repeatUntil >= date) event.repeatUntil = repeatUntil;
  }
  if (reminder !== undefined) event.reminderMinutes = reminder;
  if (category) event.category = category;

  const understood: string[] = [];
  if (dates.length > 0 || repeat) understood.push(endDate ? `${shortDay(date)}~${shortDay(endDate)}` : shortDay(date));
  if (event.time) understood.push(kind === "todo" ? `${event.time}까지` : `${event.time}–${event.endTime}`);
  if (repeat) {
    understood.push(describeRepeat({
      date,
      startDate: date,
      repeat: repeat.repeat,
      repeatDays: event.repeatDays,
      repeatInterval: event.repeatInterval,
    }) + (event.repeatUntil ? ` (~${shortDay(event.repeatUntil)})` : ""));
  }
  if (reminder !== undefined) understood.push(reminder === null ? "알림 없음" : `${reminder < 60 ? `${reminder}분` : reminder % 60 === 0 ? `${reminder / 60}시간` : `${reminder}분`} 전 알림`);
  if (kind === "todo" && ctx.defaultKind !== "todo") understood.push("할 일");
  if (category) understood.push(`#${category}`);

  return { event, understood, recognized };
};
