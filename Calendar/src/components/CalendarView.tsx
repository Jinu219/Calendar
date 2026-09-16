// ═══════════════════════════════════════════════════════════
// CalendarView Component
// ═══════════════════════════════════════════════════════════

import React, { memo, useCallback, useEffect, useRef } from "react";
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
  EventClickArg,
  EventDropArg,
  EventInput,
} from "@fullcalendar/core";
import type { AddMode, CalendarViewType, Settings, MoonPhase } from "../types";
import {
  addDays,
  fmtDate,
  getLocalToday,
  getLunarDateString,
  parseLocalDate,
} from "../utils";

interface CalendarViewProps {
  view: Exclude<CalendarViewType, "timeline">;
  events: EventInput[];
  holidays: Record<string, string>;
  settings: Settings;
  selectedDate: string;
  moonPhase: MoonPhase;
  onDateClick: (dateStr: string, allDay: boolean, time?: { start: string; end: string }) => void;
  onSelect: (startDate: string, endDate: string, time?: { start: string; end: string }) => void;
  onEventDrop: (todoId: string, newDate: string, newTime?: string) => void;
  onEventClick: (todoId: string, date: string) => void;
  onEventSelectionChange: (todoId: string, additive: boolean) => void;
  onCalendarApiReady: (api: CalendarApi | null) => void;
  onVisibleRangeChange: (start: Date, end: Date) => void;
  onEventResize?: (
    todoId: string,
    updates: { endDate?: string; endTime?: string }
  ) => void;
  editMode: boolean;
  calendarMode: AddMode;
}

const CalendarViewComponent: React.FC<CalendarViewProps> = ({
  view,
  events,
  holidays,
  settings,
  selectedDate,
  moonPhase,
  onDateClick,
  onSelect,
  onEventDrop,
  onEventClick,
  onEventSelectionChange,
  onCalendarApiReady,
  onVisibleRangeChange,
  onEventResize,
  editMode,
  calendarMode,
}) => {
  const calendarRef = useRef<FullCalendar>(null);

  useEffect(() => {
    const api = calendarRef.current?.getApi() ?? null;
    onCalendarApiReady(api);

    return () => onCalendarApiReady(null);
  }, [onCalendarApiReady]);

  // Sync view
  useEffect(() => {
    calendarRef.current?.getApi().changeView(view);
  }, [view]);

  const handleDateClick = useCallback((info: DateClickArg) => {
    const d = info.dateStr.slice(0, 10);
    if (info.view.type === "timeGridWeek" && !info.allDay) {
      const h = String(info.date.getHours()).padStart(2, "0");
      const m = String(info.date.getMinutes()).padStart(2, "0");
      const h2 = String((info.date.getHours() + 1) % 24).padStart(2, "0");
      onDateClick(d, false, { start: `${h}:${m}`, end: `${h2}:${m}` });
    } else {
      onDateClick(d, true);
    }
  }, [onDateClick]);

  const handleSelect = useCallback((info: DateSelectArg) => {
    const startDate = info.startStr.slice(0, 10);

    if (info.view.type === "timeGridWeek") {
      onSelect(startDate, startDate, {
        start: info.startStr.slice(11, 16),
        end: info.endStr.slice(11, 16),
      });
    } else {
      // Month view selections are whole days with an exclusive end date.
      const endDate = fmtDate(addDays(parseLocalDate(info.endStr.slice(0, 10)), -1));
      onSelect(startDate, endDate < startDate ? startDate : endDate);
    }

    calendarRef.current?.getApi().unselect();
  }, [onSelect]);

  const handleEventDrop = useCallback((info: EventDropArg) => {
    const todoId = info.event.extendedProps?.todoId;
    const isHoliday = info.event.extendedProps?.isHoliday;
    
    // Prevent moving holidays
    if (isHoliday) {
      info.revert();
      return;
    }
    
    if (todoId) {
      const newDate = info.event.startStr.slice(0, 10);
      const newTime = info.event.startStr.slice(11, 16);
      onEventDrop(todoId, newDate, newTime);
    }
  }, [onEventDrop]);

  const handleEventClick = useCallback((info: EventClickArg) => {
    const todoId = info.event.extendedProps?.todoId;
    const isHoliday = info.event.extendedProps?.isHoliday;
    
    // Prevent clicking on holidays
    if (isHoliday) {
      return;
    }
    
    if (todoId) {
      const additive = info.jsEvent.shiftKey;
      onEventSelectionChange(todoId, additive);

      if (!additive) {
        const d = info.event.startStr.slice(0, 10);
        onEventClick(todoId, d);
      }
    }
  }, [onEventClick, onEventSelectionChange]);

  const handleEventResize = useCallback((info: EventResizeDoneArg) => {
    const todoId = info.event.extendedProps?.todoId;
    const isHoliday = info.event.extendedProps?.isHoliday;
    
    // Prevent resizing holidays
    if (isHoliday) {
      info.revert();
      return;
    }
    
    if (todoId && onEventResize) {
      const eventEnd = info.event.endStr;
      const endDate = eventEnd
        ? info.event.allDay
          ? fmtDate(addDays(parseLocalDate(eventEnd.slice(0, 10)), -1))
          : eventEnd.slice(0, 10)
        : undefined;
      const endTime = !info.event.allDay && eventEnd
        ? eventEnd.slice(11, 16)
        : undefined;

      onEventResize(todoId, { endDate, endTime });
    }
  }, [onEventResize]);

  const handleDatesSet = (info: DatesSetArg) => {
    onVisibleRangeChange(info.start, info.end);
  };

  const dayCellClassNames = (arg: DayCellContentArg) => {
    const cls: string[] = [];
    if (arg.dateStr === selectedDate) cls.push("selected-day");
    const dow = arg.date.getDay();
    if (dow === 0) cls.push("sunday-cell");
    if (dow === 6) cls.push("saturday-cell");
    if (holidays[arg.dateStr]) cls.push("holiday-cell");
    return cls;
  };

  const dayCellContent = (arg: DayCellContentArg) => {
    const date = arg.date;
    const dateStr = arg.dateStr;
    const lunarInfo = getLunarDateString(date);
    const isToday = dateStr === getLocalToday();
    const showLunar = view === "dayGridMonth" && settings.useLunar && lunarInfo;

    return (
      <div className="day-cell-content">
        <div className="day-number-row">
          <span className="day-number">{date.getDate()}</span>
          {showLunar && (
            <span className="lunar-date-small">{lunarInfo}</span>
          )}
        </div>
        {holidays[dateStr] && <div className="holiday-name">{holidays[dateStr]}</div>}
        {isToday && settings.showMoonPhase && <div className="moon-phase-small">{moonPhase.emoji}</div>}
      </div>
    );
  };

  return (
    <div className="calendar-wrap" style={{ position: "relative" }}>
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
        eventResizableFromStart={true}
        eventDurationEditable={true}
        headerToolbar={{ left: "", center: "", right: "" }}
        slotMinTime="09:00:00"
        slotMaxTime="23:00:00"
        slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: !settings.use24Hour, meridiem: false }}
        slotDuration="00:30:00"
        allDaySlot={true}
        allDayText=""
        nowIndicator={true}
        selectable={calendarMode !== "todo"}
        selectMirror={true}
        selectMinDistance={8}
        events={events}
        showNonCurrentDates={true}
        fixedWeekCount={settings.showOverflow}
        dayMaxEvents={view === "dayGridMonth" ? 3 : false}
        dateClick={handleDateClick}
        select={handleSelect}
        eventDrop={handleEventDrop}
        eventClick={handleEventClick}
        eventResize={handleEventResize}
        datesSet={handleDatesSet}
        dayCellClassNames={dayCellClassNames}
        dayCellContent={dayCellContent}
      />
    </div>
  );
};

export const CalendarView = memo(CalendarViewComponent);
