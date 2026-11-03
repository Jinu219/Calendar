// ═══════════════════════════════════════════════════════════
// Type Definitions
// ═══════════════════════════════════════════════════════════

/** "weekdays" = every Monday–Friday. Combine with `repeatInterval` for "every 2 weeks" etc. */
export type RepeatType = "none" | "daily" | "weekdays" | "weekly" | "monthly" | "yearly";
/** Monthly repetition on the same date (the 3rd) or the same weekday (the first Tuesday). */
export type MonthlyMode = "date" | "weekday";
export type ColorTheme = "pink" | "lavender" | "sky" | "mint" | "warm" | "mono" | "night" | "contrast";
export type DayNumPos = "left" | "right";
export type TodayStyle = "highlight" | "glow" | "elevated" | "border";
export type WindowLevel = "bottom" | "top";
export type CalendarViewType = "dayGridMonth" | "timeGridWeek" | "timeline";
/** Which kind of item a todo is, or that the calendar's click/drag creates. */
export type ItemKind = "schedule" | "todo";
/** The title bar's kind filter: a single kind, or "all" to show both. */
export type AddMode = ItemKind | "all";
/** Whether a change to a recurring item applies to one occurrence or the whole series. */
export type RecurrenceScope = "this" | "all";

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface AddTodoOptions {
  color?: string;
  allDay?: boolean;
  todoTime?: string;
  startTime?: string;
  endTime?: string;
  startDate?: string;
  endDate?: string;
  repeat?: RepeatType;
  repeatEndDate?: string;
  repeatInterval?: number;
  repeatDays?: number[];
  monthlyMode?: MonthlyMode;
  reminderMinutes?: number | null;
  subtasks?: Subtask[];
  kind?: ItemKind;
}

export interface Todo {
  id: string;
  date: string;
  startDate?: string;
  endDate?: string;
  title: string;
  /** Completion of a one-off todo. Recurring todos track completion per occurrence in `doneDates`. */
  done: boolean;
  color: string;
  allDay: boolean;
  startTime?: string;
  endTime?: string;
  todoTime?: string;
  repeat: RepeatType;
  repeatEndDate?: string;
  /** Every N days/weeks/months/years (default 1). */
  repeatInterval?: number;
  /** Weekly repetition on these weekdays (0 = Sunday). Default: the start weekday. */
  repeatDays?: number[];
  monthlyMode?: MonthlyMode;
  sortOrder: number;
  /** Occurrence start dates (YYYY-MM-DD) skipped for a recurring todo. */
  exceptions?: string[];
  /** Occurrence start dates (YYYY-MM-DD) marked done for a recurring todo. */
  doneDates?: string[];
  /** Whether this was added as a timed "schedule" item or a plain "todo". Missing on
   *  data saved before this existed; treat as "schedule" in that case. */
  kind?: ItemKind;
  /** Minutes before the start to notify. undefined = the global setting, null = never. */
  reminderMinutes?: number | null;
  /** Checklist inside a one-off item. */
  subtasks?: Subtask[];
  /** Set for items from a subscribed calendar feed; those are read-only. */
  sourceId?: string;
}

/** One concrete occurrence of a todo: the todo itself plus the start date of that occurrence. */
export interface OccurrenceRef {
  todoId: string;
  occurrenceDate: string;
}

/** A todo as it appears on a particular day of the agenda. */
export interface AgendaItem {
  todo: Todo;
  /** Start date of the occurrence covering the agenda day. */
  occurrenceDate: string;
  occurrenceEndDate: string;
  done: boolean;
  /** 1-based day of a multi-day occurrence, and its length in days. */
  dayIndex: number;
  totalDays: number;
}

/** Where and when one occurrence sits on the calendar. End date is inclusive. */
export interface EventTiming {
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime?: string;
  endTime?: string;
}

/** A subscribed read-only calendar (ICS / webcal URL). */
export interface CalendarFeed {
  id: string;
  name: string;
  url: string;
  color: string;
  enabled: boolean;
}

export interface Settings {
  colorTheme: ColorTheme;
  dayNumberPos: DayNumPos;
  fontFamily: string;
  fontSize: number;
  showOverflow: boolean;
  todayStyle: TodayStyle;
  opacity: number;
  todoPanelWidth: number;
  autostart: boolean;
  useLunar: boolean;
  use24Hour: boolean;
  showMoonPhase: boolean;

  editMode: boolean;
  showOnTaskbar: boolean;
  windowLevel: WindowLevel;

  remindersEnabled: boolean;
  reminderMinutesBefore: number;
  /** "HH:MM" to announce today's all-day items, "" to never. */
  allDayReminderTime: string;
  /** Announce todos due tomorrow (at allDayReminderTime). */
  todoDueReminder: boolean;

  autoBackup: boolean;
  autoUpdateCheck: boolean;

  /** Category names for the item colors (color → name). */
  colorLabels: Record<string, string>;
  /** Colors (categories) hidden from every view. */
  hiddenColors: string[];
  calendarFeeds: CalendarFeed[];
}

export interface ModalState {
  open: boolean;
  date: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  mode: ItemKind;
}

/** Reminder choice in the form: the global default, never, or N minutes before. */
export type ReminderChoice = "default" | "none" | number;

export interface EventFormData {
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
  repeatInterval: number;
  repeatDays: number[];
  monthlyMode: MonthlyMode;
  reminder: ReminderChoice;
  subtasks: Subtask[];
  kind: ItemKind;
}

export interface HolidayApiItem {
  date: string;
  localName: string;
  globalName: string;
}

export interface Theme {
  accent: string;
  mid: string;
  border: string;
  text: string;
  /** Secondary text (hints, labels). */
  textSecondary: string;
  /** "r,g,b" used for the translucent glass panel background. */
  bg: string;
  /** Dark themes flip the light-on-glass surfaces. */
  mode: "light" | "dark";
  /** High contrast: opaque panels, solid borders, thicker focus rings. */
  highContrast?: boolean;
}

export interface ThemeOption {
  key: ColorTheme;
  label: string;
  emoji: string;
}

export interface TodayStyleOption {
  key: TodayStyle;
  label: string;
}

export interface MoonPhase {
  name: string;
  emoji: string;
}

export interface Memo {
  id: string;
  content: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  /** Pins the memo to a day: it shows in that day's cell and todo panel. */
  linkedDate?: string;
}

export interface ToastMessage {
  /** Increments per toast so an identical message still restarts the timer. */
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}
