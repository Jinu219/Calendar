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

  return (
    <div 
      className="title-bar" 
      data-tauri-drag-region
      onMouseDown={preventDblClick}
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
