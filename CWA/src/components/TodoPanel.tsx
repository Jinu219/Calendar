// ═══════════════════════════════════════════════════════════
// TodoPanel Component
// ═══════════════════════════════════════════════════════════

import React, { useState, DragEvent } from "react";
import type { Todo, Settings } from "../types";
import { TODO_COLORS } from "../constants";
import { formatDateDisplayWithWeekday, getCurrentTime } from "../utils";
import {
  getTodoTimeDisplay,
  getTodoRepeatLabel,
  getTodosForDate,
} from "../utils/todoUtils";

interface TodoPanelProps {
  selectedDate: string;
  todos: Todo[];
  settings: Settings;
  onAddTodo: (title: string, date: string, options?: {
    color?: string;
    allDay?: boolean;
    todoTime?: string;
  }) => void;
  onToggleDone: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  onEditTodo: (todo: Todo) => void;
  onMoveTodo: (fromId: string, toId: string) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const TodoPanel: React.FC<TodoPanelProps> = ({
  selectedDate,
  todos,
  settings,
  onAddTodo,
  onToggleDone,
  onDeleteTodo,
  onEditTodo,
  onMoveTodo,
}) => {
  const [inputVal, setInputVal] = useState("");
  const [inputTime, setInputTime] = useState(() => getCurrentTime());
  const [inputColor, setInputColor] = useState(TODO_COLORS[0]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const selectedTodos = getTodosForDate(todos, selectedDate);

  const fmtSelectedDate = formatDateDisplayWithWeekday(selectedDate);

  const handleAddTodo = () => {
    const t = inputVal.trim();
    if (!t) return;
    onAddTodo(t, selectedDate, {
      color: inputColor,
      allDay: true,
      todoTime: inputTime || undefined,
    });
    setInputVal("");
    setInputTime(getCurrentTime());
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, id: string) => {
    e.preventDefault();
    setDragOver(id);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setDragOver(null);
      return;
    }
    onMoveTodo(dragId, targetId);
    setDragId(null);
    setDragOver(null);
  };

  return (
    <div className="todo-panel glass-panel" style={{ width: settings.todoPanelWidth }}>
      <div className="todo-header">
        <span className="todo-icon">🗓</span>
        <div>
          <div className="todo-date-label">{fmtSelectedDate}</div>
          <div className="todo-subtext">ToDoList</div>
        </div>
      </div>

      <div className="todo-quick-add">
        <div className="todo-input-row">
          <input
            className="todo-input"
            placeholder="할 일 입력…"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAddTodo()}
          />
          <button className="add-btn" onClick={handleAddTodo}>+</button>
        </div>
        <div className="color-row-quick">
          {TODO_COLORS.map(c => (
            <button
              key={c}
              className={`color-dot-quick ${inputColor === c ? "selected" : ""}`}
              style={{ background: c }}
              onClick={() => setInputColor(c)}
            />
          ))}
        </div>
        <input
          type="time"
          className="todo-input time-memo"
          value={inputTime}
          onChange={e => setInputTime(e.target.value)}
        />
      </div>

      <div className="todo-list">
        {selectedTodos.length === 0 && <div className="todo-empty">할 일이 없어요 🌸</div>}
        {selectedTodos.map(t => {
        const isVirtualOccurrence = t.date !== selectedDate;

        return (
          <div
            key={`${t.id}-${selectedDate}`}
            className={`todo-item ${t.done ? "done" : ""} ${dragOver === t.id ? "drag-over" : ""}`}
            draggable={!isVirtualOccurrence}
            title={isVirtualOccurrence ? "반복 일정입니다. 수정/삭제는 전체 반복 일정에 적용됩니다." : undefined}
            onDragStart={e => {
              if (isVirtualOccurrence) return;
              handleDragStart(e, t.id);
            }}
            onDragOver={e => {
              if (isVirtualOccurrence) return;
              handleDragOver(e, t.id);
            }}
            onDrop={e => {
              if (isVirtualOccurrence) return;
              handleDrop(e, t.id);
            }}
            onDragEnd={() => {
              setDragId(null);
              setDragOver(null);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              onEditTodo(t);
            }}
          >
            <span className="drag-handle">
              {isVirtualOccurrence ? "↻" : "⠿"}
            </span>

            <button className="check-btn" onClick={() => onToggleDone(t.id)}>
              {t.done ? "✅" : ""}
            </button>

            <div className="todo-content">
              <span className="todo-title">{t.title}</span>

              {getTodoTimeDisplay(t) && (
                <span className="todo-time">{getTodoTimeDisplay(t)}</span>
              )}

              {getTodoRepeatLabel(t) && (
                <span className="todo-time">{getTodoRepeatLabel(t)}</span>
              )}

              {isVirtualOccurrence && (
                <span className="todo-time">반복 발생</span>
              )}
            </div>

            <button className="edit-btn" onClick={() => onEditTodo(t)}>✏</button>
            <button className="delete-btn" onClick={() => onDeleteTodo(t.id)}>×</button>
          </div>
        );
        })}
      </div>

      {selectedTodos.length > 0 && (
        <div className="todo-stats">
          완료 {selectedTodos.filter(t => t.done).length} / {selectedTodos.length}
        </div>
      )}
    </div>
  );
};
