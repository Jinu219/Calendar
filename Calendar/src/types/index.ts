// ═══════════════════════════════════════════════════════════
// Type Definitions
// ═══════════════════════════════════════════════════════════

export type RepeatType = "none" | "daily" | "weekly" | "monthly";
export type ColorTheme = "pink" | "lavender" | "sky" | "mint" | "warm" | "mono";
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
  sortOrder: number;
  /** Occurrence start dates (YYYY-MM-DD) skipped for a recurring todo. */
  exceptions?: string[];
  /** Occurrence start dates (YYYY-MM-DD) marked done for a recurring todo. */
  doneDates?: string[];
  /** Whether this was added as a timed "schedule" item or a plain "todo". Missing on
   *  data saved before this existed; treat as "schedule" in that case. */
  kind?: ItemKind;
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
  /** "r,g,b" used for the translucent glass panel background. */
  bg: string;
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
}

export interface ToastMessage {
  /** Increments per toast so an identical message still restarts the timer. */
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}
