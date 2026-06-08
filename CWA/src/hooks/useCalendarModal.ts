import { useCallback, useState } from "react";
import { MODAL_CLOSED } from "../constants";
import type { ModalState, RepeatType } from "../types";

interface AddTodoOptions {
  color?: string;
  allDay?: boolean;
  todoTime?: string;
  startTime?: string;
  endTime?: string;
  startDate?: string;
  endDate?: string;
  repeat?: RepeatType;
  repeatEndDate?: string;
}

interface AddEventSubmitData {
  title: string;
  date: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  color: string;
  repeat: RepeatType;
  repeatEndDate: string;
}

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

  const handleDateClick = useCallback((
    dateStr: string,
    allDay: boolean,
    time?: { start: string; end: string }
  ) => {
    setSelectedDate(dateStr);

  }, [setSelectedDate]);

  const handleSelect = useCallback((date: string, time: { start: string; end: string }) => {
    setSelectedDate(date);

  }, [setSelectedDate]);

  const handleAddEventSubmit = useCallback((data: AddEventSubmitData) => {
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