// ═══════════════════════════════════════════════════════════
// Date Utility Functions
// ═══════════════════════════════════════════════════════════

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_SHORT = ["일", "월", "화", "수", "목", "금", "토"];

/** Parse a YYYY-MM-DD value without applying an implicit UTC offset. */
export const parseLocalDate = (dateString: string): Date =>
  new Date(`${dateString}T00:00:00`);

/** Difference in whole calendar days. */
export const differenceInCalendarDays = (from: Date, to: Date): number =>
  Math.round((to.getTime() - from.getTime()) / DAY_MS);

/** Add days to a date. */
export const addDays = (d: Date, n: number): Date => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

/** Add months to a date */
export const addMonths = (d: Date, n: number): Date => {
  const r = new Date(d);
  const dayOfMonth = r.getDate();

  r.setDate(1);
  r.setMonth(r.getMonth() + n);

  const lastDayOfTargetMonth = new Date(
    r.getFullYear(),
    r.getMonth() + 1,
    0
  ).getDate();
  r.setDate(Math.min(dayOfMonth, lastDayOfTargetMonth));

  return r;
};

/** Format date to YYYY-MM-DD string */
export const fmtDate = (d: Date): string => [
  d.getFullYear(),
  String(d.getMonth() + 1).padStart(2, "0"),
  String(d.getDate()).padStart(2, "0"),
].join("-");

/** Shift a YYYY-MM-DD string by whole days. */
export const shiftDate = (dateStr: string, days: number): string =>
  fmtDate(addDays(parseLocalDate(dateStr), days));

/** Whole calendar days from one YYYY-MM-DD string to another. */
export const daysBetween = (from: string, to: string): number =>
  differenceInCalendarDays(parseLocalDate(from), parseLocalDate(to));

/** Get local today's date as YYYY-MM-DD */
export const getLocalToday = (): string => {
  return fmtDate(new Date());
};

/** Load JSON from localStorage with fallback */
export const loadJson = <T,>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
};

/** Calculate week number based on month */
export const getWeekNumber = (date: Date): number => {
  const year = date.getFullYear();
  const month = date.getMonth();

  // First day of the month
  const firstDayOfMonth = new Date(year, month, 1);

  // First Sunday of the week containing the 1st
  const firstSunday = new Date(firstDayOfMonth);
  firstSunday.setDate(firstSunday.getDate() - firstSunday.getDay());

  // Days from first Sunday to current date
  const diffTime = date.getTime() - firstSunday.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return Math.floor(diffDays / 7) + 1;
};

/** Format date for display with full weekday */
export const formatDateDisplayWithWeekday = (dateStr: string): string => {
  return parseLocalDate(dateStr)
    .toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
};

/** "11월 3일 (화)" — compact label for panels and tooltips. */
export const formatShortDate = (dateStr: string): string => {
  const d = parseLocalDate(dateStr);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY_SHORT[d.getDay()]})`;
};

/** Get today label */
export const getTodayLabel = (today: string = getLocalToday()): string => {
  return parseLocalDate(today)
    .toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
};

/** "HH:MM" → minutes since midnight. */
export const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

/** Minutes since midnight → "HH:MM", wrapped into a single day. */
export const minutesToTime = (totalMinutes: number): string => {
  const wrapped = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

/** Local Date → "HH:MM". */
export const formatClock = (d: Date): string =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** "14:30" → "14:30" or "오후 2:30" depending on the 24-hour setting. */
export const formatTimeLabel = (time: string, use24Hour: boolean): string => {
  if (use24Hour) return time;

  const minutes = timeToMinutes(time);
  const hours = Math.floor(minutes / 60);
  const meridiem = hours < 12 ? "오전" : "오후";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;

  return `${meridiem} ${displayHour}:${String(minutes % 60).padStart(2, "0")}`;
};
