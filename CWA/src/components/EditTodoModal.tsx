// ═══════════════════════════════════════════════════════════
// EditTodoModal Component
// ═══════════════════════════════════════════════════════════

import React from "react";
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
  if (!todo) return null;

  const handleSave = () => {
    onSave(todo);
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
            value={todo.title}
            autoFocus
            onChange={e => onSave({ ...todo, title: e.target.value })}
          />

          <div className="modal-times">
            <label className="time-lbl">
              시작일
              <input
                type="date"
                className="time-input"
                value={todo.date}
                onChange={e => onSave({ ...todo, date: e.target.value })}
              />
            </label>
          </div>

          <div className="modal-times">
            <label className="time-lbl">
              시작
              <input
                type="time"
                className="time-input"
                value={todo.startTime || ""}
                onChange={e => onSave({ ...todo, startTime: e.target.value })}
              />
            </label>
            <label className="time-lbl">
              종료
              <input
                type="time"
                className="time-input"
                value={todo.endTime || ""}
                onChange={e => onSave({ ...todo, endTime: e.target.value })}
              />
            </label>
            <label className="allday-lbl">
              <input
                type="checkbox"
                checked={todo.allDay}
                onChange={e => onSave({ ...todo, allDay: e.target.checked })}
              />
              종일
            </label>
          </div>

          <div className="color-row-setting" style={{ padding: "2px 0" }}>
            {TODO_COLORS.map(c => (
              <button
                key={c}
                className={`color-dot-setting ${todo.color === c ? "selected" : ""}`}
                style={{ background: c }}
                onClick={() => onSave({ ...todo, color: c })}
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
