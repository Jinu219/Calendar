// ═══════════════════════════════════════════════════════════
// EditTodoModal Component
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from "react";
import type { RepeatType, Todo } from "../types";
import { TODO_COLORS } from "../constants";
import {
  addDays,
  differenceInCalendarDays,
  fmtDate,
  parseLocalDate,
} from "../utils";

interface EditTodoModalProps {
  todo: Todo | null;
  onClose: () => void;
  onSave: (updatedTodo: Todo) => void;
  scopeLabel?: string;
}

export const EditTodoModal: React.FC<EditTodoModalProps> = ({
  todo,
  onClose,
  onSave,
  scopeLabel,
}) => {
  const [formTodo, setFormTodo] = useState<Todo | null>(todo);

  useEffect(() => {
    setFormTodo(todo);
  }, [todo]);

  if (!todo || !formTodo) return null;

  const updateField = <K extends keyof Todo>(key: K, value: Todo[K]) => {
    setFormTodo(prev => {
      if (!prev) return prev;

      return {
        ...prev,
        [key]: value,
      };
    });
  };

  const handleSave = () => {
    const trimmedTitle = formTodo.title.trim();

    if (!trimmedTitle) {
      onClose();
      return;
    }

    onSave({
      ...formTodo,
      title: trimmedTitle,
      startTime: formTodo.allDay ? undefined : formTodo.startTime,
      endTime: formTodo.allDay ? undefined : formTodo.endTime,
    });
  };

  const handleDateChange = (nextDate: string) => {
    setFormTodo(prev => {
      if (!prev) return prev;

      const currentStart = prev.startDate ?? prev.date;
      const currentEnd = prev.endDate ?? currentStart;
      const spanDays = Math.max(
        0,
        differenceInCalendarDays(
          parseLocalDate(currentStart),
          parseLocalDate(currentEnd)
        )
      );

      return {
        ...prev,
        date: nextDate,
        startDate: nextDate,
        endDate: fmtDate(addDays(parseLocalDate(nextDate), spanDays)),
      };
    });
  };

  const handleDueDateChange = (nextEndDate: string) => {
    updateField("endDate", nextEndDate || undefined);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box glass-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <span>✏ 일정 수정{scopeLabel ? ` · ${scopeLabel}` : ""}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <input
            className="todo-input modal-input"
            placeholder="일정 제목…"
            value={formTodo.title}
            autoFocus
            onChange={e => updateField("title", e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSave()}
          />

          <div className="modal-times">
            <label className="time-lbl">
              시작일
              <input
                type="date"
                className="time-input"
                value={formTodo.startDate ?? formTodo.date}
                onChange={e => handleDateChange(e.target.value)}
              />
            </label>

            <label className="time-lbl">
              마감일
              <input
                type="date"
                className="time-input"
                value={formTodo.endDate ?? formTodo.startDate ?? formTodo.date}
                min={formTodo.startDate ?? formTodo.date}
                onChange={e => handleDueDateChange(e.target.value)}
              />
            </label>
          </div>
          <p className="sg-hint" style={{ margin: 0 }}>
            마감일까지 매일 할 일 목록과 달력에 계속 표시됩니다.
          </p>

          <div className="modal-times">
            <label className="time-lbl">
              시작
              <input
                type="time"
                className="time-input"
                value={formTodo.startTime || ""}
                disabled={formTodo.allDay}
                onChange={e => updateField("startTime", e.target.value)}
              />
            </label>

            <label className="time-lbl">
              종료
              <input
                type="time"
                className="time-input"
                value={formTodo.endTime || ""}
                disabled={formTodo.allDay}
                onChange={e => updateField("endTime", e.target.value)}
              />
            </label>

            <label className="allday-lbl">
              <input
                type="checkbox"
                checked={formTodo.allDay}
                onChange={e => updateField("allDay", e.target.checked)}
              />
              종일
            </label>
          </div>

          <div className="color-row-setting" style={{ padding: "2px 0" }}>
            {TODO_COLORS.map(c => (
              <button
                key={c}
                type="button"
                className={`color-dot-setting ${formTodo.color === c ? "selected" : ""}`}
                style={{ background: c }}
                onClick={() => updateField("color", c)}
              />
            ))}
          </div>

          {!scopeLabel && (
            <>
              <div className="repeat-row">
                <span className="repeat-label">반복</span>
                <select
                  className="repeat-select"
                  value={formTodo.repeat}
                  onChange={e => updateField("repeat", e.target.value as RepeatType)}
                >
                  <option value="none">없음</option>
                  <option value="daily">매일</option>
                  <option value="weekly">매주</option>
                  <option value="monthly">매월</option>
                </select>
              </div>

              {formTodo.repeat !== "none" && (
                <div className="modal-times">
                  <label className="time-lbl">
                    반복 종료일
                    <input
                      type="date"
                      className="time-input"
                      value={formTodo.repeatEndDate ?? ""}
                      min={formTodo.startDate ?? formTodo.date}
                      onChange={e => updateField("repeatEndDate", e.target.value || undefined)}
                    />
                  </label>
                </div>
              )}
            </>
          )}

          <div className="modal-actions">
            <button className="modal-cancel" onClick={onClose}>취소</button>
            <button className="modal-confirm" onClick={handleSave}>저장</button>
          </div>
        </div>
      </div>
    </div>
  );
};
