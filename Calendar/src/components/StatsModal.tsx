// ═══════════════════════════════════════════════════════════
// StatsModal — weekly completion and habit streaks
// ═══════════════════════════════════════════════════════════

import React, { useMemo } from "react";
import type { Todo } from "../types";
import {
  describeRepeat,
  getCompletionRate,
  getHabitStreaks,
  getWeekStats,
  parseLocalDate,
} from "../utils";
import { ModalShell } from "./ModalShell";

interface StatsModalProps {
  open: boolean;
  todos: Todo[];
  today: string;
  onClose: () => void;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const percent = ({ done, total }: { done: number; total: number }) =>
  total === 0 ? "—" : `${Math.round((done / total) * 100)}%`;

const StatsModalContent: React.FC<Omit<StatsModalProps, "open">> = ({ todos, today, onClose }) => {
  const week = useMemo(() => getWeekStats(todos, today), [todos, today]);
  const last30 = useMemo(() => getCompletionRate(todos, today, 30), [todos, today]);
  const streaks = useMemo(() => getHabitStreaks(todos, today).slice(0, 6), [todos, today]);

  const weekTotals = week
    .filter(day => !day.future)
    .reduce((sum, day) => ({ done: sum.done + day.done, total: sum.total + day.total }), { done: 0, total: 0 });
  const maxTotal = Math.max(1, ...week.map(day => day.total));

  return (
    <ModalShell title="📊 통계" onClose={onClose} className="stats-modal">
      <div className="modal-body">
        <div className="stats-summary">
          <div className="stats-card">
            <span className="stats-number">{percent(weekTotals)}</span>
            <span className="stats-caption">이번 주 완료율 ({weekTotals.done}/{weekTotals.total})</span>
          </div>
          <div className="stats-card">
            <span className="stats-number">{percent(last30)}</span>
            <span className="stats-caption">최근 30일 ({last30.done}/{last30.total})</span>
          </div>
        </div>

        <h3 className="sg-label">이번 주</h3>
        <div className="week-chart" role="list" aria-label="요일별 완료 현황">
          {week.map(day => {
            const dow = parseLocalDate(day.date).getDay();
            const label = `${WEEKDAYS[dow]}요일: ${day.future ? "예정" : `${day.done}/${day.total} 완료`}`;

            return (
              <div
                key={day.date}
                className={`week-bar ${day.future ? "future" : ""} ${day.date === today ? "today" : ""}`}
                role="listitem"
                aria-label={label}
                title={label}
              >
                <div className="week-bar-track">
                  <div className="week-bar-total" style={{ height: `${(day.total / maxTotal) * 100}%` }}>
                    <div
                      className="week-bar-done"
                      style={{ height: day.total ? `${(day.done / day.total) * 100}%` : 0 }}
                    />
                  </div>
                </div>
                <span className="week-bar-label">{WEEKDAYS[dow]}</span>
              </div>
            );
          })}
        </div>

        <h3 className="sg-label">반복 습관</h3>
        {streaks.length === 0 ? (
          <p className="sg-hint">반복 일정을 만들고 완료 체크를 하면 연속 기록이 여기 쌓여요.</p>
        ) : (
          <ul className="streak-list">
            {streaks.map(streak => (
              <li key={streak.todo.id} className="streak-row">
                <span className="todo-color-bar" style={{ background: streak.todo.color }} aria-hidden="true" />
                <span className="streak-title">
                  {streak.todo.title}
                  <small>{describeRepeat(streak.todo)}</small>
                </span>
                <span className="streak-count" title={`최고 ${streak.best}회 연속 · ${streak.done}/${streak.total}회 완료`}>
                  {streak.current > 0 ? `🔥 ${streak.current}회 연속` : "다시 시작!"}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="modal-actions">
          <button type="button" className="modal-confirm" onClick={onClose}>닫기</button>
        </div>
      </div>
    </ModalShell>
  );
};

export const StatsModal: React.FC<StatsModalProps> = ({ open, ...props }) =>
  open ? <StatsModalContent {...props} /> : null;

export default StatsModal;
