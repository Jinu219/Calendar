// ═══════════════════════════════════════════════════════════
// SettingsDrawer Component
// ═══════════════════════════════════════════════════════════
//
// Four tabs of compact rows (label left, control right) so nothing needs a
// long scroll. Switches for on/off, dropdowns for lists of choices.

import React, { useRef, useState } from "react";
import type { Settings, DayNumPos, TodayStyle } from "../types";
import {
  ALL_DAY_REMINDER_TIMES,
  COLOR_NAMES,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  REMINDER_LEAD_OPTIONS,
  TODAY_STYLES,
  TODO_COLORS,
} from "../constants";
import type { UpdateStatus } from "../hooks/useAutoUpdate";
import type { FeedStatus } from "../hooks/useCalendarFeeds";
import type { InboxReceipt } from "../hooks/useAssistantInbox";
import type { NotionFeatures } from "../hooks/useNotion";
import { formatShortDate } from "../utils";
import { FeedSettings } from "./FeedSettings";
import { NotionSettings } from "./NotionSettings";
import { SegmentedControl } from "./SegmentedControl";
import { SelectRow, SettingGroup, SettingRow, SliderRow, SwitchRow } from "./SettingControls";
import { ThemePicker } from "./ThemePicker";

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
  onShowHelp: () => void;
  notion: NotionFeatures;
  /** Runs an export and returns the summary to show. */
  onNotionExport: () => Promise<string>;
  /** The last batch Claude added from a conversation. */
  lastInbox: InboxReceipt | null;
}

type TabKey = "look" | "events" | "connect" | "app";

const TABS: { key: TabKey; label: string }[] = [
  { key: "look", label: "화면" },
  { key: "events", label: "일정" },
  { key: "connect", label: "연동" },
  { key: "app", label: "앱" },
];

const TOP_MODE_OPACITY = 0.16;
const FONT_LIST_LIMIT = 30;

const formatAt = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
  onShowHelp,
  notion,
  onNotionExport,
  lastInbox,
}) => {
  const [tab, setTab] = useState<TabKey>("look");
  const [fontsOpen, setFontsOpen] = useState(false);
  const tabRefs = useRef<Record<TabKey, HTMLButtonElement | null>>({ look: null, events: null, connect: null, app: null });

  const handleReset = () => {
    if (window.confirm("설정을 초기화하시겠습니까? 일정과 메모는 그대로예요.")) {
      onResetSettings();
    }
  };

  const handleImportClick = () => {
    if (window.confirm("백업 파일을 가져오면 현재 일정·메모·설정이 모두 덮어써집니다. 계속할까요?")) {
      onImportData();
    }
  };

  const updateStatusLabel = (() => {
    switch (updateStatus.state) {
      case "checking":
        return "확인 중…";
      case "up-to-date":
        return "최신 버전이에요";
      case "available":
        return `새 버전 ${updateStatus.version}`;
      case "installing":
        return "설치 중…";
      case "error":
        return `확인 실패: ${updateStatus.message}`;
      default:
        return "";
    }
  })();

  const handleAlwaysOnTop = (top: boolean) => {
    onSetSetting("windowLevel", top ? "top" : "bottom");
    // On top of other windows the widget should cover less.
    if (top && settings.opacity > TOP_MODE_OPACITY) onSetSetting("opacity", TOP_MODE_OPACITY);
  };

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  const handleTabKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const index = TABS.findIndex(t => t.key === tab);
    const next = TABS[(index + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length].key;
    setTab(next);
    tabRefs.current[next]?.focus();
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
        <div className="settings-hdr-top">
          <h2 className="settings-title">설정</h2>
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

        <div className="settings-tabs" role="tablist" aria-label="설정 분류" onKeyDown={handleTabKeyDown}>
          {TABS.map(t => (
            <button
              key={t.key}
              ref={el => { tabRefs.current[t.key] = el; }}
              type="button"
              role="tab"
              id={`settings-tab-${t.key}`}
              aria-selected={tab === t.key}
              aria-controls={`settings-panel-${t.key}`}
              tabIndex={tab === t.key ? 0 : -1}
              className={`settings-tab ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="settings-body"
        role="tabpanel"
        id={`settings-panel-${tab}`}
        aria-labelledby={`settings-tab-${tab}`}
      >
        {/* ─────────────── 화면 ─────────────── */}
        {tab === "look" && (
          <>
            <SettingGroup title="모양">
              <SettingRow label="테마">
                <ThemePicker value={settings.colorTheme} onChange={theme => onSetSetting("colorTheme", theme)} />
              </SettingRow>
              <SliderRow
                label="불투명도"
                min={0.08}
                max={0.72}
                step={0.01}
                value={settings.opacity}
                format={value => `${Math.round(value * 100)}%`}
                onChange={value => onSetSetting("opacity", value)}
              />
              <SliderRow
                label="글자 크기"
                min={FONT_SIZE_MIN}
                max={FONT_SIZE_MAX}
                step={1}
                value={settings.fontSize}
                format={value => `${value}px`}
                onChange={value => onSetSetting("fontSize", value)}
              />
              <SettingRow label="글꼴">
                <button
                  type="button"
                  className="set-select font-current"
                  aria-expanded={fontsOpen}
                  aria-label={`글꼴: ${settings.fontFamily}`}
                  style={{ fontFamily: `'${settings.fontFamily}', sans-serif` }}
                  onClick={() => setFontsOpen(prev => !prev)}
                >
                  {settings.fontFamily}
                </button>
              </SettingRow>
              {fontsOpen && (
                <div className="font-panel">
                  <input
                    className="set-input"
                    type="search"
                    placeholder="폰트 검색…"
                    aria-label="폰트 검색"
                    value={fontSearch}
                    onChange={e => onFontSearchChange(e.target.value)}
                  />
                  <div className="font-list" role="group" aria-label="글꼴 목록">
                    {filteredFonts.slice(0, FONT_LIST_LIMIT).map(font => (
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
                    {filteredFonts.length > FONT_LIST_LIMIT && (
                      <div className="font-more">…외 {filteredFonts.length - FONT_LIST_LIMIT}개</div>
                    )}
                  </div>
                </div>
              )}
            </SettingGroup>

            <SettingGroup title="달력">
              <SelectRow<TodayStyle>
                label="오늘 표시"
                options={TODAY_STYLES.map(option => ({ value: option.key, label: option.label }))}
                value={settings.todayStyle}
                onChange={value => onSetSetting("todayStyle", value)}
              />
              <SettingRow label="날짜 숫자">
                <SegmentedControl<DayNumPos>
                  label="날짜 숫자 위치"
                  className="seg-compact"
                  options={[
                    { value: "left", label: "왼쪽" },
                    { value: "right", label: "오른쪽" },
                  ]}
                  value={settings.dayNumberPos}
                  onChange={value => onSetSetting("dayNumberPos", value)}
                />
              </SettingRow>
              <SwitchRow label="항상 6주 표시" checked={settings.showOverflow} onChange={value => onSetSetting("showOverflow", value)} />
              <SwitchRow label="음력 날짜" checked={settings.useLunar} onChange={value => onSetSetting("useLunar", value)} />
              <SwitchRow label="24시간제" checked={settings.use24Hour} onChange={value => onSetSetting("use24Hour", value)} />
              <SliderRow
                label="할 일 패널"
                min={200}
                max={480}
                step={10}
                value={settings.todoPanelWidth}
                format={value => `${value}px`}
                onChange={value => onSetSetting("todoPanelWidth", value)}
              />
            </SettingGroup>
          </>
        )}

        {/* ─────────────── 일정 ─────────────── */}
        {tab === "events" && (
          <>
            <SettingGroup title="알림">
              <SwitchRow label="알림 받기" checked={settings.remindersEnabled} onChange={value => onSetSetting("remindersEnabled", value)} />
              {settings.remindersEnabled && (
                <>
                  <SelectRow<number>
                    label="시간 일정"
                    options={REMINDER_LEAD_OPTIONS.map(minutes => ({
                      value: minutes,
                      label: minutes === 0 ? "정시에" : `${minutes}분 전`,
                    }))}
                    value={settings.reminderMinutesBefore}
                    onChange={value => onSetSetting("reminderMinutesBefore", value)}
                  />
                  <SelectRow<string>
                    label="종일 일정"
                    options={ALL_DAY_REMINDER_TIMES.map(time => ({ value: time, label: time ? `아침 ${time}` : "알리지 않음" }))}
                    value={settings.allDayReminderTime}
                    onChange={value => onSetSetting("allDayReminderTime", value)}
                  />
                  <SwitchRow label="할 일 마감 전날" checked={settings.todoDueReminder} onChange={value => onSetSetting("todoDueReminder", value)} />
                </>
              )}
            </SettingGroup>

            <SettingGroup title="카테고리 이름">
              <div className="category-label-list">
                {TODO_COLORS.map(color => (
                  <label key={color} className="category-label-row">
                    <span className="category-dot" style={{ background: color }} aria-hidden="true" />
                    <input
                      className="set-input"
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
            </SettingGroup>

            <SettingGroup title="구독 캘린더">
              <FeedSettings
                feeds={settings.calendarFeeds}
                onChange={feeds => onSetSetting("calendarFeeds", feeds)}
                statusFor={feedStatusFor}
                onRefresh={onRefreshFeeds}
              />
            </SettingGroup>
          </>
        )}

        {/* ─────────────── 연동 ─────────────── */}
        {tab === "connect" && (
          <>
            <SettingGroup title="Claude 대화">
              <SwitchRow
                label="대화에서 일정 받기"
                checked={settings.assistantInbox}
                onChange={value => onSetSetting("assistantInbox", value)}
              />
              <p className="set-status">
                {lastInbox
                  ? `마지막: ${formatAt(lastInbox.at)} · ${lastInbox.titles[0]}${lastInbox.titles.length > 1 ? ` 외 ${lastInbox.titles.length - 1}개` : ""}`
                  : "Claude에게 \"이 일정 캘린더에 넣어줘\"라고 하면 여기로 들어와요."}
              </p>
            </SettingGroup>

            <SettingGroup title="Notion">
              <NotionSettings
                settings={settings}
                notion={notion}
                onSetSetting={onSetSetting}
                onExport={onNotionExport}
              />
            </SettingGroup>
          </>
        )}

        {/* ─────────────── 앱 ─────────────── */}
        {tab === "app" && (
          <>
            <SettingGroup title="창">
              <SwitchRow label="Windows 시작 시 실행" checked={settings.autostart} onChange={() => onToggleAutostart()} />
              <SwitchRow label="항상 위에 표시" checked={settings.windowLevel === "top"} onChange={handleAlwaysOnTop} />
              <SwitchRow label="작업표시줄 아이콘" checked={settings.showOnTaskbar} onChange={value => onSetSetting("showOnTaskbar", value)} />
              <SettingRow label="열기/숨기기">
                {globalShortcut ? <kbd>{globalShortcut}</kbd> : <span className="set-value">등록 실패</span>}
              </SettingRow>
              <SettingRow label="단축키">
                <button type="button" className="set-btn" onClick={onShowHelp}>보기</button>
              </SettingRow>
            </SettingGroup>

            <SettingGroup title="백업">
              <SettingRow label="파일로">
                <div className="btn-row">
                  <button type="button" className="set-btn" disabled={isExporting} onClick={onExportData}>
                    {isExporting ? "…" : "내보내기"}
                  </button>
                  <button type="button" className="set-btn" disabled={isImporting} onClick={handleImportClick}>
                    {isImporting ? "…" : "가져오기"}
                  </button>
                </div>
              </SettingRow>
              <SwitchRow label="매일 자동 백업" checked={settings.autoBackup} onChange={value => onSetSetting("autoBackup", value)} />
              <SettingRow label={lastAutoBackup ? `마지막 ${formatShortDate(lastAutoBackup)}` : "자동 백업 없음"}>
                <div className="btn-row">
                  <button type="button" className="set-btn" onClick={onBackupNow}>지금</button>
                  <button type="button" className="set-btn" onClick={onOpenBackupFolder}>폴더</button>
                </div>
              </SettingRow>
            </SettingGroup>

            <SettingGroup title="업데이트">
              <SettingRow label={updateStatusLabel || "새 버전"}>
                {updateStatus.state === "available" ? (
                  <button type="button" className="set-btn primary" onClick={onInstallUpdate}>설치</button>
                ) : (
                  <button
                    type="button"
                    className="set-btn"
                    disabled={updateStatus.state === "checking" || updateStatus.state === "installing"}
                    onClick={onCheckForUpdate}
                  >
                    확인
                  </button>
                )}
              </SettingRow>
              <SwitchRow label="하루 한 번 자동 확인" checked={settings.autoUpdateCheck} onChange={value => onSetSetting("autoUpdateCheck", value)} />
            </SettingGroup>

            <SettingGroup>
              <SettingRow label="설정 초기화">
                <button type="button" className="set-btn danger" onClick={handleReset}>초기화</button>
              </SettingRow>
            </SettingGroup>
          </>
        )}
      </div>
    </aside>
  );
};
