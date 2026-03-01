// ═══════════════════════════════════════════════════════════
// useSettings Hook
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import type { Settings, ColorTheme, DayNumPos, TodayStyle } from "../types";
import { loadJson } from "../utils";
import { DEFAULT_SETTINGS, SETTINGS_KEY, THEMES, WEB_FONTS } from "../constants";
import { invoke } from "@tauri-apps/api/core";

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => ({
    ...DEFAULT_SETTINGS,
    ...loadJson<Partial<Settings>>(SETTINGS_KEY, {}),
  }));

  // Persist settings
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  // Apply theme
  useEffect(() => {
    const t = THEMES[settings.colorTheme];
    const s = document.documentElement.style;
    s.setProperty("--accent", t.accent);
    s.setProperty("--mid", t.mid);
    s.setProperty("--glass-border", t.border);
    s.setProperty("--text-primary", t.text);
    s.setProperty("--glass-bg", `rgba(255,245,248,${settings.opacity})`);
  }, [settings.colorTheme, settings.opacity]);

  // Apply font
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

  // Apply day-num position
  useEffect(() => {
    const m: Record<DayNumPos, string> = { 
      left: "flex-start", 
      right: "flex-end" 
    };
    document.documentElement.style.setProperty("--day-num-justify", m[settings.dayNumberPos]);
  }, [settings.dayNumberPos]);

  // Apply show overflow
  useEffect(() => {
    // This will be handled by the Calendar component
  }, [settings.showOverflow]);

  const setSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggleAutostart = useCallback(async () => {
    try {
      const next = !settings.autostart;
      const result: boolean = await invoke(
        next ? "plugin:autostart|enable" : "plugin:autostart|disable"
      );
      setSetting("autostart", result ?? next);
    } catch {
      setSetting("autostart", !settings.autostart);
    }
  }, [settings.autostart, setSetting]);

  const resetSettings = useCallback(() => {
    localStorage.removeItem(SETTINGS_KEY);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return {
    settings,
    setSettings,
    setSetting,
    toggleAutostart,
    resetSettings,
  };
}
