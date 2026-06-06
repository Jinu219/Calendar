// ═══════════════════════════════════════════════════════════
// useSettings Hook
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import type { Settings } from "../types";
import { loadJson } from "../utils";
import { DEFAULT_SETTINGS, SETTINGS_KEY, THEMES, WEB_FONTS } from "../constants";
import { invoke } from "@tauri-apps/api/core";

type LegacySettings = Partial<Settings> & {
  alwaysOnTop?: boolean;
};

const loadSettings = (): Settings => {
  const saved = loadJson<LegacySettings>(SETTINGS_KEY, {});

  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    windowLevel: saved.windowLevel ?? (saved.alwaysOnTop ? "top" : DEFAULT_SETTINGS.windowLevel),
    editMode: saved.editMode ?? DEFAULT_SETTINGS.editMode,
    showOnTaskbar: saved.showOnTaskbar ?? DEFAULT_SETTINGS.showOnTaskbar,
  };
};

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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
    try {
      const next = !settings.autostart;

      if (next) {
        await invoke("plugin:autostart|enable");
      } else {
        await invoke("plugin:autostart|disable");
      }

      setSetting("autostart", next);
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