// ═══════════════════════════════════════════════════════════
// EditTodoModal Component
// ═══════════════════════════════════════════════════════════

import React, { useState } from "react";
import type { EventFormData, Todo } from "../types";
import {
  getDefaultEndTime,
  getRepeatDays,
  getRepeatInterval,
  getTodoStartDate,
  isOccurrenceDone,
  minutesToReminder,
  reminderToMinutes,
  repeatFieldsFromForm,
} from "../utils";
import { EventForm, validateEventForm } from "./EventForm";
import { ModalShell } from "./ModalShell";

interface EditTodoModalProps {
  todo: Todo | null;
  defaultReminderMinutes: number;
  colorLabels: Record<string, string>;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Todo>) => void;
  onDelete: (todo: Todo) => void;
  /** Set when only one occurrence of a recurring todo is being edited. */
  scopeLabel?: string;
}

const toFormData = (todo: Todo): EventFormData => {
  const startDate = getTodoStartDate(todo);
  const startTime = todo.startTime || "09:00";

  return {
    title: todo.title,
    date: startDate,
    startDate,
    endDate: todo.endDate || startDate,
    allDay: todo.allDay,
    startTime,
    endTime: todo.endTime || getDefaultEndTime(startTime),
    color: todo.color,
    repeat: todo.repeat,
    repeatEndDate: todo.repeatEndDate ?? "",
    repeatInterval: getRepeatInterval(todo),
    repeatDays: getRepeatDays(todo),
    monthlyMode: todo.monthlyMode ?? "date",
    reminder: minutesToReminder(todo.reminderMinutes),
    subtasks: todo.subtasks ?? [],
    kind: todo.kind ?? "schedule",
  };
};

/**
 * One-off todos keep a single done flag, recurring ones a done flag per
 * occurrence. Switching between the two carries the first occurrence's state over.
 */
const completionUpdates = (todo: Todo, form: EventFormData): Partial<Todo> => {
  const wasRecurring = todo.repeat !== "none";
  const isRecurring = form.repeat !== "none";

  if (!wasRecurring && isRecurring) {
    return { done: false, doneDates: todo.done ? [form.startDate] : undefined };
  }

  if (wasRecurring && !isRecurring) {
    return { done: isOccurrenceDone(todo, getTodoStartDate(todo)), doneDates: undefined };
  }

  return {};
};

const toTodoUpdates = (form: EventFormData): Partial<Todo> => {
  const allDay = form.kind === "todo" ? true : form.allDay;

  return {
    title: form.title.trim(),
    kind: form.kind,
    color: form.color,
    date: form.startDate,
    startDate: form.startDate,
    endDate: form.endDate || form.startDate,
    allDay,
    startTime: allDay ? undefined : form.startTime,
    endTime: allDay ? undefined : form.endTime,
    reminderMinutes: reminderToMinutes(form.reminder),
    ...repeatFieldsFromForm(form),
  };
};

const SERIES_ONLY_FIELDS: (keyof Todo)[] = [
  "repeat", "repeatEndDate", "repeatInterval", "repeatDays", "monthlyMode", "subtasks",
];

const EditTodoModalContent: React.FC<EditTodoModalProps & { todo: Todo }> = ({
  todo,
  defaultReminderMinutes,
  colorLabels,
  onClose,
  onSave,
  onDelete,
  scopeLabel,
}) => {
  const [form, setForm] = useState<EventFormData>(() => toFormData(todo));
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    const problem = validateEventForm(form);

    if (problem) {
      setError(problem);
      return;
    }

    const updates = scopeLabel
      ? toTodoUpdates(form)
      : { ...toTodoUpdates(form), ...completionUpdates(todo, form) };

    // Editing a single occurrence never changes the series' repetition.
    if (scopeLabel) {
      SERIES_ONLY_FIELDS.forEach(field => delete updates[field]);
    }

    onSave(todo.id, updates);
  };

  return (
    <ModalShell
      title={`✏ ${form.kind === "todo" ? "할 일" : "일정"} 수정${scopeLabel ? ` · ${scopeLabel}` : ""}`}
      onClose={onClose}
    >
      <EventForm
        value={form}
        onChange={patch => {
          setForm(prev => ({ ...prev, ...patch }));
          setError(null);
        }}
        error={error}
        showRepeat={!scopeLabel}
        defaultReminderMinutes={defaultReminderMinutes}
        colorLabels={colorLabels}
        submitLabel="저장"
        onCancel={onClose}
        onSubmit={handleSave}
        secondaryActions={
          <button type="button" className="modal-danger" onClick={() => onDelete(todo)}>
            삭제
          </button>
        }
      />
    </ModalShell>
  );
};

export const EditTodoModal: React.FC<EditTodoModalProps> = ({ todo, ...props }) =>
  // Keyed by id so switching straight to another todo starts a fresh form.
  todo ? <EditTodoModalContent key={todo.id} todo={todo} {...props} /> : null;
