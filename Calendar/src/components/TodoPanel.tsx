// ═══════════════════════════════════════════════════════════
// TodoPanel Component
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useState, DragEvent } from "react";
import type { AddMode, AgendaItem, OccurrenceRef, Settings, Todo } from "../types";
import {
  formatDateDisplayWithWeekday,
  getAgendaForDate,
  getRepeatLabel,
  getTodoTimeLabel,
} from "../utils";

interface TodoPanelProps {
  selectedDate: string;
  todos: Todo[];
  settings: Settings;
  addMode: AddMode;
  holidayName?: string;
  lunarDate?: string;
  selection: OccurrenceRef[];
  quickAddRef: React.RefObject<HTMLInputElement | null>;
  onQuickAdd: (text: string) => void;
  onOpenAddModal: () => void;
  memoOpen: boolean;
  onToggleMemo: () => void;
  onToggleDone: (ref: OccurrenceRef) => void;
  onRequestEdit: (todo: Todo, occurrenceDate: string) => void;
  onRequestDelete: (todo: Todo, occurrenceDate: string) => void;
  onMoveTodo: (fromId: string, toId: string) => void;
}

const metaFor = (item: AgendaItem, use24Hour: boolean): string[] => {
  const meta: string[] = [];
  const time = getTodoTimeLabel(item.todo, use24Hour);

  if (time) meta.push(time);
  if (item.totalDays > 1) meta.push(`${item.dayIndex}/${item.totalDays}일차`);
  if (item.todo.repeat !== "none") meta.push(`↻ ${getRepeatLabel(item.todo.repeat)}`);

  return meta;
};

export const TodoPanel: React.FC<TodoPanelProps> = ({
  selectedDate,
  todos,
  settings,
  addMode,
  holidayName,
  lunarDate,
  selection,
  quickAddRef,
  onQuickAdd,
  onOpenAddModal,
  memoOpen,
  onToggleMemo,
  onToggleDone,
  onRequestEdit,
  onRequestDelete,
  onMoveTodo,
}) => {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [quickText, setQuickText] = useState("");

  const agenda = useMemo(() => getAgendaForDate(todos, selectedDate), [todos, selectedDate]);
  const doneCount = agenda.filter(item => item.done).length;
  const scheduleCount = agenda.filter(item => item.todo.kind !== "todo").length;
  const todoCount = agenda.length - scheduleCount;
  const selectedKeys = new Set(selection.map(ref => `${ref.todoId}__${ref.occurrenceDate}`));
  const kindLabel = addMode === "todo" ? "할 일" : "일정";

  const resetDrag = () => {
    setDragId(null);
    setDragOver(null);
  };

  const handleDrop = (e: DragEvent<HTMLLIElement>, targetId: string) => {
    e.preventDefault();

    if (dragId && dragId !== targetId) {
      onMoveTodo(dragId, targetId);
    }

    resetDrag();
  };

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickText.trim()) return;

    onQuickAdd(quickText);
    setQuickText("");
  };

  return (
    <aside
      className="todo-panel glass-panel"
      style={{ width: settings.todoPanelWidth }}
      aria-label="선택한 날짜의 일정"
    >
      <div className="todo-header">
        <span className="todo-icon" aria-hidden="true">🗓</span>

        <div className="todo-header-text">
          <h2 className="todo-date-label">{formatDateDisplayWithWeekday(selectedDate)}</h2>

          <div className="todo-subtext">
            {holidayName && <span className="todo-chip holiday">{holidayName}</span>}
            {lunarDate && <span className="todo-chip">음력 {lunarDate}</span>}
            {agenda.length > 0
              ? <span>일정 {scheduleCount} · 할 일 {todoCount}</span>
              : <span>등록된 항목 없음</span>}
          </div>
        </div>
      </div>

      <form className="quick-add" onSubmit={handleQuickAdd}>
        <input
          ref={quickAddRef}
          className="todo-input"
          value={quickText}
          onChange={e => setQuickText(e.target.value)}
          placeholder={addMode === "todo" ? "할 일 입력 후 Enter" : "예: 14:30 회의 → Enter"}
          aria-label={`${kindLabel} 빠르게 추가 (단축키 /)`}
          title={addMode === "todo"
            ? "선택한 날짜에 할 일을 추가합니다"
            : "시간을 함께 적으면(14:30, 오후 3시 반, 14:00~15:30) 시간 일정으로 추가됩니다"}
        />

        <button
          type="button"
          className="todo-panel-main-add-btn"
          onClick={onOpenAddModal}
          aria-label={`${kindLabel} 자세히 추가`}
          title={`${kindLabel} 자세히 추가 (N)`}
        >
          +
        </button>

        <button
          type="button"
          className={`todo-panel-memo-toggle ${memoOpen ? "active" : ""}`}
          onClick={onToggleMemo}
          aria-pressed={memoOpen}
          title={memoOpen ? "메모 닫기" : "메모 열기"}
        >
          메모
        </button>
      </form>

      {agenda.length === 0 ? (
        <div className="todo-empty">
          <p>이 날은 비어 있어요 🌸</p>
          <p className="todo-empty-hint">위 칸에 적고 Enter를 누르거나 + 버튼으로 추가하세요.</p>
        </div>
      ) : (
        <ul className="todo-list">
          {agenda.map(item => {
            const { todo, occurrenceDate, done } = item;
            const ref = { todoId: todo.id, occurrenceDate };
            const meta = metaFor(item, settings.use24Hour);
            const selected = selectedKeys.has(`${todo.id}__${occurrenceDate}`);

            return (
              <li
                key={`${todo.id}-${occurrenceDate}`}
                className={[
                  "todo-item",
                  done ? "done" : "",
                  selected ? "selected" : "",
                  dragOver === todo.id ? "drag-over" : "",
                  dragId === todo.id ? "dragging" : "",
                ].filter(Boolean).join(" ")}
                draggable
                onDragStart={e => {
                  setDragId(todo.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={e => {
                  e.preventDefault();
                  setDragOver(todo.id);
                }}
                onDragLeave={() => setDragOver(prev => (prev === todo.id ? null : prev))}
                onDrop={e => handleDrop(e, todo.id)}
                onDragEnd={resetDrag}
                onContextMenu={e => {
                  e.preventDefault();
                  onRequestEdit(todo, occurrenceDate);
                }}
                onClick={() => onToggleDone(ref)}
                title="클릭: 완료 표시 · 우클릭: 수정 · 끌어서 순서 변경"
              >
                <span className="drag-handle" aria-hidden="true">⠿</span>

                <button
                  type="button"
                  className="check-btn"
                  role="checkbox"
                  aria-checked={done}
                  aria-label={`${todo.title} 완료`}
                  onClick={e => {
                    e.stopPropagation();
                    onToggleDone(ref);
                  }}
                >
                  {done ? "✓" : ""}
                </button>

                <span className="todo-color-bar" style={{ background: todo.color }} aria-hidden="true" />

                <div className="todo-content">
                  <span className="todo-title">{todo.title}</span>
                  {meta.length > 0 && <span className="todo-time">{meta.join(" · ")}</span>}
                </div>

                <button
                  type="button"
                  className="edit-btn"
                  aria-label={`${todo.title} 수정`}
                  title="수정"
                  onClick={e => {
                    e.stopPropagation();
                    onRequestEdit(todo, occurrenceDate);
                  }}
                >
                  ✏
                </button>

                <button
                  type="button"
                  className="delete-btn"
                  aria-label={`${todo.title} 삭제`}
                  title="삭제"
                  onClick={e => {
                    e.stopPropagation();
                    onRequestDelete(todo, occurrenceDate);
                  }}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {agenda.length > 0 && (
        <div className="todo-stats">
          <div
            className="todo-progress"
            role="progressbar"
            aria-label="완료율"
            aria-valuemin={0}
            aria-valuemax={agenda.length}
            aria-valuenow={doneCount}
          >
            <div className="todo-progress-fill" style={{ width: `${(doneCount / agenda.length) * 100}%` }} />
          </div>
          <span>완료 {doneCount} / {agenda.length}</span>
        </div>
      )}
    </aside>
  );
};

export default TodoPanel;
