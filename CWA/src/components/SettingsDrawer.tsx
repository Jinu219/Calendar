// ═══════════════════════════════════════════════════════════
// SettingsDrawer Component
// ═══════════════════════════════════════════════════════════

import React from "react";
import type { Settings, MoonPhase, DayNumPos } from "../types";
import { 
  THEME_OPTIONS, 
  TODAY_STYLES, 
  WEB_FONTS 
} from "../constants";

interface SettingsDrawerProps {
  isOpen: boolean;
  settings: Settings;
  onClose: () => void;
  onSetSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  onToggleAutostart: () => void;
  onResetSettings: () => void;
  filteredFonts: string[];
  fontSearch: string;
  onFontSearchChange: (search: string) => void;
  moonPhase: MoonPhase;
  lunarDate: string;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  settings,
  onClose,
  onSetSetting,
  onToggleAutostart,
  onResetSettings,
  filteredFonts,
  fontSearch,
  onFontSearchChange,
  moonPhase,
  lunarDate,
}) => {
  return (
    <div className={`settings-drawer glass-panel ${isOpen ? "open" : ""}`}>
      <div className="settings-hdr">
        <span className="settings-title">⚙ 설정</span>
        <button className="settings-close" onClick={onClose}>✕</button>
      </div>
      <div className="settings-body">
        {/* 색상 테마 */}
        <div className="sg">
          <div className="sg-label">🎨 색상 테마</div>
          <div className="theme-grid">
            {THEME_OPTIONS.map(o => (
              <button
                key={o.key}
                className={`theme-btn ${settings.colorTheme === o.key ? "active" : ""}`}
                style={{ "--ba": THEME_OPTIONS.find(t => t.key === settings.colorTheme)?.key ? 
                  `var(--accent)` : "transparent" } as React.CSSProperties}
                onClick={() => onSetSetting("colorTheme", o.key)}
              >
                <span className="theme-emoji">{o.emoji}</span>
                <span className="theme-label">{o.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 투명도 */}
        <div className="sg">
          <div className="sg-label">🔮 배경 투명도</div>
          <div className="slider-row">
            <span className="slider-hint">투명</span>
            <input
              type="range"
              min="0.05"
              max="0.85"
              step="0.01"
              value={settings.opacity}
              className="opacity-slider"
              onChange={e => onSetSetting("opacity", parseFloat(e.target.value))}
            />
            <span className="slider-hint">불투명</span>
          </div>
          <div className="slider-val">{Math.round(settings.opacity * 100)}%</div>
        </div>

        {/* 오늘 표시 */}
        <div className="sg">
          <div className="sg-label">📍 오늘 표시 스타일</div>
          <div className="seg-ctrl seg-2x2">
            {TODAY_STYLES.map(o => (
              <button
                key={o.key}
                className={`seg-btn ${settings.todayStyle === o.key ? "active" : ""}`}
                onClick={() => onSetSetting("todayStyle", o.key)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* 날짜 숫자 위치 */}
        <div className="sg">
          <div className="sg-label">📅 날짜 숫자 위치</div>
          <div className="seg-ctrl">
            {(["left", "right"] as DayNumPos[]).map(p => (
              <button
                key={p}
                className={`seg-btn ${settings.dayNumberPos === p ? "active" : ""}`}
                onClick={() => onSetSetting("dayNumberPos", p)}
              >
                {p === "left" ? "왼쪽" : "오른쪽"}
              </button>
            ))}
          </div>
        </div>

        {/* 달력 주 표시 */}
        <div className="sg">
          <div className="sg-label">🗓 달력 주 표시</div>
          <div className="seg-ctrl">
            <button
              className={`seg-btn ${settings.showOverflow ? "active" : ""}`}
              onClick={() => onSetSetting("showOverflow", true)}
            >
              6주 고정
            </button>
            <button
              className={`seg-btn ${!settings.showOverflow ? "active" : ""}`}
              onClick={() => onSetSetting("showOverflow", false)}
            >
              자동
            </button>
          </div>
        </div>

        {/* 글꼴 선택 */}
        <div className="sg">
          <div className="sg-label">✏ 글꼴 (시스템 폰트 포함)</div>
          <input
            className="font-search"
            placeholder="폰트 검색…"
            value={fontSearch}
            onChange={e => onFontSearchChange(e.target.value)}
          />
          <div className="font-list">
            {filteredFonts.slice(0, 30).map(f => (
              <button
                key={f}
                className={`font-btn ${settings.fontFamily === f ? "active" : ""}`}
                style={{ fontFamily: `'${f}', sans-serif` }}
                onClick={() => onSetSetting("fontFamily", f)}
              >
                {f}
              </button>
            ))}
            {filteredFonts.length > 30 && (
              <div className="font-more">…외 {filteredFonts.length - 30}개 (검색으로 좁히기)</div>
            )}
          </div>
        </div>

        {/* 글꼴 크기 */}
        <div className="sg">
          <div className="sg-label">🔤 글꼴 크기</div>
          <div className="slider-row">
            <span className="slider-hint">작게</span>
            <input
              type="range"
              min="10"
              max="20"
              step="1"
              value={settings.fontSize}
              className="opacity-slider"
              onChange={e => onSetSetting("fontSize", parseInt(e.target.value))}
            />
            <span className="slider-hint">크게</span>
          </div>
          <div className="slider-val">{settings.fontSize}px</div>
        </div>

        {/* 시작 프로그램 */}
        <div className="sg">
          <div className="sg-label">🚀 시작 프로그램</div>
          <div className="seg-ctrl">
            <button
              className={`seg-btn ${settings.autostart ? "active" : ""}`}
              onClick={onToggleAutostart}
            >
              {settings.autostart ? "ON — 자동 실행 중" : "OFF — 클릭해서 켜기"}
            </button>
          </div>
        </div>

        {/* 항상 위에 표시 (Win+D 방지) */}
        <div className="sg">
          <div className="sg-label">🖥️ 항상 위에 표시</div>
          <div className="seg-ctrl">
            <button
              className={`seg-btn ${settings.alwaysOnTop ? "active" : ""}`}
              onClick={() => onSetSetting("alwaysOnTop", !settings.alwaysOnTop)}
            >
              {settings.alwaysOnTop ? "ON — Win+D 방지됨" : "OFF — 클릭해서 켜기"}
            </button>
          </div>
          <div className="sg-hint">ON 시 작업 표시줄을 눌러도 창이 숨겨지지 않습니다</div>
        </div>

        {/* 작업 표시줄 표시 */}
        <div className="sg">
          <div className="sg-label">📌 작업 표시줄 표시</div>
          <div className="seg-ctrl">
            <button
              className={`seg-btn ${settings.showOnTaskbar ? "active" : ""}`}
              onClick={() => onSetSetting("showOnTaskbar", !settings.showOnTaskbar)}
            >
              {settings.showOnTaskbar ? "ON" : "OFF"}
            </button>
          </div>
          <div className="sg-hint">ON 시 작업 표시줄에서 창을 끄고 끌 수 있습니다</div>
        </div>

        {/* 편집 모드 (위치/크기 고정) */}
        <div className="sg">
          <div className="sg-label">🔒 편집 모드</div>
          <div className="seg-ctrl">
            <button
              className={`seg-btn ${settings.editMode ? "active" : ""}`}
              onClick={() => onSetSetting("editMode", !settings.editMode)}
            >
              {settings.editMode ? "ON — 위치/크기 조절 가능" : "OFF — 고정됨"}
            </button>
          </div>
          <div className="sg-hint">ON 시 창 크기와 패널 너비를 조절할 수 있습니다</div>
        </div>

        {/* 음력 표시 */}
        <div className="sg">
          <div className="sg-label">📅 음력 표시</div>
          <div className="seg-ctrl">
            <button
              className={`seg-btn ${settings.useLunar ? "active" : ""}`}
              onClick={() => onSetSetting("useLunar", true)}
            >
              ON
            </button>
            <button
              className={`seg-btn ${!settings.useLunar ? "active" : ""}`}
              onClick={() => onSetSetting("useLunar", false)}
            >
              OFF
            </button>
          </div>
        </div>

        {/* 시간 형식 */}
        <div className="sg">
          <div className="sg-label">🕐 시간 형식</div>
          <div className="seg-ctrl">
            <button
              className={`seg-btn ${settings.use24Hour ? "active" : ""}`}
              onClick={() => onSetSetting("use24Hour", true)}
            >
              24시간
            </button>
            <button
              className={`seg-btn ${!settings.use24Hour ? "active" : ""}`}
              onClick={() => onSetSetting("use24Hour", false)}
            >
              12시간
            </button>
          </div>
        </div>

        {/* 설정 초기화 */}
        <div className="sg">
          <div className="sg-label">🔄 설정 초기화</div>
          <button
            className="edit-mode-btn reset-btn"
            onClick={() => {
              if (confirm("설정을 초기화하시겠습니까?")) {
                onResetSettings();
              }
            }}
          >
            모든 설정 초기화
          </button>
        </div>
      </div>
    </div>
  );
};
