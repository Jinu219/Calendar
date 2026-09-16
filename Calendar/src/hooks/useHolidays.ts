// ═══════════════════════════════════════════════════════════
// useHolidays Hook
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { fetchHolidays } from "../utils";

export function useHolidays() {
  const [holidays, setHolidays] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;

    const loadHolidays = async () => {
      const year = new Date().getFullYear();
      const [currentYear, nextYear] = await Promise.all([
        fetchHolidays(year),
        fetchHolidays(year + 1),
      ]);

      if (active) {
        setHolidays({ ...currentYear, ...nextYear });
      }
    };

    void loadHolidays();

    return () => {
      active = false;
    };
  }, []);

  return { holidays };
}
