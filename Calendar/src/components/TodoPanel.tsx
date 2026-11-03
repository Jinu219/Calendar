// ═══════════════════════════════════════════════════════════
// TodoPanel Component
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useState, DragEvent } from "react";
import type { AddMode, AgendaItem, Memo, OccurrenceRef, Settings, Todo } from "../types";
import {
  describeRepeat,
  formatDateDisplayWithWeekday,
  formatShortDate,
  getAgendaForDate,
  getSubtaskProgress,
  getTodoStartDate,
  getTodoTimeLabel,
  parseScheduleText,
} from "../utils";

interface TodoPanelProps {
  selectedDate: string;
  today: string;
  todos: Todo[];
  settings: Settings;
  addMode: AddMode;
  holidayName?: string;
  lunarDate?: string;
  selection: OccurrenceRef[];
  overdue: Todo[];
  linkedMemos: Memo[];
  quickAddRef: React.RefObject<HTMLInputElement | null>;
  onQuickAdd: (text: string) => void;
  /** Gemini is set up: offer ✨ (and Shift+Enter) for sentences the rules don't get. */
  aiReady: boolean;
  /** Resolves true when items were added (the input is then cleared). */
  onAiQuickAdd: (text: string) => Promise<boolean>;
  onOpenAddModal: () => void;
  memoOpen: boolean;
  onToggleMemo: () => void;
  onOpenMemo: (memoId: string) => void;
  onOpenStats: () => void;
  onToggleDone: (ref: OccurrenceRef) => void;
  onToggleSubtask: (todoId: string, subtaskId: string) => void;
  onCarryOver: (ids: string[]) => void;
  onRequestEdit: (todo: Todo, occurrenceDate: string) => void;
  onRequestDelete: (todo: Todo, occurrenceDate: string) => void;
  onMoveTodo: (fromId: string, toId: string) => void;
}

const metaFor = (item: AgendaItem, settings: Settings): string[] => {
  const meta: string[] = [];
  const time = getTodoTimeLabel(item.todo, settings.use24Hour);
  const category = settings.colorLabels[item.todo.color];
  const progress = getSubtaskProgress(item.todo);

  if (time) meta.push(time);
  if (item.totalDays > 1) meta.push(`${item.dayIndex}/${item.totalDays}일차`);
  if (item.todo.repeat !== "none") meta.push(`↻ ${describeRepeat(item.todo)}`);
  if (progress) meta.push(`☑ ${progress}`);
  if (category) meta.push(category);
  if (item.todo.reminderMinutes === null) meta.push("🔕");

  return meta;
};

const memoPreview = (memo: Memo): string =>
  memo.content.split("\n").find(line => line.trim())?.replace(/^- \[[ xX]\] /, "").trim() || "(빈 메모)";

export const TodoPanel: React.FC<TodoPanelProps> = ({
  selectedDate,
  today,
  todos,
  settings,
  addMode,
  holidayName,
  lunarDate,
  selection,
  overdue,
  linkedMemos,
  quickAddRef,
  onQuickAdd,
  aiReady,
  onAiQuickAdd,
  onOpenAddModal,
  memoOpen,
  onToggleMemo,
  onOpenMemo,
  onOpenStats,
  onToggleDone,
  onToggleSubtask,
  onCarryOver,
  onRequestEdit,
  onRequestDelete,
  onMoveTodo,
}) => {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [quickText, setQuickText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const agenda = useMemo(() => getAgendaForDate(todos, selectedDate), [todos, selectedDate]);
  const own = agenda.filter(item => !item.todo.sourceId);
  const doneCount = own.filter(item => item.done).length;
  const scheduleCount = agenda.filter(item => item.todo.kind !== "todo").length;
  const todoCount = agenda.length - scheduleCount;
  const selectedKeys = new Set(selection.map(ref => `${ref.todoId}__${ref.occurrenceDate}`));
  const kindLabel = addMode === "todo" ? "할 일" : "일정";
  const showOverdue = selectedDate === today && overdue.length > 0;

  // What Enter would add, shown under the input while typing.
  const preview = useMemo(() => {
    if (!quickText.trim()) return null;
    const parsed = parseScheduleText(quickText, { today, selectedDate, defaultKind: addMode === "todo" ? "todo" : "schedule" });
    return parsed.recognized ? `${parsed.event.title} · ${parsed.understood.join(" · ")}` : null;
  }, [quickText, today, selectedDate, addMode]);

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

  const handleAiQuickAdd = async () => {
    const text = quickText.trim();
    if (!text || aiBusy) return;

    setAiBusy(true);
    try {
      if (await onAiQuickAdd(text)) setQuickText("");
    } finally {
      setAiBusy(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderOwnItem = (item: AgendaItem) => {
    const { todo, occurrenceDate, done } = item;
    const ref = { todoId: todo.id, occurrenceDate };
    const meta = metaFor(item, settings);
    const selected = selectedKeys.has(`${todo.id}__${occurrenceDate}`);
    const hasSubtasks = (todo.subtasks?.length ?? 0) > 0;
    const isExpanded = expanded.has(todo.id);

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
        <div className="todo-item-main">
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

          {hasSubtasks && (
            <button
              type="button"
              className="edit-btn subtask-toggle"
              aria-expanded={isExpanded}
              aria-label={`${todo.title} 체크리스트 ${isExpanded ? "접기" : "펼치기"}`}
              title="체크리스트"
              onClick={e => {
                e.stopPropagation();
                toggleExpanded(todo.id);
              }}
            >
              {isExpanded ? "▾" : "▸"}
            </button>
          )}

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
        </div>

        {hasSubtasks && isExpanded && (
          <ul className="subtask-list" onClick={e => e.stopPropagation()}>
            {todo.subtasks!.map(subtask => (
              <li key={subtask.id} className={`subtask-row ${subtask.done ? "done" : ""}`}>
                <label>
                  <input
                    type="checkbox"
                    checked={subtask.done}
                    onChange={() => onToggleSubtask(todo.id, subtask.id)}
                  />
                  {subtask.title}
                </label>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  };

  // Subscribed calendars: shown for reference, never edited here.
  const renderFeedItem = (item: AgendaItem) => {
    const time = getTodoTimeLabel(item.todo, settings.use24Hour);

    return (
      <li key={`${item.todo.id}-${item.occurrenceDate}`} className="todo-item external" title="구독 캘린더 일정 (읽기 전용)">
        <div className="todo-item-main">
          <span className="todo-color-bar" style={{ background: item.todo.color }} aria-hidden="true" />
          <div className="todo-content">
            <span className="todo-title">{item.todo.title}</span>
            <span className="todo-time">
              {[time, item.totalDays > 1 ? `${item.dayIndex}/${item.totalDays}일차` : "", "구독"].filter(Boolean).join(" · ")}
            </span>
          </div>
        </div>
      </li>
    );
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
          onKeyDown={e => {
            // Shift+Enter: let Gemini read the sentence instead of the rules.
            if (aiReady && e.key === "Enter" && e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void handleAiQuickAdd();
            }
          }}
          placeholder={addMode === "todo" ? "예: 금요일까지 보고서 → Enter" : "예: 내일 3시 치과 → Enter"}
          aria-label={`${kindLabel} 빠르게 추가 (단축키 /)`}
          aria-describedby={preview ? "quick-add-preview" : undefined}
          title={`날짜·시간·반복을 함께 적으면 알아서 넣어요 (다음 주 화요일 3시 치과, 매주 월수금 7시 헬스, 11/11~11/13 대동제)${aiReady ? " · Shift+Enter 또는 ✨: Gemini가 읽기" : ""}`}
        />

        {aiReady && (
          <button
            type="button"
            className="ai-quick-btn"
            onClick={() => void handleAiQuickAdd()}
            disabled={!quickText.trim() || aiBusy}
            aria-label="Gemini로 문장을 일정으로 바꾸기 (Shift+Enter)"
            title="Gemini가 문장을 읽고 일정을 만들어요 (Shift+Enter) — 여러 일정도 한 번에"
          >
            {aiBusy ? "…" : "✨"}
          </button>
        )}

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

      {preview && (
        <p className="quick-preview" id="quick-add-preview" aria-live="polite">
          <span aria-hidden="true">→ </span>{preview}
        </p>
      )}

      {showOverdue && (
        <section className="overdue-box" aria-label="지난 할 일">
          <div className="overdue-header">
            <span>⏰ 지난 할 일 {overdue.length}개</span>
            <button type="button" className="overdue-move-all" onClick={() => onCarryOver(overdue.map(t => t.id))}>
              모두 오늘로
            </button>
          </div>
          <ul className="overdue-list">
            {overdue.slice(0, 5).map(todo => (
              <li key={todo.id} className="overdue-row">
                <span className="todo-color-bar" style={{ background: todo.color }} aria-hidden="true" />
                <span className="overdue-title">{todo.title}</span>
                <span className="overdue-date">{formatShortDate(todo.endDate || getTodoStartDate(todo))}</span>
                <button
                  type="button"
                  className="overdue-move"
                  aria-label={`${todo.title} 오늘로 옮기기`}
                  onClick={() => onCarryOver([todo.id])}
                >
                  오늘로
                </button>
              </li>
            ))}
            {overdue.length > 5 && <li className="sg-hint">…외 {overdue.length - 5}개</li>}
          </ul>
        </section>
      )}

      {agenda.length === 0 && linkedMemos.length === 0 ? (
        <div className="todo-empty">
          <p>이 날은 비어 있어요 🌸</p>
          <p className="todo-empty-hint">위 칸에 적고 Enter를 누르거나 + 버튼으로 추가하세요.</p>
        </div>
      ) : (
        <ul className="todo-list">
          {agenda.map(item => (item.todo.sourceId ? renderFeedItem(item) : renderOwnItem(item)))}

          {linkedMemos.map(memo => (
            <li key={memo.id} className="todo-item memo-link" style={{ "--memo-color": memo.color } as React.CSSProperties}>
              <button
                type="button"
                className="memo-link-btn"
                onClick={() => onOpenMemo(memo.id)}
                title="이 날짜에 연결된 메모 열기"
              >
                <span aria-hidden="true">📝</span>
                <span className="memo-link-text">{memoPreview(memo)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {own.length > 0 && (
        <div className="todo-stats">
          <div
            className="todo-progress"
            role="progressbar"
            aria-label="완료율"
            aria-valuemin={0}
            aria-valuemax={own.length}
            aria-valuenow={doneCount}
          >
            <div className="todo-progress-fill" style={{ width: `${(doneCount / own.length) * 100}%` }} />
          </div>
          <span>완료 {doneCount} / {own.length}</span>
          <button type="button" className="stats-link" onClick={onOpenStats} title="통계 보기 (S)" aria-label="통계 보기">
            📊
          </button>
        </div>
      )}
    </aside>
  );
};

export default TodoPanel;
