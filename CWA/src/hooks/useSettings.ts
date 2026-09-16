// ═══════════════════════════════════════════════════════════
// useSettings Hook
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Settings } from "../types";
import { loadJson } from "../utils";
import { DEFAULT_SETTINGS, SETTINGS_KEY, THEMES, WEB_FONTS } from "../constants";

type LegacySettings = Partial<Settings> & {
  alwaysOnTop?: boolean;
};

const loadSettings = (): Settings => {
  const saved = loadJson<LegacySettings>(SETTINGS_KEY, {});
  const colorTheme = saved.colorTheme && saved.colorTheme in THEMES
    ? saved.colorTheme
    : DEFAULT_SETTINGS.colorTheme;
  const dayNumberPos = saved.dayNumberPos === "right" ? "right" : "left";
  const windowLevel = saved.windowLevel === "top" || saved.alwaysOnTop
    ? "top"
    : "bottom";

  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    colorTheme,
    dayNumberPos,
    fontFamily: typeof saved.fontFamily === "string"
      ? saved.fontFamily
      : DEFAULT_SETTINGS.fontFamily,
    fontSize: typeof saved.fontSize === "number"
      ? Math.min(24, Math.max(10, saved.fontSize))
      : DEFAULT_SETTINGS.fontSize,
    opacity: typeof saved.opacity === "number"
      ? Math.min(0.85, Math.max(0.05, saved.opacity))
      : DEFAULT_SETTINGS.opacity,
    todoPanelWidth: typeof saved.todoPanelWidth === "number"
      ? Math.min(480, Math.max(200, saved.todoPanelWidth))
      : DEFAULT_SETTINGS.todoPanelWidth,
    windowLevel,
    editMode: saved.editMode ?? DEFAULT_SETTINGS.editMode,
    showOnTaskbar: saved.showOnTaskbar ?? DEFAULT_SETTINGS.showOnTaskbar,
    remindersEnabled: saved.remindersEnabled ?? DEFAULT_SETTINGS.remindersEnabled,
    reminderMinutesBefore: typeof saved.reminderMinutesBefore === "number"
      ? saved.reminderMinutesBefore
      : DEFAULT_SETTINGS.reminderMinutesBefore,
  };
};

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
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to persist settings:", error);
    }
  }, [settings]);

  useEffect(() => {
    const t = THEMES[settings.colorTheme];
    const s = document.documentElement.style;

    s.setProperty("--accent", t.accent);
    s.setProperty("--mid", t.mid);
    s.setProperty("--glass-border", t.border);
    s.setProperty("--text-primary", t.text);
    s.setProperty("--glass-bg", `rgba(255,245,248,${settings.opacity})`);
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
    localStorage.removeItem(SETTINGS_KEY);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return {
    settings,
    setSetting,
    toggleAutostart,
    resetSettings,
  };
}
