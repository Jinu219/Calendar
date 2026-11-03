// ═══════════════════════════════════════════════════════════
// SegmentedControl — a row of mutually exclusive toggle buttons
// ═══════════════════════════════════════════════════════════

import React from "react";

export interface SegmentOption<T> {
  value: T;
  label: React.ReactNode;
  title?: string;
}

interface SegmentedControlProps<T> {
  /** Announced to screen readers as the group's name. */
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Lay the options out as a 2-column grid instead of one row. */
  grid?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string | number | boolean>({
  label,
  options,
  value,
  onChange,
  grid = false,
  className = "",
}: SegmentedControlProps<T>) {
  return (
    <div
      className={`seg-ctrl ${grid ? "seg-2x2" : ""} ${className}`}
      role="group"
      aria-label={label}
    >
      {options.map(option => {
        const active = option.value === value;

        return (
          <button
            key={String(option.value)}
            type="button"
            className={`seg-btn ${active ? "active" : ""}`}
            aria-pressed={active}
            title={option.title}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
