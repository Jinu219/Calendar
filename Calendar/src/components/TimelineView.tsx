// ═══════════════════════════════════════════════════════════
// TimelineView Component — horizontal Gantt-style calendar
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef } from "react";
import type { Todo } from "../types";
import {
  daysBetween,
  formatShortDate,
  getTodoSpanDays,
  getTodoTimeLabel,
  isOccurrenceDone,
  listOccurrenceStarts,
  parseLocalDate,
  shiftDate,
} from "../utils";

interface TimelineViewProps {
  todos: Todo[];
  anchorDate: string;
  selectedDate: string;
  today: string;
  holidays: Record<string, string>;
  use24Hour: boolean;
  onSelectDate: (date: string) => void;
  onOpenItem: (todo: Todo, occurrenceDate: string) => void;
}

interface TimelineBar {
  key: string;
  todo: Todo;
  occurrenceDate: string;
  occurrenceEndDate: string;
  startIdx: number;
  endIdx: number;
  done: boolean;
  lane: number;
}

const DAYS_BEFORE = 21;
const DAYS_AFTER = 21;
const DAY_COUNT = DAYS_BEFORE + DAYS_AFTER + 1;
// Rough column width and glyph width, used only to keep a short bar's
// overflowing label from colliding with the next bar in its lane.
const APPROX_COLUMN_PX = 34;
const APPROX_CHAR_PX = 8;

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

/** Pack bars into as few rows as possible without overlapping (labels included). */
const assignLanes = (bars: Omit<TimelineBar, "lane">[]): TimelineBar[] => {
  const laneEnds: number[] = [];

  return [...bars]
    .sort((a, b) => a.startIdx - b.startIdx || (b.endIdx - b.startIdx) - (a.endIdx - a.startIdx))
    .map(bar => {
      const labelColumns = Math.ceil((bar.todo.title.length * APPROX_CHAR_PX + 20) / APPROX_COLUMN_PX);
      const visualEnd = Math.max(bar.endIdx, bar.startIdx + labelColumns - 1);
      let lane = laneEnds.findIndex(end => end < bar.startIdx);

      if (lane < 0) {
        lane = laneEnds.length;
        laneEnds.push(visualEnd);
      } else {
        laneEnds[lane] = visualEnd;
      }

      return { ...bar, lane };
    });
};

export const TimelineView: React.FC<TimelineViewProps> = ({
  todos,
  anchorDate,
  selectedDate,
  today,
  holidays,
  use24Hour,
  onSelectDate,
  onOpenItem,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => {
    const start = shiftDate(anchorDate, -DAYS_BEFORE);
    return Array.from({ length: DAY_COUNT }, (_, i) => shiftDate(start, i));
  }, [anchorDate]);

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
    const result: Omit<TimelineBar, "lane">[] = [];

    for (const todo of todos) {
      const span = getTodoSpanDays(todo);

      for (const occurrenceDate of listOccurrenceStarts(todo, windowStart, windowEnd)) {
        const occurrenceEndDate = shiftDate(occurrenceDate, span);
        const startIdx = Math.max(0, daysBetween(windowStart, occurrenceDate));
        const endIdx = Math.min(days.length - 1, daysBetween(windowStart, occurrenceEndDate));

        result.push({
          key: `${todo.id}__${occurrenceDate}`,
          todo,
          occurrenceDate,
          occurrenceEndDate,
          startIdx,
          endIdx,
          done: isOccurrenceDone(todo, occurrenceDate),
        });
      }
    }

    return assignLanes(result);
  }, [todos, days]);

  const laneCount = Math.max(1, ...bars.map(bar => bar.lane + 1));
  const gridTemplateColumns = `repeat(${days.length}, minmax(${APPROX_COLUMN_PX}px, 1fr))`;

  return (
    <div className="timeline-view">
      <div className="timeline-scroll" ref={scrollRef}>
        <div className="timeline-header" style={{ gridTemplateColumns }}>
          {days.map((d, idx) => {
            const date = parseLocalDate(d);
            const dow = date.getDay();
            const holiday = holidays[d];
            const showMonth = idx === 0 || date.getDate() === 1;

            return (
              <button
                type="button"
                key={d}
                className={[
                  "timeline-day-header",
                  d === selectedDate ? "selected" : "",
                  dow === 0 || holiday ? "sunday" : "",
                  dow === 6 && !holiday ? "saturday" : "",
                  showMonth ? "month-start" : "",
                ].filter(Boolean).join(" ")}
                aria-pressed={d === selectedDate}
                aria-label={`${formatShortDate(d)}${holiday ? `, ${holiday}` : ""}${d === today ? ", 오늘" : ""}`}
                title={holiday}
                onClick={() => onSelectDate(d)}
              >
                <span className="timeline-month">{showMonth ? `${date.getMonth() + 1}월` : ""}</span>
                <span className="timeline-weekday">{WEEKDAY_LABELS[dow]}</span>
                <span className={`timeline-day-number ${d === today ? "today-badge" : ""}`}>
                  {date.getDate()}
                </span>
              </button>
            );
          })}
        </div>

        <div
          className="timeline-grid"
          style={{ gridTemplateColumns, gridTemplateRows: `repeat(${laneCount}, 26px)` }}
        >
          {days.map((d, idx) => {
            const dow = parseLocalDate(d).getDay();

            return (
              <div
                key={`col-${d}`}
                aria-hidden="true"
                className={[
                  "timeline-col",
                  dow === 0 || dow === 6 || holidays[d] ? "weekend" : "",
                  d === today ? "today" : "",
                  d === selectedDate ? "selected" : "",
                ].filter(Boolean).join(" ")}
                style={{ gridColumn: idx + 1, gridRow: `1 / span ${laneCount}` }}
              />
            );
          })}

          {bars.map(bar => {
            const time = getTodoTimeLabel(bar.todo, use24Hour);
            const range = bar.occurrenceDate === bar.occurrenceEndDate
              ? formatShortDate(bar.occurrenceDate)
              : `${formatShortDate(bar.occurrenceDate)} – ${formatShortDate(bar.occurrenceEndDate)}`;

            return (
              <button
                type="button"
                key={bar.key}
                className={`timeline-bar ${bar.done ? "done" : ""}`}
                style={{
                  gridColumn: `${bar.startIdx + 1} / ${bar.endIdx + 2}`,
                  gridRow: bar.lane + 1,
                  background: bar.todo.color,
                }}
                onClick={() => onOpenItem(bar.todo, bar.occurrenceDate)}
                aria-label={`${bar.todo.title}, ${range}${time ? ` ${time}` : ""}${bar.done ? ", 완료" : ""}`}
                title={`${bar.todo.title}\n${range}${time ? ` ${time}` : ""}`}
              >
                <span className="timeline-bar-title">
                  {time && <span className="timeline-bar-time">{time.split(" – ")[0]}</span>}
                  {bar.todo.title}
                </span>
              </button>
            );
          })}
        </div>

        {bars.length === 0 && (
          <div className="timeline-empty">이 기간에 표시할 항목이 없어요 🌸</div>
        )}
      </div>
    </div>
  );
};

export default TimelineView;
