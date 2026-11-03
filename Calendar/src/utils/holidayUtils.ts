// ═══════════════════════════════════════════════════════════
// Korean public holidays (공휴일 · 대체공휴일)
// ═══════════════════════════════════════════════════════════
//
// The legal rules are computed locally so the calendar works offline and isn't
// at the mercy of the public API lagging behind law changes. The API is only
// used to pick up dates we can't know in advance (임시공휴일 etc.).

import type { HolidayApiItem } from "../types";
import { addDays, fmtDate, parseLocalDate, shiftDate } from "./dateUtils";

const HOLIDAY_API_URL = "https://date.nager.at/api/v3/PublicHolidays";
const API_CACHE_PREFIX = "cwa:holidays-api:";
const API_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface LunarHolidayDates {
  seollal: string;
  buddha: string;
  chuseok: string;
}

/** 설날 · 부처님오신날 · 추석 (한국천문연구원 음력 기준). */
const LUNAR_HOLIDAYS: Record<number, LunarHolidayDates> = {
  2024: { seollal: "2024-02-10", buddha: "2024-05-15", chuseok: "2024-09-17" },
  2025: { seollal: "2025-01-29", buddha: "2025-05-05", chuseok: "2025-10-06" },
  2026: { seollal: "2026-02-17", buddha: "2026-05-24", chuseok: "2026-09-25" },
  2027: { seollal: "2027-02-07", buddha: "2027-05-13", chuseok: "2027-09-15" },
  2028: { seollal: "2028-01-26", buddha: "2028-05-02", chuseok: "2028-10-03" },
  2029: { seollal: "2029-02-13", buddha: "2029-05-20", chuseok: "2029-09-22" },
  2030: { seollal: "2030-02-03", buddha: "2030-05-09", chuseok: "2030-09-12" },
  // 2031~2035: astronomical values (checked against Intl's Chinese calendar).
  // Re-check against KASI's official 월력요항 when each year is announced.
  2031: { seollal: "2031-01-23", buddha: "2031-05-28", chuseok: "2031-10-01" },
  2032: { seollal: "2032-02-11", buddha: "2032-05-16", chuseok: "2032-09-19" },
  2033: { seollal: "2033-01-31", buddha: "2033-05-06", chuseok: "2033-09-08" },
  2034: { seollal: "2034-02-19", buddha: "2034-05-25", chuseok: "2034-09-27" },
  2035: { seollal: "2035-02-08", buddha: "2035-05-15", chuseok: "2035-09-16" },
};

/** Election days are public holidays too. */
const ELECTION_DAYS: Record<string, string> = {
  "2026-06-03": "전국동시지방선거",
  "2028-04-12": "국회의원선거",
};

/**
 * - `weekend`: a 대체공휴일 follows when it falls on Saturday/Sunday or on another holiday
 *   (삼일절·어린이날·부처님오신날·광복절·개천절·한글날·성탄절, 2023년 개정 기준)
 * - `sunday`: only Sunday or another holiday counts (설날·추석 연휴)
 * - `none`: never substituted (신정·현충일·선거일)
 */
type SubstituteRule = "weekend" | "sunday" | "none";

interface HolidaySpec {
  name: string;
  dates: string[];
  rule: SubstituteRule;
}

let lunarFormatter: Intl.DateTimeFormat | null = null;

/** Gregorian date of a lunar month/day in `year`, via the Chinese calendar in Intl. */
const findLunarDate = (year: number, month: number, day: number): string | undefined => {
  try {
    lunarFormatter ??= new Intl.DateTimeFormat("ko-KR-u-ca-chinese", {
      month: "numeric",
      day: "numeric",
    });

    for (let d = new Date(year, 0, 1); d.getFullYear() === year; d.setDate(d.getDate() + 1)) {
      const parts = lunarFormatter.formatToParts(d);

      if (
        parts.find(part => part.type === "month")?.value === String(month) &&
        parts.find(part => part.type === "day")?.value === String(day)
      ) {
        return fmtDate(d);
      }
    }
  } catch {
    // Intl without the Chinese calendar: lunar holidays are simply unknown.
  }

  return undefined;
};

const getLunarHolidays = (year: number): Partial<LunarHolidayDates> =>
  LUNAR_HOLIDAYS[year] ?? {
    seollal: findLunarDate(year, 1, 1),
    buddha: findLunarDate(year, 4, 8),
    chuseok: findLunarDate(year, 8, 15),
  };

const threeDays = (center: string): string[] =>
  [shiftDate(center, -1), center, shiftDate(center, 1)];

const getHolidaySpecs = (year: number): HolidaySpec[] => {
  const lunar = getLunarHolidays(year);
  const specs: HolidaySpec[] = [
    { name: "신정", dates: [`${year}-01-01`], rule: "none" },
    { name: "삼일절", dates: [`${year}-03-01`], rule: "weekend" },
    { name: "어린이날", dates: [`${year}-05-05`], rule: "weekend" },
    { name: "현충일", dates: [`${year}-06-06`], rule: "none" },
    { name: "광복절", dates: [`${year}-08-15`], rule: "weekend" },
    { name: "개천절", dates: [`${year}-10-03`], rule: "weekend" },
    { name: "한글날", dates: [`${year}-10-09`], rule: "weekend" },
    { name: "성탄절", dates: [`${year}-12-25`], rule: "weekend" },
  ];

  if (lunar.seollal) specs.push({ name: "설날", dates: threeDays(lunar.seollal), rule: "sunday" });
  if (lunar.buddha) specs.push({ name: "부처님오신날", dates: [lunar.buddha], rule: "weekend" });
  if (lunar.chuseok) specs.push({ name: "추석", dates: threeDays(lunar.chuseok), rule: "sunday" });

  for (const [date, name] of Object.entries(ELECTION_DAYS)) {
    if (date.startsWith(`${year}-`)) specs.push({ name, dates: [date], rule: "none" });
  }

  return specs.sort((a, b) => a.dates[0].localeCompare(b.dates[0]));
};

const dayOfWeek = (dateStr: string): number => parseLocalDate(dateStr).getDay();

const labelFor = (spec: HolidaySpec, index: number): string => {
  if (spec.dates.length !== 3) return spec.name;
  return [`${spec.name} 전날`, spec.name, `${spec.name} 다음날`][index];
};

/** Holidays of one year computed from the law, including 대체공휴일. */
export const computeKoreanHolidays = (year: number): Record<string, string> => {
  const specs = getHolidaySpecs(year);
  const holidays: Record<string, string> = {};
  const holidayCount = new Map<string, number>();

  for (const spec of specs) {
    spec.dates.forEach((date, index) => {
      holidays[date] ??= labelFor(spec, index);
      holidayCount.set(date, (holidayCount.get(date) ?? 0) + 1);
    });
  }

  // Two holidays on one day earn a single substitute between them.
  const compensatedOverlaps = new Set<string>();

  for (const spec of specs) {
    if (spec.rule === "none") continue;

    const onRestDay = spec.dates.some(date => {
      const dow = dayOfWeek(date);
      return dow === 0 || (spec.rule === "weekend" && dow === 6);
    });
    const overlap = spec.dates.find(date =>
      (holidayCount.get(date) ?? 0) > 1 && !compensatedOverlaps.has(date)
    );

    if (!onRestDay && !overlap) continue;
    if (overlap) compensatedOverlaps.add(overlap);

    // The first following day that is neither a weekend nor already a holiday.
    let candidate = addDays(parseLocalDate(spec.dates[spec.dates.length - 1]), 1);

    while (candidate.getDay() === 0 || candidate.getDay() === 6 || holidays[fmtDate(candidate)]) {
      candidate = addDays(candidate, 1);
    }

    holidays[fmtDate(candidate)] = `${spec.name} 대체공휴일`;
  }

  return holidays;
};

const readApiCache = (year: number): HolidayApiItem[] | null => {
  try {
    const raw = localStorage.getItem(`${API_CACHE_PREFIX}${year}`);
    if (!raw) return null;

    const cached = JSON.parse(raw) as { fetchedAt: number; items: HolidayApiItem[] };
    return Date.now() - cached.fetchedAt < API_CACHE_TTL_MS && Array.isArray(cached.items)
      ? cached.items
      : null;
  } catch {
    return null;
  }
};

const writeApiCache = (year: number, items: HolidayApiItem[]) => {
  try {
    localStorage.setItem(
      `${API_CACHE_PREFIX}${year}`,
      JSON.stringify({ fetchedAt: Date.now(), items })
    );
  } catch {
    // Cache is best-effort.
  }
};

const fetchApiHolidays = async (year: number): Promise<HolidayApiItem[]> => {
  const cached = readApiCache(year);
  if (cached) return cached;

  const response = await fetch(`${HOLIDAY_API_URL}/${year}/KR`);
  if (!response.ok) return [];

  const items = await response.json() as HolidayApiItem[];
  writeApiCache(year, items);
  return items;
};

export async function fetchHolidays(year: number): Promise<Record<string, string>> {
  const holidays = computeKoreanHolidays(year);

  try {
    for (const item of await fetchApiHolidays(year)) {
      // Our dates follow the law precisely (substitutes included); the API only
      // adds dates we couldn't know in advance, such as one-off 임시공휴일.
      const name = item.localName || item.globalName;
      if (!item.date || holidays[item.date] || /대체|substitute|alternative/i.test(name)) continue;
      holidays[item.date] = name;
    }
  } catch (error) {
    console.warn("Holiday API failed; using computed holidays only.", error);
  }

  return holidays;
}
