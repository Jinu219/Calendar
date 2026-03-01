// ═══════════════════════════════════════════════════════════
// API Utility Functions
// ═══════════════════════════════════════════════════════════

import type { HolidayAPIItem, MoonPhase } from "../types";

/** Fetch holidays from API */
export async function fetchHolidays(year: number): Promise<Record<string, string>> {
  const holidays: Record<string, string> = {};
  
  try {
    const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/KR`);
    if (response.ok) {
      const data: HolidayAPIItem[] = await response.json();
      for (const item of data) {
        if (item.isHoliday) {
          holidays[item.localeDate] = item.dateName;
        }
      }
    }
  } catch (e) {
    console.log("Holiday API failed, using fallback data");
  }

  // Fallback: 기본 공휴일
  const baseHolidays: Record<string, string> = {
    [`${year}-01-01`]: "신정",
    [`${year}-03-01`]: "삼일절",
    [`${year}-05-05`]: "어린이날",
    [`${year}-05-15`]: "부처님오신날",
    [`${year}-06-06`]: "현충일",
    [`${year}-08-15`]: "광복절",
    [`${year}-10-03`]: "개천절",
    [`${year}-10-09`]: "한글날",
    [`${year}-12-25`]: "크리스마스",
  };

  for (const [date, name] of Object.entries(baseHolidays)) {
    if (!holidays[date]) {
      holidays[date] = name;
    }
  }

  // Add lunar holidays
  const lunarNewYear = getLunarNewYear(year);
  if (lunarNewYear.length >= 1) {
    holidays[`${year}-01-0${lunarNewYear[0]}`] = "설날전날";
    if (lunarNewYear.length >= 2) {
      holidays[`${year}-01-0${lunarNewYear[1]}`] = "설날";
      if (lunarNewYear.length >= 3) {
        holidays[`${year}-01-0${lunarNewYear[2]}`] = "설날다음날";
      }
    }
  }

  const chuseok = getChuseok(year);
  if (chuseok.length >= 1) {
    const chuseokMonth = chuseok[0];
    const prefix = chuseokMonth >= 10 ? `${chuseokMonth}-` : `0${chuseokMonth}-`;
    holidays[`${year}-${prefix}${chuseok[1]}`] = "추석전날";
    if (chuseok.length >= 2) {
      holidays[`${year}-${prefix}${chuseok[2]}`] = "추석";
      if (chuseok.length >= 3) {
        holidays[`${year}-${prefix}${chuseok[3]}`] = "추석다음날";
      }
    }
  }

  // 대체 공휴일
  if (year === 2024) holidays["2024-05-06"] = "대체공휴일";
  if (year === 2025) holidays["2025-05-06"] = "대체공휴일";
  if (year === 2026) {
    // 2026년 대체공휴일 (설연휴 연속 휴일)
    holidays["2026-02-17"] = "대체공휴일";
  }

  return holidays;
}

const getLunarNewYear = (year: number): number[] => {
  const lunarNewYears: Record<number, number[]> = {
    2024: [2, 9, 10],
    2025: [1, 28, 29, 30],
    2026: [2, 16, 17, 18],
    2027: [2, 6, 7, 8],
    2028: [1, 26, 27, 28],
    2029: [2, 13, 14, 15],
    2030: [2, 3, 4, 5],
  };
  return lunarNewYears[year] || [2, 10];
};

const getChuseok = (year: number): number[] => {
  const chuseokDates: Record<number, number[]> = {
    2024: [9, 16, 17, 18],
    2025: [10, 5, 6, 7],
    2026: [9, 24, 25, 26],
    2027: [9, 14, 15, 16],
    2028: [9, 29, 30, 10, 1],
    2029: [9, 19, 20, 21],
    2030: [9, 8, 9, 10],
  };
  return chuseokDates[year] || [9, 20];
};

/** Fetch moon phase from API */
export async function fetchMoonPhase(): Promise<MoonPhase> {
  try {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const response = await fetch(`https://moon-api.com/?date=${dateStr}`);
    if (response.ok) {
      const data = await response.json();
      if (data && data.phase) {
        return getPhaseFromIndex(Math.round(data.phase));
      }
    }
  } catch (e) {
    console.log("Moon phase API failed, calculating locally");
  }
  
  return calculateMoonPhaseLocally(new Date());
}

function getPhaseFromIndex(index: number): MoonPhase {
  const phases: Record<number, MoonPhase> = {
    0: { name: "삭", emoji: "🌑" },
    1: { name: "초승달", emoji: "🌒" },
    2: { name: "초승달", emoji: "🌒" },
    3: { name: "초승달", emoji: "🌒" },
    4: { name: "상현망간달", emoji: "🌓" },
    5: { name: "상현달", emoji: "🌓" },
    6: { name: "상현달", emoji: "🌓" },
    7: { name: "상현달", emoji: "🌓" },
    8: { name: "보름달", emoji: "🌕" },
    9: { name: "망명", emoji: "🌕" },
    10: { name: "망명", emoji: "🌕" },
    11: { name: "하현달", emoji: "🌖" },
    12: { name: "하현달", emoji: "🌖" },
    13: { name: "하현달", emoji: "🌖" },
    14: { name: "하현망간달", emoji: "🌖" },
    15: { name: "보름달", emoji: "🌕" },
    16: { name: "김서리달", emoji: "🌗" },
    17: { name: "김서리달", emoji: "🌗" },
    18: { name: "김서리달", emoji: "🌗" },
    19: { name: "하현망간달", emoji: "🌗" },
    20: { name: "하현달", emoji: "🌖" },
    21: { name: "하현달", emoji: "🌖" },
    22: { name: "하현달", emoji: "🌖" },
    23: { name: "하현망간달", emoji: "🌖" },
    24: { name: "보름달", emoji: "🌕" },
  };
  return phases[index] || { name: "", emoji: "" };
}

/** Calculate moon phase locally (fallback) */
export function calculateMoonPhaseLocally(date: Date): MoonPhase {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  let jd = (1461 * (year + 4800 + (month - 14) / 12)) / 4 +
           (367 * (month - 2 - 12 * ((month - 14) / 12))) / 12 -
           (3 * ((year + 4900 + (month - 14) / 12) / 100)) / 4 +
           day - 32075;
  
  const phase = (jd + 1.5) % 29.53;
  const phaseIndex = Math.floor((phase / 29.53) * 24);
  
  return getPhaseFromIndex(phaseIndex);
}

/** Get lunar date string */
export function getLunarDateString(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  // 음력 계산 (간단한 방식)
  // 음력은 양력보다 약 20~50일 정도 늦음
  const lunarOffset = getLunarOffset(year, month);
  let lunarMonth = month;
  let lunarDay = day - lunarOffset;
  
  if (lunarDay <= 0) {
    // 이전 달로
    lunarMonth = month - 1;
    if (lunarMonth <= 0) {
      lunarMonth = 12;
    }
    // 이전 달의 마지막 날로
    const lastDay = getLunarMonthDays(year, lunarMonth);
    lunarDay = lastDay + lunarDay;
  }
  
  // 음력일 이름
  const dayNames = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十',
                    '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
                    '廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
  
  // 음력월 이름 (간단)
  const monthNames = ['','正月','二月','三月','四月','五月','六月','七月','八月','九月','十月','臘月'];
  
  // 적절한 형식으로 반환
  if (lunarDay >= 1 && lunarDay <= 30) {
    return dayNames[lunarDay - 1] || `${lunarDay}`;
  }
  return `${lunarDay}`;
}

// 음력 오프셋 가져오기 (대략적)
function getLunarOffset(year: number, month: number): number {
  // 음력 캘린더 데이터 (양력 월/일 -> 음력 오프셋)
  const lunarCalendar: Record<string, number> = {
    // 2026년
    '2026-1': 20, '2026-2': 19, '2026-3': 20, '2026-4': 19, '2026-5': 20, '2026-6': 20,
    '2026-7': 21, '2026-8': 21, '2026-9': 22, '2026-10': 22, '2026-11': 22, '2026-12': 22,
    // 2025년
    '2025-1': 22, '2025-2': 20, '2025-3': 21, '2025-4': 20, '2025-5': 21, '2025-6': 21,
    '2025-7': 22, '2025-8': 22, '2025-9': 23, '2025-10': 23, '2025-11': 23, '2025-12': 23,
    // 2024년
    '2024-1': 21, '2024-2': 19, '2024-3': 20, '2024-4': 19, '2024-5': 20, '2024-6': 20,
    '2024-7': 21, '2024-8': 21, '2024-9': 22, '2024-10': 22, '2024-11': 22, '2024-12': 22,
  };
  
  const key = `${year}-${month}`;
  return lunarCalendar[key] || 20;
}

// 음력 월의 마지막 날
function getLunarMonthDays(year: number, month: number): number {
  // 대략 29 또는 30일
  const leapMonths = [2024, 2026];
  if (leapMonths.includes(year)) {
    if (month === 6) return 30; // 윤월
  }
  // 기본값
  return month % 2 === 0 ? 29 : 30;
}
