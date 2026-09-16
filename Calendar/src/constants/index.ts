// ═══════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════

import type {
  ColorTheme,
  ModalState,
  Settings,
  Theme,
  ThemeOption,
  TodayStyleOption,
} from "../types";

export const TODO_COLORS = [
  "#f9a8d4", "#a5f3fc", "#bbf7d0", "#fde68a",
  "#c4b5fd", "#fb923c", "#6ee7b7", "#fca5a5",
] as const;

export const THEMES: Record<ColorTheme, Theme> = {
  pink:     { accent:"#ec4899", mid:"#f9a8d4", border:"rgba(255,200,220,.38)", text:"#2d1520", bg:"255,245,248" },
  lavender: { accent:"#8b5cf6", mid:"#c4b5fd", border:"rgba(196,181,253,.38)", text:"#1e1030", bg:"255,245,248" },
  sky:      { accent:"#0ea5e9", mid:"#7dd3fc", border:"rgba(125,211,252,.38)", text:"#0c2d3e", bg:"255,245,248" },
  mint:     { accent:"#10b981", mid:"#6ee7b7", border:"rgba(110,231,183,.38)", text:"#0d2a1e", bg:"255,245,248" },
  warm:     { accent:"#f59e0b", mid:"#fcd34d", border:"rgba(252,211,77,.38)",  text:"#2a1a05", bg:"255,245,248" },
  mono:     { accent:"#4b5563", mid:"#9ca3af", border:"rgba(148,163,184,.38)", text:"#18181b", bg:"228,228,231" },
};

export const THEME_OPTIONS: ThemeOption[] = [
  { key: "pink", label: "벚꽃", emoji: "🌸" },
  { key: "lavender", label: "라벤더", emoji: "💜" },
  { key: "sky", label: "하늘", emoji: "🩵" },
  { key: "mint", label: "민트", emoji: "🌿" },
  { key: "warm", label: "황금", emoji: "✨" },
  { key: "mono", label: "흑백", emoji: "⚫" },
];

export const MEMOS_KEY = "cwa:memos";

export const DEFAULT_MEMO_COLOR = "#fff4a3";

export const MEMO_COLORS = [
  "#fff4a3",
  "#ffd6e0",
  "#d7f9d0",
  "#cdeffd",
  "#e4d7ff",
  "#ffe1b3",
  "#d9f5ec",
  "#f3d1ff",
] as const;

export const TODAY_STYLES: TodayStyleOption[] = [
  { key: "highlight", label: "배경 강조" },
  { key: "glow", label: "빛 효과" },
  { key: "elevated", label: "입체 강조" },
  { key: "border", label: "테두리" },
];

export const FALLBACK_FONTS = [
  "Noto Sans KR","맑은 고딕","나눔고딕","굴림","돋움",
  "Arial","Georgia","Courier New","Times New Roman",
];

export const WEB_FONTS = [
  "Noto Sans KR","Gothic A1","Nanum Gothic","IBM Plex Sans KR","Hahmlet","Gowun Dodum"
];

export const TODOS_KEY = "cwa-todos-v4";
export const SETTINGS_KEY = "cwa-settings-v4";
export const WIN_POS_KEY = "cwa-win-pos";

export const DEFAULT_SETTINGS: Settings = {
  colorTheme: "pink",
  dayNumberPos: "left",
  fontFamily: "Noto Sans KR",
  fontSize: 14,
  showOverflow: true,
  todayStyle: "highlight",
  opacity: 0.22,
  todoPanelWidth: 270,
  autostart: false,
  useLunar: false,
  use24Hour: true,
  showMoonPhase: true,

  editMode: false,
  showOnTaskbar: false,
  windowLevel: "bottom",

  remindersEnabled: true,
  reminderMinutesBefore: 10,
};

export const REMINDER_LEAD_OPTIONS = [0, 5, 10, 30, 60] as const;

export const MODAL_CLOSED: ModalState = {
  open: false,
  date: "",
  startDate: "",
  endDate: "",
  startTime: "09:00",
  endTime: "10:00",
  allDay: false,
  mode: "schedule",
};
