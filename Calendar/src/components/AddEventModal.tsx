// ═══════════════════════════════════════════════════════════
// AddEventModal Component
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from "react";
import type { EventFormData, ItemKind, ModalState, RepeatType } from "../types";
import { TODO_COLORS } from "../constants";
import { getLocalToday } from "../utils";

interface AddEventModalProps {
  isOpen: boolean;
  initialData?: ModalState;
  onClose: () => void;
  onSubmit: (data: EventFormData) => void;
}

const getDefaultModalDate = () => getLocalToday();

const getDefaultFormData = (initialData?: ModalState): EventFormData => {
  const today = getDefaultModalDate();
  const mode = initialData?.mode ?? "schedule";
  const isTodoMode = mode === "todo";

  return {
    title: "",
    date: initialData?.date || today,
    startDate: initialData?.startDate || initialData?.date || today,
    endDate: initialData?.endDate || initialData?.date || today,
    startTime: initialData?.startTime || "09:00",
    endTime: initialData?.endTime || "10:00",
    allDay: isTodoMode ? true : initialData?.allDay ?? true,
    color: TODO_COLORS[0],
    repeat: "none",
    repeatEndDate: "",
    kind: mode,
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
  const [color, setColor] = useState<string>(TODO_COLORS[0]);
  const [repeat, setRepeat] = useState<RepeatType>("none");
  const [repeatEndDate, setRepeatEndDate] = useState("");
  const [mode, setMode] = useState<ItemKind>("schedule");

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
    setMode(data?.mode ?? "schedule");
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
    const submitAllDay = mode === "todo" ? true : allDay;

    onSubmit({
      title: trimmedTitle,
      date: submitStartDate,
      startDate: submitStartDate,
      endDate: submitEndDate,
      allDay: submitAllDay,
      startTime: submitAllDay ? "09:00" : startTime,
      endTime: submitAllDay ? "10:00" : endTime,
      color,
      repeat,
      repeatEndDate,
      kind: mode,
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
          <span>{mode === "todo" ? "할 일 추가" : "시간 일정 추가"}</span>
          <button className="modal-close" onClick={handleClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="modal-date-preview">
            {startDate}
            {startDate !== endDate && ` ~ ${endDate}`}
            {mode !== "todo" && !allDay && ` ${startTime} ~ ${endTime}`}
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
              {mode === "todo" ? "마감일" : "종료일"}
              <input
                type="date"
                className="time-input"
                value={endDate}
                min={startDate}
                onChange={e => handleEndDateChange(e.target.value)}
              />
            </label>
          </div>

          {mode === "todo" && (
            <p className="sg-hint" style={{ margin: 0 }}>
              마감일까지 매일 할 일 목록과 달력에 계속 표시됩니다.
            </p>
          )}

          {mode !== "todo" && (
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
          )}

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
