// ═══════════════════════════════════════════════════════════
// TodoPanel Component
// ═══════════════════════════════════════════════════════════

import React, { useState, DragEvent } from "react";
import type { AddMode, Todo, Settings } from "../types";
import { formatDateDisplayWithWeekday } from "../utils";
import {
  getTodoTimeDisplay,
  getTodoRepeatLabel,
  getTodosForDate,
} from "../utils/todoUtils";
import { RecurrenceScopeModal, type RecurrenceScope } from "./RecurrenceScopeModal";

interface TodoPanelProps {
  selectedDate: string;
  todos: Todo[];
  settings: Settings;
  addMode: AddMode;
  onOpenAddModal: () => void;
  memoOpen: boolean;
  onToggleMemo: () => void;
  onToggleDone: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  onDeleteOccurrence: (id: string, occurrenceDate: string) => void;
  onEditTodo: (todo: Todo, occurrenceDate?: string) => void;
  onMoveTodo: (fromId: string, toId: string) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const TodoPanel: React.FC<TodoPanelProps> = ({
  selectedDate,
  todos,
  settings,
  addMode,
  onOpenAddModal,
  memoOpen,
  onToggleMemo,
  onToggleDone,
  onDeleteTodo,
  onDeleteOccurrence,
  onEditTodo,
  onMoveTodo,
}) => {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [scopeAction, setScopeAction] = useState<{ type: "edit" | "delete"; todo: Todo } | null>(null);

  const selectedTodos = getTodosForDate(todos, selectedDate);
  const fmtSelectedDate = formatDateDisplayWithWeekday(selectedDate);

  const handleEditClick = (todo: Todo) => {
    if (todo.repeat !== "none") {
      setScopeAction({ type: "edit", todo });
      return;
    }

    onEditTodo(todo);
  };

  const handleDeleteClick = (todo: Todo) => {
    if (todo.repeat !== "none") {
      setScopeAction({ type: "delete", todo });
      return;
    }

    onDeleteTodo(todo.id);
  };

  const handleScopeChoice = (scope: RecurrenceScope) => {
    if (!scopeAction) return;
    const { type, todo } = scopeAction;

    if (type === "delete") {
      if (scope === "this") {
        onDeleteOccurrence(todo.id, selectedDate);
      } else {
        onDeleteTodo(todo.id);
      }
    } else {
      onEditTodo(todo, scope === "this" ? selectedDate : undefined);
    }

    setScopeAction(null);
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
    <div
      className="todo-panel glass-panel"
      style={{ width: settings.todoPanelWidth }}
    >
      <div className="todo-header">
        <span className="todo-icon">🗓</span>

        <div>
          <div className="todo-date-label">{fmtSelectedDate}</div>
          <div className="todo-subtext">ToDoList</div>
        </div>
      </div>

      <div className="todo-panel-action-row">
        <button
          type="button"
          className="todo-panel-main-add-btn"
          onClick={onOpenAddModal}
          title={addMode === "todo" ? "할 일 추가" : "일정 추가"}
        >
          +
        </button>

        <button
          type="button"
          className={`todo-panel-memo-toggle ${memoOpen ? "active" : ""}`}
          onClick={onToggleMemo}
          title={memoOpen ? "메모 닫기" : "메모 열기"}
        >
          메모
        </button>
      </div>

      <div className="todo-list">
        {selectedTodos.length === 0 && (
          <div className="todo-empty">할 일이 없어요 🌸</div>
        )}

        {selectedTodos.map(todo => {
          const isVirtualOccurrence = todo.date !== selectedDate;

          return (
            <div
              key={`${todo.id}-${selectedDate}`}
              className={`todo-item ${todo.done ? "done" : ""} ${
                dragOver === todo.id ? "drag-over" : ""
              }`}
              draggable={!isVirtualOccurrence}
              title={
                isVirtualOccurrence
                  ? "반복 일정입니다. 수정/삭제 시 이 날짜만 또는 전체를 선택할 수 있습니다."
                  : undefined
              }
              onDragStart={event => {
                if (isVirtualOccurrence) return;
                handleDragStart(event, todo.id);
              }}
              onDragOver={event => {
                if (isVirtualOccurrence) return;
                handleDragOver(event, todo.id);
              }}
              onDrop={event => {
                if (isVirtualOccurrence) return;
                handleDrop(event, todo.id);
              }}
              onDragEnd={() => {
                setDragId(null);
                setDragOver(null);
              }}
              onContextMenu={event => {
                event.preventDefault();
                handleEditClick(todo);
              }}
              onClick={() => onToggleDone(todo.id)}
            >
              <span className="drag-handle">
                {isVirtualOccurrence ? "↻" : "⠿"}
              </span>

              <button
                type="button"
                className="check-btn"
                onClick={event => {
                  event.stopPropagation();
                  onToggleDone(todo.id);
                }}
              >
                {todo.done ? "✅" : ""}
              </button>

              <div className="todo-content">
                <span className="todo-title">{todo.title}</span>

                {getTodoTimeDisplay(todo) && (
                  <span className="todo-time">{getTodoTimeDisplay(todo)}</span>
                )}

                {getTodoRepeatLabel(todo) && (
                  <span className="todo-time">{getTodoRepeatLabel(todo)}</span>
                )}

                {isVirtualOccurrence && (
                  <span className="todo-time">반복 발생</span>
                )}
              </div>

              <button
                type="button"
                className="edit-btn"
                onClick={event => {
                  event.stopPropagation();
                  handleEditClick(todo);
                }}
              >
                ✏
              </button>

              <button
                type="button"
                className="delete-btn"
                onClick={event => {
                  event.stopPropagation();
                  handleDeleteClick(todo);
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {selectedTodos.length > 0 && (
        <div className="todo-stats">
          완료 {selectedTodos.filter(todo => todo.done).length} /{" "}
          {selectedTodos.length}
        </div>
      )}

      <RecurrenceScopeModal
        open={scopeAction !== null}
        actionLabel={scopeAction?.type === "delete" ? "삭제" : "수정"}
        onChoose={handleScopeChoice}
        onCancel={() => setScopeAction(null)}
      />
    </div>
  );
};

export default TodoPanel;