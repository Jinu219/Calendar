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
import { getTodosForDate, getLocalToday } from "../utils";

const CHECK_INTERVAL_MS = 20_000;

const getEffectiveTime = (todo: Todo): string | undefined => {
  if (todo.todoTime) return todo.todoTime;
  if (!todo.allDay && todo.startTime) return todo.startTime;
  return undefined;
};

const subtractMinutes = (dateStr: string, timeStr: string, minutes: number): Date => {
  const [hours, mins] = timeStr.split(":").map(Number);
  const target = new Date(`${dateStr}T00:00:00`);
  target.setHours(hours, mins - minutes, 0, 0);
  return target;
};

export const useReminders = (todos: Todo[], settings: Settings) => {
  const firedRef = useRef<Set<string>>(new Set());
  const todosRef = useRef(todos);
  const settingsRef = useRef(settings);

  todosRef.current = todos;
  settingsRef.current = settings;

  useEffect(() => {
    if (!settings.remindersEnabled) return;

    let cancelled = false;

    const ensurePermission = async () => {
      const granted = await isPermissionGranted();
      if (!granted && !cancelled) {
        await requestPermission();
      }
    };

    void ensurePermission();

    const tick = async () => {
      const currentSettings = settingsRef.current;
      if (!currentSettings.remindersEnabled) return;

      const granted = await isPermissionGranted();
      if (!granted) return;

      const today = getLocalToday();
      const todosToday = getTodosForDate(todosRef.current, today);
      const now = new Date();

      for (const todo of todosToday) {
        if (todo.done) continue;

        const time = getEffectiveTime(todo);
        if (!time) continue;

        const fireKey = `${todo.id}__${today}__${time}`;
        if (firedRef.current.has(fireKey)) continue;

        const notifyAt = subtractMinutes(today, time, currentSettings.reminderMinutesBefore);
        const diffMs = now.getTime() - notifyAt.getTime();

        if (diffMs >= 0 && diffMs < CHECK_INTERVAL_MS) {
          firedRef.current.add(fireKey);

          const body = currentSettings.reminderMinutesBefore > 0
            ? `${time} 일정이 ${currentSettings.reminderMinutesBefore}분 후 시작해요`
            : `${time} 일정이 지금 시작해요`;

          sendNotification({ title: todo.title, body });
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
