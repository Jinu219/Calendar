// ═══════════════════════════════════════════════════════════
// AddEventModal Component
// ═══════════════════════════════════════════════════════════

import React, { useState } from "react";
import type { EventFormData, ModalState } from "../types";
import { TODO_COLORS } from "../constants";
import { getLocalToday, parseLocalDate } from "../utils";
import { EventForm, validateEventForm } from "./EventForm";
import { ModalShell } from "./ModalShell";

interface AddEventModalProps {
  isOpen: boolean;
  initialData?: ModalState;
  defaultReminderMinutes: number;
  colorLabels: Record<string, string>;
  onSuggestSubtasks?: (title: string, dueDate: string, existing: string[]) => Promise<string[]>;
  onClose: () => void;
  onSubmit: (data: EventFormData) => void;
}

const toFormData = (initialData?: ModalState): EventFormData => {
  const today = getLocalToday();
  const startDate = initialData?.startDate || initialData?.date || today;
  const kind = initialData?.mode ?? "schedule";

  return {
    title: "",
    date: startDate,
    startDate,
    endDate: initialData?.endDate || startDate,
    startTime: initialData?.startTime || "09:00",
    endTime: initialData?.endTime || "10:00",
    allDay: kind === "todo" ? true : initialData?.allDay ?? true,
    color: TODO_COLORS[0],
    repeat: "none",
    repeatEndDate: "",
    repeatInterval: 1,
    repeatDays: [parseLocalDate(startDate).getDay()],
    monthlyMode: "date",
    reminder: "default",
    subtasks: [],
    kind,
    ...initialData?.draft,
  };
};

const AddEventModalContent: React.FC<Omit<AddEventModalProps, "isOpen">> = ({
  initialData,
  defaultReminderMinutes,
  colorLabels,
  onSuggestSubtasks,
  onClose,
  onSubmit,
}) => {
  const aiFilled = Boolean(initialData?.draft);
  // Mounted fresh on every open, so the form starts from initialData each time.
  const [form, setForm] = useState<EventFormData>(() => toFormData(initialData));
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    const problem = validateEventForm(form);

    if (problem) {
      setError(problem);
      return;
    }

    onSubmit({
      ...form,
      title: form.title.trim(),
      allDay: form.kind === "todo" ? true : form.allDay,
      endDate: form.endDate || form.startDate,
    });
  };

  return (
    <ModalShell
      title={`${aiFilled ? "✨ " : ""}${form.kind === "todo" ? "할 일 추가" : "일정 추가"}`}
      onClose={onClose}
    >
      {aiFilled && (
        <p className="ai-filled-hint" role="status">Claude가 채운 내용이에요. 확인하고 고친 뒤 추가를 눌러 주세요.</p>
      )}
      <EventForm
        value={form}
        onChange={patch => {
          setForm(prev => ({ ...prev, ...patch }));
          setError(null);
        }}
        error={error}
        showRepeat
        defaultReminderMinutes={defaultReminderMinutes}
        colorLabels={colorLabels}
        onSuggestSubtasks={onSuggestSubtasks}
        submitLabel="추가"
        onCancel={onClose}
        onSubmit={handleSubmit}
      />
    </ModalShell>
  );
};

export const AddEventModal: React.FC<AddEventModalProps> = ({ isOpen, ...props }) =>
  isOpen ? <AddEventModalContent {...props} /> : null;
