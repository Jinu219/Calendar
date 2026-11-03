// ═══════════════════════════════════════════════════════════
// CalendarPage Component
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CalendarApi } from "@fullcalendar/core";
import { invoke } from "@tauri-apps/api/core";

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
  useMemos,
  useBackup,
  useAutoBackup,
  useReminders,
  useAutoUpdate,
  useToday,
  useToast,
  useCalendarFeeds,
  useTrayStatus,
  useSelection,
  useRecurrenceScopePrompt,
  useClaude,
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
  SearchModal,
  StatsModal,
  BriefingModal,
  Toast,
  type VisibleDatesInfo,
} from "../components";

import { FLASH_MESSAGE_KEY, MEMO_FOCUS_KEY } from "../constants";
import {
  expandTodos,
  describeRepeat,
  formatClock,
  formatShortDate,
  getAgendaForDate,
  getHabitStreaks,
  getTodoStartTime,
  getHolidayEvents,
  getOccurrenceStartOn,
  getOccurrenceTiming,
  getOverdueTodos,
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
  Todo,
} from "../types";

const TIMELINE_HALF_SPAN_DAYS = 21;

interface EditingState {
  todo: Todo;
  /** Set when only this occurrence of a recurring todo is being edited. */
  occurrenceDate: string | null;
}

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [calendarApi, setCalendarApi] = useState<CalendarApi | null>(null);
  const [visibleDates, setVisibleDates] = useState<VisibleDatesInfo>(initialVisibleDates);
  const [globalShortcut, setGlobalShortcut] = useState<string | null>(null);
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
    toggleSubtask,
    carryOverTodos,
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
  const { memos } = useMemos();
  const { feedTodos, statusFor: feedStatusFor, refresh: refreshFeeds } = useCalendarFeeds(settings.calendarFeeds);
  const { selection, select, setSelection, clearSelection } = useSelection(todos);
  const scope = useRecurrenceScopePrompt();
  const claude = useClaude(settings);

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

  // Own items plus subscribed calendars, filtered by the schedule/todo/all toggle
  // and the category filter. Mutation hooks always work on the full own list.
  const visibleTodos = useMemo(() => {
    const hidden = new Set(settings.hiddenColors);

    return [...todos, ...feedTodos].filter(t =>
      !hidden.has(t.color) && (addMode === "all" || (t.kind ?? "schedule") === addMode)
    );
  }, [todos, feedTodos, addMode, settings.hiddenColors]);

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

  const memoDates = useMemo(
    () => new Set(memos.flatMap(memo => (memo.linkedDate ? [memo.linkedDate] : []))),
    [memos]
  );
  const linkedMemos = useMemo(
    () => memos.filter(memo => memo.linkedDate === selectedDate),
    [memos, selectedDate]
  );
  const overdue = useMemo(
    () => (addMode === "schedule" ? [] : getOverdueTodos(todos, today)),
    [todos, today, addMode]
  );

  const findTodo = useCallback(
    (id: string) => todos.find(t => t.id === id) ?? feedTodos.find(t => t.id === id),
    [todos, feedTodos]
  );

  // One-shot message left by a reload (e.g. after importing a backup).
  useEffect(() => {
    const message = sessionStorage.getItem(FLASH_MESSAGE_KEY);
    if (!message) return;

    sessionStorage.removeItem(FLASH_MESSAGE_KEY);
    showToast(message);
  }, [showToast]);

  useEffect(() => {
    invoke<string | null>("get_global_shortcut")
      .then(shortcut => setGlobalShortcut(shortcut ?? null))
      .catch(() => setGlobalShortcut(null));
  }, []);

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
  useReminders(todos, settings);
  useTrayStatus(todos, today);

  const { memoOpen, toggleMemoWindow, openMemoWindow } = useMemoWindow();
  const { exportData, importData, isExporting, isImporting } = useBackup();
  const { lastBackup, backupNow, openBackupFolder } = useAutoBackup(settings.autoBackup, today);

  const installUpdateRef = useRef<() => void>(() => undefined);
  const { status: updateStatus, checkForUpdate, installUpdate } = useAutoUpdate({
    autoCheck: settings.autoUpdateCheck,
    onAvailable: version => showToast(`새 버전 ${version}이(가) 나왔어요`, {
      label: "설치",
      onAction: () => installUpdateRef.current(),
    }),
  });
  installUpdateRef.current = () => void installUpdate();

  const {
    modal,
    closeModal,
    openAddTodoModal,
    openWithDraft,
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

  const goToDate = useCallback((date: string) => {
    setSelectedDate(date);
    setTimelineAnchor(date);
    calendarApi?.gotoDate(date);
  }, [calendarApi]);

  const handleToday = useCallback(() => goToDate(today), [goToDate, today]);

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
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const openStats = useCallback(() => setStatsOpen(true), []);

  const toggleEditMode = useCallback(() => {
    setSetting("editMode", !editMode);
  }, [editMode, setSetting]);

  const handleHiddenColorsChange = useCallback(
    (hiddenColors: string[]) => setSetting("hiddenColors", hiddenColors),
    [setSetting]
  );

  // ───────────────────────────────────────────────────────
  // Handlers: selection
  // ───────────────────────────────────────────────────────

  const handleEventClick = useCallback((ref: OccurrenceRef, additive: boolean) => {
    releaseTextFocus();
    setSelectedDate(ref.occurrenceDate);

    // Subscribed items can't be completed, edited or deleted, so they aren't selectable.
    if (findTodo(ref.todoId)?.sourceId) return;
    select(ref, additive);
  }, [findTodo, select]);

  const handleDateClick = useCallback((dateStr: string) => {
    setSelectedDate(dateStr);
    clearSelection();

    // In todo mode a click on a day leads straight into typing a task for it.
    if (addMode === "todo") quickAddRef.current?.focus();
    else releaseTextFocus();
  }, [addMode, clearSelection]);

  const handleEscape = useCallback(() => {
    if (settingsOpen) {
      setSettingsOpen(false);
    } else {
      clearSelection();
    }
  }, [settingsOpen, clearSelection]);

  // ───────────────────────────────────────────────────────
  // Handlers: recurrence-aware edit / delete / move
  // ───────────────────────────────────────────────────────

  const { withScope } = scope;

  const openEditor = useCallback((todo: Todo, occurrenceDate: string | null) => {
    setEditing({
      // Editing one occurrence shows that occurrence's own dates.
      todo: occurrenceDate ? { ...todo, ...timingToFields(getOccurrenceTiming(todo, occurrenceDate)) } : todo,
      occurrenceDate,
    });
  }, []);

  const requestEdit = useCallback((todo: Todo, occurrenceDate: string) => {
    if (todo.sourceId) {
      showToast("구독 캘린더 일정은 원래 캘린더에서 수정해 주세요");
      return;
    }

    withScope(todo, occurrenceDate, "수정", choice =>
      openEditor(todo, choice === "this" ? occurrenceDate : null)
    );
  }, [withScope, openEditor, showToast]);

  const handleEventDoubleClick = useCallback((ref: OccurrenceRef) => {
    const todo = findTodo(ref.todoId);
    if (todo) requestEdit(todo, ref.occurrenceDate);
  }, [findTodo, requestEdit]);

  const requestDelete = useCallback((todo: Todo, occurrenceDate: string) => {
    withScope(todo, occurrenceDate, "삭제", choice => {
      if (choice === "this") {
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
    const todo = todos.find(t => t.id === ref.todoId);

    if (!todo) {
      revert();
      return;
    }

    withScope(
      todo,
      ref.occurrenceDate,
      "이동",
      choice => {
        applyTiming(todo.id, ref.occurrenceDate, timing, choice);
        clearSelection();
        setSelectedDate(timing.startDate);
      },
      revert
    );
  }, [todos, withScope, applyTiming, clearSelection]);

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
  // Handlers: adding, carrying over, memos, search
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

  // ── Claude ──

  /** A sentence → Claude's draft → the add form, for the user to confirm. */
  const handleAiQuickAdd = useCallback(async (text: string): Promise<boolean> => {
    try {
      const draft = await claude.parseEvent(text, {
        today,
        now: formatClock(new Date()),
        selectedDate,
        defaultKind: addMode === "todo" ? "todo" : "schedule",
      });
      openWithDraft(draft);
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
      return false;
    }
  }, [claude, today, selectedDate, addMode, openWithDraft, showToast]);

  const fetchBriefing = useCallback(() => {
    const toItem = (todo: Todo, date: string, done: boolean) => ({
      date,
      time: getTodoStartTime(todo),
      title: todo.title,
      kind: todo.kind ?? "schedule",
      done,
      repeat: todo.repeat !== "none" ? describeRepeat(todo) : undefined,
    });
    const own = todos.filter(t => !settings.hiddenColors.includes(t.color));
    const agendaOf = (date: string) =>
      getAgendaForDate(own, date)
        .filter(item => item.occurrenceDate === date)
        .map(item => toItem(item.todo, date, item.done));

    return claude.briefing({
      today,
      now: formatClock(new Date()),
      todayItems: getAgendaForDate(own, today).map(item => toItem(item.todo, today, item.done)),
      weekItems: Array.from({ length: 7 }, (_, i) => agendaOf(shiftDate(today, i + 1))).flat(),
      overdue: getOverdueTodos(own, today).map(todo => toItem(todo, todo.endDate || todo.date, false)),
      streaks: getHabitStreaks(own, today).filter(s => s.current > 0).map(s => ({ title: s.todo.title, current: s.current })),
    });
  }, [claude, todos, today, settings.hiddenColors]);

  const handleCarryOver = useCallback((ids: string[]) => {
    carryOverTodos(ids, today);
    notifyUndoable(`지난 할 일 ${ids.length}개를 오늘로 옮겼어요`);
  }, [carryOverTodos, today, notifyUndoable]);

  const handleOpenMemo = useCallback((memoId: string) => {
    // The memo window listens for this key and switches to that memo.
    localStorage.setItem(MEMO_FOCUS_KEY, `${memoId}|${Date.now()}`);
    openMemoWindow();
  }, [openMemoWindow]);

  const handleSearchPick = useCallback((todo: Todo, date: string) => {
    setSearchOpen(false);
    goToDate(date);

    const occurrenceDate = getOccurrenceStartOn(todo, date) ?? date;
    if (!todo.sourceId) setSelection([{ todoId: todo.id, occurrenceDate }]);
  }, [goToDate, setSelection]);

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
    clearSelection();
  }, [selection, removeOccurrences, notifyUndoable, clearSelection]);

  const handleCopy = useCallback(() => {
    copiedRefs.current = selection;
    showToast(`${selection.length}개 항목을 복사했어요 · 날짜를 고르고 Ctrl+V`);
  }, [selection, showToast]);

  // A pasted item is a one-off copy of that occurrence on the selected day.
  const handlePaste = useCallback(() => {
    const inputs = copiedRefs.current.flatMap(ref => {
      const original = todos.find(t => t.id === ref.todoId);
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
          reminderMinutes: original.reminderMinutes,
          subtasks: original.subtasks?.map(s => ({ ...s, done: false })),
          startDate: selectedDate,
          endDate: shiftDate(selectedDate, getTodoSpanDays(original)),
        },
      }];
    });

    if (inputs.length === 0) return;

    addTodos(inputs);
    notifyUndoable(`${inputs.length}개 항목을 ${formatShortDate(selectedDate)}에 붙여넣었어요`);
  }, [todos, selectedDate, addTodos, notifyUndoable]);

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
    onOpenSearch: openSearch,
    onOpenStats: openStats,
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

  const handleBackupNow = useCallback(async () => {
    showToast((await backupNow()).message);
  }, [backupNow, showToast]);

  const handleOpenBackupFolder = useCallback(async () => {
    const result = await openBackupFolder();
    if (result) showToast(result.message);
  }, [openBackupFolder, showToast]);

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
        onOpenSearch={openSearch}
        colorLabels={settings.colorLabels}
        hiddenColors={settings.hiddenColors}
        onHiddenColorsChange={handleHiddenColorsChange}
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
              memoDates={memoDates}
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
            today={today}
            todos={visibleTodos}
            settings={settings}
            addMode={addMode}
            holidayName={holidays[selectedDate]}
            lunarDate={lunarDate}
            selection={selection}
            overdue={overdue}
            linkedMemos={linkedMemos}
            quickAddRef={quickAddRef}
            onQuickAdd={handleQuickAdd}
            aiReady={claude.ready}
            onAiQuickAdd={handleAiQuickAdd}
            onOpenBriefing={() => setBriefingOpen(true)}
            onOpenAddModal={handleOpenAddTodoModal}
            memoOpen={memoOpen}
            onToggleMemo={toggleMemoWindow}
            onOpenMemo={handleOpenMemo}
            onOpenStats={openStats}
            onToggleDone={ref => toggleDone(ref.todoId, ref.occurrenceDate)}
            onToggleSubtask={toggleSubtask}
            onCarryOver={handleCarryOver}
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
        onInstallUpdate={() => void installUpdate()}
        lastAutoBackup={lastBackup}
        onBackupNow={() => void handleBackupNow()}
        onOpenBackupFolder={() => void handleOpenBackupFolder()}
        feedStatusFor={feedStatusFor}
        onRefreshFeeds={refreshFeeds}
        globalShortcut={globalShortcut}
        claude={claude}
      />

      <AddEventModal
        isOpen={modal.open}
        initialData={modal}
        defaultReminderMinutes={settings.reminderMinutesBefore}
        colorLabels={settings.colorLabels}
        onSuggestSubtasks={claude.ready ? claude.suggestSubtasks : undefined}
        onClose={closeModal}
        onSubmit={handleAddEventSubmit}
      />

      <EditTodoModal
        todo={editing?.todo ?? null}
        defaultReminderMinutes={settings.reminderMinutesBefore}
        colorLabels={settings.colorLabels}
        onSuggestSubtasks={claude.ready ? claude.suggestSubtasks : undefined}
        onClose={closeEditTodoModal}
        onSave={handleSaveEditTodo}
        onDelete={handleDeleteFromEditor}
        scopeLabel={editing?.occurrenceDate ? `${formatShortDate(editing.occurrenceDate)}만` : undefined}
      />

      <RecurrenceScopeModal
        open={scope.prompt !== null}
        actionLabel={scope.prompt?.actionLabel ?? ""}
        occurrenceDate={scope.prompt?.occurrenceDate}
        onChoose={scope.choose}
        onCancel={scope.cancel}
      />

      <SearchModal
        open={searchOpen}
        todos={[...todos, ...feedTodos]}
        today={today}
        use24Hour={settings.use24Hour}
        colorLabels={settings.colorLabels}
        onPick={handleSearchPick}
        onClose={() => setSearchOpen(false)}
      />

      <StatsModal open={statsOpen} todos={todos} today={today} onClose={() => setStatsOpen(false)} />

      <BriefingModal
        open={briefingOpen}
        today={today}
        fetchBriefing={fetchBriefing}
        onClose={() => setBriefingOpen(false)}
      />

      <ShortcutHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
};

export default CalendarPage;
