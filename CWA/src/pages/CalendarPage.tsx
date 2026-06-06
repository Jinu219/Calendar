// ═══════════════════════════════════════════════════════════
// CalendarPage Component
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { invoke } from "@tauri-apps/api/core";

import { useTodos, useSettings, useHolidays, useSystemFonts } from "../hooks";
import {
  TitleBar,
  CalendarView,
  TodoPanel,
  SettingsDrawer,
  AddEventModal,
  EditTodoModal,
} from "../components";
import { expandTodos, getLunarDateString, loadJson } from "../utils";
import { MODAL_CLOSED, getLocalToday, WIN_POS_KEY } from "../constants";
import type { Todo, ModalState, RepeatType } from "../types";

export const CalendarPage: React.FC = () => {
  // ───────────────────────────────────────────────────────
  // Base state
  // ───────────────────────────────────────────────────────

  const [view, setView] = useState<"dayGridMonth" | "timeGridWeek">("dayGridMonth");
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalToday());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [modal, setModal] = useState<ModalState>(MODAL_CLOSED);

  // ───────────────────────────────────────────────────────
  // Hooks
  // ───────────────────────────────────────────────────────

  const {
    todos,
    addTodo,
    updateTodo,
    toggleDone,
    deleteTodo,
    moveTodo,
    updateTodoDate,
  } = useTodos();

  const {
    settings,
    setSetting,
    toggleAutostart,
    resetSettings,
  } = useSettings();

  const { holidays } = useHolidays();

  const {
    filteredFonts,
    fontSearch,
    setFontSearch,
  } = useSystemFonts();

  const appWin = useMemo(() => getCurrentWindow(), []);

  // settings.editMode을 단일 기준으로 사용
  const editMode = settings.editMode;

  // ───────────────────────────────────────────────────────
  // Additional state
  // ───────────────────────────────────────────────────────

  const [moonPhase, setMoonPhase] = useState<{ name: string; emoji: string }>({
    name: "",
    emoji: "",
  });

  const [lunarDate, setLunarDate] = useState("");

  // ───────────────────────────────────────────────────────
  // Moon phase
  // ───────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    import("../utils/apiUtils")
      .then(({ fetchMoonPhase }) => fetchMoonPhase())
      .then(phase => {
        if (mounted) {
          setMoonPhase(phase);
        }
      })
      .catch(console.error);

    return () => {
      mounted = false;
    };
  }, []);

  // ───────────────────────────────────────────────────────
  // Lunar date
  // ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!settings.useLunar) {
      setLunarDate("");
      return;
    }

    const date = new Date(`${selectedDate}T00:00:00`);
    setLunarDate(getLunarDateString(date));
  }, [selectedDate, settings.useLunar]);

  // ───────────────────────────────────────────────────────
  // Window behavior
  // ───────────────────────────────────────────────────────

  useEffect(() => {
    if (settings.alwaysOnTop) {
      invoke("set_always_on_top", { enabled: true }).catch(console.error);
      return;
    }

    invoke("set_always_on_top", { enabled: false }).catch(console.error);

    const pushToBottom = () => {
      invoke("set_always_on_bottom", {}).catch(console.error);
    };

    pushToBottom();

    const unlistenPromise = appWin.onFocusChanged(({ payload: focused }) => {
      if (!focused) {
        pushToBottom();
      }
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten()).catch(console.error);
    };
  }, [appWin, settings.alwaysOnTop]);

  useEffect(() => {
    invoke("set_show_on_taskbar", { show: settings.showOnTaskbar }).catch(console.error);
  }, [settings.showOnTaskbar]);

  // ───────────────────────────────────────────────────────
  // Window position restore/save
  // ───────────────────────────────────────────────────────

  useEffect(() => {
    const saved = loadJson<{ x: number; y: number } | null>(WIN_POS_KEY, null);

    if (!saved) return;

    appWin
      .setPosition(new PhysicalPosition(saved.x, saved.y))
      .catch(console.error);
  }, [appWin]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const unlistenPromise = appWin.onMoved(({ payload }) => {
      // 위치 저장은 편집 모드일 때만 수행
      if (!editMode) return;

      if (timer) {
        clearTimeout(timer);
      }

      timer = setTimeout(() => {
        localStorage.setItem(
          WIN_POS_KEY,
          JSON.stringify({
            x: payload.x,
            y: payload.y,
          })
        );
      }, 500);
    });

    return () => {
      if (timer) {
        clearTimeout(timer);
      }

      unlistenPromise.then(unlisten => unlisten()).catch(console.error);
    };
  }, [appWin, editMode]);

  // ───────────────────────────────────────────────────────
  // Keyboard shortcuts
  // ───────────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;

      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const selectedEvents = ((window as any).__selectedEvents || []) as string[];
      const selectedEventId = (window as any).__selectedEventId as string | undefined;

      // Delete / Backspace: 선택 일정 삭제
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedEvents.length > 0) {
          e.preventDefault();

          selectedEvents.forEach(id => deleteTodo(id));

          (window as any).__selectedEvents = [];
          (window as any).__selectedEventId = null;

          return;
        }

        if (selectedEventId) {
          e.preventDefault();

          deleteTodo(selectedEventId);

          (window as any).__selectedEventId = null;
        }
      }

      // Ctrl+C: 선택 일정 복사
      if (e.ctrlKey && e.key.toLowerCase() === "c") {
        if (selectedEvents.length > 0 || selectedEventId) {
          const idsToCopy = selectedEvents.length > 0
            ? selectedEvents
            : [selectedEventId];

          (window as any).__copiedEvents = idsToCopy;
        }
      }

      // Ctrl+V: 선택 날짜에 복사 일정 붙여넣기
      if (e.ctrlKey && e.key.toLowerCase() === "v") {
        const copiedEvents = ((window as any).__copiedEvents || []) as string[];

        if (copiedEvents.length === 0) return;

        e.preventDefault();

        copiedEvents.forEach(id => {
          const original = todos.find(t => t.id === id);

          if (!original) return;

          addTodo(original.title, selectedDate, {
            color: original.color,
            allDay: original.allDay,
            todoTime: original.todoTime,
            startTime: original.startTime,
            endTime: original.endTime,
            startDate: selectedDate,
            endDate: selectedDate,
            repeat: original.repeat,
            repeatEndDate: original.repeatEndDate,
          });
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [addTodo, deleteTodo, selectedDate, todos]);

  // ───────────────────────────────────────────────────────
  // Calendar events
  // ───────────────────────────────────────────────────────

  const calendarEvents = useMemo(
    () => expandTodos(todos, holidays),
    [todos, holidays]
  );

  // ───────────────────────────────────────────────────────
  // Handlers: view / settings / edit mode
  // ───────────────────────────────────────────────────────

  const handleViewChange = useCallback((nextView: "dayGridMonth" | "timeGridWeek") => {
    setView(nextView);
  }, []);

  const toggleSettingsDrawer = useCallback(() => {
    setSettingsOpen(prev => !prev);
  }, []);

  const closeSettingsDrawer = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const toggleEditMode = useCallback(() => {
    setSetting("editMode", !editMode);
  }, [editMode, setSetting]);

  // ───────────────────────────────────────────────────────
  // Handlers: calendar interaction
  // ───────────────────────────────────────────────────────

  const handleDateClick = useCallback((
    dateStr: string,
    allDay: boolean,
    time?: { start: string; end: string }
  ) => {
    setSelectedDate(dateStr);

    setModal({
      open: true,
      date: dateStr,
      startDate: dateStr,
      endDate: dateStr,
      allDay,
      startTime: time?.start ?? "09:00",
      endTime: time?.end ?? "10:00",
    });
  }, []);

  const handleSelect = useCallback((date: string, time: { start: string; end: string }) => {
    setSelectedDate(date);

    setModal({
      open: true,
      date,
      startDate: date,
      endDate: date,
      allDay: false,
      startTime: time.start,
      endTime: time.end,
    });
  }, []);

  const handleEventClick = useCallback((todoId: string, date: string) => {
    setSelectedDate(date);
    toggleDone(todoId);
  }, [toggleDone]);

  const handleEventDrop = useCallback((
    todoId: string,
    newDate: string,
    newTime?: string
  ) => {
    if (newTime) {
      updateTodo(todoId, {
        date: newDate,
        startDate: newDate,
        startTime: newTime,
        allDay: false,
      });

      return;
    }

    updateTodoDate(todoId, newDate);
  }, [updateTodo, updateTodoDate]);

  const handleEventResize = useCallback((
    todoId: string,
    newEndTime: string | undefined
  ) => {
    if (!newEndTime) return;

    updateTodo(todoId, {
      endTime: newEndTime,
    });
  }, [updateTodo]);

  // ───────────────────────────────────────────────────────
  // Handlers: modal
  // ───────────────────────────────────────────────────────

  const closeModal = useCallback(() => {
    setModal(MODAL_CLOSED);
  }, []);

  const handleAddEventSubmit = useCallback((data: {
    title: string;
    date: string;
    startDate: string;
    endDate: string;
    allDay: boolean;
    startTime: string;
    endTime: string;
    color: string;
    repeat: RepeatType;
    repeatEndDate: string;
  }) => {
    const baseDate = data.startDate || data.date;

    addTodo(data.title, baseDate, {
      color: data.color,
      allDay: data.allDay,
      startTime: data.allDay ? undefined : data.startTime,
      endTime: data.allDay ? undefined : data.endTime,
      startDate: data.startDate || baseDate,
      endDate: data.endDate || data.startDate || baseDate,
      repeat: data.repeat,
      repeatEndDate: data.repeatEndDate || undefined,
    });

    setSelectedDate(baseDate);
    closeModal();
  }, [addTodo, closeModal]);

  const closeEditTodoModal = useCallback(() => {
    setEditingTodo(null);
  }, []);

  const handleSaveEditTodo = useCallback((todo: Todo) => {
    updateTodo(todo.id, todo);
    setEditingTodo(null);
  }, [updateTodo]);

  // ───────────────────────────────────────────────────────
  // Handlers: resize
  // ───────────────────────────────────────────────────────

  const startResize = useCallback((e: React.MouseEvent) => {
    if (!editMode) return;

    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);

    const startX = e.clientX;
    const startW = settings.todoPanelWidth;

    const onMove = (ev: MouseEvent) => {
      const nextWidth = Math.max(
        200,
        Math.min(480, startW + (startX - ev.clientX))
      );

      setSetting("todoPanelWidth", nextWidth);
    };

    const onUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [editMode, settings.todoPanelWidth, setSetting]);

  // ───────────────────────────────────────────────────────
  // Misc
  // ───────────────────────────────────────────────────────

  const preventContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // ───────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────

  return (
    <div
      className={`app-root today-${settings.todayStyle}`}
      style={{ cursor: isResizing ? "ew-resize" : undefined }}
      onContextMenu={preventContextMenu}
    >
      <TitleBar
        view={view}
        onViewChange={handleViewChange}
        settingsOpen={settingsOpen}
        onSettingsToggle={toggleSettingsDrawer}
        editMode={editMode}
        onEditModeToggle={toggleEditMode}
        moonPhase={moonPhase}
      />

      <div className="glass-panel main-panel">
        <div
          className="app-body"
          style={{ userSelect: isResizing ? "none" : undefined }}
        >
          <CalendarView
            view={view}
            onViewChange={handleViewChange}
            events={calendarEvents}
            holidays={holidays}
            settings={settings}
            selectedDate={selectedDate}
            moonPhase={moonPhase}
            onDateClick={handleDateClick}
            onSelect={handleSelect}
            onEventDrop={handleEventDrop}
            onEventClick={handleEventClick}
            onEventResize={handleEventResize}
            editMode={editMode}
          />

          <div
            className={`resize-handle ${editMode ? "visible" : ""} ${isResizing ? "active" : ""}`}
            onMouseDown={startResize}
            title={editMode ? "드래그해서 Todo 패널 크기 조절" : undefined}
          />

          <TodoPanel
            selectedDate={selectedDate}
            todos={todos}
            settings={settings}
            onAddTodo={addTodo}
            onToggleDone={toggleDone}
            onDeleteTodo={deleteTodo}
            onEditTodo={setEditingTodo}
            onMoveTodo={moveTodo}
          />
        </div>
      </div>

      <SettingsDrawer
        isOpen={settingsOpen}
        settings={settings}
        onClose={closeSettingsDrawer}
        onSetSetting={setSetting}
        onToggleAutostart={toggleAutostart}
        onResetSettings={resetSettings}
        filteredFonts={filteredFonts}
        fontSearch={fontSearch}
        onFontSearchChange={setFontSearch}
        moonPhase={moonPhase}
        lunarDate={lunarDate}
      />

      <AddEventModal
        isOpen={modal.open}
        initialData={modal}
        onClose={closeModal}
        onSubmit={handleAddEventSubmit}
      />

      <EditTodoModal
        todo={editingTodo}
        onClose={closeEditTodoModal}
        onSave={handleSaveEditTodo}
      />
    </div>
  );
};

export default CalendarPage;