// ═══════════════════════════════════════════════════════════
// useHolidays Hook
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { fetchHolidays } from "../utils";

export function useHolidays() {
  const [holidays, setHolidays] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const year = new Date().getFullYear();
      const h1 = await fetchHolidays(year);
      const h2 = await fetchHolidays(year + 1);
      setHolidays({ ...h1, ...h2 });
    })();
  }, []);

  return { holidays, setHolidays };
}
