// ═══════════════════════════════════════════════════════════
// TimelineView Component — horizontal Gantt-style calendar
// ═══════════════════════════════════════════════════════════
//
// Three spans: a day (half-hour columns), a week or a month (day columns).
// Bars are packed into lanes so they never overlap.

import React, { useEffect, useMemo, useRef } from "react";
import type { TimelineSpan, Todo } from "../types";
import {
  DAY_SLOT_COUNT,
  daysBetween,
  formatShortDate,
  getAgendaForDate,
  getDaySlots,
  getTimelineRange,
  getTodoSpanDays,
  getTodoTimeLabel,
  isOccurrenceDone,
  listOccurrenceStarts,
  parseLocalDate,
  shiftDate,
} from "../utils";
import { SegmentedControl } from "./SegmentedControl";

interface TimelineViewProps {
  todos: Todo[];
  anchorDate: string;
  span: TimelineSpan;
  onSpanChange: (span: TimelineSpan) => void;
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
  /** Shown in the tooltip and read out by screen readers. */
  rangeLabel: string;
  startIdx: number;
  endIdx: number;
  done: boolean;
  lane: number;
}

// Minimum column width per span. Also used to keep a short bar's overflowing
// label from colliding with the next bar in its lane.
const COLUMN_PX: Record<TimelineSpan, number> = { day: 24, week: 72, month: 30 };
const APPROX_CHAR_PX = 8;
const DAY_VIEW_START_HOUR = 8;

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

const SPAN_OPTIONS: { value: TimelineSpan; label: string }[] = [
  { value: "day", label: "일" },
  { value: "week", label: "주" },
  { value: "month", label: "월" },
];

/** Pack bars into as few rows as possible without overlapping (labels included). */
const assignLanes = (bars: Omit<TimelineBar, "lane">[], columnPx: number): TimelineBar[] => {
  const laneEnds: number[] = [];

  return [...bars]
    .sort((a, b) => a.startIdx - b.startIdx || (b.endIdx - b.startIdx) - (a.endIdx - a.startIdx))
    .map(bar => {
      const labelColumns = Math.ceil((bar.todo.title.length * APPROX_CHAR_PX + 20) / columnPx);
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

const rangeOf = (start: string, end: string) =>
  start === end ? formatShortDate(start) : `${formatShortDate(start)} – ${formatShortDate(end)}`;

export const TimelineView: React.FC<TimelineViewProps> = ({
  todos,
  anchorDate,
  span,
  onSpanChange,
  selectedDate,
  today,
  holidays,
  use24Hour,
  onSelectDate,
  onOpenItem,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const columnPx = COLUMN_PX[span];

  const days = useMemo(() => {
    const { start, end } = getTimelineRange(anchorDate, span);
    return Array.from({ length: daysBetween(start, end) + 1 }, (_, i) => shiftDate(start, i));
  }, [anchorDate, span]);

  const columnCount = span === "day" ? DAY_SLOT_COUNT : days.length;

  const bars = useMemo<TimelineBar[]>(() => {
    if (span === "day") {
      const day = days[0];

      return assignLanes(getAgendaForDate(todos, day).map(item => {
        const slots = getDaySlots(item, day);

        return {
          key: `${item.todo.id}__${item.occurrenceDate}`,
          todo: item.todo,
          occurrenceDate: item.occurrenceDate,
          rangeLabel: rangeOf(item.occurrenceDate, item.occurrenceEndDate),
          startIdx: slots.first,
          endIdx: slots.last,
          done: item.done,
        };
      }), columnPx);
    }

    const windowStart = days[0];
    const windowEnd = days[days.length - 1];
    const result: Omit<TimelineBar, "lane">[] = [];

    for (const todo of todos) {
      const spanDays = getTodoSpanDays(todo);

      for (const occurrenceDate of listOccurrenceStarts(todo, windowStart, windowEnd)) {
        const occurrenceEndDate = shiftDate(occurrenceDate, spanDays);

        result.push({
          key: `${todo.id}__${occurrenceDate}`,
          todo,
          occurrenceDate,
          rangeLabel: rangeOf(occurrenceDate, occurrenceEndDate),
          startIdx: Math.max(0, daysBetween(windowStart, occurrenceDate)),
          endIdx: Math.min(days.length - 1, daysBetween(windowStart, occurrenceEndDate)),
          done: isOccurrenceDone(todo, occurrenceDate),
        });
      }
    }

    return assignLanes(result, columnPx);
  }, [todos, days, span, columnPx]);

  // Day: start at the current hour (today) or the morning. Month: centre the
  // selected day. A week always fits.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const colWidth = el.scrollWidth / columnCount;

    if (span === "day") {
      const hour = days[0] === today ? Math.max(0, new Date().getHours() - 1) : DAY_VIEW_START_HOUR;
      el.scrollLeft = hour * 2 * colWidth;
    } else if (span === "month") {
      const idx = Math.max(0, days.indexOf(selectedDate));
      el.scrollLeft = Math.max(0, (idx + 0.5) * colWidth - el.clientWidth / 2);
    } else {
      el.scrollLeft = 0;
    }
    // Only when the range changes, not on every selection inside it.
  }, [anchorDate, span]);

  const laneCount = Math.max(1, ...bars.map(bar => bar.lane + 1));
  const gridTemplateColumns = `repeat(${columnCount}, minmax(${columnPx}px, 1fr))`;
  const nowSlot = span === "day" && days[0] === today
    ? Math.floor((new Date().getHours() * 60 + new Date().getMinutes()) / 30)
    : -1;

  const header = span === "day"
    ? Array.from({ length: 24 }, (_, hour) => (
        <div
          key={hour}
          className={`timeline-hour-header ${hour === Math.floor(nowSlot / 2) ? "now" : ""}`}
          style={{ gridColumn: `${hour * 2 + 1} / span 2` }}
        >
          {use24Hour ? `${hour}시` : `${hour < 12 ? "오전" : "오후"} ${hour % 12 || 12}시`}
        </div>
      ))
    : days.map((d, idx) => {
        const date = parseLocalDate(d);
        const dow = date.getDay();
        const holiday = holidays[d];
        const showMonth = span === "month" ? idx === 0 : idx === 0 || date.getDate() === 1;

        return (
          <button
            type="button"
            key={d}
            className={[
              "timeline-day-header",
              d === selectedDate ? "selected" : "",
              dow === 0 || holiday ? "sunday" : "",
              dow === 6 && !holiday ? "saturday" : "",
              showMonth && idx > 0 ? "month-start" : "",
            ].filter(Boolean).join(" ")}
            aria-pressed={d === selectedDate}
            aria-label={`${formatShortDate(d)}${holiday ? `, ${holiday}` : ""}${d === today ? ", 오늘" : ""}`}
            title={holiday}
            onClick={() => onSelectDate(d)}
          >
            {span === "week" && <span className="timeline-month">{showMonth ? `${date.getMonth() + 1}월` : ""}</span>}
            <span className="timeline-weekday">{WEEKDAY_LABELS[dow]}</span>
            <span className={`timeline-day-number ${d === today ? "today-badge" : ""}`}>
              {date.getDate()}
            </span>
          </button>
        );
      });

  const columns = Array.from({ length: columnCount }, (_, idx) => {
    if (span === "day") {
      return (
        <div
          key={`col-${idx}`}
          aria-hidden="true"
          className={["timeline-col", idx % 2 ? "half" : "", idx === nowSlot ? "today" : ""].filter(Boolean).join(" ")}
          style={{ gridColumn: idx + 1, gridRow: `1 / span ${laneCount}` }}
        />
      );
    }

    const d = days[idx];
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
  });

  return (
    <div className={`timeline-view span-${span}`}>
      <div className="timeline-toolbar">
        <SegmentedControl<TimelineSpan>
          label="타임라인 범위"
          className="seg-compact"
          options={SPAN_OPTIONS.map(option => ({ ...option, title: `${option.label} 단위로 보기` }))}
          value={span}
          onChange={onSpanChange}
        />
      </div>

      <div className="timeline-scroll" ref={scrollRef}>
        <div className="timeline-header" style={{ gridTemplateColumns }}>
          {header}
        </div>

        <div
          className="timeline-grid"
          style={{ gridTemplateColumns, gridTemplateRows: `repeat(${laneCount}, 26px)` }}
        >
          {columns}

          {bars.map(bar => {
            const time = getTodoTimeLabel(bar.todo, use24Hour);

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
                aria-label={`${bar.todo.title}, ${bar.rangeLabel}${time ? ` ${time}` : ""}${bar.done ? ", 완료" : ""}`}
                title={`${bar.todo.title}\n${bar.rangeLabel}${time ? ` ${time}` : ""}`}
              >
                <span className="timeline-bar-title">
                  {time && span !== "day" && <span className="timeline-bar-time">{time.split(" – ")[0]}</span>}
                  {bar.todo.title}
                </span>
              </button>
            );
          })}
        </div>

        {bars.length === 0 && (
          <div className="timeline-empty">
            {span === "day" ? "이 날은 비어 있어요 🌸" : "이 기간에 표시할 항목이 없어요 🌸"}
          </div>
        )}
      </div>
    </div>
  );
};

export default TimelineView;
