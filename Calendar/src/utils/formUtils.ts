// ═══════════════════════════════════════════════════════════
// Form ⇄ Todo conversions shared by the add and edit flows
// ═══════════════════════════════════════════════════════════

import type { EventFormData, ReminderChoice, RepeatType, Todo } from "../types";

/** Repeat types that take an "every N" interval, with the unit shown next to it. */
export const REPEAT_INTERVAL_UNITS: Partial<Record<RepeatType, string>> = {
  daily: "일",
  weekly: "주",
  monthly: "개월",
  yearly: "년",
};

export const reminderToMinutes = (choice: ReminderChoice): number | null | undefined =>
  choice === "default" ? undefined : choice === "none" ? null : choice;

export const minutesToReminder = (minutes: number | null | undefined): ReminderChoice =>
  minutes === undefined ? "default" : minutes === null ? "none" : minutes;

/** The repetition fields of a todo as the form describes them (unused ones cleared). */
export const repeatFieldsFromForm = (form: EventFormData): Partial<Todo> => ({
  repeat: form.repeat,
  repeatEndDate: form.repeat !== "none" && form.repeatEndDate ? form.repeatEndDate : undefined,
  repeatInterval: REPEAT_INTERVAL_UNITS[form.repeat] && form.repeatInterval > 1 ? form.repeatInterval : undefined,
  repeatDays: form.repeat === "weekly" ? form.repeatDays : undefined,
  monthlyMode: form.repeat === "monthly" && form.monthlyMode === "weekday" ? "weekday" : undefined,
  // Checklists belong to one-off items only.
  subtasks: form.repeat === "none" && form.subtasks.length > 0 ? form.subtasks : undefined,
});
