import type { HolidayApiItem, MoonPhase } from "../types";
import { addDays, fmtDate, parseLocalDate } from "./dateUtils";

const HOLIDAY_API_URL = "https://date.nager.at/api/v3/PublicHolidays";
const SYNODIC_MONTH_DAYS = 29.53058867;
const DAY_MS = 24 * 60 * 60 * 1000;
const KNOWN_NEW_MOON_UTC = Date.UTC(2000, 0, 6, 18, 14);

const LUNAR_NEW_YEAR_DATES: Record<number, string[]> = {
  2024: ["2024-02-09", "2024-02-10", "2024-02-11"],
  2025: ["2025-01-28", "2025-01-29", "2025-01-30"],
  2026: ["2026-02-16", "2026-02-17", "2026-02-18"],
  2027: ["2027-02-06", "2027-02-07", "2027-02-08"],
};

const CHUSEOK_DATES: Record<number, string[]> = {
  2024: ["2024-09-16", "2024-09-17", "2024-09-18"],
  2025: ["2025-10-05", "2025-10-06", "2025-10-07"],
  2026: ["2026-09-24", "2026-09-25", "2026-09-26"],
  2027: ["2027-09-14", "2027-09-15", "2027-09-16"],
};

const addThreeDayHoliday = (
  holidays: Record<string, string>,
  dates: string[] | undefined,
  name: string
) => {
  if (!dates || dates.length !== 3) return;

  holidays[dates[0]] = `${name} 전날`;
  holidays[dates[1]] = name;
  holidays[dates[2]] = `${name} 다음날`;
};

const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

/**
 * Korean substitute-holiday rule (대체공휴일): when every day of a holiday's range can
 * fall on a weekend, the next date that is neither a weekend nor already a holiday
 * becomes a substitute holiday. New Year's Day, Memorial Day, and Christmas are
 * excluded by law, so they're simply never passed in here.
 */
const applySubstituteHoliday = (
  holidays: Record<string, string>,
  name: string,
  dates: string[]
) => {
  const fallsOnWeekend = dates.some(d => isWeekend(parseLocalDate(d)));
  if (!fallsOnWeekend) return;

  let candidate = addDays(parseLocalDate(dates[dates.length - 1]), 1);

  while (isWeekend(candidate) || holidays[fmtDate(candidate)]) {
    candidate = addDays(candidate, 1);
  }

  holidays[fmtDate(candidate)] = `${name} 대체공휴일`;
};

const getFallbackHolidays = (year: number): Record<string, string> => {
  const holidays: Record<string, string> = {
    [`${year}-01-01`]: "신정",
    [`${year}-03-01`]: "삼일절",
    [`${year}-05-05`]: "어린이날",
    [`${year}-06-06`]: "현충일",
    [`${year}-08-15`]: "광복절",
    [`${year}-10-03`]: "개천절",
    [`${year}-10-09`]: "한글날",
    [`${year}-12-25`]: "크리스마스",
  };

  addThreeDayHoliday(holidays, LUNAR_NEW_YEAR_DATES[year], "설날");
  addThreeDayHoliday(holidays, CHUSEOK_DATES[year], "추석");

  // 법정 대체공휴일 대상 공휴일만, 실제 달력상 날짜 순으로 정렬해 순차 적용
  // (뒤에 처리되는 항목이 앞서 지정된 대체공휴일과 겹치지 않도록)
  const substituteEligible: { name: string; dates: string[] }[] = [
    { name: "삼일절", dates: [`${year}-03-01`] },
    { name: "어린이날", dates: [`${year}-05-05`] },
    { name: "광복절", dates: [`${year}-08-15`] },
    { name: "개천절", dates: [`${year}-10-03`] },
    { name: "한글날", dates: [`${year}-10-09`] },
  ];

  if (LUNAR_NEW_YEAR_DATES[year]) {
    substituteEligible.push({ name: "설날", dates: LUNAR_NEW_YEAR_DATES[year] });
  }

  if (CHUSEOK_DATES[year]) {
    substituteEligible.push({ name: "추석", dates: CHUSEOK_DATES[year] });
  }

  substituteEligible
    .sort((a, b) => a.dates[0].localeCompare(b.dates[0]))
    .forEach(({ name, dates }) => applySubstituteHoliday(holidays, name, dates));

  return holidays;
};

export async function fetchHolidays(year: number): Promise<Record<string, string>> {
  const holidays = getFallbackHolidays(year);

  try {
    const response = await fetch(`${HOLIDAY_API_URL}/${year}/KR`);

    if (!response.ok) {
      return holidays;
    }

    const data = await response.json() as HolidayApiItem[];

    for (const item of data) {
      if (!item.date) continue;

      const rawName = item.localName || item.globalName;
      const isSubstitute = /대체|alternative|substitute/i.test(rawName);

      holidays[item.date] = isSubstitute && !rawName.includes("대체")
        ? `${rawName} (대체공휴일)`
        : rawName;
    }
  } catch (error) {
    console.warn("Holiday API failed; using fallback data.", error);
  }

  return holidays;
}

const MOON_PHASES: MoonPhase[] = [
  { name: "삭", emoji: "🌑" },
  { name: "초승달", emoji: "🌒" },
  { name: "상현달", emoji: "🌓" },
  { name: "차오르는 달", emoji: "🌔" },
  { name: "보름달", emoji: "🌕" },
  { name: "기우는 달", emoji: "🌖" },
  { name: "하현달", emoji: "🌗" },
  { name: "그믐달", emoji: "🌘" },
];

export function calculateMoonPhaseLocally(date: Date): MoonPhase {
  const daysSinceKnownNewMoon = (date.getTime() - KNOWN_NEW_MOON_UTC) / DAY_MS;
  const moonAge = (
    (daysSinceKnownNewMoon % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS
  ) % SYNODIC_MONTH_DAYS;
  const phaseIndex = Math.round(
    moonAge / SYNODIC_MONTH_DAYS * MOON_PHASES.length
  ) % MOON_PHASES.length;

  return MOON_PHASES[phaseIndex];
}

export async function fetchMoonPhase(): Promise<MoonPhase> {
  return calculateMoonPhaseLocally(new Date());
}

export function getLunarDateString(date: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("ko-KR-u-ca-chinese", {
      month: "numeric",
      day: "numeric",
    }).formatToParts(date);
    const month = parts.find(part => part.type === "month")?.value;
    const day = parts.find(part => part.type === "day")?.value;

    return month && day ? `${month}/${day}` : "";
  } catch {
    return "";
  }
}
