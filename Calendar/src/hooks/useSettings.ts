// ═══════════════════════════════════════════════════════════
// useSettings Hook
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { CalendarFeed, Settings } from "../types";
import { loadJson, persistItem } from "../utils";
import {
  CLAUDE_MODELS,
  DEFAULT_SETTINGS,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  SETTINGS_KEY,
  THEMES,
  TODAY_STYLES,
  WEB_FONTS,
} from "../constants";

type LegacySettings = Partial<Settings> & {
  alwaysOnTop?: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Only known keys with the right type survive, so leftovers from older versions
 * (e.g. `alwaysOnTop`) or a hand-edited backup can't leak into the settings.
 */
export const normalizeSettings = (value: unknown): Settings => {
  const saved = (typeof value === "object" && value !== null ? value : {}) as LegacySettings;
  const pick = <K extends keyof Settings>(key: K): Settings[K] =>
    typeof saved[key] === typeof DEFAULT_SETTINGS[key]
      ? saved[key] as Settings[K]
      : DEFAULT_SETTINGS[key];

  return {
    ...DEFAULT_SETTINGS,
    colorTheme: saved.colorTheme && saved.colorTheme in THEMES
      ? saved.colorTheme
      : DEFAULT_SETTINGS.colorTheme,
    dayNumberPos: saved.dayNumberPos === "right" ? "right" : "left",
    fontFamily: pick("fontFamily"),
    fontSize: clamp(pick("fontSize"), FONT_SIZE_MIN, FONT_SIZE_MAX),
    showOverflow: pick("showOverflow"),
    todayStyle: TODAY_STYLES.some(style => style.key === saved.todayStyle)
      ? saved.todayStyle as Settings["todayStyle"]
      : DEFAULT_SETTINGS.todayStyle,
    opacity: clamp(pick("opacity"), 0.05, 0.85),
    todoPanelWidth: clamp(pick("todoPanelWidth"), 200, 480),
    useLunar: pick("useLunar"),
    use24Hour: pick("use24Hour"),
    showMoonPhase: pick("showMoonPhase"),
    editMode: pick("editMode"),
    showOnTaskbar: pick("showOnTaskbar"),
    windowLevel: saved.windowLevel === "top" || saved.alwaysOnTop ? "top" : "bottom",
    remindersEnabled: pick("remindersEnabled"),
    reminderMinutesBefore: clamp(pick("reminderMinutesBefore"), 0, 24 * 60),
    allDayReminderTime: /^(\d{2}:\d{2})?$/.test(String(saved.allDayReminderTime ?? "x"))
      ? saved.allDayReminderTime as string
      : DEFAULT_SETTINGS.allDayReminderTime,
    todoDueReminder: pick("todoDueReminder"),
    autoBackup: pick("autoBackup"),
    autoUpdateCheck: pick("autoUpdateCheck"),
    colorLabels: normalizeColorLabels(saved.colorLabels),
    hiddenColors: Array.isArray(saved.hiddenColors)
      ? saved.hiddenColors.filter((color): color is string => typeof color === "string")
      : [],
    calendarFeeds: normalizeFeeds(saved.calendarFeeds),
    claudeEnabled: pick("claudeEnabled"),
    claudeModel: CLAUDE_MODELS.some(model => model.id === saved.claudeModel)
      ? saved.claudeModel as Settings["claudeModel"]
      : DEFAULT_SETTINGS.claudeModel,
  };
};

const normalizeColorLabels = (value: unknown): Record<string, string> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim() !== ""
    )
  );
};

const normalizeFeeds = (value: unknown): CalendarFeed[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter((feed): feed is Partial<CalendarFeed> => typeof feed === "object" && feed !== null)
    .filter(feed => typeof feed.id === "string" && typeof feed.url === "string")
    .map(feed => ({
      id: feed.id as string,
      url: feed.url as string,
      name: typeof feed.name === "string" && feed.name ? feed.name : "구독 캘린더",
      color: typeof feed.color === "string" ? feed.color : "#c4b5fd",
      enabled: feed.enabled !== false,
    }));
};

const loadSettings = (): Settings =>
  normalizeSettings(loadJson<unknown>(SETTINGS_KEY, {}));

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  useEffect(() => {
    let active = true;

    invoke<boolean>("get_autostart_status")
      .then(autostart => {
        if (active) {
          setSettings(prev => ({ ...prev, autostart }));
        }
      })
      .catch(error => console.error("Failed to read autostart status:", error));

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    try {
      persistItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to persist settings:", error);
    }
  }, [settings]);

  useEffect(() => {
    const t = THEMES[settings.colorTheme];
    const root = document.documentElement;
    const s = root.style;
    // Legibility floors: dark glass needs some body, high contrast is near-opaque.
    const opacity = t.highContrast
      ? Math.max(settings.opacity, 0.94)
      : t.mode === "dark"
        ? Math.max(settings.opacity, 0.45)
        : settings.opacity;

    s.setProperty("--accent", t.accent);
    s.setProperty("--mid", t.mid);
    s.setProperty("--glass-border", t.border);
    s.setProperty("--text-primary", t.text);
    s.setProperty("--text-secondary", t.textSecondary);
    s.setProperty("--glass-bg", `rgba(${t.bg},${opacity})`);
    // App.css swaps the light-on-glass surfaces for these.
    root.dataset.themeMode = t.mode;
    root.dataset.contrast = t.highContrast ? "high" : "normal";
  }, [settings.colorTheme, settings.opacity]);

  useEffect(() => {
    document.documentElement.style.setProperty("--font", `'${settings.fontFamily}', sans-serif`);

    if (WEB_FONTS.includes(settings.fontFamily)) {
      const id = `gf-${settings.fontFamily.replace(/\s/g, "")}`;

      if (!document.getElementById(id)) {
        const l = document.createElement("link");
        l.id = id;
        l.rel = "stylesheet";
        l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(settings.fontFamily)}:wght@300;400;500;700&display=swap`;
        document.head.appendChild(l);
      }
    }
  }, [settings.fontFamily]);

  useEffect(() => {
    document.documentElement.style.setProperty("--font-size", `${settings.fontSize}px`);
  }, [settings.fontSize]);

  useEffect(() => {
    const m = {
      left: "flex-start",
      right: "flex-end",
    } as const;

    document.documentElement.style.setProperty("--day-num-justify", m[settings.dayNumberPos]);
  }, [settings.dayNumberPos]);

  const setSetting = useCallback(<K extends keyof Settings>(
    key: K,
    value: Settings[K]
  ) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const toggleAutostart = useCallback(async () => {
    const next = !settings.autostart;

    try {
      const actual = await invoke<boolean>("set_autostart_status", {
        enabled: next,
      });
      setSetting("autostart", actual);
    } catch (error) {
      console.error("Failed to update autostart status:", error);
    }
  }, [settings.autostart, setSetting]);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return {
    settings,
    setSetting,
    toggleAutostart,
    resetSettings,
  };
}
