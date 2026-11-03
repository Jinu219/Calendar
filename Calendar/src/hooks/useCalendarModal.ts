import { useCallback, useState } from "react";
import { MODAL_CLOSED } from "../constants";
import type { AddMode, AddTodoOptions, EventFormData, ModalState } from "../types";
import { reminderToMinutes, repeatFieldsFromForm } from "../utils";

interface UseCalendarModalParams {
  addTodo: (
    title: string,
    date: string,
    options?: AddTodoOptions
  ) => void;
  setSelectedDate: (date: string) => void;
  addMode: AddMode;
}

export const useCalendarModal = ({
  addTodo,
  setSelectedDate,
  addMode,
}: UseCalendarModalParams) => {
  const [modal, setModal] = useState<ModalState>(MODAL_CLOSED);

  // "all" (both kinds visible) still needs one concrete kind to create when adding.
  const effectiveKind = addMode === "todo" ? "todo" : "schedule";

  const closeModal = useCallback(() => {
    setModal(MODAL_CLOSED);
  }, []);

  const openAddTodoModal = useCallback((dateStr: string) => {
    setSelectedDate(dateStr);

    setModal({
      open: true,
      date: dateStr,
      startDate: dateStr,
      endDate: dateStr,
      allDay: true,
      startTime: "09:00",
      endTime: "10:00",
      mode: effectiveKind,
    });
  }, [setSelectedDate, effectiveKind]);

  /** Open the add form prefilled (e.g. with a draft Claude made from a sentence). */
  const openWithDraft = useCallback((draft: Partial<EventFormData>) => {
    const date = draft.startDate ?? draft.date ?? "";
    if (date) setSelectedDate(date);

    setModal({
      ...MODAL_CLOSED,
      open: true,
      date,
      startDate: date,
      endDate: draft.endDate ?? date,
      allDay: draft.allDay ?? true,
      mode: draft.kind ?? effectiveKind,
      draft,
    });
  }, [setSelectedDate, effectiveKind]);

  /** A drag over days (month) or hours (week) opens the add form for that range. */
  const handleSelect = useCallback((
    startDate: string,
    endDate: string,
    time?: { start: string; end: string }
  ) => {
    setSelectedDate(startDate);

    // Dragging a range only makes sense for timed/multi-day events.
    if (addMode === "todo") return;

    setModal({
      open: true,
      date: startDate,
      startDate,
      endDate,
      allDay: !time,
      startTime: time?.start ?? "09:00",
      endTime: time?.end ?? "10:00",
      mode: "schedule",
    });
  }, [setSelectedDate, addMode]);

  const handleAddEventSubmit = useCallback((data: EventFormData) => {
    const baseDate = data.startDate || data.date;

    addTodo(data.title, baseDate, {
      color: data.color,
      allDay: data.allDay,
      startTime: data.allDay ? undefined : data.startTime,
      endTime: data.allDay ? undefined : data.endTime,
      startDate: data.startDate || baseDate,
      endDate: data.endDate || data.startDate || baseDate,
      reminderMinutes: reminderToMinutes(data.reminder),
      ...repeatFieldsFromForm(data),
      kind: data.kind,
    });

    setSelectedDate(baseDate);
    closeModal();
  }, [addTodo, closeModal, setSelectedDate]);

  return {
    modal,
    closeModal,
    openAddTodoModal,
    openWithDraft,
    handleSelect,
    handleAddEventSubmit,
  };
};
