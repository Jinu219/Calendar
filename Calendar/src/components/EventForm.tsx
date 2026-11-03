// ═══════════════════════════════════════════════════════════
// EventForm — fields shared by the add and edit modals
// ═══════════════════════════════════════════════════════════

import React from "react";
import type { EventFormData, ItemKind, RepeatType } from "../types";
import { TODO_COLORS } from "../constants";
import {
  daysBetween,
  formatShortDate,
  getDefaultEndTime,
  getRepeatLabel,
  shiftDate,
} from "../utils";
import { ColorSwatches } from "./ColorSwatches";
import { SegmentedControl } from "./SegmentedControl";

/** Why the form can't be saved yet, or null when it can. */
export const validateEventForm = (data: EventFormData): string | null => {
  if (!data.title.trim()) return "제목을 입력해 주세요.";
  if (!data.startDate) return "시작일을 정해 주세요.";
  if (data.endDate && data.endDate < data.startDate) return "종료일이 시작일보다 빨라요.";

  if (
    data.kind === "schedule" &&
    !data.allDay &&
    (data.endDate || data.startDate) === data.startDate &&
    data.endTime <= data.startTime
  ) {
    return "종료 시간이 시작 시간보다 늦어야 해요.";
  }

  if (data.repeat !== "none" && data.repeatEndDate && data.repeatEndDate < data.startDate) {
    return "반복 종료일이 시작일보다 빨라요.";
  }

  return null;
};

/** One-line human summary: "11월 3일 (화) 14:00 – 15:00 · 매주". */
const summarize = (data: EventFormData): string => {
  const range = data.endDate && data.endDate !== data.startDate
    ? `${formatShortDate(data.startDate)} – ${formatShortDate(data.endDate)}`
    : formatShortDate(data.startDate);
  const time = data.kind === "schedule" && !data.allDay ? ` ${data.startTime} – ${data.endTime}` : "";
  const repeat = data.repeat !== "none" ? ` · ${getRepeatLabel(data.repeat)}` : "";

  return `${range}${time}${repeat}`;
};

interface EventFormProps {
  value: EventFormData;
  onChange: (patch: Partial<EventFormData>) => void;
  error: string | null;
  showRepeat: boolean;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: () => void;
  /** Extra actions on the left of the footer (e.g. delete). */
  secondaryActions?: React.ReactNode;
}

const KIND_OPTIONS = [
  { value: "schedule" as ItemKind, label: "일정" },
  { value: "todo" as ItemKind, label: "할 일" },
];

export const EventForm: React.FC<EventFormProps> = ({
  value,
  onChange,
  error,
  showRepeat,
  submitLabel,
  onCancel,
  onSubmit,
  secondaryActions,
}) => {
  const isTodo = value.kind === "todo";

  // Moving the start keeps the item's length instead of collapsing it.
  const handleStartDateChange = (nextStart: string) => {
    if (!nextStart) return;

    const span = Math.max(0, daysBetween(value.startDate, value.endDate || value.startDate));
    onChange({ date: nextStart, startDate: nextStart, endDate: shiftDate(nextStart, span) });
  };

  const handleStartTimeChange = (nextStart: string) => {
    const patch: Partial<EventFormData> = { startTime: nextStart };
    if (nextStart && value.endTime <= nextStart) patch.endTime = getDefaultEndTime(nextStart);
    onChange(patch);
  };

  return (
    <form
      className="modal-body"
      noValidate
      onSubmit={e => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="modal-date-preview" aria-live="polite">{summarize(value)}</div>

      <input
        className="todo-input modal-input"
        placeholder={isTodo ? "할 일 제목…" : "일정 제목…"}
        aria-label="제목"
        aria-invalid={error !== null && !value.title.trim()}
        value={value.title}
        autoFocus
        onChange={e => onChange({ title: e.target.value })}
      />

      <SegmentedControl
        label="종류"
        options={KIND_OPTIONS}
        value={value.kind}
        onChange={kind => onChange({ kind, ...(kind === "todo" ? { allDay: true } : {}) })}
      />

      <div className="modal-times">
        <label className="time-lbl">
          시작일
          <input
            type="date"
            className="time-input"
            value={value.startDate}
            onChange={e => handleStartDateChange(e.target.value)}
          />
        </label>

        <label className="time-lbl">
          {isTodo ? "마감일" : "종료일"}
          <input
            type="date"
            className="time-input"
            value={value.endDate || value.startDate}
            min={value.startDate}
            onChange={e => onChange({ endDate: e.target.value || value.startDate })}
          />
        </label>
      </div>

      {isTodo ? (
        <p className="sg-hint">마감일까지 매일 할 일 목록과 달력에 계속 표시됩니다.</p>
      ) : (
        <div className="modal-times">
          <label className="time-lbl">
            시작
            <input
              type="time"
              className="time-input"
              value={value.startTime}
              disabled={value.allDay}
              onChange={e => handleStartTimeChange(e.target.value)}
            />
          </label>

          <label className="time-lbl">
            종료
            <input
              type="time"
              className="time-input"
              value={value.endTime}
              disabled={value.allDay}
              onChange={e => onChange({ endTime: e.target.value })}
            />
          </label>

          <label className="allday-lbl">
            <input
              type="checkbox"
              checked={value.allDay}
              onChange={e => onChange({ allDay: e.target.checked })}
            />
            종일
          </label>
        </div>
      )}

      <ColorSwatches
        colors={TODO_COLORS}
        value={value.color}
        onChange={color => onChange({ color })}
      />

      {showRepeat && (
        <>
          <label className="repeat-row">
            <span className="repeat-label">반복</span>
            <select
              className="repeat-select"
              value={value.repeat}
              onChange={e => onChange({ repeat: e.target.value as RepeatType })}
            >
              <option value="none">없음</option>
              <option value="daily">매일</option>
              <option value="weekly">매주</option>
              <option value="monthly">매월</option>
            </select>
          </label>

          {value.repeat !== "none" && (
            <div className="modal-times">
              <label className="time-lbl">
                반복 종료일 (비우면 계속)
                <input
                  type="date"
                  className="time-input"
                  value={value.repeatEndDate}
                  min={value.startDate}
                  onChange={e => onChange({ repeatEndDate: e.target.value })}
                />
              </label>
            </div>
          )}
        </>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="modal-actions">
        {secondaryActions && <div className="modal-actions-left">{secondaryActions}</div>}
        <button type="button" className="modal-cancel" onClick={onCancel}>취소</button>
        <button type="submit" className="modal-confirm">{submitLabel}</button>
      </div>
    </form>
  );
};

export default EventForm;
