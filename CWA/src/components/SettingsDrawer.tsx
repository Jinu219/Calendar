// ═══════════════════════════════════════════════════════════
// SettingsDrawer Component
// ═══════════════════════════════════════════════════════════

import React from "react";
import type { Settings, MoonPhase, DayNumPos, WindowLevel } from "../types";
import { THEME_OPTIONS, TODAY_STYLES } from "../constants";


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
  const handleReset = () => {
    if (window.confirm("설정을 초기화하시겠습니까?")) {
      onResetSettings();
    }
  };
  const TOP_MODE_OPACITY = 0.16;

  const handleWindowLevelChange = (level: WindowLevel) => {
  onSetSetting("windowLevel", level);

  if (level === "top" && settings.opacity > TOP_MODE_OPACITY) {
    onSetSetting("opacity", TOP_MODE_OPACITY);
  }
  };
  
  return (
    <aside className={`settings-drawer glass-panel ${isOpen ? "open" : ""}`}>
      <div className="settings-hdr">
        <span className="settings-title">⚙ 설정</span>

        <button
          className="settings-close"
          type="button"
          onClick={onClose}
          title="설정 닫기"
        >
          ✕
        </button>
      </div>

      <div className="settings-body">
        {/* ─────────────────────────────────────────────
            Appearance
            ───────────────────────────────────────────── */}

        <section className="sg">
          <div className="sg-label">화면 테마</div>

          <div className="theme-grid">
            {THEME_OPTIONS.map(option => (
              <button
                key={option.key}
                type="button"
                className={`theme-btn ${settings.colorTheme === option.key ? "active" : ""}`}
                onClick={() => onSetSetting("colorTheme", option.key)}
              >
                <span className="theme-emoji">{option.emoji || "●"}</span>
                <span className="theme-label">{option.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="sg">
          <div className="sg-label">배경 투명도</div>

          <div className="slider-row">
            <span className="slider-hint">투명</span>

            <input
              className="opacity-slider"
              type="range"
              min={0.08}
              max={0.72}
              step={0.01}
              value={settings.opacity}
              onChange={e => onSetSetting("opacity", Number(e.target.value))}
            />

            <span className="slider-hint">불투명</span>
          </div>

          <div className="slider-val">
            {Math.round(settings.opacity * 100)}%
          </div>
        </section>

        <section className="sg">
          <div className="sg-label">오늘 표시 스타일</div>

          <div className="seg-ctrl seg-2x2">
            {TODAY_STYLES.map(option => (
              <button
                key={option.key}
                type="button"
                className={`seg-btn ${settings.todayStyle === option.key ? "active" : ""}`}
                onClick={() => onSetSetting("todayStyle", option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="sg">
          <div className="sg-label">날짜 숫자 위치</div>

          <div className="seg-ctrl">
            {(["left", "right"] as DayNumPos[]).map(position => (
              <button
                key={position}
                type="button"
                className={`seg-btn ${settings.dayNumberPos === position ? "active" : ""}`}
                onClick={() => onSetSetting("dayNumberPos", position)}
              >
                {position === "left" ? "왼쪽" : "오른쪽"}
              </button>
            ))}
          </div>
        </section>

        <section className="sg">
          <div className="sg-label">달력 주 표시</div>

          <div className="seg-ctrl">
            <button
              type="button"
              className={`seg-btn ${settings.showOverflow ? "active" : ""}`}
              onClick={() => onSetSetting("showOverflow", true)}
            >
              6주 고정
            </button>

            <button
              type="button"
              className={`seg-btn ${!settings.showOverflow ? "active" : ""}`}
              onClick={() => onSetSetting("showOverflow", false)}
            >
              자동
            </button>
          </div>
        </section>

        {/* ─────────────────────────────────────────────
            Todo panel
            ───────────────────────────────────────────── */}

        <section className="sg">
          <div className="sg-label">Todo 패널 너비</div>

          <div className="slider-row">
            <span className="slider-hint">좁게</span>

            <input
              className="opacity-slider"
              type="range"
              min={200}
              max={480}
              step={10}
              value={settings.todoPanelWidth}
              onChange={e => onSetSetting("todoPanelWidth", Number(e.target.value))}
            />

            <span className="slider-hint">넓게</span>
          </div>

          <div className="slider-val">
            {settings.todoPanelWidth}px
          </div>

          <p className="sg-hint">
            상단의 ↔ 버튼을 켜면 마우스로 패널 경계선을 직접 조절할 수 있습니다.
          </p>
        </section>

        {/* ─────────────────────────────────────────────
            Font
            ───────────────────────────────────────────── */}

        <section className="sg">
          <div className="sg-label">글꼴</div>

          <input
            className="font-search"
            type="text"
            placeholder="폰트 검색…"
            value={fontSearch}
            onChange={e => onFontSearchChange(e.target.value)}
          />

          <div className="font-list">
            {filteredFonts.slice(0, 30).map(font => (
              <button
                key={font}
                type="button"
                className={`font-btn ${settings.fontFamily === font ? "active" : ""}`}
                style={{ fontFamily: `'${font}', sans-serif` }}
                onClick={() => onSetSetting("fontFamily", font)}
              >
                {font}
              </button>
            ))}

            {filteredFonts.length > 30 && (
              <div className="font-more">
                …외 {filteredFonts.length - 30}개, 검색으로 좁혀보세요.
              </div>
            )}
          </div>
        </section>

        <section className="sg">
          <div className="sg-label">글꼴 크기</div>

          <div className="slider-row">
            <span className="slider-hint">작게</span>

            <input
              className="opacity-slider"
              type="range"
              min={11}
              max={18}
              step={1}
              value={settings.fontSize}
              onChange={e => onSetSetting("fontSize", Number(e.target.value))}
            />

            <span className="slider-hint">크게</span>
          </div>

          <div className="slider-val">
            {settings.fontSize}px
          </div>
        </section>

        {/* ─────────────────────────────────────────────
            Desktop behavior
            ───────────────────────────────────────────── */}

        <section className="sg">
          <div className="sg-label">데스크톱 동작</div>

          <button
            type="button"
            className={`edit-mode-btn ${settings.autostart ? "on" : ""}`}
            onClick={onToggleAutostart}
          >
            {settings.autostart ? "시작 프로그램 ON" : "시작 프로그램 OFF"}
          </button>

          <div className="seg-ctrl seg-3">
            <button
              type="button"
              className={`seg-btn ${settings.windowLevel === "bottom" ? "active" : ""}`}
              onClick={() => handleWindowLevelChange("bottom")}
            >
              항상 아래
            </button>

            <button
              type="button"
              className={`seg-btn ${settings.windowLevel === "normal" ? "active" : ""}`}
              onClick={() => handleWindowLevelChange("normal")}
            >
              일반
            </button>

            <button
              type="button"
              className={`seg-btn ${settings.windowLevel === "top" ? "active" : ""}`}
              onClick={() => handleWindowLevelChange("top")}
            >
              항상 위
            </button>
          </div>

          <p className="sg-hint">
            항상 아래는 바탕화면 위젯처럼 뒤쪽에 두는 모드입니다. 항상 위를 선택하면 화면을 덜 가리도록 투명도가 자동으로 낮아집니다.
          </p>

          <div className="seg-ctrl">
            <button
              type="button"
              className={`seg-btn ${settings.showOnTaskbar ? "active" : ""}`}
              onClick={() => onSetSetting("showOnTaskbar", true)}
            >
              작업표시줄 표시
            </button>

            <button
              type="button"
              className={`seg-btn ${!settings.showOnTaskbar ? "active" : ""}`}
              onClick={() => onSetSetting("showOnTaskbar", false)}
            >
              트레이 중심
            </button>
          </div>

          <p className="sg-hint">
            바탕화면형은 창을 뒤쪽에 두고, 트레이 중심은 작업표시줄 노출을 줄이는 모드입니다.
          </p>
        </section>

        {/* ─────────────────────────────────────────────
            Calendar extras
            ───────────────────────────────────────────── */}

        <section className="sg">
          <div className="sg-label">부가 표시</div>

          <div className="seg-ctrl">
            <button
              type="button"
              className={`seg-btn ${settings.useLunar ? "active" : ""}`}
              onClick={() => onSetSetting("useLunar", true)}
            >
              음력 ON
            </button>

            <button
              type="button"
              className={`seg-btn ${!settings.useLunar ? "active" : ""}`}
              onClick={() => onSetSetting("useLunar", false)}
            >
              음력 OFF
            </button>
          </div>

          <div className="seg-ctrl">
            <button
              type="button"
              className={`seg-btn ${settings.showMoonPhase ? "active" : ""}`}
              onClick={() => onSetSetting("showMoonPhase", true)}
            >
              달 위상 ON
            </button>

            <button
              type="button"
              className={`seg-btn ${!settings.showMoonPhase ? "active" : ""}`}
              onClick={() => onSetSetting("showMoonPhase", false)}
            >
              달 위상 OFF
            </button>
          </div>

          <div className="seg-ctrl">
            <button
              type="button"
              className={`seg-btn ${settings.use24Hour ? "active" : ""}`}
              onClick={() => onSetSetting("use24Hour", true)}
            >
              24시간
            </button>

            <button
              type="button"
              className={`seg-btn ${!settings.use24Hour ? "active" : ""}`}
              onClick={() => onSetSetting("use24Hour", false)}
            >
              12시간
            </button>
          </div>

          {settings.showMoonPhase && moonPhase.name && (
            <div className="moon-phase-display">
              <span className="moon-emoji">{moonPhase.emoji || "🌙"}</span>
              <span className="moon-name">{moonPhase.name}</span>
            </div>
          )}

          {settings.useLunar && lunarDate && (
            <div className="lunar-date-display">
              선택 날짜 음력: {lunarDate}
            </div>
          )}
        </section>

        {/* ─────────────────────────────────────────────
            Reset
            ───────────────────────────────────────────── */}

        <section className="sg">
          <div className="sg-label">설정 초기화</div>

          <button
            type="button"
            className="edit-mode-btn"
            onClick={handleReset}
          >
            모든 설정 초기화
          </button>

          <p className="sg-hint">
            테마, 글꼴, 패널 너비, 위젯 동작 설정이 기본값으로 돌아갑니다.
          </p>
        </section>
      </div>
    </aside>
  );
};