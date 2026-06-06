// ═══════════════════════════════════════════════════════════
// AddEventModal Component
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from "react";
import type { ModalState, RepeatType } from "../types";
import { TODO_COLORS, getLocalToday } from "../constants";

interface AddEventModalProps {
  isOpen: boolean;
  initialData?: ModalState;
  onClose: () => void;
  onSubmit: (data: {
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
  }) => void;
}

const getDefaultModalDate = () => getLocalToday();

const getDefaultFormData = (initialData?: ModalState) => {
  const today = getDefaultModalDate();

  return {
    title: "",
    date: initialData?.date || today,
    startDate: initialData?.startDate || initialData?.date || today,
    endDate: initialData?.endDate || initialData?.date || today,
    startTime: initialData?.startTime || "09:00",
    endTime: initialData?.endTime || "10:00",
    allDay: initialData?.allDay ?? true,
    color: TODO_COLORS[0],
    repeat: "none" as RepeatType,
    repeatEndDate: "",
  };
};

export const AddEventModal: React.FC<AddEventModalProps> = ({
  isOpen,
  initialData,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(getDefaultModalDate());
  const [startDate, setStartDate] = useState(getDefaultModalDate());
  const [endDate, setEndDate] = useState(getDefaultModalDate());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [allDay, setAllDay] = useState(true);
  const [color, setColor] = useState(TODO_COLORS[0]);
  const [repeat, setRepeat] = useState<RepeatType>("none");
  const [repeatEndDate, setRepeatEndDate] = useState("");

  const resetForm = (data?: ModalState) => {
    const defaults = getDefaultFormData(data);

    setTitle(defaults.title);
    setDate(defaults.date);
    setStartDate(defaults.startDate);
    setEndDate(defaults.endDate);
    setStartTime(defaults.startTime);
    setEndTime(defaults.endTime);
    setAllDay(defaults.allDay);
    setColor(defaults.color);
    setRepeat(defaults.repeat);
    setRepeatEndDate(defaults.repeatEndDate);
  };

  useEffect(() => {
    if (!isOpen) return;

    resetForm(initialData);
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleClose = () => {
    resetForm(initialData);
    onClose();
  };

  const handleSubmit = () => {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      handleClose();
      return;
    }

    const submitStartDate = startDate || date;
    const submitEndDate = endDate || submitStartDate;

    onSubmit({
      title: trimmedTitle,
      date: submitStartDate,
      startDate: submitStartDate,
      endDate: submitEndDate,
      allDay,
      startTime: allDay ? "09:00" : startTime,
      endTime: allDay ? "10:00" : endTime,
      color,
      repeat,
      repeatEndDate,
    });

    resetForm();
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    setDate(value);

    if (!endDate || endDate < value) {
      setEndDate(value);
    }
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-box glass-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <span>시간 일정 추가</span>
          <button className="modal-close" onClick={handleClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="modal-date-preview">
            {startDate}
            {startDate !== endDate && ` ~ ${endDate}`}
            {!allDay && ` ${startTime} ~ ${endTime}`}
          </div>

          <input
            className="todo-input modal-input"
            placeholder="일정 제목…"
            value={title}
            autoFocus
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
          />

          <div className="modal-times">
            <label className="time-lbl">
              시작일
              <input
                type="date"
                className="time-input"
                value={startDate}
                onChange={e => handleStartDateChange(e.target.value)}
              />
            </label>

            <label className="time-lbl">
              종료일
              <input
                type="date"
                className="time-input"
                value={endDate}
                min={startDate}
                onChange={e => handleEndDateChange(e.target.value)}
              />
            </label>
          </div>

          <div className="modal-times">
            <label className="time-lbl">
              시작
              <input
                type="time"
                className="time-input"
                value={startTime}
                disabled={allDay}
                onChange={e => setStartTime(e.target.value)}
              />
            </label>

            <label className="time-lbl">
              종료
              <input
                type="time"
                className="time-input"
                value={endTime}
                disabled={allDay}
                onChange={e => setEndTime(e.target.value)}
              />
            </label>

            <label className="allday-lbl">
              <input
                type="checkbox"
                checked={allDay}
                onChange={e => setAllDay(e.target.checked)}
              />
              종일
            </label>
          </div>

          <div className="color-row-setting" style={{ padding: "2px 0" }}>
            {TODO_COLORS.map(c => (
              <button
                key={c}
                type="button"
                className={`color-dot-setting ${color === c ? "selected" : ""}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>

          <div className="repeat-row">
            <span className="repeat-label">반복</span>
            <select
              className="repeat-select"
              value={repeat}
              onChange={e => setRepeat(e.target.value as RepeatType)}
            >
              <option value="none">없음</option>
              <option value="daily">매일</option>
              <option value="weekly">매주</option>
              <option value="monthly">매월</option>
            </select>
          </div>

          {repeat !== "none" && (
            <div className="modal-times">
              <label className="time-lbl">
                반복 종료일
                <input
                  type="date"
                  className="time-input"
                  value={repeatEndDate}
                  min={startDate}
                  onChange={e => setRepeatEndDate(e.target.value)}
                />
              </label>
            </div>
          )}

          <div className="modal-actions">
            <button className="modal-cancel" onClick={handleClose}>취소</button>
            <button className="modal-confirm" onClick={handleSubmit}>추가</button>
          </div>
        </div>
      </div>
    </div>
  );
};