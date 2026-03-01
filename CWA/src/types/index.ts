// ═══════════════════════════════════════════════════════════
// Type Definitions
// ═══════════════════════════════════════════════════════════

export type RepeatType = "none" | "daily" | "weekly" | "monthly";
export type ColorTheme = "pink" | "lavender" | "sky" | "mint" | "warm";
export type DayNumPos = "left" | "right";
export type TodayStyle = "highlight" | "glow" | "elevated" | "border";

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

export interface HolidayAPIItem {
  dateName: string;
  localeDate: string;
  isHoliday: boolean;
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
