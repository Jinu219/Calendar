// ═══════════════════════════════════════════════════════════
// ColorSwatches — color picker announced as a radio group
// ═══════════════════════════════════════════════════════════

import React from "react";
import { COLOR_NAMES } from "../constants";

interface ColorSwatchesProps {
  colors: readonly string[];
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

export const ColorSwatches: React.FC<ColorSwatchesProps> = ({
  colors,
  value,
  onChange,
  label = "색상",
}) => (
  <div className="color-row-setting" role="radiogroup" aria-label={label}>
    {colors.map(color => {
      const name = COLOR_NAMES[color] ?? color;

      return (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={name}
          title={name}
          className={`color-dot-setting ${value === color ? "selected" : ""}`}
          style={{ background: color }}
          onClick={() => onChange(color)}
        />
      );
    })}
  </div>
);

export default ColorSwatches;
