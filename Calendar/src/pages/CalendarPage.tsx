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
  useBackup,
  useReminders,
  useAutoUpdate,
} from "../hooks";

import {
  TitleBar,
  CalendarView,
  TimelineView,
  TodoPanel,
  SettingsDrawer,
  AddEventModal,
  EditTodoModal,
  Toast,
} from "../components";

import {
  expandTodos,
  getLocalToday,
  addDays,
  differenceInCalendarDays,
  fmtDate,
  parseLocalDate,
} from "../utils";
import type { AddMode, CalendarViewType, Todo } from "../types";

export const CalendarPage: React.FC = () => {
  // ───────────────────────────────────────────────────────
  // Base state
  // ───────────────────────────────────────────────────────

  const [view, setView] = useState<CalendarViewType>("dayGridMonth");
  const [addMode, setAddMode] = useState<AddMode>("schedule");
  const [timelineAnchor, setTimelineAnchor] = useState<string>(() => getLocalToday());

  const [selectedDate, setSelectedDate] = useState<string>(() =>
    getLocalToday()
  );

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [editingOccurrenceDate, setEditingOccurrenceDate] = useState<string | null>(null);
  const [selectedTodoIds, setSelectedTodoIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
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
    deleteOccurrence,
    editOccurrence,
    undo,
    redo,
    canUndo,
    canRedo,
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

  // Filtered by the schedule/todo/all title-bar toggle for display. Mutation
  // hooks (useTodos, reminders) always operate on the full, unfiltered list.
  const visibleTodos = useMemo(
    () => addMode === "all" ? todos : todos.filter(t => (t.kind ?? "schedule") === addMode),
    [todos, addMode]
  );

  const calendarEvents = useMemo(
    () => expandTodos(visibleTodos, holidays, visibleRange.start, visibleRange.end),
    [visibleTodos, holidays, visibleRange]
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

  const { exportData, importData, isExporting, isImporting } = useBackup();
  const { status: updateStatus, checkForUpdate, installUpdate } = useAutoUpdate();

  useReminders(todos, settings);

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
    addMode,
  });

  const {
    isResizing,
    startResize,
  } = useTodoPanelResize({
    editMode,
    todoPanelWidth: settings.todoPanelWidth,
    setTodoPanelWidth: width => setSetting("todoPanelWidth", width),
  });

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    undo();
    setToastMessage("실행 취소됨 (Ctrl+Z)");
  }, [canUndo, undo]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    redo();
    setToastMessage("다시 실행됨 (Ctrl+Y)");
  }, [canRedo, redo]);

  useCalendarKeyboardShortcuts({
    todos: visibleTodos,
    selectedDate,
    addTodo,
    deleteTodo,
    selectedTodoIds,
    clearSelection: clearTodoSelection,
    onUndo: handleUndo,
    onRedo: handleRedo,
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

  const handleAddModeChange = useCallback((mode: AddMode) => {
    setAddMode(mode);
  }, []);

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
    setEditingOccurrenceDate(null);
  }, []);

  const handleEditTodo = useCallback((todo: Todo, occurrenceDate?: string) => {
    if (!occurrenceDate) {
      setEditingTodo(todo);
      setEditingOccurrenceDate(null);
      return;
    }

    const currentStart = todo.startDate ?? todo.date;
    const currentEnd = todo.endDate ?? currentStart;
    const spanDays = Math.max(
      0,
      differenceInCalendarDays(parseLocalDate(currentStart), parseLocalDate(currentEnd))
    );
    const occurrenceEndDate = fmtDate(addDays(parseLocalDate(occurrenceDate), spanDays));

    setEditingTodo({
      ...todo,
      date: occurrenceDate,
      startDate: occurrenceDate,
      endDate: occurrenceEndDate,
    });
    setEditingOccurrenceDate(occurrenceDate);
  }, []);

  const handleSaveEditTodo = useCallback(
    (todo: Todo) => {
      if (editingOccurrenceDate) {
        editOccurrence(todo.id, editingOccurrenceDate, {
          title: todo.title,
          color: todo.color,
          allDay: todo.allDay,
          startTime: todo.startTime,
          endTime: todo.endTime,
          date: todo.date,
          startDate: todo.startDate,
          endDate: todo.endDate,
        });
      } else {
        updateTodo(todo.id, todo);
      }

      setEditingTodo(null);
      setEditingOccurrenceDate(null);
    },
    [editOccurrence, editingOccurrenceDate, updateTodo]
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
        onPrevious={() => {
          if (view === "timeline") {
            setTimelineAnchor(d => fmtDate(addDays(parseLocalDate(d), -7)));
          } else {
            calendarApi?.prev();
          }
        }}
        onNext={() => {
          if (view === "timeline") {
            setTimelineAnchor(d => fmtDate(addDays(parseLocalDate(d), 7)));
          } else {
            calendarApi?.next();
          }
        }}
        onToday={() => {
          if (view === "timeline") {
            setTimelineAnchor(getLocalToday());
          } else {
            calendarApi?.today();
          }
        }}
        settingsOpen={settingsOpen}
        onSettingsToggle={toggleSettingsDrawer}
        editMode={editMode}
        onEditModeToggle={toggleEditMode}
        moonPhase={moonPhase}
        addMode={addMode}
        onAddModeChange={handleAddModeChange}
      />

      <div className="glass-panel main-panel">
        <div
          className="app-body"
          style={{ userSelect: isResizing ? "none" : undefined }}
        >
          {view === "timeline" ? (
            <TimelineView
              todos={visibleTodos}
              anchorDate={timelineAnchor}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onEditTodo={handleEditTodo}
            />
          ) : (
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
              calendarMode={addMode}
            />
          )}

          <div
            className={`resize-handle ${editMode ? "visible" : ""} ${
              isResizing ? "active" : ""
            }`}
            onMouseDown={startResize}
            title={editMode ? "드래그해서 Todo 패널 크기 조절" : undefined}
          />

          <TodoPanel
            selectedDate={selectedDate}
            todos={visibleTodos}
            settings={settings}
            addMode={addMode}
            onOpenAddModal={handleOpenAddTodoModal}
            memoOpen={memoOpen}
            onToggleMemo={toggleMemoWindow}
            onToggleDone={toggleDone}
            onDeleteTodo={deleteTodo}
            onDeleteOccurrence={deleteOccurrence}
            onEditTodo={handleEditTodo}
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
        onExportData={exportData}
        onImportData={importData}
        isExporting={isExporting}
        isImporting={isImporting}
        updateStatus={updateStatus}
        onCheckForUpdate={checkForUpdate}
        onInstallUpdate={installUpdate}
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
        scopeLabel={editingOccurrenceDate ? "이 날짜만" : undefined}
      />

      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </div>
  );
};

export default CalendarPage;
