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
  /** Category names given to colors; shown instead of the plain color name. */
  colorLabels?: Record<string, string>;
}

export const ColorSwatches: React.FC<ColorSwatchesProps> = ({
  colors,
  value,
  onChange,
  label = "색상",
  colorLabels,
}) => {
  const nameOf = (color: string) => colorLabels?.[color] || COLOR_NAMES[color] || color;

  return (
    <div className="color-row-setting" role="radiogroup" aria-label={label}>
      {colors.map(color => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={nameOf(color)}
          title={nameOf(color)}
          className={`color-dot-setting ${value === color ? "selected" : ""}`}
          style={{ background: color }}
          onClick={() => onChange(color)}
        />
      ))}

      {colorLabels?.[value] && <span className="color-caption">{colorLabels[value]}</span>}
    </div>
  );
};

export default ColorSwatches;
