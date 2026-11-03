// ═══════════════════════════════════════════════════════════
// useReminders Hook — desktop notifications for upcoming todos
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef } from "react";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import type { AgendaItem, Settings, Todo } from "../types";
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

const at = (dateStr: string, time: string, minutesBefore = 0): number => {
  const moment = parseLocalDate(dateStr);
  moment.setMinutes(timeToMinutes(time) - minutesBefore);
  return moment.getTime();
};

const leadLabel = (minutes: number): string => {
  if (minutes === 0) return "지금 시작해요";
  if (minutes === 1440) return "내일 이 시간에 시작해요";
  return minutes >= 60 ? `${minutes / 60}시간 후 시작해요` : `${minutes}분 후 시작해요`;
};

const titlesOf = (items: AgendaItem[]): string => {
  const titles = items.map(item => item.todo.title);
  return titles.length > 3 ? `${titles.slice(0, 3).join(", ")} 외 ${titles.length - 3}개` : titles.join(", ");
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
      const current = settingsRef.current;
      if (!current.remindersEnabled) return;

      const now = Date.now();
      const since = Math.max(lastCheckRef.current ?? now - CHECK_INTERVAL_MS, now - MAX_CATCH_UP_MS);
      lastCheckRef.current = now;

      try {
        if (!await isPermissionGranted()) return;
      } catch {
        return;
      }

      const isDue = (moment: number) => moment > since && moment <= now;
      const notifyOnce = (key: string, title: string, body: string) => {
        if (firedRef.current.has(key)) return;
        firedRef.current.add(key);
        sendNotification({ title, body });
      };

      const today = getLocalToday();
      const tomorrow = shiftDate(today, 1);
      // Subscribed calendars are someone else's schedule: no notifications for them.
      const own = todosRef.current.filter(todo => !todo.sourceId);
      const todayAgenda = getAgendaForDate(own, today).filter(item => !item.done);

      // Timed items, each with its own lead time (or the global default).
      // Tomorrow is scanned too: "하루 전" and a 00:05 item with a 10-minute lead fire today.
      for (const date of [today, tomorrow]) {
        const agenda = date === today ? todayAgenda : getAgendaForDate(own, date).filter(item => !item.done);

        for (const item of agenda) {
          // Multi-day items are announced once, on the day they start.
          if (item.occurrenceDate !== date) continue;

          const time = getTodoStartTime(item.todo);
          const lead = item.todo.reminderMinutes === undefined
            ? current.reminderMinutesBefore
            : item.todo.reminderMinutes;

          if (!time || lead === null) continue;

          if (isDue(at(date, time, lead))) {
            notifyOnce(`${item.todo.id}__${date}__${time}__${lead}`, item.todo.title, `${time} · ${leadLabel(lead)}`);
          }
        }
      }

      // Morning digest of today's all-day items and of todos due tomorrow.
      if (current.allDayReminderTime && isDue(at(today, current.allDayReminderTime))) {
        const allDay = todayAgenda.filter(item => !getTodoStartTime(item.todo) && item.occurrenceDate === today);

        if (allDay.length > 0) {
          notifyOnce(`allday__${today}`, `오늘 할 일 ${allDay.length}개`, titlesOf(allDay));
        }

        if (current.todoDueReminder) {
          const dueTomorrow = getAgendaForDate(own, tomorrow).filter(item =>
            !item.done && item.todo.kind === "todo" && item.occurrenceEndDate === tomorrow
          );

          if (dueTomorrow.length > 0) {
            notifyOnce(`due__${today}`, `내일 마감 ${dueTomorrow.length}개`, titlesOf(dueTomorrow));
          }
        }
      }
    };

    void tick();
    const interval = window.setInterval(tick, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [settings.remindersEnabled]);
};
