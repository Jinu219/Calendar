// ═══════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════

import type {
  ClaudeModelId,
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
  pink:     { mode:"light", accent:"#ec4899", mid:"#f9a8d4", border:"rgba(255,200,220,.38)", text:"#2d1520", textSecondary:"rgba(45,21,32,.7)",  bg:"255,245,248" },
  lavender: { mode:"light", accent:"#8b5cf6", mid:"#c4b5fd", border:"rgba(196,181,253,.38)", text:"#1e1030", textSecondary:"rgba(30,16,48,.7)",  bg:"255,245,248" },
  sky:      { mode:"light", accent:"#0ea5e9", mid:"#7dd3fc", border:"rgba(125,211,252,.38)", text:"#0c2d3e", textSecondary:"rgba(12,45,62,.7)",  bg:"255,245,248" },
  mint:     { mode:"light", accent:"#10b981", mid:"#6ee7b7", border:"rgba(110,231,183,.38)", text:"#0d2a1e", textSecondary:"rgba(13,42,30,.7)",  bg:"255,245,248" },
  warm:     { mode:"light", accent:"#f59e0b", mid:"#fcd34d", border:"rgba(252,211,77,.38)",  text:"#2a1a05", textSecondary:"rgba(42,26,5,.7)",   bg:"255,245,248" },
  mono:     { mode:"light", accent:"#4b5563", mid:"#9ca3af", border:"rgba(148,163,184,.38)", text:"#18181b", textSecondary:"rgba(24,24,27,.7)",  bg:"228,228,231" },
  // For dark wallpapers: light text on a dark glass.
  night:    { mode:"dark",  accent:"#a78bfa", mid:"#6d5bd0", border:"rgba(167,139,250,.32)", text:"#ece9fb", textSecondary:"rgba(236,233,251,.72)", bg:"22,20,36" },
  // Low vision: near-opaque panel, black text, strong blue accent.
  contrast: { mode:"light", highContrast:true, accent:"#1d4ed8", mid:"#60a5fa", border:"rgba(15,23,42,.85)", text:"#000000", textSecondary:"#1f2937", bg:"255,255,255" },
};

export const THEME_OPTIONS: ThemeOption[] = [
  { key: "pink", label: "벚꽃", emoji: "🌸" },
  { key: "lavender", label: "라벤더", emoji: "💜" },
  { key: "sky", label: "하늘", emoji: "🩵" },
  { key: "mint", label: "민트", emoji: "🌿" },
  { key: "warm", label: "황금", emoji: "✨" },
  { key: "mono", label: "흑백", emoji: "⚫" },
  { key: "night", label: "밤", emoji: "🌙" },
  { key: "contrast", label: "고대비", emoji: "◐" },
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

/** Screen-reader names for the color swatches. */
export const COLOR_NAMES: Record<string, string> = {
  "#f9a8d4": "분홍", "#a5f3fc": "하늘", "#bbf7d0": "연두", "#fde68a": "노랑",
  "#c4b5fd": "보라", "#fb923c": "주황", "#6ee7b7": "민트", "#fca5a5": "빨강",
  "#fff4a3": "노랑", "#ffd6e0": "분홍", "#d7f9d0": "연두", "#cdeffd": "하늘",
  "#e4d7ff": "보라", "#ffe1b3": "살구", "#d9f5ec": "민트", "#f3d1ff": "라일락",
};

export const TODOS_KEY = "cwa-todos-v4";
export const SETTINGS_KEY = "cwa-settings-v4";
export const WIN_POS_KEY = "cwa-win-pos";
/** One-shot message shown after a reload (e.g. "backup imported"). */
export const FLASH_MESSAGE_KEY = "cwa:flash-message";

/** Week view hours shown by default; widened automatically to fit earlier/later events. */
export const WEEK_VIEW_DEFAULT_START_HOUR = 9;
export const WEEK_VIEW_DEFAULT_END_HOUR = 23;

export const KEYBOARD_SHORTCUTS: { keys: string; description: string }[] = [
  { keys: "← / →", description: "이전 / 다음 달·주" },
  { keys: "T", description: "오늘로 이동" },
  { keys: "1 / 2 / 3", description: "월간 / 주간 / 타임라인 보기" },
  { keys: "N", description: "선택한 날짜에 새 항목 추가" },
  { keys: "/", description: "빠른 추가 입력창으로 이동" },
  { keys: "Ctrl+F", description: "일정 검색" },
  { keys: "S", description: "통계 보기" },
  { keys: "Enter · Space", description: "선택한 항목 완료 표시" },
  { keys: "E · F2", description: "선택한 항목 수정" },
  { keys: "Delete", description: "선택한 항목 삭제 (반복 일정은 그 날짜만)" },
  { keys: "Ctrl+C / Ctrl+V", description: "선택한 항목 복사 / 선택한 날짜에 붙여넣기" },
  { keys: "Ctrl+Z / Ctrl+Y", description: "실행 취소 / 다시 실행" },
  { keys: "Esc", description: "선택 해제 · 열린 창 닫기" },
  { keys: "?", description: "이 도움말 열기" },
  { keys: "Win+Alt+C", description: "어디서든 위젯 보이기/숨기기 (사용 중이면 Ctrl+Alt+C)" },
];

export const MOUSE_TIPS: string[] = [
  "달력의 일정을 클릭하면 선택, 더블클릭하면 수정합니다.",
  "Shift 또는 Ctrl을 누른 채 클릭하면 여러 개를 선택합니다.",
  "일정을 끌어서 옮기거나 가장자리를 끌어 기간을 바꿉니다.",
  "제목(예: 2026년 11월)을 누르면 원하는 달로 바로 이동합니다.",
];

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
  allDayReminderTime: "09:00",
  todoDueReminder: true,

  autoBackup: true,
  autoUpdateCheck: true,

  colorLabels: {},
  hiddenColors: [],
  calendarFeeds: [],

  claudeEnabled: false,
  claudeModel: "claude-opus-5-5",
};

/** Per-million-token prices (USD) used for the usage estimate shown in settings. */
export const CLAUDE_MODELS: {
  id: ClaudeModelId;
  label: string;
  inputPerMTok: number;
  outputPerMTok: number;
  /** Server-side fallback on a safety decline (not offered for Haiku). */
  fallback: boolean;
}[] = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 · 가장 정확 (기본)", inputPerMTok: 4, outputPerMTok: 20, fallback: true },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 · 빠르고 저렴", inputPerMTok: 2, outputPerMTok: 10, fallback: true },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 · 가장 저렴", inputPerMTok: 0.1, outputPerMTok: 0.5, fallback: false },
];
export const CLAUDE_USAGE_KEY = "cwa:claude-usage";
export const CLAUDE_BRIEFING_KEY = "cwa:claude-briefing";

export const REMINDER_LEAD_OPTIONS = [0, 5, 10, 30, 60] as const;
/** Per-item reminder choices (minutes before); 1440 = the day before. */
export const ITEM_REMINDER_OPTIONS = [0, 5, 10, 30, 60, 1440] as const;
export const ALL_DAY_REMINDER_TIMES = ["", "07:00", "08:00", "09:00", "10:00"] as const;

/** How often subscribed calendars are refreshed. */
export const FEED_REFRESH_MS = 6 * 60 * 60 * 1000;
export const FEED_CACHE_KEY = "cwa:feed-cache";
/** Memo id a memo window should bring to front (set by the main window). */
export const MEMO_FOCUS_KEY = "cwa:memo-focus";
export const LAST_UPDATE_CHECK_KEY = "cwa:last-update-check";

export const FONT_SIZE_MIN = 11;
export const FONT_SIZE_MAX = 20;

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
