// ═══════════════════════════════════════════════════════════
// TitleBar Component
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useMemo, useRef, memo } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { formatShortDate } from "../utils";
import type { AddMode, CalendarViewType, MoonPhase } from "../types";

interface TitleBarProps {
  view: CalendarViewType;
  onViewChange: (view: CalendarViewType) => void;
  /** What the calendar is showing, e.g. "2026년 11월". */
  viewTitle: string;
  /** Month ("YYYY-MM") the title's month picker opens on. */
  viewMonth: string;
  onJumpToMonth: (month: string) => void;
  today: string;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  settingsOpen: boolean;
  onSettingsToggle: () => void;
  editMode: boolean;
  onEditModeToggle: () => void;
  onShowHelp: () => void;
  moonPhase?: MoonPhase;
  showMoonPhase: boolean;
  addMode: AddMode;
  onAddModeChange: (mode: AddMode) => void;
}

const KIND_FILTERS: { value: AddMode; label: string; title: string }[] = [
  { value: "schedule", label: "일정", title: "일정만 보기 · 클릭/드래그로 일정 추가" },
  { value: "todo", label: "할일", title: "할 일만 보기 · 날짜를 클릭하면 할 일 추가" },
  { value: "all", label: "전체", title: "일정과 할 일 모두 보기" },
];

const VIEWS: { value: CalendarViewType; label: string; key: string }[] = [
  { value: "dayGridMonth", label: "월간", key: "1" },
  { value: "timeGridWeek", label: "주간", key: "2" },
  { value: "timeline", label: "타임라인", key: "3" },
];

export const TitleBar: React.FC<TitleBarProps> = memo(({
  view,
  onViewChange,
  viewTitle,
  viewMonth,
  onJumpToMonth,
  today,
  onPrevious,
  onNext,
  onToday,
  settingsOpen,
  onSettingsToggle,
  editMode,
  onEditModeToggle,
  onShowHelp,
  moonPhase,
  showMoonPhase,
  addMode,
  onAddModeChange,
}) => {
  const appWin = useMemo(() => getCurrentWindow(), []);
  const monthInputRef = useRef<HTMLInputElement>(null);
  const todayLabel = formatShortDate(today);
  const unit = view === "dayGridMonth" ? "달" : "주";

  const preventDblClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const handleDragStart = useCallback(async (e: React.MouseEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button, input")) {
      return;
    }

    try {
      await appWin.startDragging();
    } catch (error) {
      console.error("Failed to start dragging:", error);
    }
  }, [appWin]);

  const openMonthPicker = () => {
    const input = monthInputRef.current;
    if (!input) return;

    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  };

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
        <div className="nav-group" role="group" aria-label="날짜 이동">
          <button
            type="button"
            className="nav-btn"
            onClick={onPrevious}
            aria-label={`이전 ${unit}`}
            title={`이전 ${unit} (←)`}
          >
            ◀
          </button>
          <button
            type="button"
            className="today-btn"
            onClick={onToday}
            title="오늘로 이동 (T)"
          >
            오늘
          </button>
          <button
            type="button"
            className="nav-btn"
            onClick={onNext}
            aria-label={`다음 ${unit}`}
            title={`다음 ${unit} (→)`}
          >
            ▶
          </button>
        </div>

        <div className="view-title-wrap">
          <button
            type="button"
            className="view-title"
            onClick={openMonthPicker}
            title="원하는 달로 이동"
            aria-label={`${viewTitle}, 다른 달로 이동`}
          >
            {viewTitle}
          </button>
          <input
            ref={monthInputRef}
            type="month"
            className="visually-hidden-input"
            tabIndex={-1}
            aria-hidden="true"
            value={viewMonth}
            onChange={e => e.target.value && onJumpToMonth(e.target.value)}
          />
        </div>

        {showMoonPhase && moonPhase?.emoji && (
          <span className="moon-label" title={`오늘의 달: ${moonPhase.name}`}>
            <span aria-hidden="true">{moonPhase.emoji}</span> {moonPhase.name}
          </span>
        )}

        <span className="today-label" title="오늘">
          오늘 {todayLabel}
        </span>
      </div>

      <div className="titlebar-right">
        <div className="view-switch" role="group" aria-label="표시할 항목">
          {KIND_FILTERS.map(filter => (
            <button
              key={filter.value}
              type="button"
              className={addMode === filter.value ? "active" : ""}
              aria-pressed={addMode === filter.value}
              title={filter.title}
              onClick={() => onAddModeChange(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="view-switch" role="group" aria-label="보기 방식">
          {VIEWS.map(option => (
            <button
              key={option.value}
              type="button"
              className={view === option.value ? "active" : ""}
              aria-pressed={view === option.value}
              title={`${option.label} 보기 (${option.key})`}
              onClick={() => onViewChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className={`edit-mode-btn ${editMode ? "active" : ""}`}
          aria-pressed={editMode}
          aria-label="패널 크기 조절 모드"
          title={editMode ? "패널 크기 조절 끄기" : "패널 크기 조절 켜기"}
          onClick={onEditModeToggle}
        >
          ↔
        </button>

        <button
          type="button"
          className="settings-btn"
          aria-label="단축키 도움말"
          title="단축키 도움말 (?)"
          onClick={onShowHelp}
        >
          ?
        </button>

        <button
          type="button"
          className={`settings-btn ${settingsOpen ? "active" : ""}`}
          aria-pressed={settingsOpen}
          aria-label="설정"
          title="설정"
          onClick={onSettingsToggle}
        >
          ⚙
        </button>
      </div>
    </header>
  );
});
