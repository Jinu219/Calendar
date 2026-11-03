// ═══════════════════════════════════════════════════════════
// Lunar date
// ═══════════════════════════════════════════════════════════

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
