// ═══════════════════════════════════════════════════════════
// CalendarPage Component
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PhysicalPosition } from "@tauri-apps/api/dpi";

import { useTodos, useSettings, useHolidays, useSystemFonts } from "../hooks";
import { 
  TitleBar, 
  CalendarView, 
  TodoPanel, 
  SettingsDrawer, 
  AddEventModal, 
  EditTodoModal 
} from "../components";
import { expandTodos, getLunarDateString, loadJson } from "../utils";
import { MODAL_CLOSED, getLocalToday, WIN_POS_KEY } from "../constants";
import type { Todo, ModalState, RepeatType } from "../types";
import { invoke } from "@tauri-apps/api/core";

export const CalendarPage: React.FC = () => {
  // State
  const [view, setView] = useState<"dayGridMonth" | "timeGridWeek">("dayGridMonth");
  const [selectedDate, setSelectedDate] = useState(getLocalToday);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [todoPanelExpanded, setTodoPanelExpanded] = useState(true); // Collapsible todo input
  
  // Modal state
// Modal state
  const [modal, setModal] = useState<ModalState>(MODAL_CLOSED); 

  // Hooks
  const { todos, addTodo, updateTodo, toggleDone, deleteTodo, moveTodo, updateTodoDate } = useTodos();
  const { settings, setSetting, toggleAutostart, resetSettings } = useSettings();
  const { holidays } = useHolidays();
  const { filteredFonts, fontSearch, setFontSearch } = useSystemFonts();
  
  // Additional state
  const [moonPhase, setMoonPhase] = useState<{ name: string; emoji: string }>({ name: "", emoji: "" });
  const [lunarDate, setLunarDate] = useState<string>("");
  const appWin = getCurrentWindow();

  // Load moon phase
  useEffect(() => {
    import("../utils/apiUtils").then(({ fetchMoonPhase }) => {
      fetchMoonPhase().then(setMoonPhase);
    });
  }, []);

  // Update lunar date when selected date changes
  useEffect(() => {
    if (settings.useLunar) {
      const date = new Date(selectedDate + "T00:00:00");
      setLunarDate(getLunarDateString(date));
    } else {
      setLunarDate("");
    }
  }, [selectedDate, settings.useLunar]);

  // Keyboard event handler for deleting and copy-paste events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      // Delete key - delete selected event(s)
      if (e.key === "Delete" || e.key === "Backspace") {
        // Get selected events
        const selectedEvents = (window as any).__selectedEvents || [];
        const selectedEventId = (window as any).__selectedEventId;
        
        if (selectedEvents.length > 0) {
          e.preventDefault();
          // Delete all selected events
          selectedEvents.forEach((id: string) => deleteTodo(id));
          (window as any).__selectedEvents = [];
          (window as any).__selectedEventId = null;
        } else if (selectedEventId) {
          e.preventDefault();
          deleteTodo(selectedEventId);
          (window as any).__selectedEventId = null;
        }
      }

      // Ctrl+C - Copy selected event(s)
      if (e.ctrlKey && e.key === "c") {
        const selectedEvents = (window as any).__selectedEvents || [];
        const selectedEventId = (window as any).__selectedEventId;
        
        if (selectedEvents.length > 0 || selectedEventId) {
          const idsToCopy = selectedEvents.length > 0 ? selectedEvents : [selectedEventId];
          (window as any).__copiedEvents = idsToCopy;
        }
      }

      // Ctrl+V - Paste copied event(s) to selected date
      if (e.ctrlKey && e.key === "v") {
        const copiedEvents = (window as any).__copiedEvents || [];
        if (copiedEvents.length > 0) {
          e.preventDefault();
          copiedEvents.forEach((id: string) => {
            const original = todos.find(t => t.id === id);
            if (original) {
              addTodo(original.title, selectedDate, {
                color: original.color,
                allDay: original.allDay,
                todoTime: original.todoTime,
                startTime: original.startTime,
                endTime: original.endTime,
              });
            }
          });
        }
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteTodo, addTodo, selectedDate, todos]);

  // Apply always on bottom setting (window behind other apps)
// Apply always on bottom setting (window behind other apps)
useEffect(() => {
  const pushToBottom = () => {
    if (!settings.alwaysOnTop) {
      invoke("set_always_on_bottom", {}).catch(console.error);
    }
  };

  pushToBottom(); // 최초 실행

  if (settings.alwaysOnTop) {
    invoke("set_always_on_top", { enabled: true }).catch(console.error);
    return;
  }

  // 포커스를 잃을 때마다 bottom으로 재설정
  const unlistenPromise = appWin.onFocusChanged(({ payload: focused }) => {
    if (!focused) pushToBottom();
  });

  return () => {
    unlistenPromise.then(fn => fn());
  };
}, [settings.alwaysOnTop]);

  // Apply show on taskbar setting
  useEffect(() => {
    invoke("set_show_on_taskbar", { show: settings.showOnTaskbar }).catch(console.error);
  }, [settings.showOnTaskbar]);

  // Sync editMode with settings
  useEffect(() => {
    setEditMode(settings.editMode);
  }, [settings.editMode]);

  // Restore window position
  useEffect(() => {
    const saved = loadJson<{ x: number; y: number } | null>(WIN_POS_KEY, null);
    if (saved && settings.editMode) {
      appWin.setPosition(new PhysicalPosition(saved.x, saved.y));
    }
  }, []);

  // Save window position on move
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const unlisten = appWin.onMoved(({ payload }) => {
      // Only save position in edit mode
      if (!settings.editMode) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        localStorage.setItem(WIN_POS_KEY, JSON.stringify({ x: payload.x, y: payload.y }));
      }, 500);
    });
    return () => { unlisten.then(fn => fn()); clearTimeout(timer); };
  }, [settings.editMode]);

  // Calendar events
  const calendarEvents = useMemo(() => expandTodos(todos, holidays), [todos, holidays]);

  // Selected todos


  // Handlers
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
      allDay: false,
      startDate: date,
      endDate: date,
      startTime: time.start,
      endTime: time.end,
    });
  }, []);

  const handleEventDrop = useCallback((todoId: string, newDate: string, newTime?: string) => {
    if (newTime) {
      // Update both date and time for weekly view
      updateTodo(todoId, { date: newDate, startTime: newTime });
    } else {
      updateTodoDate(todoId, newDate);
    }
  }, [updateTodo, updateTodoDate]);

  const handleEventClick = useCallback((todoId: string, date: string) => {
    setSelectedDate(date);
    toggleDone(todoId);
  }, [toggleDone]);

  const handleEventResize = useCallback((todoId: string, newEndTime: string | undefined) => {
    const todo = todos.find(t => t.id === todoId);
    if (todo && newEndTime) {
      updateTodo(todoId, { endTime: newEndTime });
    }
  }, [todos, updateTodo]);

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

  // Resize handler
  const startResize = (e: React.MouseEvent) => {
    if (!editMode) return;
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startW = settings.todoPanelWidth;
    const onMove = (ev: MouseEvent) => setSetting("todoPanelWidth", Math.max(200, Math.min(480, startW + (startX - ev.clientX))));
    const onUp = () => { setIsResizing(false); window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Prevent context menu
  const preventContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div
      className={`app-root today-${settings.todayStyle}`}
      style={{ cursor: isResizing ? "ew-resize" : undefined }}
      onContextMenu={preventContextMenu}
    >
      <TitleBar
        view={view}
        onViewChange={setView}
        settingsOpen={settingsOpen}
        onSettingsToggle={() => setSettingsOpen(o => !o)}
        moonPhase={moonPhase}
      />

      <div className="glass-panel main-panel">
        <div className="app-body" style={{ userSelect: isResizing ? "none" : undefined }}>
          <CalendarView
            view={view}
            onViewChange={setView}
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

          {todoPanelExpanded ? (
            <>
              <div
                className={`resize-handle ${editMode ? "active" : ""}`}
                onMouseDown={editMode ? startResize : undefined}
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
            </>
          ) : null}
        </div>
      </div>

      <SettingsDrawer
        isOpen={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
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
        onClose={() => setEditingTodo(null)}
        onSave={(todo) => {
          updateTodo(todo.id, todo);
          setEditingTodo(null);
        }}
      />
    </div>
  );
};

export default CalendarPage;
