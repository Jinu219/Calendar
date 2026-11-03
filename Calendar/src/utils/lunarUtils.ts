// ═══════════════════════════════════════════════════════════
// Moon phase & lunar date
// ═══════════════════════════════════════════════════════════

import type { MoonPhase } from "../types";

const SYNODIC_MONTH_DAYS = 29.53058867;
const DAY_MS = 24 * 60 * 60 * 1000;
const KNOWN_NEW_MOON_UTC = Date.UTC(2000, 0, 6, 18, 14);

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

export function calculateMoonPhase(date: Date): MoonPhase {
  const daysSinceKnownNewMoon = (date.getTime() - KNOWN_NEW_MOON_UTC) / DAY_MS;
  const moonAge = (
    (daysSinceKnownNewMoon % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS
  ) % SYNODIC_MONTH_DAYS;
  const phaseIndex = Math.round(
    moonAge / SYNODIC_MONTH_DAYS * MOON_PHASES.length
  ) % MOON_PHASES.length;

  return MOON_PHASES[phaseIndex];
}

// Creating an Intl formatter is far more expensive than using one, and the
// month view asks for ~42 lunar dates per render.
let lunarFormatter: Intl.DateTimeFormat | null = null;

export function getLunarDateString(date: Date): string {
  try {
    lunarFormatter ??= new Intl.DateTimeFormat("ko-KR-u-ca-chinese", {
      month: "numeric",
      day: "numeric",
    });

    const parts = lunarFormatter.formatToParts(date);
    const month = parts.find(part => part.type === "month")?.value;
    const day = parts.find(part => part.type === "day")?.value;

    return month && day ? `${month}/${day}` : "";
  } catch {
    return "";
  }
}
