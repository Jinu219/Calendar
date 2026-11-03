// ═══════════════════════════════════════════════════════════
// useHolidays Hook
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { fetchHolidays } from "../utils";

/** Holidays for every year the user is looking at, loaded on demand. */
export function useHolidays(years: number[]) {
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  const requestedYears = useRef(new Set<number>());
  const yearsKey = [...new Set(years)].sort().join(",");

  useEffect(() => {
    const missing = yearsKey
      .split(",")
      .map(Number)
      .filter(year => Number.isFinite(year) && !requestedYears.current.has(year));

    if (missing.length === 0) return;

    missing.forEach(year => requestedYears.current.add(year));

    // Results are merged even if the visible years changed meanwhile: a year
    // once requested is never requested again, so dropping them would lose it.
    Promise.all(missing.map(fetchHolidays))
      .then(results => setHolidays(prev => Object.assign({}, prev, ...results)))
      .catch(error => {
        console.error("Failed to load holidays:", error);
        missing.forEach(year => requestedYears.current.delete(year));
      });
  }, [yearsKey]);

  return { holidays };
}
