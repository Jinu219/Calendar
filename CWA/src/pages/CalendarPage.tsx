// ═══════════════════════════════════════════════════════════
// CalendarPage Component
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useMemo, useState } from "react";
import type { CalendarApi } from "@fullcalendar/core";

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
  useMemoWindow,
} from "../hooks";

import {
  TitleBar,
  CalendarView,
  TodoPanel,
  SettingsDrawer,
  AddEventModal,
  EditTodoModal,
} from "../components";

import { expandTodos, getLocalToday } from "../utils";
import type { CalendarViewType, Todo } from "../types";

export const CalendarPage: React.FC = () => {
  // ───────────────────────────────────────────────────────
  // Base state
  // ───────────────────────────────────────────────────────

  const [view, setView] = useState<CalendarViewType>("dayGridMonth");

  const [selectedDate, setSelectedDate] = useState<string>(() =>
    getLocalToday()
  );

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [selectedTodoIds, setSelectedTodoIds] = useState<string[]>([]);
  const [calendarApi, setCalendarApi] = useState<CalendarApi | null>(null);
  const [visibleRange, setVisibleRange] = useState(() => {
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end: new Date(now.getFullYear(), now.getMonth() + 2, 1),
    };
  });
  const clearTodoSelection = useCallback(() => setSelectedTodoIds([]), []);

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
    () => expandTodos(todos, holidays, visibleRange.start, visibleRange.end),
    [todos, holidays, visibleRange]
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

  const { memoOpen, toggleMemoWindow } = useMemoWindow();

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
    selectedTodoIds,
    clearSelection: clearTodoSelection,
  });

  usePreventDevToolsShortcuts();

  // ───────────────────────────────────────────────────────
  // Handlers: view / settings / edit mode
  // ───────────────────────────────────────────────────────

  const handleViewChange = useCallback(
    (nextView: CalendarViewType) => {
      setView(nextView);
    },
    []
  );

  const toggleSettingsDrawer = useCallback(() => {
    setSettingsOpen(prev => !prev);
  }, []);

  const closeSettingsDrawer = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const toggleEditMode = useCallback(() => {
    setSetting("editMode", !editMode);
  }, [editMode, setSetting]);

  const handleEventSelectionChange = useCallback((todoId: string, additive: boolean) => {
    setSelectedTodoIds(prev => {
      if (!additive) return [todoId];
      return prev.includes(todoId) ? prev : [...prev, todoId];
    });
  }, []);

  const handleVisibleRangeChange = useCallback((start: Date, end: Date) => {
    setVisibleRange(prev => {
      if (prev.start.getTime() === start.getTime() && prev.end.getTime() === end.getTime()) {
        return prev;
      }

      return { start, end };
    });
  }, []);

  // ───────────────────────────────────────────────────────
  // Handlers: calendar events
  // ───────────────────────────────────────────────────────

  const handleEventClick = useCallback(
    (todoId: string, date: string) => {
      setSelectedDate(date);
      toggleDone(todoId);
    },
    [toggleDone]
  );

  const handleEventDrop = useCallback(
    (todoId: string, newDate: string, newTime?: string) => {
      updateTodoDate(todoId, newDate);

      if (newTime) {
        updateTodo(todoId, {
          startTime: newTime,
          allDay: false,
        });
      }
    },
    [updateTodo, updateTodoDate]
  );

  const handleEventResize = useCallback(
    (todoId: string, updates: { endDate?: string; endTime?: string }) => {
      updateTodo(todoId, updates);
    },
    [updateTodo]
  );

  // ───────────────────────────────────────────────────────
  // Handlers: edit todo modal
  // ───────────────────────────────────────────────────────

  const closeEditTodoModal = useCallback(() => {
    setEditingTodo(null);
  }, []);

  const handleSaveEditTodo = useCallback(
    (todo: Todo) => {
      updateTodo(todo.id, todo);
      setEditingTodo(null);
    },
    [updateTodo]
  );

  const handleOpenAddTodoModal = useCallback(() => {
    openAddTodoModal(selectedDate);
  }, [openAddTodoModal, selectedDate]);

  // ───────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────

  return (
    <div
      className={`app-root today-${settings.todayStyle}`}
      style={{ cursor: isResizing ? "ew-resize" : undefined }}
    >
      <TitleBar
        view={view}
        onViewChange={handleViewChange}
        onPrevious={() => calendarApi?.prev()}
        onNext={() => calendarApi?.next()}
        onToday={() => calendarApi?.today()}
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
            events={calendarEvents}
            holidays={holidays}
            settings={settings}
            selectedDate={selectedDate}
            moonPhase={moonPhase}
            onDateClick={handleDateClick}
            onSelect={handleSelect}
            onEventDrop={handleEventDrop}
            onEventClick={handleEventClick}
            onEventSelectionChange={handleEventSelectionChange}
            onCalendarApiReady={setCalendarApi}
            onVisibleRangeChange={handleVisibleRangeChange}
            onEventResize={handleEventResize}
            editMode={editMode}
          />

          <div
            className={`resize-handle ${editMode ? "visible" : ""} ${
              isResizing ? "active" : ""
            }`}
            onMouseDown={startResize}
            title={editMode ? "드래그해서 Todo 패널 크기 조절" : undefined}
          />

          <TodoPanel
            selectedDate={selectedDate}
            todos={todos}
            settings={settings}
            onOpenAddModal={handleOpenAddTodoModal}
            memoOpen={memoOpen}
            onToggleMemo={toggleMemoWindow}
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
