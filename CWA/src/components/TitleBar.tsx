// ═══════════════════════════════════════════════════════════
// TitleBar Component
// ═══════════════════════════════════════════════════════════

import React, { useCallback, memo } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getTodayLabel } from "../utils";
import type { CalendarViewType, MoonPhase } from "../types";

interface TitleBarProps {
  view: CalendarViewType;
  onViewChange: (view: CalendarViewType) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  settingsOpen: boolean;
  onSettingsToggle: () => void;
  editMode: boolean;
  onEditModeToggle: () => void;
  moonPhase?: MoonPhase;
}

export const TitleBar: React.FC<TitleBarProps> = memo(({
  view,
  onViewChange,
  onPrevious,
  onNext,
  onToday,
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
        <button className="nav-btn" onClick={onPrevious}>◀</button>
        <button className="today-btn" onClick={onToday}>오늘</button>
        <button className="nav-btn" onClick={onNext}>▶</button>

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

      </div>
    </header>
  );
});
