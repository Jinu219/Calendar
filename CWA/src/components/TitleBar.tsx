// ═══════════════════════════════════════════════════════════
// TitleBar Component
// ═══════════════════════════════════════════════════════════

import React, { useCallback, memo } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getTodayLabel } from "../utils";
import { getCalendarApi } from "./CalendarView";
import type { MoonPhase } from "../types";

interface TitleBarProps {
  view: "dayGridMonth" | "timeGridWeek";
  onViewChange: (view: "dayGridMonth" | "timeGridWeek") => void;
  settingsOpen: boolean;
  onSettingsToggle: () => void;
  editMode: boolean;
  onEditModeToggle: () => void;
  moonPhase?: MoonPhase;
}

export const TitleBar: React.FC<TitleBarProps> = memo(({
  view,
  onViewChange,
  settingsOpen,
  onSettingsToggle,
  editMode,
  onEditModeToggle,
  moonPhase,
}) => {
  const appWin = getCurrentWindow();
  const todayLabel = getTodayLabel();

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

  const handleDragStart = useCallback(async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) {
      return;
    }

    try {
      await appWin.startDragging();
    } catch (e) {
      console.error("Failed to start dragging:", e);
    }
  }, [appWin]);

  const handlePrev = useCallback(() => {
    const api = getCalendarApi();
    api?.prev();
  }, []);

  const handleNext = useCallback(() => {
    const api = getCalendarApi();
    api?.next();
  }, []);

  const handleToday = useCallback(() => {
    const api = getCalendarApi();
    api?.today();
  }, []);

  return (
    <header
      className="titlebar"
      onMouseDown={handleDragStart}
      onDoubleClick={preventDblClick}
    >
      <div className="titlebar-left">
        <span className="app-title">Calendar</span>
      </div>

      <div className="titlebar-center">
        <button className="nav-btn" onClick={handlePrev}>◀</button>
        <button className="today-btn" onClick={handleToday}>오늘</button>
        <button className="nav-btn" onClick={handleNext}>▶</button>

        {moonPhase && moonPhase.emoji && (
          <span className="moon-label">
            {moonPhase.emoji} {moonPhase.name}
          </span>
        )}

        <span className="today-label">{todayLabel}</span>
      </div>

      <div className="titlebar-right">
        <div className="view-switch">
          <button
            className={view === "dayGridMonth" ? "active" : ""}
            onClick={() => onViewChange("dayGridMonth")}
          >
            월간
          </button>

          <button
            className={view === "timeGridWeek" ? "active" : ""}
            onClick={() => onViewChange("timeGridWeek")}
          >
            주간
          </button>
        </div>

        <button
          className={`edit-mode-btn ${editMode ? "active" : ""}`}
          title={editMode ? "패널 크기 조절 끄기" : "패널 크기 조절 켜기"}
          onClick={onEditModeToggle}
        >
          ↔
        </button>

        <button
          className={`settings-btn ${settingsOpen ? "active" : ""}`}
          title="설정"
          onClick={onSettingsToggle}
        >
          ⚙
        </button>

        <button
          className="window-btn"
          title="숨기기"
          onClick={handleMinimize}
        >
          ＿
        </button>
      </div>
    </header>
  );
});