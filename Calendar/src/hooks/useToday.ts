// ═══════════════════════════════════════════════════════════
// useToday Hook — today's date that follows midnight
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { getLocalToday } from "../utils";

const CHECK_INTERVAL_MS = 60_000;

/**
 * The widget stays open for days, so "today" can't be read once at startup.
 * Re-checked every minute and whenever the window becomes visible again.
 */
export function useToday(): string {
  const [today, setToday] = useState(getLocalToday);

  useEffect(() => {
    const sync = () => {
      const now = getLocalToday();
      setToday(prev => (prev === now ? prev : now));
    };

    const interval = window.setInterval(sync, CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  return today;
}
