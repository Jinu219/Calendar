// ═══════════════════════════════════════════════════════════
// AddEventModal Component
// ═══════════════════════════════════════════════════════════

import React, { useState } from "react";
import type { ModalState, RepeatType } from "../types";
import { TODO_COLORS, MODAL_CLOSED, getLocalToday } from "../constants";

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

export const AddEventModal: React.FC<AddEventModalProps> = ({
  isOpen,
  initialData,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initialData?.date || getLocalToday());
  const [startDate, setStartDate] = useState(initialData?.startDate || getLocalToday());
  const [endDate, setEndDate] = useState(initialData?.endDate || getLocalToday());
  const [startTime, setStartTime] = useState(initialData?.startTime || "09:00");
  const [endTime, setEndTime] = useState(initialData?.endTime || "10:00");
  const [allDay, setAllDay] = useState(initialData?.allDay || false);
  const [color, setColor] = useState(TODO_COLORS[0]);
  const [repeat, setRepeat] = useState<RepeatType>("none");
  const [repeatEndDate, setRepeatEndDate] = useState("");

  if (!isOpen) return null;

  const handleSubmit = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      onClose();
      return;
    }

    onSubmit({
      title: trimmedTitle,
      date,
      startDate,
      endDate,
      allDay,
      startTime: allDay ? "09:00" : startTime,
      endTime: allDay ? "10:00" : endTime,
      color,
      repeat,
      repeatEndDate,
    });

    // Reset form
    setTitle("");
    setDate(getLocalToday());
    setStartDate(getLocalToday());
    setEndDate(getLocalToday());
    setStartTime("09:00");
    setEndTime("10:00");
    setAllDay(false);
    setColor(TODO_COLORS[0]);
    setRepeat("none");
    setRepeatEndDate("");
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box glass-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <span>📌 시간 일정 추가</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="modal-chips">
            <span className="modal-chip">{date}</span>
            {!allDay && <span className="modal-chip time">{startTime} ~ {endTime}</span>}
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
                onChange={e => setStartDate(e.target.value)}
              />
            </label>
            <label className="time-lbl">
              종료일
              <input
                type="date"
                className="time-input"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
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
                onChange={e => setStartTime(e.target.value)}
              />
            </label>
            <label className="time-lbl">
              종료
              <input
                type="time"
                className="time-input"
                value={endTime}
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
                className={`color-dot-setting ${color === c ? "selected" : ""}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>

          <div className="modal-repeat-row">
            <span className="sg-label">🔁 반복</span>
            <div className="seg-ctrl">
              {(["none", "daily", "weekly", "monthly"] as RepeatType[]).map(r => (
                <button
                  key={r}
                  className={`seg-btn ${repeat === r ? "active" : ""}`}
                  onClick={() => setRepeat(r)}
                >
                  {r === "none" ? "없음" : r === "daily" ? "매일" : r === "weekly" ? "매주" : "매월"}
                </button>
              ))}
            </div>
            {repeat !== "none" && (
              <label className="time-lbl" style={{ marginTop: 6 }}>
                반복 종료일
                <input
                  type="date"
                  className="time-input"
                  value={repeatEndDate}
                  onChange={e => setRepeatEndDate(e.target.value)}
                />
              </label>
            )}
          </div>

          <div className="modal-actions">
            <button className="modal-cancel" onClick={onClose}>취소</button>
            <button className="modal-confirm" onClick={handleSubmit}>추가</button>
          </div>
        </div>
      </div>
    </div>
  );
};
