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
  useLunarDate,
  useWindowBehavior,
  useWindowPosition,
  useCalendarModal,
  useTodoPanelResize,
  useCalendarKeyboardShortcuts,
  usePreventBrowserBehaviors,
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
  useAssistantInbox,
  useNotion,
  useGemini,
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
  Toast,
  type VisibleDatesInfo,
} from "../components";

import { COLOR_NAMES, FLASH_MESSAGE_KEY, MEMO_FOCUS_KEY, TODO_COLORS } from "../constants";
import {
  expandTodos,
  formatClock,
  formatTimelineTitle,
  getTimelineRange,
  shiftTimelineAnchor,
  formatShortDate,
  getHolidayEvents,
  getOccurrenceStartOn,
  getOccurrenceTiming,
  getOverdueTodos,
  getTodoSpanDays,
  getWeekNumber,
  parseLocalDate,
  parseInboxEvent,
  parseScheduleText,
  shiftDate,
  timingToFields,
} from "../utils";
import type {
  AddMode,
  CalendarViewType,
  EventTiming,
  OccurrenceRef,
  Todo,
} from "../types";

const NAV_UNITS = { day: "날", week: "주", month: "달" } as const;
/** Automatic Notion export waits for edits to settle. */
const NOTION_AUTO_SYNC_DELAY_MS = 20_000;

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
    deleteFollowing,
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
  const notion = useNotion(settings);
  const gemini = useGemini(settings);
  const notionExportRef = useRef(notion.exportTodos);
  notionExportRef.current = notion.exportTodos;

  const timelineSpan = settings.timelineSpan;
  const timelineRange = useMemo(() => getTimelineRange(timelineAnchor, timelineSpan), [timelineAnchor, timelineSpan]);

  // Holidays for every year on screen (calendar and timeline).
  const holidayYears = useMemo(() => [
    parseLocalDate(today).getFullYear(),
    visibleDates.start.getFullYear(),
    visibleDates.end.getFullYear(),
    parseLocalDate(timelineRange.start).getFullYear(),
    parseLocalDate(timelineRange.end).getFullYear(),
  ], [today, visibleDates, timelineRange]);

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
        viewTitle: formatTimelineTitle(timelineAnchor, timelineSpan),
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
  }, [view, timelineAnchor, timelineSpan, visibleDates]);

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

  const lunarDate = useLunarDate(selectedDate, settings.useLunar);

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

  usePreventBrowserBehaviors();

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
      setTimelineAnchor(d => shiftTimelineAnchor(d, timelineSpan, -1));
    } else {
      calendarApi?.prev();
    }
  }, [view, calendarApi, timelineSpan]);

  const handleNext = useCallback(() => {
    if (view === "timeline") {
      setTimelineAnchor(d => shiftTimelineAnchor(d, timelineSpan, 1));
    } else {
      calendarApi?.next();
    }
  }, [view, calendarApi, timelineSpan]);

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
      } else if (choice === "following") {
        deleteFollowing(todo.id, occurrenceDate);
        notifyUndoable(`"${todo.title}" ${formatShortDate(occurrenceDate)}부터 이후 일정을 삭제했어요`);
      } else {
        deleteTodo(todo.id);
        notifyUndoable(`"${todo.title}"을(를) 삭제했어요`);
      }
    }, undefined, true);
  }, [withScope, removeOccurrences, deleteFollowing, deleteTodo, notifyUndoable]);

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

  /** Enter in quick add: the rule parser reads dates, times and repeats offline. */
  const handleQuickAdd = useCallback((text: string) => {
    const defaultKind = addMode === "todo" ? "todo" : "schedule";
    const parsed = parseScheduleText(text, { today, selectedDate, defaultKind });
    const result = parseInboxEvent(parsed.event, settings.colorLabels);

    if (!result.ok) {
      showToast(result.error);
      return;
    }

    addTodos([result.input]);
    notifyUndoable(`"${result.input.title}" 추가 · ${parsed.understood.join(" · ") || formatShortDate(result.input.date)}`);
  }, [addMode, today, selectedDate, settings.colorLabels, addTodos, showToast, notifyUndoable]);

  /** ✨ / Shift+Enter: Gemini reads the sentence (several items at once is fine). */
  const handleAiQuickAdd = useCallback(async (text: string): Promise<boolean> => {
    try {
      const events = await gemini.parse(text, {
        today,
        now: formatClock(new Date()),
        selectedDate,
        defaultKind: addMode === "todo" ? "todo" : "schedule",
        categories: TODO_COLORS.map(color => settings.colorLabels[color] || COLOR_NAMES[color]),
      });
      const results = events.map(event => parseInboxEvent(event, settings.colorLabels));
      const inputs = results.flatMap(result => (result.ok ? [result.input] : []));

      if (inputs.length === 0) {
        const firstError = results.find(result => !result.ok);
        showToast(firstError && !firstError.ok ? firstError.error : "Gemini가 문장에서 일정을 찾지 못했어요.");
        return false;
      }

      addTodos(inputs);
      const first = inputs[0];
      const time = first.options.startTime ?? first.options.todoTime;
      notifyUndoable(
        `✨ "${first.title}"${inputs.length > 1 ? ` 외 ${inputs.length - 1}개` : ""} 추가 · ${formatShortDate(first.date)}${time ? ` ${time}` : ""}`
      );
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
      return false;
    }
  }, [gemini, today, selectedDate, addMode, settings.colorLabels, addTodos, showToast, notifyUndoable]);

  // ── Claude conversation inbox ──

  const { lastInbox } = useAssistantInbox(settings.assistantInbox, settings.colorLabels, useCallback(inputs => {
    addTodos(inputs);
    const first = inputs[0];
    notifyUndoable(
      `Claude가 "${first.title}"${inputs.length > 1 ? ` 외 ${inputs.length - 1}개를` : "을(를)"} 추가했어요 · ${formatShortDate(first.date)}`
    );
  }, [addTodos, notifyUndoable]));

  // ── Notion ──

  const describeExport = (result: { created: number; updated: number; skipped: number; failed: number; firstError?: string }) =>
    `Notion 내보내기: 새로 ${result.created} · 갱신 ${result.updated} · 그대로 ${result.skipped}` +
    (result.failed ? ` · 실패 ${result.failed} (${result.firstError ?? "알 수 없는 오류"})` : "");

  const handleNotionExport = useCallback(async (): Promise<string> => {
    const result = await notionExportRef.current(todos);
    return result ? describeExport(result) : "이미 내보내는 중이에요.";
  }, [todos]);

  // Automatic export: a while after the last edit, send whatever changed.
  useEffect(() => {
    if (!settings.notionAutoSync || !notion.ready) return;

    const timer = window.setTimeout(async () => {
      try {
        const result = await notionExportRef.current(todos);
        if (result?.failed) showToast(describeExport(result));
      } catch (error) {
        showToast(`Notion 자동 내보내기 실패: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, NOTION_AUTO_SYNC_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [todos, settings.notionAutoSync, notion.ready, showToast]);

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
        navUnit={view === "dayGridMonth" ? "달" : view === "timeGridWeek" ? "주" : NAV_UNITS[timelineSpan]}
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
        onOpenSearch={openSearch}
        colorLabels={settings.colorLabels}
        hiddenColors={settings.hiddenColors}
        onHiddenColorsChange={handleHiddenColorsChange}
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
              span={timelineSpan}
              onSpanChange={span => {
                setSetting("timelineSpan", span);
                setTimelineAnchor(selectedDate);
              }}
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
            aiReady={gemini.ready}
            onAiQuickAdd={handleAiQuickAdd}
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
        onShowHelp={openHelp}
        notion={notion}
        onNotionExport={handleNotionExport}
        lastInbox={lastInbox}
        gemini={gemini}
      />

      <AddEventModal
        isOpen={modal.open}
        initialData={modal}
        defaultReminderMinutes={settings.reminderMinutesBefore}
        colorLabels={settings.colorLabels}
        onClose={closeModal}
        onSubmit={handleAddEventSubmit}
      />

      <EditTodoModal
        todo={editing?.todo ?? null}
        defaultReminderMinutes={settings.reminderMinutesBefore}
        colorLabels={settings.colorLabels}
        onClose={closeEditTodoModal}
        onSave={handleSaveEditTodo}
        onDelete={handleDeleteFromEditor}
        scopeLabel={editing?.occurrenceDate ? `${formatShortDate(editing.occurrenceDate)}만` : undefined}
      />

      <RecurrenceScopeModal
        open={scope.prompt !== null}
        actionLabel={scope.prompt?.actionLabel ?? ""}
        occurrenceDate={scope.prompt?.occurrenceDate}
        allowFollowing={scope.prompt?.allowFollowing ?? false}
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

      <ShortcutHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
};

export default CalendarPage;
