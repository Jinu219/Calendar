// ═══════════════════════════════════════════════════════════
// TimelineView Component — horizontal Gantt-style calendar
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef } from "react";
import type { Todo } from "../types";
import { addDays, fmtDate, getLocalToday, parseLocalDate } from "../utils";
import { doesTodoOccurOnDate } from "../utils/todoUtils";

interface TimelineViewProps {
  todos: Todo[];
  anchorDate: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onEditTodo: (todo: Todo) => void;
}

interface TimelineBar {
  key: string;
  todo: Todo;
  startIdx: number;
  endIdx: number;
}

const DAYS_BEFORE = 21;
const DAYS_AFTER = 21;

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export const TimelineView: React.FC<TimelineViewProps> = ({
  todos,
  anchorDate,
  selectedDate,
  onSelectDate,
  onEditTodo,
}) => {
  const today = getLocalToday();
  const scrollRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => {
    const anchor = parseLocalDate(anchorDate);
    const start = addDays(anchor, -DAYS_BEFORE);

    return Array.from(
      { length: DAYS_BEFORE + DAYS_AFTER + 1 },
      (_, i) => fmtDate(addDays(start, i))
    );
  }, [anchorDate]);

  const dayIndex = useMemo(() => {
    const map = new Map<string, number>();
    days.forEach((d, i) => map.set(d, i));
    return map;
  }, [days]);

  // The anchor date always sits at a fixed index (DAYS_BEFORE); center it in
  // the scroll viewport instead of leaving the view stuck at the far left.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const colWidth = el.scrollWidth / days.length;
    el.scrollLeft = Math.max(0, (DAYS_BEFORE + 0.5) * colWidth - el.clientWidth / 2);
  }, [anchorDate, days.length]);

  const bars = useMemo<TimelineBar[]>(() => {
    const windowStart = days[0];
    const windowEnd = days[days.length - 1];
    const result: TimelineBar[] = [];

    for (const todo of todos) {
      if (todo.repeat === "none") {
        const start = todo.startDate ?? todo.date;
        const end = todo.endDate ?? start;

        if (end < windowStart || start > windowEnd) continue;

        const clippedStart = start < windowStart ? windowStart : start;
        const clippedEnd = end > windowEnd ? windowEnd : end;
        const startIdx = dayIndex.get(clippedStart);
        const endIdx = dayIndex.get(clippedEnd);

        if (startIdx === undefined || endIdx === undefined) continue;

        result.push({ key: todo.id, todo, startIdx, endIdx });
      } else {
        days.forEach((d, idx) => {
          if (doesTodoOccurOnDate(todo, d)) {
            result.push({ key: `${todo.id}__${d}`, todo, startIdx: idx, endIdx: idx });
          }
        });
      }
    }

    return result.sort((a, b) =>
      a.startIdx - b.startIdx || a.todo.title.localeCompare(b.todo.title)
    );
  }, [todos, days, dayIndex]);

  const gridTemplateColumns = `repeat(${days.length}, minmax(30px, 1fr))`;

  return (
    <div className="timeline-view">
      <div className="timeline-scroll" ref={scrollRef}>
        <div className="timeline-header" style={{ gridTemplateColumns }}>
          {days.map(d => {
            const date = parseLocalDate(d);
            const dow = date.getDay();
            const isToday = d === today;

            return (
              <button
                type="button"
                key={d}
                className={[
                  "timeline-day-header",
                  d === selectedDate ? "selected" : "",
                  dow === 0 ? "sunday" : "",
                  dow === 6 ? "saturday" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => onSelectDate(d)}
              >
                <span className="timeline-weekday">{WEEKDAY_LABELS[dow]}</span>
                <span className={`timeline-day-number ${isToday ? "today-badge" : ""}`}>
                  {date.getDate()}
                </span>
              </button>
            );
          })}
        </div>

        <div className="timeline-body">
          {bars.length === 0 && (
            <div className="timeline-empty">표시할 항목이 없어요 🌸</div>
          )}

          {bars.map(bar => (
            <div key={bar.key} className="timeline-row" style={{ gridTemplateColumns }}>
              <button
                type="button"
                className={`timeline-bar ${bar.todo.done ? "done" : ""}`}
                style={{
                  gridColumn: `${bar.startIdx + 1} / ${bar.endIdx + 2}`,
                  background: bar.todo.color,
                }}
                onClick={() => onEditTodo(bar.todo)}
                title={bar.todo.title}
              >
                <span className="timeline-bar-title">{bar.todo.title}</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TimelineView;
