// ═══════════════════════════════════════════════════════════
// useTrayStatus Hook — "오늘 남은 일정 N개" on the tray icon
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Todo } from "../types";
import { formatClock, getAgendaForDate, getTodoStartTime } from "../utils";

const REFRESH_MS = 60_000;

/** Today's items not done yet whose time hasn't passed (all-day items count until done). */
export const countRemainingToday = (todos: Todo[], today: string, now: Date): number => {
  const clock = formatClock(now);

  return getAgendaForDate(todos, today).filter(item => {
    if (item.done) return false;
    const time = getTodoStartTime(item.todo);
    return !time || item.occurrenceDate !== today || time >= clock;
  }).length;
};

export function useTrayStatus(todos: Todo[], today: string) {
  const [minute, setMinute] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setMinute(Date.now()), REFRESH_MS);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const remaining = countRemainingToday(todos, today, new Date(minute));
    const text = remaining > 0 ? `Calendar · 오늘 남은 일정 ${remaining}개` : "Calendar · 오늘 일정 끝!";

    invoke("set_tray_tooltip", { text }).catch(() => {
      // No tray (browser preview) — nothing to update.
    });
  }, [todos, today, minute]);
}
