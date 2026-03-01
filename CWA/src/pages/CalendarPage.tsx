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
import { TODO_COLORS, MODAL_CLOSED, getLocalToday, WIN_POS_KEY } from "../constants";
import type { Todo, ModalState, RepeatType } from "../types";

export const CalendarPage: React.FC = () => {
  // State
  const [view, setView] = useState<"dayGridMonth" | "timeGridWeek">("dayGridMonth");
  const [selectedDate, setSelectedDate] = useState(getLocalToday);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  
  // Modal state
  const [modal, setModal] = useState<ModalState>(MODAL_CLOSED);
  const [modalTitle, setModalTitle] = useState("");
  const [modalColor, setModalColor] = useState(TODO_COLORS[0]);
  const [modalRepeat, setModalRepeat] = useState<RepeatType>("none");
  const [modalRepeatEnd, setModalRepeatEnd] = useState("");

  // Hooks
  const { todos, addTodo, updateTodo, toggleDone, deleteTodo, moveTodo, updateTodoDate, getTodosByDate } = useTodos();
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

  // Restore window position
  useEffect(() => {
    const saved = loadJson<{ x: number; y: number } | null>(WIN_POS_KEY, null);
    if (saved) {
      appWin.setPosition(new PhysicalPosition(saved.x, saved.y));
    }
  }, []);

  // Save window position on move
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const unlisten = appWin.onMoved(({ payload }) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        localStorage.setItem(WIN_POS_KEY, JSON.stringify({ x: payload.x, y: payload.y }));
      }, 500);
    });
    return () => { unlisten.then(fn => fn()); clearTimeout(timer); };
  }, []);

  // Calendar events
  const calendarEvents = useMemo(() => expandTodos(todos, holidays), [todos, holidays]);

  // Selected todos
  const selectedTodos = useMemo(() => getTodosByDate(selectedDate), [getTodosByDate, selectedDate]);

  // Handlers
  const handleDateClick = useCallback((dateStr: string, allDay: boolean, time?: { start: string; end: string }) => {
    setSelectedDate(dateStr);
    if (time) {
      setModal({
        open: true,
        date: dateStr,
        allDay: false,
        startDate: dateStr,
        endDate: dateStr,
        startTime: time.start,
        endTime: time.end,
      });
      setModalTitle("");
      setModalColor(TODO_COLORS[0]);
      setModalRepeat("none");
    }
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
    setModalTitle("");
    setModalColor(TODO_COLORS[0]);
    setModalRepeat("none");
  }, []);

  const handleEventDrop = useCallback((todoId: string, newDate: string) => {
    updateTodoDate(todoId, newDate);
  }, [updateTodoDate]);

  const handleEventClick = useCallback((todoId: string, date: string) => {
    setSelectedDate(date);
    toggleDone(todoId);
  }, [toggleDone]);

  const commitModal = () => {
    const t = modalTitle.trim();
    if (!t) { closeModal(); return; }
    
    addTodo(t, modal.date, {
      color: modalColor,
      allDay: modal.allDay,
      startTime: modal.allDay ? undefined : modal.startTime,
      endTime: modal.allDay ? undefined : modal.endTime,
      repeat: modalRepeat,
      repeatEndDate: modalRepeatEnd || undefined,
    });
    
    closeModal();
  };

  const closeModal = () => {
    setModal(MODAL_CLOSED);
    setModalTitle("");
    setModalRepeat("none");
    setModalRepeatEnd("");
  };

  const saveEdit = () => {
    if (!editingTodo) return;
    updateTodo(editingTodo.id, editingTodo);
    setEditingTodo(null);
  };

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
            editMode={editMode}
          />

          <div
            className={`resize-handle ${editMode ? "active" : ""}`}
            onMouseDown={startResize}
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
        onSubmit={(data) => {
          addTodo(data.title, data.date, {
            color: data.color,
            allDay: data.allDay,
            startTime: data.startTime,
            endTime: data.endTime,
            repeat: data.repeat,
            repeatEndDate: data.repeatEndDate,
          });
          closeModal();
        }}
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
