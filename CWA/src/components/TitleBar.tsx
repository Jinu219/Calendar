// ═══════════════════════════════════════════════════════════
// TitleBar Component
// ═══════════════════════════════════════════════════════════

import React, { useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getTodayLabel } from "../utils";

interface TitleBarProps {
  view: "dayGridMonth" | "timeGridWeek";
  onViewChange: (view: "dayGridMonth" | "timeGridWeek") => void;
  settingsOpen: boolean;
  onSettingsToggle: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  view,
  onViewChange,
  settingsOpen,
  onSettingsToggle,
}) => {
  const appWin = getCurrentWindow();
  const todayLabel = getTodayLabel();

  // Prevent double-click from maximizing the window
  const preventDblClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const handleMinimize = useCallback(async () => {
    try {
      await appWin.hide();
    } catch (e) {
      console.error("Failed to hide window:", e);
    }
  }, [appWin]);

  // Handle dragging - allow window to be moved from most of the title bar
  const handleDragStart = useCallback(async (e: React.MouseEvent) => {
    // Don't drag if clicking on buttons
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    try {
      await appWin.startDragging();
    } catch (e) {
      console.error("Failed to start dragging:", e);
    }
  }, [appWin]);

  // Navigate to previous month/week
  const handlePrev = useCallback(() => {
    const calendarEl = document.querySelector('.fc');
    if (calendarEl) {
      const calendar = (calendarEl as any)._fullCalendar;
      if (calendar) {
        calendar.getApi().prev();
      }
    }
  }, []);

  // Navigate to next month/week
  const handleNext = useCallback(() => {
    const calendarEl = document.querySelector('.fc');
    if (calendarEl) {
      const calendar = (calendarEl as any)._fullCalendar;
      if (calendar) {
        calendar.getApi().next();
      }
    }
  }, []);

  // Go to today
  const handleToday = useCallback(() => {
    const calendarEl = document.querySelector('.fc');
    if (calendarEl) {
      const calendar = (calendarEl as any)._fullCalendar;
      if (calendar) {
        calendar.getApi().today();
      }
    }
  }, []);

  return (
    <div 
      className="title-bar" 
      data-tauri-drag-region
      onMouseDown={preventDblClick}
      onMouseMove={handleDragStart}
    >
      <div className="tb-left" data-tauri-drag-region>
        <button 
          className="app-logo minimize-btn" 
          onClick={handleMinimize} 
          title="창 내리기"
        >
          🌸
        </button>
        <span className="app-title" data-tauri-drag-region>Calendar</span>
      </div>

      <div className="tb-nav" data-tauri-drag-region>
        <button className="nav-btn" onClick={handlePrev} title="이전">◀</button>
        <button className="nav-btn nav-today" onClick={handleToday}>오늘</button>
        <button className="nav-btn" onClick={handleNext} title="다음">▶</button>
      </div>

      <div className="tb-today" data-tauri-drag-region>
        <span className="tb-today-text">{todayLabel}</span>
      </div>

      <div className="tb-right">
        <div className="view-switcher">
          <button 
            className={`view-btn ${view === "dayGridMonth" ? "active" : ""}`}
            onClick={() => onViewChange("dayGridMonth")}
          >
            월간
          </button>
          <button 
            className={`view-btn ${view === "timeGridWeek" ? "active" : ""}`}
            onClick={() => onViewChange("timeGridWeek")}
          >
            주간
          </button>
        </div>
        <div className="tb-sep" />
        <button 
          className={`wc-btn gear-btn ${settingsOpen ? "gear-on" : ""}`}
          title="설정"
          onClick={onSettingsToggle}
        >
          ⚙
        </button>
      </div>
    </div>
  );
};
