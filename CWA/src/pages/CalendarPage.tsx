// ═══════════════════════════════════════════════════════════
// CalendarPage Component
// ═══════════════════════════════════════════════════════════

import React, { useState, useMemo, useCallback, use } from "react";

import {
  useTodos,
  useSettings,
  useHolidays,
  useSystemFonts,
  useMoonAndLunar,
  useWindowBehavior,
  useWindowPosition,
  useCalendarModal,
  useTodoPanelResize,
  useCalendarKeyboardShortcuts,
  usePreventDevToolsShortcuts,
} from "../hooks";

import {
  TitleBar,
  CalendarView,
  TodoPanel,
  SettingsDrawer,
  AddEventModal,
  EditTodoModal,
} from "../components";

import { expandTodos } from "../utils";
import { getLocalToday } from "../constants";
import type { Todo } from "../types";

export const CalendarPage: React.FC = () => {
  // ───────────────────────────────────────────────────────
  // Base state
  // ───────────────────────────────────────────────────────

  const [view, setView] = useState<"dayGridMonth" | "timeGridWeek">("dayGridMonth");
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalToday());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);

  // ───────────────────────────────────────────────────────
  // Core hooks
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

  // ───────────────────────────────────────────────────────
  // Derived state
  // ───────────────────────────────────────────────────────

  const editMode = settings.editMode;

  const calendarEvents = useMemo(
    () => expandTodos(todos, holidays),
    [todos, holidays]
  );

  // ───────────────────────────────────────────────────────
  // Feature hooks
  // ───────────────────────────────────────────────────────

  const {
    moonPhase,
    lunarDate,
  } = useMoonAndLunar(selectedDate, settings.useLunar);

  useWindowBehavior({
    windowLevel: settings.windowLevel,
    showOnTaskbar: settings.showOnTaskbar,
  });
  
  useWindowPosition(editMode);

  const {
    modal,
    closeModal,
    openAddTodoModal,
    handleDateClick,
    handleSelect,
    handleAddEventSubmit,
  } = useCalendarModal({
    addTodo,
    setSelectedDate,
  });

  const {
    isResizing,
    startResize,
  } = useTodoPanelResize({
    editMode,
    todoPanelWidth: settings.todoPanelWidth,
    setTodoPanelWidth: width => setSetting("todoPanelWidth", width),
  });

  useCalendarKeyboardShortcuts({
    todos,
    selectedDate,
    addTodo,
    deleteTodo,
  });
  
  usePreventDevToolsShortcuts();

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
  // Handlers: calendar events
  // ───────────────────────────────────────────────────────

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
  // Handlers: edit todo modal
  // ───────────────────────────────────────────────────────

  const closeEditTodoModal = useCallback(() => {
    setEditingTodo(null);
  }, []);

  const handleSaveEditTodo = useCallback((todo: Todo) => {
    updateTodo(todo.id, todo);
    setEditingTodo(null);
  }, [updateTodo]);

  const handleOpenAddTodoModal = useCallback(() => {
    openAddTodoModal(selectedDate);
  }, [openAddTodoModal, selectedDate]);
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
            onOpenAddModel={handleOpenAddTodoModal}
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