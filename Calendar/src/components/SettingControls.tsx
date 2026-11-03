// ═══════════════════════════════════════════════════════════
// Settings building blocks — one compact row per setting
// ═══════════════════════════════════════════════════════════

import React, { useId } from "react";

/** A titled card of rows; the title is the group's accessible name. */
export const SettingGroup: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => {
  const id = useId();

  return (
    <section className="set-group" aria-labelledby={title ? id : undefined}>
      {title && <h3 className="set-group-title" id={id}>{title}</h3>}
      <div className="set-card">{children}</div>
    </section>
  );
};

/** Label on the left, control on the right. */
export const SettingRow: React.FC<{
  label: React.ReactNode;
  children: React.ReactNode;
  /** Put the control under the label instead (lists, long inputs). */
  stacked?: boolean;
}> = ({ label, children, stacked = false }) => (
  <div className={`set-row ${stacked ? "stacked" : ""}`}>
    <span className="set-label">{label}</span>
    <div className="set-control">{children}</div>
  </div>
);

export const Switch: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}> = ({ label, checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    className={`switch ${checked ? "on" : ""}`}
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
  >
    <span className="switch-knob" aria-hidden="true" />
  </button>
);

/** A switch row: the whole row's label names the switch. */
export const SwitchRow: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <SettingRow label={label}>
    <Switch label={label} checked={checked} onChange={onChange} />
  </SettingRow>
);

export function SelectRow<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <SettingRow label={label}>
      <select
        className="set-select"
        aria-label={label}
        value={String(value)}
        onChange={e => {
          const picked = options.find(option => String(option.value) === e.target.value);
          if (picked) onChange(picked.value);
        }}
      >
        {options.map(option => (
          <option key={String(option.value)} value={String(option.value)}>{option.label}</option>
        ))}
      </select>
    </SettingRow>
  );
}

export const SliderRow: React.FC<{
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  /** Shown next to the slider and read out by screen readers. */
  format: (value: number) => string;
  onChange: (value: number) => void;
}> = ({ label, min, max, step, value, format, onChange }) => (
  <SettingRow label={label}>
    <input
      className="set-slider"
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={label}
      aria-valuetext={format(value)}
      onChange={e => onChange(Number(e.target.value))}
    />
    <span className="set-value">{format(value)}</span>
  </SettingRow>
);
