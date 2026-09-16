import { useCallback, useState } from "react";
import { MODAL_CLOSED } from "../constants";
import type { AddMode, AddTodoOptions, EventFormData, ModalState } from "../types";

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
      mode: addMode,
    });
  }, [setSelectedDate, addMode]);

  const handleDateClick = useCallback((dateStr: string) => {
    setSelectedDate(dateStr);

    // In todo mode, a click is the primary way to add a task for that day.
    // In schedule mode, a click only selects the date (use the + button or a
    // week-view time drag to add a timed event) so browsing stays lightweight.
    if (addMode === "todo") {
      setModal({
        open: true,
        date: dateStr,
        startDate: dateStr,
        endDate: dateStr,
        allDay: true,
        startTime: "09:00",
        endTime: "10:00",
        mode: "todo",
      });
    }
  }, [setSelectedDate, addMode]);

  const handleSelect = useCallback((date: string, time: { start: string; end: string }) => {
    setSelectedDate(date);

    // Dragging a time range only makes sense for timed events.
    if (addMode !== "schedule") return;

    setModal({
      open: true,
      date,
      startDate: date,
      endDate: date,
      allDay: false,
      startTime: time.start,
      endTime: time.end,
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
      repeat: data.repeat,
      repeatEndDate: data.repeatEndDate || undefined,
    });

    setSelectedDate(baseDate);
    closeModal();
  }, [addTodo, closeModal, setSelectedDate]);

  return {
    modal,
    closeModal,
    openAddTodoModal,
    handleDateClick,
    handleSelect,
    handleAddEventSubmit,
  };
};
