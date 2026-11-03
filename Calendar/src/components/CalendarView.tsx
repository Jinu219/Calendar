// ═══════════════════════════════════════════════════════════
// CalendarView Component
// ═══════════════════════════════════════════════════════════

import React, { memo, useCallback, useEffect, useMemo, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, {
  type DateClickArg,
  type EventResizeDoneArg,
} from "@fullcalendar/interaction";
import type {
  CalendarApi,
  DateSelectArg,
  DatesSetArg,
  DayCellContentArg,
  EventApi,
  EventClickArg,
  EventContentArg,
  EventDropArg,
  EventInput,
  EventMountArg,
} from "@fullcalendar/core";
import type { AddMode, CalendarViewType, EventTiming, MoonPhase, OccurrenceRef, Settings } from "../types";
import {
  WEEK_VIEW_DEFAULT_END_HOUR,
  WEEK_VIEW_DEFAULT_START_HOUR,
} from "../constants";
import {
  addDays,
  fmtDate,
  formatClock,
  getLunarDateString,
  parseLocalDate,
  shiftDate,
} from "../utils";

export interface VisibleDatesInfo {
  start: Date;
  end: Date;
  /** First day of the period the view represents (not the padding days around it). */
  currentStart: Date;
  viewType: string;
}

interface CalendarViewProps {
  view: Exclude<CalendarViewType, "timeline">;
  events: EventInput[];
  holidays: Record<string, string>;
  settings: Settings;
  selectedDate: string;
  today: string;
  moonPhase: MoonPhase;
  selection: OccurrenceRef[];
  onDateClick: (dateStr: string) => void;
  onSelect: (startDate: string, endDate: string, time?: { start: string; end: string }) => void;
  onEventClick: (ref: OccurrenceRef, additive: boolean) => void;
  onEventDoubleClick: (ref: OccurrenceRef) => void;
  /** A drag or resize finished. Call `revert` to put the event back (e.g. cancelled). */
  onEventTimingChange: (ref: OccurrenceRef, timing: EventTiming, revert: () => void) => void;
  onCalendarApiReady: (api: CalendarApi | null) => void;
  onDatesChange: (info: VisibleDatesInfo) => void;
  editMode: boolean;
  calendarMode: AddMode;
}

const refOf = (event: EventApi): OccurrenceRef | null => {
  const { todoId, occurrenceDate, isHoliday } = event.extendedProps ?? {};
  if (isHoliday || typeof todoId !== "string" || typeof occurrenceDate !== "string") return null;
  return { todoId, occurrenceDate };
};

/** Where FullCalendar put an event after a drag/resize, in our inclusive-end terms. */
const timingOf = (event: EventApi): EventTiming | null => {
  const start = event.start;
  if (!start) return null;

  const startDate = fmtDate(start);

  if (event.allDay) {
    // FullCalendar's all-day end is exclusive.
    const endDate = fmtDate(addDays(event.end ?? addDays(start, 1), -1));
    return { startDate, endDate: endDate < startDate ? startDate : endDate, allDay: true };
  }

  // An all-day item dropped into the time grid has no end yet: give it an hour.
  const end = event.end ?? new Date(start.getTime() + 60 * 60_000);
  let endDate = fmtDate(end);
  let endTime = formatClock(end);

  // Ending exactly at midnight belongs to the previous day.
  if (endTime === "00:00" && endDate > startDate) {
    endDate = shiftDate(endDate, -1);
    endTime = "23:59";
  }

  return { startDate, endDate, allDay: false, startTime: formatClock(start), endTime };
};

const hourOf = (value: unknown): number | null => {
  if (typeof value !== "string" || value.length < 16) return null;
  return Number(value.slice(11, 13)) + Number(value.slice(14, 16)) / 60;
};

const toSlotTime = (hour: number) => `${String(hour).padStart(2, "0")}:00:00`;

const CalendarViewComponent: React.FC<CalendarViewProps> = ({
  view,
  events,
  holidays,
  settings,
  selectedDate,
  today,
  moonPhase,
  selection,
  onDateClick,
  onSelect,
  onEventClick,
  onEventDoubleClick,
  onEventTimingChange,
  onCalendarApiReady,
  onDatesChange,
  editMode,
  calendarMode,
}) => {
  const calendarRef = useRef<FullCalendar>(null);

  useEffect(() => {
    const api = calendarRef.current?.getApi() ?? null;
    onCalendarApiReady(api);

    return () => onCalendarApiReady(null);
  }, [onCalendarApiReady]);

  // Sync view. FullCalendar re-renders our custom cell content with flushSync,
  // which React rejects (and logs dozens of errors for) inside its commit
  // phase — so the switch runs on the next tick instead.
  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api || api.view.type === view) return;

    const timer = window.setTimeout(() => api.changeView(view));
    return () => window.clearTimeout(timer);
  }, [view]);

  // The week grid normally shows 09–23h but widens to fit any earlier or later
  // event, so nothing is ever hidden outside the visible hours.
  const { slotMinTime, slotMaxTime, scrollTime } = useMemo(() => {
    let min = WEEK_VIEW_DEFAULT_START_HOUR;
    let max = WEEK_VIEW_DEFAULT_END_HOUR;

    for (const event of events) {
      if (event.allDay) continue;

      const start = hourOf(event.start);
      const end = hourOf(event.end);
      const crossesMidnight = typeof event.end === "string" && typeof event.start === "string"
        && event.end.slice(0, 10) !== event.start.slice(0, 10);

      if (start !== null) min = Math.min(min, Math.floor(start));
      if (crossesMidnight) {
        min = 0;
        max = 24;
      } else if (end !== null) {
        max = Math.max(max, Math.ceil(end));
      }
    }

    const nowHour = new Date().getHours();

    return {
      slotMinTime: toSlotTime(min),
      slotMaxTime: toSlotTime(Math.min(24, max)),
      scrollTime: toSlotTime(Math.max(min, Math.min(nowHour - 1, max - 1))),
    };
  }, [events]);

  const selectionKeys = useMemo(
    () => new Set(selection.map(ref => `${ref.todoId}__${ref.occurrenceDate}`)),
    [selection]
  );

  const handleDateClick = useCallback((info: DateClickArg) => {
    onDateClick(info.dateStr.slice(0, 10));
  }, [onDateClick]);

  const handleSelect = useCallback((info: DateSelectArg) => {
    const startDate = info.startStr.slice(0, 10);

    if (info.view.type === "timeGridWeek" && !info.allDay) {
      onSelect(startDate, info.endStr.slice(0, 10), {
        start: info.startStr.slice(11, 16),
        end: info.endStr.slice(11, 16),
      });
    } else {
      // Whole-day selections have an exclusive end date.
      const endDate = fmtDate(addDays(parseLocalDate(info.endStr.slice(0, 10)), -1));
      onSelect(startDate, endDate < startDate ? startDate : endDate);
    }

    calendarRef.current?.getApi().unselect();
  }, [onSelect]);

  const handleTimingChange = useCallback((event: EventApi, revert: () => void) => {
    const ref = refOf(event);
    const timing = timingOf(event);

    if (!ref || !timing) {
      revert();
      return;
    }

    onEventTimingChange(ref, timing, revert);
  }, [onEventTimingChange]);

  const handleEventDrop = useCallback((info: EventDropArg) => {
    handleTimingChange(info.event, info.revert);
  }, [handleTimingChange]);

  const handleEventResize = useCallback((info: EventResizeDoneArg) => {
    handleTimingChange(info.event, info.revert);
  }, [handleTimingChange]);

  const handleEventClick = useCallback((info: EventClickArg) => {
    const ref = refOf(info.event);
    if (!ref) return;

    info.jsEvent.preventDefault();

    // The second click of a double-click arrives with detail === 2.
    if (info.jsEvent.detail >= 2) {
      onEventDoubleClick(ref);
      return;
    }

    onEventClick(ref, info.jsEvent.shiftKey || info.jsEvent.ctrlKey || info.jsEvent.metaKey);
  }, [onEventClick, onEventDoubleClick]);

  const handleDatesSet = useCallback((info: DatesSetArg) => {
    onDatesChange({
      start: info.start,
      end: info.end,
      currentStart: info.view.currentStart,
      viewType: info.view.type,
    });
  }, [onDatesChange]);

  const eventClassNames = useCallback((arg: EventContentArg) => {
    const ref = refOf(arg.event);
    return ref && selectionKeys.has(`${ref.todoId}__${ref.occurrenceDate}`) ? ["is-selected"] : [];
  }, [selectionKeys]);

  // Screen readers otherwise only hear the bare title.
  const handleEventDidMount = useCallback((arg: EventMountArg) => {
    if (arg.event.extendedProps?.isHoliday) {
      arg.el.setAttribute("aria-label", `공휴일: ${arg.event.title}`);
      return;
    }

    const done = arg.event.classNames.includes("is-done");
    const time = arg.event.allDay || !arg.event.start ? "종일" : formatClock(arg.event.start);
    const title = arg.event.title.replace(/^✓ /, "");

    arg.el.setAttribute("aria-label", `${title}, ${time}${done ? ", 완료" : ""}`);
    arg.el.setAttribute("title", `${title} — 클릭: 선택 · 더블클릭: 수정`);
  }, []);

  // Note: day cell args have no `dateStr` (FullCalendar's type allows any extra
  // prop, so reading it compiles but is always undefined) — derive it from `date`.
  const dayCellClassNames = (arg: DayCellContentArg) => {
    const dateStr = fmtDate(arg.date);
    const cls: string[] = [];
    if (dateStr === selectedDate) cls.push("selected-day");
    const dow = arg.date.getDay();
    if (dow === 0) cls.push("sunday-cell");
    if (dow === 6) cls.push("saturday-cell");
    if (holidays[dateStr]) cls.push("holiday-cell");
    return cls;
  };

  const dayCellContent = (arg: DayCellContentArg) => {
    const dateStr = fmtDate(arg.date);
    const showLunar = view === "dayGridMonth" && settings.useLunar;
    const lunarInfo = showLunar ? getLunarDateString(arg.date) : "";
    const holiday = holidays[dateStr];

    return (
      <div className="day-cell-content">
        <div className="day-number-row">
          <span className="day-number">{arg.date.getDate()}</span>
          {lunarInfo && (
            <span className="lunar-date-small" title={`음력 ${lunarInfo}`}>{lunarInfo}</span>
          )}
          {dateStr === today && settings.showMoonPhase && (
            <span className="moon-phase-small" title={moonPhase.name} aria-hidden="true">
              {moonPhase.emoji}
            </span>
          )}
        </div>
        {holiday && <div className="holiday-name" title={holiday}>{holiday}</div>}
      </div>
    );
  };

  const hour12 = !settings.use24Hour;

  return (
    <div className="calendar-wrap">
      {editMode && (
        <div className="edit-mode-badge">
          ✏ 편집 모드 — 경계 드래그로 패널 너비 조절
        </div>
      )}
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={view}
        locale="ko"
        height="100%"
        editable={true}
        eventInteractive={true}
        eventResizableFromStart={true}
        eventDurationEditable={true}
        headerToolbar={{ left: "", center: "", right: "" }}
        slotMinTime={slotMinTime}
        slotMaxTime={slotMaxTime}
        scrollTime={scrollTime}
        scrollTimeReset={false}
        slotLabelFormat={{ hour: hour12 ? "numeric" : "2-digit", minute: "2-digit", hour12, meridiem: hour12 ? "short" : false }}
        eventTimeFormat={{ hour: hour12 ? "numeric" : "2-digit", minute: "2-digit", hour12, meridiem: hour12 ? "short" : false }}
        slotDuration="00:30:00"
        allDaySlot={true}
        allDayText="종일"
        nowIndicator={true}
        selectable={calendarMode !== "todo"}
        selectMirror={true}
        selectMinDistance={8}
        events={events}
        showNonCurrentDates={true}
        fixedWeekCount={settings.showOverflow}
        dayMaxEvents={view === "dayGridMonth" ? true : false}
        dateClick={handleDateClick}
        select={handleSelect}
        eventDrop={handleEventDrop}
        eventClick={handleEventClick}
        eventResize={handleEventResize}
        eventClassNames={eventClassNames}
        eventDidMount={handleEventDidMount}
        datesSet={handleDatesSet}
        dayCellClassNames={dayCellClassNames}
        dayCellContent={dayCellContent}
      />
    </div>
  );
};

export const CalendarView = memo(CalendarViewComponent);
