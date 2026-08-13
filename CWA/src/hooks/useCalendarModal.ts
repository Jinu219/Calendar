import { useCallback, useState } from "react";
import { MODAL_CLOSED } from "../constants";
import type { AddTodoOptions, EventFormData, ModalState } from "../types";

interface UseCalendarModalParams {
  addTodo: (
    title: string,
    date: string,
    options?: AddTodoOptions
  ) => void;
  setSelectedDate: (date: string) => void;
}

export const useCalendarModal = ({
  addTodo,
  setSelectedDate,
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
    });
  }, [setSelectedDate]);

  const handleDateClick = useCallback((dateStr: string) => {
    setSelectedDate(dateStr);
  }, [setSelectedDate]);

  const handleSelect = useCallback((date: string) => {
    setSelectedDate(date);
  }, [setSelectedDate]);

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
