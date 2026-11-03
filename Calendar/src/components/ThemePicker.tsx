// ═══════════════════════════════════════════════════════════
// ThemePicker — one button that opens every theme
// ═══════════════════════════════════════════════════════════

import React, { useRef, useState } from "react";
import type { ColorTheme } from "../types";
import { THEME_OPTIONS, THEMES } from "../constants";
import { useDismiss } from "../hooks/useDismiss";

interface ThemePickerProps {
  value: ColorTheme;
  onChange: (theme: ColorTheme) => void;
}

const swatch = (theme: ColorTheme): React.CSSProperties => ({
  background: `linear-gradient(135deg, ${THEMES[theme].mid}, ${THEMES[theme].accent})`,
});

export const ThemePicker: React.FC<ThemePickerProps> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = THEME_OPTIONS.find(option => option.key === value) ?? THEME_OPTIONS[0];

  useDismiss(rootRef, open, () => setOpen(false));

  return (
    <div className="theme-picker" ref={rootRef}>
      <button
        type="button"
        className="theme-current"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`화면 테마: ${current.label}`}
        onClick={() => setOpen(prev => !prev)}
      >
        <span className="theme-swatch" style={swatch(current.key)} aria-hidden="true" />
        {current.label}
        <span className="chevron" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="theme-popover glass-panel" role="group" aria-label="화면 테마 고르기">
          {THEME_OPTIONS.map(option => (
            <button
              key={option.key}
              type="button"
              className={`theme-choice ${option.key === value ? "active" : ""}`}
              aria-pressed={option.key === value}
              onClick={() => {
                onChange(option.key);
                setOpen(false);
              }}
            >
              <span className="theme-swatch large" style={swatch(option.key)} aria-hidden="true">
                {option.emoji}
              </span>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ThemePicker;
