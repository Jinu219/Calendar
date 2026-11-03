// ═══════════════════════════════════════════════════════════
// CalendarPage Component
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  useToday,
  useToast,
} from "../hooks";

import {
  TitleBar,
  CalendarView,
  TimelineView,
  TodoPanel,
  SettingsDrawer,
  AddEventModal,
  EditTodoModal,
  RecurrenceScopeModal,
  ShortcutHelpModal,
  Toast,
  type VisibleDatesInfo,
} from "../components";

import { FLASH_MESSAGE_KEY } from "../constants";
import {
  doesOccurrenceStartOn,
  expandTodos,
  formatShortDate,
  getHolidayEvents,
  getOccurrenceTiming,
  getTodoSpanDays,
  getWeekNumber,
  parseLocalDate,
  parseQuickAdd,
  shiftDate,
  timingToFields,
  type QuickAddResult,
} from "../utils";
import type {
  AddMode,
  CalendarViewType,
  EventTiming,
  OccurrenceRef,
  RecurrenceScope,
  Todo,
} from "../types";

const TIMELINE_HALF_SPAN_DAYS = 21;

interface ScopePrompt {
  actionLabel: string;
  occurrenceDate: string;
  onChoose: (scope: RecurrenceScope) => void;
  onCancel?: () => void;
}

interface EditingState {
  todo: Todo;
  /** Set when only this occurrence of a recurring todo is being edited. */
  occurrenceDate: string | null;
}

const sameRef = (a: OccurrenceRef, b: OccurrenceRef) =>
  a.todoId === b.todoId && a.occurrenceDate === b.occurrenceDate;

/**
 * FullCalendar swallows mousedown (for dragging), so clicking the calendar never
 * blurs a focused text field and the keyboard shortcuts would keep typing into it.
 */
const releaseTextFocus = () => {
  const active = document.activeElement as HTMLElement | null;
  if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) active.blur();
};

const monthDay = (dateStr: string) => {
  const d = parseLocalDate(dateStr);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

const initialVisibleDates = (): VisibleDatesInfo => {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    end: new Date(now.getFullYear(), now.getMonth() + 2, 1),
    currentStart: new Date(now.getFullYear(), now.getMonth(), 1),
    viewType: "dayGridMonth",
  };
};

export const CalendarPage: React.FC = () => {
  // ───────────────────────────────────────────────────────
  // Base state
  // ───────────────────────────────────────────────────────

  const today = useToday();
  const [view, setView] = useState<CalendarViewType>("dayGridMonth");
  const [addMode, setAddMode] = useState<AddMode>("schedule");
  const [timelineAnchor, setTimelineAnchor] = useState<string>(today);
  const [selectedDate, setSelectedDate] = useState<string>(today);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [scopePrompt, setScopePrompt] = useState<ScopePrompt | null>(null);
  const [selection, setSelection] = useState<OccurrenceRef[]>([]);
  const [calendarApi, setCalendarApi] = useState<CalendarApi | null>(null);
  const [visibleDates, setVisibleDates] = useState<VisibleDatesInfo>(initialVisibleDates);
  const copiedRefs = useRef<OccurrenceRef[]>([]);
  const quickAddRef = useRef<HTMLInputElement>(null);

  // ───────────────────────────────────────────────────────
  // Core hooks
  // ───────────────────────────────────────────────────────

  const {
    todos,
    addTodo,
    addTodos,
    updateTodo,
    toggleDone,
    deleteTodo,
    removeOccurrences,
    moveTodo,
    applyTiming,
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

  const { toast, showToast, dismissToast } = useToast();

  // Holidays for every year on screen (including the timeline's ±3 weeks).
  const holidayYears = useMemo(() => [
    parseLocalDate(today).getFullYear(),
    visibleDates.start.getFullYear(),
    visibleDates.end.getFullYear(),
    parseLocalDate(shiftDate(timelineAnchor, -TIMELINE_HALF_SPAN_DAYS)).getFullYear(),
    parseLocalDate(shiftDate(timelineAnchor, TIMELINE_HALF_SPAN_DAYS)).getFullYear(),
  ], [today, visibleDates, timelineAnchor]);

  const { holidays } = useHolidays(holidayYears);

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

  // Day cells show holiday names in the month view; the week view needs them as events.
  const calendarEvents = useMemo(
    () => [
      ...expandTodos(visibleTodos, visibleDates.start, visibleDates.end),
      ...(view === "timeGridWeek" ? getHolidayEvents(holidays, visibleDates.start, visibleDates.end) : []),
    ],
    [visibleTodos, visibleDates, holidays, view]
  );

  const { viewTitle, viewMonth } = useMemo(() => {
    if (view === "timeline") {
      return {
        viewTitle: `${monthDay(shiftDate(timelineAnchor, -TIMELINE_HALF_SPAN_DAYS))} – ${monthDay(shiftDate(timelineAnchor, TIMELINE_HALF_SPAN_DAYS))}`,
        viewMonth: timelineAnchor.slice(0, 7),
      };
    }

    const start = visibleDates.currentStart;
    const yearMonth = `${start.getFullYear()}년 ${start.getMonth() + 1}월`;

    return {
      viewTitle: visibleDates.viewType === "timeGridWeek"
        ? `${yearMonth} ${getWeekNumber(start)}주차`
        : yearMonth,
      viewMonth: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
    };
  }, [view, timelineAnchor, visibleDates]);

  const findTodo = useCallback((id: string) => todos.find(t => t.id === id), [todos]);

  // Drop selections whose occurrence no longer exists (deleted, moved, undone).
  useEffect(() => {
    setSelection(prev => {
      const next = prev.filter(ref => {
        const todo = todos.find(t => t.id === ref.todoId);
        return todo !== undefined && doesOccurrenceStartOn(todo, ref.occurrenceDate);
      });
      return next.length === prev.length ? prev : next;
    });
  }, [todos]);

  // One-shot message left by a reload (e.g. after importing a backup).
  useEffect(() => {
    const message = sessionStorage.getItem(FLASH_MESSAGE_KEY);
    if (!message) return;

    sessionStorage.removeItem(FLASH_MESSAGE_KEY);
    showToast(message);
  }, [showToast]);

  // ───────────────────────────────────────────────────────
  // Feature hooks
  // ───────────────────────────────────────────────────────

  const {
    moonPhase,
    lunarDate,
  } = useMoonAndLunar(today, selectedDate, settings.useLunar);

  useWindowBehavior({
    windowLevel: settings.windowLevel,
    showOnTaskbar: settings.showOnTaskbar,
  });

  useWindowPosition();

  const { memoOpen, toggleMemoWindow } = useMemoWindow();

  const { exportData, importData, isExporting, isImporting } = useBackup();
  const { status: updateStatus, checkForUpdate, installUpdate } = useAutoUpdate();

  useReminders(todos, settings);

  const {
    modal,
    closeModal,
    openAddTodoModal,
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

  usePreventDevToolsShortcuts();

  // ───────────────────────────────────────────────────────
  // Handlers: undo / toast
  // ───────────────────────────────────────────────────────

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    undo();
    showToast("실행 취소했어요", { label: "다시 실행", onAction: redo });
  }, [canUndo, undo, redo, showToast]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    redo();
    showToast("다시 실행했어요");
  }, [canRedo, redo, showToast]);

  /** Toast for a change the user may want to take back right away. */
  const notifyUndoable = useCallback((message: string) => {
    showToast(message, { label: "실행 취소", onAction: undo });
  }, [showToast, undo]);

  // ───────────────────────────────────────────────────────
  // Handlers: navigation / view
  // ───────────────────────────────────────────────────────

  const handlePrevious = useCallback(() => {
    if (view === "timeline") {
      setTimelineAnchor(d => shiftDate(d, -7));
    } else {
      calendarApi?.prev();
    }
  }, [view, calendarApi]);

  const handleNext = useCallback(() => {
    if (view === "timeline") {
      setTimelineAnchor(d => shiftDate(d, 7));
    } else {
      calendarApi?.next();
    }
  }, [view, calendarApi]);

  const handleToday = useCallback(() => {
    setSelectedDate(today);
    setTimelineAnchor(today);
    calendarApi?.today();
  }, [today, calendarApi]);

  const handleJumpToMonth = useCallback((month: string) => {
    const firstDay = `${month}-01`;

    if (view === "timeline") {
      setTimelineAnchor(firstDay);
    } else {
      calendarApi?.gotoDate(firstDay);
    }
  }, [view, calendarApi]);

  const handleViewChange = useCallback((nextView: CalendarViewType) => {
    // The timeline opens centred on whatever day is selected.
    if (nextView === "timeline") setTimelineAnchor(selectedDate);
    setView(nextView);
  }, [selectedDate]);

  const handleDatesChange = useCallback((info: VisibleDatesInfo) => {
    setVisibleDates(prev =>
      prev.start.getTime() === info.start.getTime() &&
      prev.end.getTime() === info.end.getTime() &&
      prev.viewType === info.viewType
        ? prev
        : info
    );
  }, []);

  const toggleSettingsDrawer = useCallback(() => setSettingsOpen(prev => !prev), []);
  const closeSettingsDrawer = useCallback(() => setSettingsOpen(false), []);
  const openHelp = useCallback(() => setHelpOpen(true), []);

  const toggleEditMode = useCallback(() => {
    setSetting("editMode", !editMode);
  }, [editMode, setSetting]);

  // ───────────────────────────────────────────────────────
  // Handlers: selection
  // ───────────────────────────────────────────────────────

  const handleEventClick = useCallback((ref: OccurrenceRef, additive: boolean) => {
    releaseTextFocus();
    setSelectedDate(ref.occurrenceDate);
    setSelection(prev => {
      if (!additive) return [ref];
      return prev.some(r => sameRef(r, ref)) ? prev.filter(r => !sameRef(r, ref)) : [...prev, ref];
    });
  }, []);

  const handleDateClick = useCallback((dateStr: string) => {
    setSelectedDate(dateStr);
    setSelection([]);

    // In todo mode a click on a day leads straight into typing a task for it.
    if (addMode === "todo") quickAddRef.current?.focus();
    else releaseTextFocus();
  }, [addMode]);

  const handleEscape = useCallback(() => {
    if (settingsOpen) {
      setSettingsOpen(false);
    } else {
      setSelection([]);
    }
  }, [settingsOpen]);

  // ───────────────────────────────────────────────────────
  // Handlers: recurrence-aware edit / delete / move
  // ───────────────────────────────────────────────────────

  /** Run `action` right away for a one-off todo, or after asking "this or all?" for a series. */
  const withScope = useCallback((
    todo: Todo,
    occurrenceDate: string,
    actionLabel: string,
    action: (scope: RecurrenceScope) => void,
    onCancel?: () => void
  ) => {
    if (todo.repeat === "none") {
      action("all");
      return;
    }

    setScopePrompt({ actionLabel, occurrenceDate, onChoose: action, onCancel });
  }, []);

  const openEditor = useCallback((todo: Todo, occurrenceDate: string | null) => {
    setEditing({
      // Editing one occurrence shows that occurrence's own dates.
      todo: occurrenceDate ? { ...todo, ...timingToFields(getOccurrenceTiming(todo, occurrenceDate)) } : todo,
      occurrenceDate,
    });
  }, []);

  const requestEdit = useCallback((todo: Todo, occurrenceDate: string) => {
    withScope(todo, occurrenceDate, "수정", scope =>
      openEditor(todo, scope === "this" ? occurrenceDate : null)
    );
  }, [withScope, openEditor]);

  const handleEventDoubleClick = useCallback((ref: OccurrenceRef) => {
    const todo = findTodo(ref.todoId);
    if (todo) requestEdit(todo, ref.occurrenceDate);
  }, [findTodo, requestEdit]);

  const requestDelete = useCallback((todo: Todo, occurrenceDate: string) => {
    withScope(todo, occurrenceDate, "삭제", scope => {
      if (scope === "this") {
        removeOccurrences([{ todoId: todo.id, occurrenceDate }]);
        notifyUndoable(`"${todo.title}" ${formatShortDate(occurrenceDate)} 일정을 삭제했어요`);
      } else {
        deleteTodo(todo.id);
        notifyUndoable(`"${todo.title}"을(를) 삭제했어요`);
      }
    });
  }, [withScope, removeOccurrences, deleteTodo, notifyUndoable]);

  const handleEventTimingChange = useCallback((
    ref: OccurrenceRef,
    timing: EventTiming,
    revert: () => void
  ) => {
    const todo = findTodo(ref.todoId);

    if (!todo) {
      revert();
      return;
    }

    withScope(
      todo,
      ref.occurrenceDate,
      "이동",
      scope => {
        applyTiming(todo.id, ref.occurrenceDate, timing, scope);
        setSelection([]);
        setSelectedDate(timing.startDate);
      },
      revert
    );
  }, [findTodo, withScope, applyTiming]);

  const handleScopeChoice = useCallback((scope: RecurrenceScope) => {
    const prompt = scopePrompt;
    setScopePrompt(null);
    prompt?.onChoose(scope);
  }, [scopePrompt]);

  const handleScopeCancel = useCallback(() => {
    scopePrompt?.onCancel?.();
    setScopePrompt(null);
  }, [scopePrompt]);

  // ───────────────────────────────────────────────────────
  // Handlers: edit modal
  // ───────────────────────────────────────────────────────

  const closeEditTodoModal = useCallback(() => setEditing(null), []);

  const handleSaveEditTodo = useCallback((id: string, updates: Partial<Todo>) => {
    if (editing?.occurrenceDate) {
      editOccurrence(id, editing.occurrenceDate, updates);
    } else {
      updateTodo(id, updates);
    }

    setEditing(null);
  }, [editing, editOccurrence, updateTodo]);

  const handleDeleteFromEditor = useCallback((todo: Todo) => {
    if (editing?.occurrenceDate) {
      removeOccurrences([{ todoId: todo.id, occurrenceDate: editing.occurrenceDate }]);
      notifyUndoable(`"${todo.title}" ${formatShortDate(editing.occurrenceDate)} 일정을 삭제했어요`);
    } else {
      deleteTodo(todo.id);
      notifyUndoable(`"${todo.title}"을(를) 삭제했어요`);
    }

    setEditing(null);
  }, [editing, removeOccurrences, deleteTodo, notifyUndoable]);

  // ───────────────────────────────────────────────────────
  // Handlers: adding
  // ───────────────────────────────────────────────────────

  const handleOpenAddTodoModal = useCallback(() => {
    openAddTodoModal(selectedDate);
  }, [openAddTodoModal, selectedDate]);

  const handleQuickAdd = useCallback((text: string) => {
    const kind = addMode === "todo" ? "todo" : "schedule";
    // Times typed into the text ("14:30 회의") only make sense for schedules.
    const parsed: QuickAddResult = kind === "schedule" ? parseQuickAdd(text) : { title: text.trim() };
    const timed = parsed.startTime !== undefined;

    addTodo(parsed.title, selectedDate, {
      kind,
      allDay: !timed,
      startDate: selectedDate,
      endDate: selectedDate,
      ...(timed ? { startTime: parsed.startTime, endTime: parsed.endTime } : {}),
    });

    notifyUndoable(
      `"${parsed.title}" 추가 · ${formatShortDate(selectedDate)}${timed ? ` ${parsed.startTime}` : ""}`
    );
  }, [addMode, selectedDate, addTodo, notifyUndoable]);

  // ───────────────────────────────────────────────────────
  // Handlers: keyboard shortcuts on the selection
  // ───────────────────────────────────────────────────────

  const handleToggleSelected = useCallback(() => {
    selection.forEach(ref => toggleDone(ref.todoId, ref.occurrenceDate));
  }, [selection, toggleDone]);

  const handleEditSelected = useCallback(() => {
    const ref = selection[0];
    const todo = ref && findTodo(ref.todoId);
    if (todo) requestEdit(todo, ref.occurrenceDate);
  }, [selection, findTodo, requestEdit]);

  const handleDeleteSelected = useCallback(() => {
    if (selection.length === 0) return;

    removeOccurrences(selection);
    notifyUndoable(`${selection.length}개 항목을 삭제했어요`);
    setSelection([]);
  }, [selection, removeOccurrences, notifyUndoable]);

  const handleCopy = useCallback(() => {
    copiedRefs.current = selection;
    showToast(`${selection.length}개 항목을 복사했어요 · 날짜를 고르고 Ctrl+V`);
  }, [selection, showToast]);

  // A pasted item is a one-off copy of that occurrence on the selected day.
  const handlePaste = useCallback(() => {
    const inputs = copiedRefs.current.flatMap(ref => {
      const original = findTodo(ref.todoId);
      if (!original) return [];

      return [{
        title: original.title,
        date: selectedDate,
        options: {
          color: original.color,
          allDay: original.allDay,
          todoTime: original.todoTime,
          startTime: original.startTime,
          endTime: original.endTime,
          kind: original.kind,
          startDate: selectedDate,
          endDate: shiftDate(selectedDate, getTodoSpanDays(original)),
        },
      }];
    });

    if (inputs.length === 0) return;

    addTodos(inputs);
    notifyUndoable(`${inputs.length}개 항목을 ${formatShortDate(selectedDate)}에 붙여넣었어요`);
  }, [findTodo, selectedDate, addTodos, notifyUndoable]);

  useCalendarKeyboardShortcuts({
    hasSelection: selection.length > 0,
    onPrevious: handlePrevious,
    onNext: handleNext,
    onToday: handleToday,
    onViewChange: handleViewChange,
    onNewItem: handleOpenAddTodoModal,
    onFocusQuickAdd: () => quickAddRef.current?.focus(),
    onToggleSelected: handleToggleSelected,
    onEditSelected: handleEditSelected,
    onDeleteSelected: handleDeleteSelected,
    onCopy: handleCopy,
    onPaste: handlePaste,
    onUndo: handleUndo,
    onRedo: handleRedo,
    onEscape: handleEscape,
    onShowHelp: openHelp,
  });

  // ───────────────────────────────────────────────────────
  // Handlers: backup
  // ───────────────────────────────────────────────────────

  const handleExportData = useCallback(async () => {
    const result = await exportData();
    if (result) showToast(result.message);
  }, [exportData, showToast]);

  const handleImportData = useCallback(async () => {
    const result = await importData();
    // A successful import reloads the window and reports itself afterwards.
    if (result && !result.ok) showToast(result.message);
  }, [importData, showToast]);

  // ───────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────

  const handleResizeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;

    e.preventDefault();
    e.stopPropagation();
    const delta = e.key === "ArrowLeft" ? 10 : -10;
    setSetting("todoPanelWidth", Math.min(480, Math.max(200, settings.todoPanelWidth + delta)));
  };

  return (
    <div
      className={`app-root today-${settings.todayStyle}`}
      style={{ cursor: isResizing ? "ew-resize" : undefined }}
    >
      <TitleBar
        view={view}
        onViewChange={handleViewChange}
        viewTitle={viewTitle}
        viewMonth={viewMonth}
        onJumpToMonth={handleJumpToMonth}
        today={today}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToday={handleToday}
        settingsOpen={settingsOpen}
        onSettingsToggle={toggleSettingsDrawer}
        editMode={editMode}
        onEditModeToggle={toggleEditMode}
        onShowHelp={openHelp}
        moonPhase={moonPhase}
        showMoonPhase={settings.showMoonPhase}
        addMode={addMode}
        onAddModeChange={setAddMode}
      />

      <main className="glass-panel main-panel">
        <div
          className="app-body"
          style={{ userSelect: isResizing ? "none" : undefined }}
        >
          {view === "timeline" ? (
            <TimelineView
              todos={visibleTodos}
              anchorDate={timelineAnchor}
              selectedDate={selectedDate}
              today={today}
              holidays={holidays}
              use24Hour={settings.use24Hour}
              onSelectDate={setSelectedDate}
              onOpenItem={(todo, occurrenceDate) => {
                setSelectedDate(occurrenceDate);
                requestEdit(todo, occurrenceDate);
              }}
            />
          ) : (
            <CalendarView
              view={view}
              events={calendarEvents}
              holidays={holidays}
              settings={settings}
              selectedDate={selectedDate}
              today={today}
              moonPhase={moonPhase}
              selection={selection}
              onDateClick={handleDateClick}
              onSelect={handleSelect}
              onEventClick={handleEventClick}
              onEventDoubleClick={handleEventDoubleClick}
              onEventTimingChange={handleEventTimingChange}
              onCalendarApiReady={setCalendarApi}
              onDatesChange={handleDatesChange}
              editMode={editMode}
              calendarMode={addMode}
            />
          )}

          <div
            className={`resize-handle ${editMode ? "visible" : ""} ${
              isResizing ? "active" : ""
            }`}
            role="separator"
            aria-orientation="vertical"
            aria-label="할 일 패널 너비 조절"
            aria-valuenow={settings.todoPanelWidth}
            aria-valuemin={200}
            aria-valuemax={480}
            tabIndex={editMode ? 0 : -1}
            onMouseDown={startResize}
            onKeyDown={editMode ? handleResizeKeyDown : undefined}
            title={editMode ? "드래그하거나 ←/→ 키로 할 일 패널 크기 조절" : undefined}
          />

          <TodoPanel
            selectedDate={selectedDate}
            todos={visibleTodos}
            settings={settings}
            addMode={addMode}
            holidayName={holidays[selectedDate]}
            lunarDate={lunarDate}
            selection={selection}
            quickAddRef={quickAddRef}
            onQuickAdd={handleQuickAdd}
            onOpenAddModal={handleOpenAddTodoModal}
            memoOpen={memoOpen}
            onToggleMemo={toggleMemoWindow}
            onToggleDone={ref => toggleDone(ref.todoId, ref.occurrenceDate)}
            onRequestEdit={requestEdit}
            onRequestDelete={requestDelete}
            onMoveTodo={moveTodo}
          />
        </div>
      </main>

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
        onExportData={() => void handleExportData()}
        onImportData={() => void handleImportData()}
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
        todo={editing?.todo ?? null}
        onClose={closeEditTodoModal}
        onSave={handleSaveEditTodo}
        onDelete={handleDeleteFromEditor}
        scopeLabel={editing?.occurrenceDate ? `${formatShortDate(editing.occurrenceDate)}만` : undefined}
      />

      <RecurrenceScopeModal
        open={scopePrompt !== null}
        actionLabel={scopePrompt?.actionLabel ?? ""}
        occurrenceDate={scopePrompt?.occurrenceDate}
        onChoose={handleScopeChoice}
        onCancel={handleScopeCancel}
      />

      <ShortcutHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
};

export default CalendarPage;
