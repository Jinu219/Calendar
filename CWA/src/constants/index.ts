// ═══════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════

import type { 
  ColorTheme, 
  DayNumPos, 
  TodayStyle, 
  Theme, 
  ThemeOption, 
  TodayStyleOption,
  Settings 
} from "../types";

export const TODO_COLORS = [
  "#f9a8d4","#a5f3fc","#bbf7d0","#fde68a",
  "#c4b5fd","#fb923c","#6ee7b7","#fca5a5",
];

export const THEMES: Record<ColorTheme, Theme> = {
  pink:     { accent:"#ec4899", mid:"#f9a8d4", border:"rgba(255,200,220,.38)", text:"#2d1520" },
  lavender: { accent:"#8b5cf6", mid:"#c4b5fd", border:"rgba(196,181,253,.38)", text:"#1e1030" },
  sky:      { accent:"#0ea5e9", mid:"#7dd3fc", border:"rgba(125,211,252,.38)", text:"#0c2d3e" },
  mint:     { accent:"#10b981", mid:"#6ee7b7", border:"rgba(110,231,183,.38)", text:"#0d2a1e" },
  warm:     { accent:"#f59e0b", mid:"#fcd34d", border:"rgba(252,211,77,.38)",  text:"#2a1a05" },
};

export const THEME_OPTIONS: ThemeOption[] = [
  { key:"pink"     as ColorTheme, label:"벚꽃", emoji:"🌸" },
  { key:"lavender" as ColorTheme, label:"라벤더", emoji:"💜" },
  { key:"sky"      as ColorTheme, label:"하늘", emoji:"🩵" },
  { key:"mint"     as ColorTheme, label:"민트", emoji:"🌿" },
  { key:"warm"     as ColorTheme, label:"황금", emoji:"✨" },
];

export const TODAY_STYLES: TodayStyleOption[] = [
  { key:"highlight", label:"배경 강조" },
  { key:"glow",      label:"글로우"   },
  { key:"elevated",  label:"입체 카드" },
  { key:"border",    label:"테두리"   },
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
  colorTheme:"pink", 
  dayNumberPos:"left", 
  fontFamily:"Noto Sans KR",
  showOverflow:true, 
  todayStyle:"highlight", 
  opacity:0.22, 
  todoPanelWidth:270, 
  autostart:false, 
  useLunar:false, 
  use24Hour:true,
  showMoonPhase:true,
};

export const MODAL_CLOSED = {
  open: false, 
  date: "", 
  startDate: "", 
  endDate: "",
  startTime: "09:00", 
  endTime: "10:00", 
  allDay: false,
};

export const getLocalToday = (): string => {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth()+1).padStart(2,"0"),
    String(d.getDate()).padStart(2,"0"),
  ].join("-");
};
