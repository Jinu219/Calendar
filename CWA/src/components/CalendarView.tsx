// ═══════════════════════════════════════════════════════════
// CalendarView Component
// ═══════════════════════════════════════════════════════════

import React, { useRef, useEffect } from "react";
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
  onEventDrop: (todoId: string, newDate: string) => void;
  onEventClick: (todoId: string, date: string) => void;
  editMode: boolean;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  view,
  onViewChange,
  events,
  holidays,
  settings,
  selectedDate,
  moonPhase,
  onDateClick,
  onSelect,
  onEventDrop,
  onEventClick,
  editMode,
}) => {
  const calendarRef = useRef<FullCalendar>(null);
  const [, setCalendarTitle] = React.useState("");

  // Sync view
  useEffect(() => {
    calendarRef.current?.getApi().changeView(view);
  }, [view]);

  const handleDateClick = (info: DateClickArg) => {
    const d = info.dateStr.slice(0, 10);
    if (info.view.type === "timeGridWeek" && !info.allDay) {
      const h = String(info.date.getHours()).padStart(2, "0");
      const m = String(info.date.getMinutes()).padStart(2, "0");
      const h2 = String((info.date.getHours() + 1) % 24).padStart(2, "0");
      onDateClick(d, false, { start: `${h}:${m}`, end: `${h2}:${m}` });
    } else {
      onDateClick(d, true);
    }
  };

  const handleSelect = (info: DateSelectArg) => {
    if (info.view.type !== "timeGridWeek") return;
    const d = info.startStr.slice(0, 10);
    onSelect(d, { start: info.startStr.slice(11, 16), end: info.endStr.slice(11, 16) });
    calendarRef.current?.getApi().unselect();
  };

  const handleEventDrop = (info: any) => {
    const todoId = info.event.extendedProps?.todoId;
    if (todoId) {
      const newDate = info.event.startStr.slice(0, 10);
      onEventDrop(todoId, newDate);
    }
  };

  const handleEventClick = (info: any) => {
    const todoId = info.event.extendedProps?.todoId;
    if (todoId) {
      const d = info.event.startStr.slice(0, 10);
      onEventClick(todoId, d);
    }
  };

  const handleDatesSet = (info: any) => {
    const titleEl = document.querySelector(".fc-toolbar-title");
    if (!titleEl) return;
    
    if (info.view.type === "timeGridWeek") {
      const start = info.view.activeStart;
      const month = start.getMonth() + 1;
      const week = getWeekNumber(start);
      // Just show "3월 1주차" without the date range
      const title = `${month}월 ${week}주차`;
      setCalendarTitle(title);
      titleEl.textContent = title;
    } else if (info.view.type === "dayGridMonth") {
      const start = info.view.activeStart;
      const year = start.getFullYear();
      const month = start.getMonth() + 1;
      // Just show "2026년 3월" without duplication
      const title = `${year}년 ${month}월`;
      setCalendarTitle(title);
      titleEl.textContent = title;
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

    return (
      <div className="day-cell-content">
        <div className="day-number-row">
          <span className="day-number">{date.getDate()}</span>
          {settings.useLunar && lunarInfo && (
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
        headerToolbar={{ left: "", center: "title", right: "" }}
        titleFormat={{ year: 'numeric', month: 'long', day: 'numeric' }}
        slotMinTime="09:00:00"
        slotMaxTime="23:00:00"
        slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        slotDuration="00:30:00"
        allDaySlot={true}
        nowIndicator={true}
        selectable={view === "timeGridWeek"}
        selectMirror={true}
        events={events}
        showNonCurrentDates={true}
        fixedWeekCount={settings.showOverflow}
        dayMaxEvents={2}
        dateClick={handleDateClick}
        select={handleSelect}
        eventDrop={handleEventDrop}
        eventClick={handleEventClick}
        datesSet={handleDatesSet}
        dayCellClassNames={dayCellClassNames}
        dayCellContent={dayCellContent}
      />
    </div>
  );
};
