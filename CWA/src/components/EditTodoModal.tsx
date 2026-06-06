// ═══════════════════════════════════════════════════════════
// EditTodoModal Component
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from "react";
import type { Todo } from "../types";
import { TODO_COLORS } from "../constants";

interface EditTodoModalProps {
  todo: Todo | null;
  onClose: () => void;
  onSave: (updatedTodo: Todo) => void;
}

export const EditTodoModal: React.FC<EditTodoModalProps> = ({
  todo,
  onClose,
  onSave,
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box glass-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <span>✏ 일정 수정</span>
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
                value={formTodo.date}
                onChange={e => updateField("date", e.target.value)}
              />
            </label>
          </div>

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

          <div className="modal-actions">
            <button className="modal-cancel" onClick={onClose}>취소</button>
            <button className="modal-confirm" onClick={handleSave}>저장</button>
          </div>
        </div>
      </div>
    </div>
  );
};