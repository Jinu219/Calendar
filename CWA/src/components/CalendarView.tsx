// ═══════════════════════════════════════════════════════════
// CalendarView Component
// ═══════════════════════════════════════════════════════════

import React, { useRef, useEffect, useCallback, memo } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import { DateSelectArg } from "@fullcalendar/core";
import { EventInput } from "@fullcalendar/core";
import type { Settings, MoonPhase } from "../types";
import { getLunarDateString, getWeekNumber, getLocalToday } from "../utils";

interface CalendarViewProps {
  view: "dayGridMonth" | "timeGridWeek";
  onViewChange: (view: "dayGridMonth" | "timeGridWeek") => void;
  events: EventInput[];
  holidays: Record<string, string>;
  settings: Settings;
  selectedDate: string;
  moonPhase: MoonPhase;
  onDateClick: (dateStr: string, allDay: boolean, time?: { start: string; end: string }) => void;
  onSelect: (date: string, time: { start: string; end: string }) => void;
  onEventDrop: (todoId: string, newDate: string, newTime?: string) => void;
  onEventClick: (todoId: string, date: string) => void;
  onEventResize?: (todoId: string, newEndTime: string | undefined) => void;
  onEventDelete?: (todoId: string) => void;
  onEventCopy?: (todoId: string, newDate: string) => void;
  editMode: boolean;
  onToggleTodoPanel?: () => void;
  isTodoPanelExpanded?: boolean;
}

// Expose calendar API globally for TitleBar to use
let calendarApiRef: any = null;

export const getCalendarApi = () => calendarApiRef;

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
  onEventResize,
  onEventDelete,
  onEventCopy,
  editMode,
  onToggleTodoPanel,
  isTodoPanelExpanded,
}) => {
  const calendarRef = useRef<FullCalendar>(null);
  const [calendarTitle, setCalendarTitle] = React.useState("");

  // Store calendar API for external access
  useEffect(() => {
    if (calendarRef.current) {
      calendarApiRef = calendarRef.current?.getApi();
    }
  }, []);

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
    if (info.view.type !== "timeGridWeek") return;
    const d = info.startStr.slice(0, 10);
    onSelect(d, { start: info.startStr.slice(11, 16), end: info.endStr.slice(11, 16) });
    calendarRef.current?.getApi().unselect();
  }, [onSelect]);

  const handleEventDrop = useCallback((info: any) => {
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

  const handleEventClick = useCallback((info: any) => {
    const todoId = info.event.extendedProps?.todoId;
    const isHoliday = info.event.extendedProps?.isHoliday;
    
    // Prevent clicking on holidays
    if (isHoliday) {
      return;
    }
    
    if (todoId) {
      // Handle Shift+Click for multi-select
      if (info.jsEvent?.shiftKey) {
        // Add to selected events array
        const selected = (window as any).__selectedEvents || [];
        if (!selected.includes(todoId)) {
          selected.push(todoId);
          (window as any).__selectedEvents = selected;
        }
      } else {
        // Single click - select one event
        (window as any).__selectedEventId = todoId;
        (window as any).__selectedEvents = [todoId];
        const d = info.event.startStr.slice(0, 10);
        onEventClick(todoId, d);
      }
    }
  }, [onEventClick]);

  const handleEventResize = useCallback((info: any) => {
    const todoId = info.event.extendedProps?.todoId;
    const isHoliday = info.event.extendedProps?.isHoliday;
    
    // Prevent resizing holidays
    if (isHoliday) {
      info.revert();
      return;
    }
    
    if (todoId && onEventResize) {
      const newEndTime = info.event.endStr ? info.event.endStr.slice(11, 16) : undefined;
      onEventResize(todoId, newEndTime);
    }
  }, [onEventResize]);

  const handleDatesSet = (info: any) => {
    // Update global API reference
    calendarApiRef = info.view.calendar;
    
    if (info.view.type === "timeGridWeek") {
      const start = info.view.activeStart;
      const month = start.getMonth() + 1;
      const week = getWeekNumber(start);
      const title = `${month}월 ${week}주차`;
      setCalendarTitle(title);
    } else if (info.view.type === "dayGridMonth") {
      const start = info.view.activeStart;
      const year = start.getFullYear();
      const month = start.getMonth() + 1;
      const title = `${year}년 ${month}월`;
      setCalendarTitle(title);
    } else {
      setCalendarTitle("");
    }
  };

  const dayCellClassNames = (arg: any) => {
    const cls: string[] = [];
    if (arg.dateStr === selectedDate) cls.push("selected-day");
    const dow = arg.date.getDay();
    if (dow === 0) cls.push("sunday-cell");
    if (dow === 6) cls.push("saturday-cell");
    if (holidays[arg.dateStr]) cls.push("holiday-cell");
    return cls;
  };

  const dayCellContent = (arg: any) => {
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
      {/* Custom title display */}
      <div className="calendar-custom-title">{calendarTitle || ' '}</div>
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
        slotDuration="00:30:00"
        allDaySlot={true}
        allDayText=""
        nowIndicator={true}
        selectable={view === "timeGridWeek"}
        selectMirror={true}
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
