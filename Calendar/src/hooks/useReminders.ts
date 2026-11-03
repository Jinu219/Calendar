// ═══════════════════════════════════════════════════════════
// useReminders Hook — desktop notifications for upcoming todos
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef } from "react";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import type { Settings, Todo } from "../types";
import {
  getAgendaForDate,
  getLocalToday,
  getTodoStartTime,
  parseLocalDate,
  shiftDate,
  timeToMinutes,
} from "../utils";

const CHECK_INTERVAL_MS = 20_000;
// WebView timers are throttled to about once a minute while the widget sits
// hidden in the tray, and the PC may sleep. Anything due within this window
// since the last check is still announced instead of silently skipped.
const MAX_CATCH_UP_MS = 10 * 60_000;

const reminderTime = (dateStr: string, time: string, minutesBefore: number): number => {
  const at = parseLocalDate(dateStr);
  at.setMinutes(timeToMinutes(time) - minutesBefore);
  return at.getTime();
};

export const useReminders = (todos: Todo[], settings: Settings) => {
  const firedRef = useRef<Set<string>>(new Set());
  const lastCheckRef = useRef<number | null>(null);
  const todosRef = useRef(todos);
  const settingsRef = useRef(settings);

  todosRef.current = todos;
  settingsRef.current = settings;

  useEffect(() => {
    if (!settings.remindersEnabled) return;

    let cancelled = false;

    const ensurePermission = async () => {
      try {
        const granted = await isPermissionGranted();
        if (!granted && !cancelled) {
          await requestPermission();
        }
      } catch (error) {
        console.error("Failed to check notification permission:", error);
      }
    };

    void ensurePermission();

    const tick = async () => {
      const currentSettings = settingsRef.current;
      if (!currentSettings.remindersEnabled) return;

      const now = Date.now();
      const since = Math.max(lastCheckRef.current ?? now - CHECK_INTERVAL_MS, now - MAX_CATCH_UP_MS);
      lastCheckRef.current = now;

      try {
        if (!await isPermissionGranted()) return;
      } catch {
        return;
      }

      const lead = currentSettings.reminderMinutesBefore;
      const today = getLocalToday();

      // Tomorrow too: a 00:05 item with a 10-minute lead is announced tonight.
      for (const date of [today, shiftDate(today, 1)]) {
        for (const item of getAgendaForDate(todosRef.current, date)) {
          // Multi-day items are announced once, on the day they start.
          if (item.done || item.occurrenceDate !== date) continue;

          const time = getTodoStartTime(item.todo);
          if (!time) continue;

          const fireKey = `${item.todo.id}__${date}__${time}__${lead}`;
          if (firedRef.current.has(fireKey)) continue;

          const notifyAt = reminderTime(date, time, lead);
          if (notifyAt <= since || notifyAt > now) continue;

          firedRef.current.add(fireKey);

          const body = lead > 0
            ? `${time} 시작 · ${lead}분 전 알림`
            : `${time} 지금 시작해요`;

          sendNotification({ title: item.todo.title, body });
        }
      }
    };

    void tick();
    const interval = window.setInterval(tick, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [settings.remindersEnabled, settings.reminderMinutesBefore]);
};
