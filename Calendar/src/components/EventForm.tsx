// ═══════════════════════════════════════════════════════════
// EventForm — fields shared by the add and edit modals
// ═══════════════════════════════════════════════════════════

import React, { useState } from "react";
import type { EventFormData, ItemKind, MonthlyMode, ReminderChoice, RepeatType } from "../types";
import { ITEM_REMINDER_OPTIONS, TODO_COLORS } from "../constants";
import {
  createId,
  daysBetween,
  describeRepeat,
  formatShortDate,
  getDefaultEndTime,
  getWeekdayOrdinal,
  parseLocalDate,
  REPEAT_INTERVAL_UNITS,
  shiftDate,
} from "../utils";
import { ColorSwatches } from "./ColorSwatches";
import { SegmentedControl } from "./SegmentedControl";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const ORDINALS = ["첫째", "둘째", "셋째", "넷째", "마지막"];

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

  if (data.repeat === "weekly" && data.repeatDays.length === 0) {
    return "반복할 요일을 하나 이상 골라 주세요.";
  }

  return null;
};

/** One-line human summary: "11월 3일 (화) 14:00 – 15:00 · 격주 월·수". */
const summarize = (data: EventFormData): string => {
  const range = data.endDate && data.endDate !== data.startDate
    ? `${formatShortDate(data.startDate)} – ${formatShortDate(data.endDate)}`
    : formatShortDate(data.startDate);
  const time = data.kind === "schedule" && !data.allDay ? ` ${data.startTime} – ${data.endTime}` : "";
  const repeat = data.repeat !== "none"
    ? ` · ${describeRepeat({ ...data, date: data.startDate })}`
    : "";

  return `${range}${time}${repeat}`;
};

const reminderLabel = (minutes: number): string => {
  if (minutes === 0) return "정시";
  if (minutes === 1440) return "하루 전";
  return minutes >= 60 ? `${minutes / 60}시간 전` : `${minutes}분 전`;
};

interface EventFormProps {
  value: EventFormData;
  onChange: (patch: Partial<EventFormData>) => void;
  error: string | null;
  showRepeat: boolean;
  /** Global reminder lead, shown as the "기본" option. */
  defaultReminderMinutes: number;
  colorLabels?: Record<string, string>;
  /** When set (Claude enabled), the checklist offers "✨ 단계 추천". */
  onSuggestSubtasks?: (title: string, dueDate: string, existing: string[]) => Promise<string[]>;
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
  defaultReminderMinutes,
  colorLabels,
  onSuggestSubtasks,
  submitLabel,
  onCancel,
  onSubmit,
  secondaryActions,
}) => {
  const [newSubtask, setNewSubtask] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const handleSuggest = async () => {
    if (!onSuggestSubtasks || !value.title.trim()) return;

    setSuggesting(true);
    setSuggestError(null);

    try {
      const steps = await onSuggestSubtasks(
        value.title.trim(),
        value.endDate || value.startDate,
        value.subtasks.map(s => s.title)
      );
      onChange({
        subtasks: [...value.subtasks, ...steps.map(title => ({ id: createId("sub"), title, done: false }))],
      });
    } catch (error) {
      setSuggestError(error instanceof Error ? error.message : String(error));
    } finally {
      setSuggesting(false);
    }
  };
  const isTodo = value.kind === "todo";
  const start = parseLocalDate(value.startDate);
  const intervalUnit = REPEAT_INTERVAL_UNITS[value.repeat];

  // Moving the start keeps the item's length instead of collapsing it.
  const handleStartDateChange = (nextStart: string) => {
    if (!nextStart) return;

    const span = Math.max(0, daysBetween(value.startDate, value.endDate || value.startDate));
    const patch: Partial<EventFormData> = { date: nextStart, startDate: nextStart, endDate: shiftDate(nextStart, span) };

    // A single chosen weekday follows the start date; a custom set is kept.
    if (value.repeatDays.length <= 1) patch.repeatDays = [parseLocalDate(nextStart).getDay()];
    onChange(patch);
  };

  const handleStartTimeChange = (nextStart: string) => {
    const patch: Partial<EventFormData> = { startTime: nextStart };
    if (nextStart && value.endTime <= nextStart) patch.endTime = getDefaultEndTime(nextStart);
    onChange(patch);
  };

  const toggleRepeatDay = (day: number) => {
    onChange({
      repeatDays: value.repeatDays.includes(day)
        ? value.repeatDays.filter(d => d !== day)
        : [...value.repeatDays, day].sort((a, b) => a - b),
    });
  };

  const addSubtask = () => {
    const title = newSubtask.trim();
    if (!title) return;

    onChange({ subtasks: [...value.subtasks, { id: createId("sub"), title, done: false }] });
    setNewSubtask("");
  };

  const reminderValue = value.reminder === "default" || value.reminder === "none"
    ? value.reminder
    : String(value.reminder);

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
        colorLabels={colorLabels}
        label="카테고리 색상"
      />

      {showRepeat && (
        <fieldset className="repeat-fieldset">
          <label className="repeat-row">
            <span className="repeat-label">반복</span>
            <select
              className="repeat-select"
              value={value.repeat}
              onChange={e => {
                const repeat = e.target.value as RepeatType;
                onChange({
                  repeat,
                  ...(repeat === "weekly" && value.repeatDays.length === 0 ? { repeatDays: [start.getDay()] } : {}),
                });
              }}
            >
              <option value="none">없음</option>
              <option value="daily">매일</option>
              <option value="weekdays">평일 (월~금)</option>
              <option value="weekly">매주</option>
              <option value="monthly">매월</option>
              <option value="yearly">매년</option>
            </select>
          </label>

          {intervalUnit && (
            <label className="repeat-row">
              <span className="repeat-label">간격</span>
              <input
                type="number"
                className="time-input repeat-interval"
                min={1}
                max={99}
                value={value.repeatInterval}
                onChange={e => onChange({ repeatInterval: Math.max(1, Math.min(99, Number(e.target.value) || 1)) })}
              />
              <span className="repeat-unit">{intervalUnit}마다</span>
            </label>
          )}

          {value.repeat === "weekly" && (
            <div className="weekday-picker" role="group" aria-label="반복할 요일">
              {WEEKDAYS.map((name, day) => (
                <button
                  key={name}
                  type="button"
                  className={`weekday-btn ${value.repeatDays.includes(day) ? "active" : ""} ${day === 0 ? "sun" : day === 6 ? "sat" : ""}`}
                  aria-pressed={value.repeatDays.includes(day)}
                  aria-label={`${name}요일`}
                  onClick={() => toggleRepeatDay(day)}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          {value.repeat === "monthly" && (
            <SegmentedControl<MonthlyMode>
              label="매월 반복 방식"
              options={[
                { value: "date", label: `매월 ${start.getDate()}일` },
                { value: "weekday", label: `${ORDINALS[getWeekdayOrdinal(start) - 1]} ${WEEKDAYS[start.getDay()]}요일` },
              ]}
              value={value.monthlyMode}
              onChange={monthlyMode => onChange({ monthlyMode })}
            />
          )}

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
        </fieldset>
      )}

      {!isTodo && !value.allDay && (
        <label className="repeat-row">
          <span className="repeat-label">알림</span>
          <select
            className="repeat-select"
            value={reminderValue}
            onChange={e => {
              const raw = e.target.value;
              onChange({ reminder: raw === "default" || raw === "none" ? raw : Number(raw) as ReminderChoice });
            }}
          >
            <option value="default">기본 ({reminderLabel(defaultReminderMinutes)})</option>
            <option value="none">알림 없음</option>
            {ITEM_REMINDER_OPTIONS.map(minutes => (
              <option key={minutes} value={minutes}>{reminderLabel(minutes)}</option>
            ))}
          </select>
        </label>
      )}

      {value.repeat === "none" ? (
        <fieldset className="subtask-editor">
          <legend className="repeat-label">체크리스트</legend>

          {value.subtasks.map(subtask => (
            <div className="subtask-edit-row" key={subtask.id}>
              <input
                type="checkbox"
                checked={subtask.done}
                aria-label={`${subtask.title} 완료`}
                onChange={() => onChange({
                  subtasks: value.subtasks.map(s => s.id === subtask.id ? { ...s, done: !s.done } : s),
                })}
              />
              <input
                className="todo-input"
                value={subtask.title}
                aria-label="세부 항목"
                onChange={e => onChange({
                  subtasks: value.subtasks.map(s => s.id === subtask.id ? { ...s, title: e.target.value } : s),
                })}
              />
              <button
                type="button"
                className="delete-btn"
                aria-label={`${subtask.title} 지우기`}
                onClick={() => onChange({ subtasks: value.subtasks.filter(s => s.id !== subtask.id) })}
              >
                ×
              </button>
            </div>
          ))}

          <div className="subtask-edit-row">
            <input
              className="todo-input"
              placeholder="세부 단계 추가 후 Enter"
              aria-label="세부 단계 추가"
              value={newSubtask}
              onChange={e => setNewSubtask(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  addSubtask();
                }
              }}
            />
          </div>

          {onSuggestSubtasks && (
            <button
              type="button"
              className="ai-btn"
              disabled={suggesting || !value.title.trim()}
              aria-busy={suggesting}
              onClick={() => void handleSuggest()}
              title="제목을 보고 Claude가 세부 단계를 제안해요"
            >
              {suggesting ? "Claude가 단계를 나누는 중…" : "✨ 단계 추천"}
            </button>
          )}
          {suggestError && <p className="form-error" role="alert">{suggestError}</p>}
        </fieldset>
      ) : (
        value.subtasks.length > 0 && (
          <p className="sg-hint">반복 일정에는 체크리스트를 쓸 수 없어요. 반복을 끄면 다시 보입니다.</p>
        )
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
