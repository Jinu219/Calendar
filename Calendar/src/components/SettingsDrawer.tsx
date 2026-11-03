// ═══════════════════════════════════════════════════════════
// SettingsDrawer Component
// ═══════════════════════════════════════════════════════════

import React, { useId } from "react";
import type { Settings, MoonPhase, DayNumPos, TodayStyle, WindowLevel } from "../types";
import {
  ALL_DAY_REMINDER_TIMES,
  COLOR_NAMES,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  REMINDER_LEAD_OPTIONS,
  THEME_OPTIONS,
  TODAY_STYLES,
  TODO_COLORS,
} from "../constants";
import type { UpdateStatus } from "../hooks/useAutoUpdate";
import type { FeedStatus } from "../hooks/useCalendarFeeds";
import { formatShortDate } from "../utils";
import { FeedSettings } from "./FeedSettings";
import { SegmentedControl } from "./SegmentedControl";
import { ShortcutListSection } from "./ShortcutHelpModal";

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
  onExportData: () => void;
  onImportData: () => void;
  isExporting: boolean;
  isImporting: boolean;
  updateStatus: UpdateStatus;
  onCheckForUpdate: () => void;
  onInstallUpdate: () => void;
  lastAutoBackup: string | null;
  onBackupNow: () => void;
  onOpenBackupFolder: () => void;
  feedStatusFor: (id: string) => FeedStatus;
  onRefreshFeeds: (id?: string) => void;
  /** The system-wide show/hide shortcut that got registered, if any. */
  globalShortcut: string | null;
}

const ON_OFF = (on: string, off: string) => [
  { value: true, label: on },
  { value: false, label: off },
];

const TOP_MODE_OPACITY = 0.16;

/** A titled settings group; the title doubles as the group's accessible name. */
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const id = useId();

  return (
    <section className="sg" aria-labelledby={id}>
      <h3 className="sg-label" id={id}>{title}</h3>
      {children}
    </section>
  );
};

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
  onExportData,
  onImportData,
  isExporting,
  isImporting,
  updateStatus,
  onCheckForUpdate,
  onInstallUpdate,
  lastAutoBackup,
  onBackupNow,
  onOpenBackupFolder,
  feedStatusFor,
  onRefreshFeeds,
  globalShortcut,
}) => {
  const handleReset = () => {
    if (window.confirm("설정을 초기화하시겠습니까?")) {
      onResetSettings();
    }
  };

  const handleImportClick = () => {
    if (
      window.confirm(
        "백업 파일을 가져오면 현재 일정·메모·설정이 모두 덮어써집니다. 계속할까요?"
      )
    ) {
      onImportData();
    }
  };

  const updateStatusLabel = (() => {
    switch (updateStatus.state) {
      case "checking":
        return "확인 중…";
      case "up-to-date":
        return "최신 버전입니다";
      case "available":
        return `새 버전 ${updateStatus.version} 발견`;
      case "installing":
        return "다운로드 및 설치 중…";
      case "error":
        return `확인 실패: ${updateStatus.message}`;
      default:
        return "";
    }
  })();

  const handleWindowLevelChange = (level: WindowLevel) => {
    onSetSetting("windowLevel", level);

    if (level === "top" && settings.opacity > TOP_MODE_OPACITY) {
      onSetSetting("opacity", TOP_MODE_OPACITY);
    }
  };

  return (
    <aside
      className={`settings-drawer glass-panel ${isOpen ? "open" : ""}`}
      aria-label="설정"
      aria-hidden={!isOpen}
      // Off-screen controls must not be reachable with Tab while closed.
      inert={!isOpen}
    >
      <div className="settings-hdr">
        <h2 className="settings-title">⚙ 설정</h2>

        <button
          className="settings-close"
          type="button"
          onClick={onClose}
          aria-label="설정 닫기"
          title="설정 닫기 (Esc)"
        >
          ✕
        </button>
      </div>

      <div className="settings-body">
        {/* ─────────────── Appearance ─────────────── */}

        <Section title="화면 테마">
          <div className="theme-grid" role="group" aria-label="화면 테마">
            {THEME_OPTIONS.map(option => (
              <button
                key={option.key}
                type="button"
                className={`theme-btn ${settings.colorTheme === option.key ? "active" : ""}`}
                aria-pressed={settings.colorTheme === option.key}
                onClick={() => onSetSetting("colorTheme", option.key)}
              >
                <span className="theme-emoji" aria-hidden="true">{option.emoji || "●"}</span>
                <span className="theme-label">{option.label}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section title="배경 투명도">
          <div className="slider-row">
            <span className="slider-hint">투명</span>
            <input
              className="opacity-slider"
              type="range"
              min={0.08}
              max={0.72}
              step={0.01}
              value={settings.opacity}
              aria-label="배경 불투명도"
              aria-valuetext={`${Math.round(settings.opacity * 100)}%`}
              onChange={e => onSetSetting("opacity", Number(e.target.value))}
            />
            <span className="slider-hint">불투명</span>
          </div>
          <div className="slider-val">{Math.round(settings.opacity * 100)}%</div>
        </Section>

        <Section title="글꼴 크기">
          <div className="slider-row">
            <span className="slider-hint" style={{ fontSize: 11 }}>가</span>
            <input
              className="opacity-slider"
              type="range"
              min={FONT_SIZE_MIN}
              max={FONT_SIZE_MAX}
              step={1}
              value={settings.fontSize}
              aria-label="글꼴 크기"
              aria-valuetext={`${settings.fontSize}픽셀`}
              onChange={e => onSetSetting("fontSize", Number(e.target.value))}
            />
            <span className="slider-hint" style={{ fontSize: 18 }}>가</span>
          </div>
          <div className="slider-val">{settings.fontSize}px</div>
          <p className="sg-hint">달력, 할 일 목록, 설정 화면의 글자가 함께 커집니다.</p>
        </Section>

        <Section title="글꼴">
          <input
            className="font-search"
            type="search"
            placeholder="폰트 검색…"
            aria-label="폰트 검색"
            value={fontSearch}
            onChange={e => onFontSearchChange(e.target.value)}
          />

          <div className="font-list" role="group" aria-label="글꼴 목록">
            {filteredFonts.slice(0, 30).map(font => (
              <button
                key={font}
                type="button"
                className={`font-btn ${settings.fontFamily === font ? "active" : ""}`}
                aria-pressed={settings.fontFamily === font}
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
        </Section>

        <Section title="오늘 표시 스타일">
          <SegmentedControl<TodayStyle>
            label="오늘 표시 스타일"
            grid
            options={TODAY_STYLES.map(option => ({ value: option.key, label: option.label }))}
            value={settings.todayStyle}
            onChange={value => onSetSetting("todayStyle", value)}
          />
        </Section>

        <Section title="달력 모양">
          <SegmentedControl<DayNumPos>
            label="날짜 숫자 위치"
            options={[
              { value: "left", label: "숫자 왼쪽" },
              { value: "right", label: "숫자 오른쪽" },
            ]}
            value={settings.dayNumberPos}
            onChange={value => onSetSetting("dayNumberPos", value)}
          />

          <SegmentedControl<boolean>
            label="달력 주 표시"
            options={[
              { value: true, label: "6주 고정" },
              { value: false, label: "주 수 자동" },
            ]}
            value={settings.showOverflow}
            onChange={value => onSetSetting("showOverflow", value)}
          />
        </Section>

        {/* ─────────────── Todo panel ─────────────── */}

        <Section title="할 일 패널 너비">
          <div className="slider-row">
            <span className="slider-hint">좁게</span>
            <input
              className="opacity-slider"
              type="range"
              min={200}
              max={480}
              step={10}
              value={settings.todoPanelWidth}
              aria-label="할 일 패널 너비"
              aria-valuetext={`${settings.todoPanelWidth}픽셀`}
              onChange={e => onSetSetting("todoPanelWidth", Number(e.target.value))}
            />
            <span className="slider-hint">넓게</span>
          </div>
          <div className="slider-val">{settings.todoPanelWidth}px</div>
          <p className="sg-hint">
            상단의 ↔ 버튼을 켜면 마우스로 패널 경계선을 직접 조절할 수 있습니다.
          </p>
        </Section>

        {/* ─────────────── Calendar extras ─────────────── */}

        <Section title="부가 표시">
          <SegmentedControl<boolean>
            label="음력"
            options={ON_OFF("음력 ON", "음력 OFF")}
            value={settings.useLunar}
            onChange={value => onSetSetting("useLunar", value)}
          />
          <SegmentedControl<boolean>
            label="달 위상"
            options={ON_OFF("달 위상 ON", "달 위상 OFF")}
            value={settings.showMoonPhase}
            onChange={value => onSetSetting("showMoonPhase", value)}
          />
          <SegmentedControl<boolean>
            label="시간 표기"
            options={ON_OFF("24시간", "12시간")}
            value={settings.use24Hour}
            onChange={value => onSetSetting("use24Hour", value)}
          />

          {settings.showMoonPhase && moonPhase.name && (
            <div className="moon-phase-display">
              <span className="moon-emoji" aria-hidden="true">{moonPhase.emoji || "🌙"}</span>
              <span className="moon-name">오늘의 달: {moonPhase.name}</span>
            </div>
          )}

          {settings.useLunar && lunarDate && (
            <div className="lunar-date-display">
              선택 날짜 음력: {lunarDate}
            </div>
          )}
        </Section>

        {/* ─────────────── Reminders ─────────────── */}

        <Section title="알림">
          <SegmentedControl<boolean>
            label="알림 사용"
            options={ON_OFF("알림 ON", "알림 OFF")}
            value={settings.remindersEnabled}
            onChange={value => onSetSetting("remindersEnabled", value)}
          />

          {settings.remindersEnabled && (
            <SegmentedControl<number>
              label="몇 분 전에 알릴까요"
              grid
              options={REMINDER_LEAD_OPTIONS.map(minutes => ({
                value: minutes,
                label: minutes === 0 ? "정시" : `${minutes}분 전`,
              }))}
              value={settings.reminderMinutesBefore}
              onChange={value => onSetSetting("reminderMinutesBefore", value)}
            />
          )}

          {settings.remindersEnabled && (
            <>
              <SegmentedControl<string>
                label="종일 일정 아침 알림"
                grid
                options={ALL_DAY_REMINDER_TIMES.map(time => ({
                  value: time,
                  label: time ? `아침 ${time}` : "아침 알림 끔",
                }))}
                value={settings.allDayReminderTime}
                onChange={value => onSetSetting("allDayReminderTime", value)}
              />

              <SegmentedControl<boolean>
                label="할 일 마감 전날 알림"
                options={ON_OFF("마감 전날 알림", "마감 알림 끔")}
                value={settings.todoDueReminder}
                onChange={value => onSetSetting("todoDueReminder", value)}
              />
            </>
          )}

          <p className="sg-hint">
            시간 일정은 위 시간 전에(일정마다 따로 바꿀 수 있음), 종일 일정·마감은 아침에 한 번 묶어서 알려 줍니다. 앱이 트레이에 있어도 동작하고, 알림을 누르면 위젯이 열립니다.
          </p>
        </Section>

        {/* ─────────────── Categories ─────────────── */}

        <Section title="카테고리">
          <div className="category-label-list">
            {TODO_COLORS.map(color => (
              <label key={color} className="category-label-row">
                <span className="category-dot" style={{ background: color }} aria-hidden="true" />
                <input
                  className="font-search"
                  placeholder={COLOR_NAMES[color]}
                  aria-label={`${COLOR_NAMES[color]} 카테고리 이름`}
                  value={settings.colorLabels[color] ?? ""}
                  onChange={e => {
                    const next = { ...settings.colorLabels };
                    if (e.target.value.trim()) next[color] = e.target.value;
                    else delete next[color];
                    onSetSetting("colorLabels", next);
                  }}
                />
              </label>
            ))}
          </div>
          <p className="sg-hint">색상에 이름(수업, 과제, 약속…)을 붙이면 상단 🏷 필터와 검색에서 쓸 수 있어요.</p>
        </Section>

        {/* ─────────────── Subscribed calendars ─────────────── */}

        <Section title="구독 캘린더">
          <FeedSettings
            feeds={settings.calendarFeeds}
            onChange={feeds => onSetSetting("calendarFeeds", feeds)}
            statusFor={feedStatusFor}
            onRefresh={onRefreshFeeds}
          />
        </Section>

        {/* ─────────────── Desktop behavior ─────────────── */}

        <Section title="데스크톱 동작">
          <button
            type="button"
            className={`edit-mode-btn ${settings.autostart ? "on" : ""}`}
            aria-pressed={settings.autostart}
            onClick={onToggleAutostart}
          >
            {settings.autostart ? "시작 프로그램 ON" : "시작 프로그램 OFF"}
          </button>

          <SegmentedControl<WindowLevel>
            label="창 위치"
            options={[
              { value: "bottom", label: "항상 아래" },
              { value: "top", label: "항상 위" },
            ]}
            value={settings.windowLevel}
            onChange={handleWindowLevelChange}
          />

          <p className="sg-hint">
            항상 아래는 바탕화면 위젯처럼 뒤쪽에 두는 모드입니다. 항상 위를 선택하면 화면을 덜 가리도록 투명도가 자동으로 낮아집니다.
          </p>

          <SegmentedControl<boolean>
            label="작업표시줄"
            options={[
              { value: true, label: "작업표시줄 표시" },
              { value: false, label: "트레이 중심" },
            ]}
            value={settings.showOnTaskbar}
            onChange={value => onSetSetting("showOnTaskbar", value)}
          />

          <p className="sg-hint">
            트레이 중심은 작업표시줄에 아이콘을 띄우지 않고, 트레이 아이콘을 한 번 눌러 열고 닫습니다.
          </p>

          <p className="sg-hint">
            {globalShortcut
              ? <>어디서든 <kbd>{globalShortcut}</kbd>로 위젯을 보이거나 숨길 수 있어요.</>
              : "전역 단축키(Win+Alt+C / Ctrl+Alt+C)를 다른 앱이 쓰고 있어 등록하지 못했어요."}
          </p>
        </Section>

        {/* ─────────────── Shortcuts ─────────────── */}

        <Section title="키보드 단축키">
          <details className="shortcut-details">
            <summary>단축키와 사용 팁 보기</summary>
            <ShortcutListSection />
          </details>
        </Section>

        {/* ─────────────── Backup ─────────────── */}

        <Section title="데이터 백업">
          <div className="btn-row">
            <button
              type="button"
              className="edit-mode-btn"
              disabled={isExporting}
              onClick={onExportData}
            >
              {isExporting ? "내보내는 중…" : "내보내기"}
            </button>

            <button
              type="button"
              className="edit-mode-btn"
              disabled={isImporting}
              onClick={handleImportClick}
            >
              {isImporting ? "가져오는 중…" : "가져오기"}
            </button>
          </div>

          <p className="sg-hint">
            일정, 메모, 설정을 하나의 JSON 파일로 내보내거나 복원합니다. PC를 옮기거나 앱을 재설치하기 전에 내보내기를 권장합니다.
          </p>

          <SegmentedControl<boolean>
            label="자동 백업"
            options={ON_OFF("매일 자동 백업", "자동 백업 끔")}
            value={settings.autoBackup}
            onChange={value => onSetSetting("autoBackup", value)}
          />

          <div className="btn-row">
            <button type="button" className="edit-mode-btn" onClick={onBackupNow}>지금 백업</button>
            <button type="button" className="edit-mode-btn" onClick={onOpenBackupFolder}>백업 폴더 열기</button>
          </div>

          <p className="sg-hint">
            {lastAutoBackup ? `마지막 자동 백업: ${formatShortDate(lastAutoBackup)}` : "아직 자동 백업이 없어요."}
            {" "}최근 7일치를 보관하고, 일정·메모는 앱 폴더의 파일에도 함께 저장되어 WebView 데이터가 지워져도 복구됩니다.
          </p>
        </Section>

        {/* ─────────────── Update ─────────────── */}

        <Section title="업데이트">
          {updateStatus.state === "available" ? (
            <button
              type="button"
              className="edit-mode-btn on"
              onClick={onInstallUpdate}
            >
              업데이트 설치 후 재시작
            </button>
          ) : (
            <button
              type="button"
              className="edit-mode-btn"
              disabled={updateStatus.state === "checking" || updateStatus.state === "installing"}
              onClick={onCheckForUpdate}
            >
              업데이트 확인
            </button>
          )}

          {updateStatusLabel && <p className="sg-hint" role="status">{updateStatusLabel}</p>}

          <SegmentedControl<boolean>
            label="업데이트 자동 확인"
            options={ON_OFF("하루 한 번 자동 확인", "자동 확인 끔")}
            value={settings.autoUpdateCheck}
            onChange={value => onSetSetting("autoUpdateCheck", value)}
          />
        </Section>

        {/* ─────────────── Reset ─────────────── */}

        <Section title="설정 초기화">
          <button
            type="button"
            className="edit-mode-btn"
            onClick={handleReset}
          >
            모든 설정 초기화
          </button>

          <p className="sg-hint">
            테마, 글꼴, 패널 너비, 위젯 동작 설정이 기본값으로 돌아갑니다. 일정과 메모는 지워지지 않습니다.
          </p>
        </Section>
      </div>
    </aside>
  );
};
