// ═══════════════════════════════════════════════════════════
// Date Utility Functions
// ═══════════════════════════════════════════════════════════

/** Add days to a date */
export const addDays = (d: Date, n: number): Date => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

/** Add months to a date */
export const addMonths = (d: Date, n: number): Date => {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
};

/** Format date to YYYY-MM-DD string */
export const fmtDate = (d: Date): string => [
  d.getFullYear(),
  String(d.getMonth() + 1).padStart(2, "0"),
  String(d.getDate()).padStart(2, "0"),
].join("-");

/** Get local today's date as YYYY-MM-DD */
export const getLocalToday = (): string => {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
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

/** Format date for display */
export const formatDateDisplay = (dateStr: string): string => {
  return new Date(dateStr + "T00:00:00")
    .toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
};

/** Get today label */
export const getTodayLabel = (): string => {
  const d = new Date();
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
};

/** Get current time as HH:MM */
export const getCurrentTime = (): string => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};
