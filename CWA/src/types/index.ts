// ═══════════════════════════════════════════════════════════
// Type Definitions
// ═══════════════════════════════════════════════════════════

export type RepeatType = "none" | "daily" | "weekly" | "monthly";
export type ColorTheme = "pink" | "lavender" | "sky" | "mint" | "warm";
export type DayNumPos = "left" | "right";
export type TodayStyle = "highlight" | "glow" | "elevated" | "border";
export type WindowLevel = "bottom" | "top";
export type CalendarViewType = "dayGridMonth" | "timeGridWeek";

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
}

export interface Todo {
  id: string;
  date: string;
  startDate?: string;
  endDate?: string;
  title: string;
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
