// ═══════════════════════════════════════════════════════════
// CategoryFilter — show/hide items by color (category)
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from "react";
import { COLOR_NAMES, TODO_COLORS } from "../constants";

interface CategoryFilterProps {
  colorLabels: Record<string, string>;
  hiddenColors: string[];
  onChange: (hiddenColors: string[]) => void;
}

/** The category name for a color: the user's label, else the color's name. */
export const categoryName = (color: string, labels: Record<string, string>): string =>
  labels[color] || COLOR_NAMES[color] || color;

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  colorLabels,
  hiddenColors,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  const toggle = (color: string) => {
    onChange(hiddenColors.includes(color)
      ? hiddenColors.filter(c => c !== color)
      : [...hiddenColors, color]);
  };

  const filtered = hiddenColors.length > 0;

  return (
    <div className="category-filter" ref={rootRef}>
      <button
        type="button"
        className={`settings-btn ${filtered ? "active" : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={filtered ? `카테고리 필터 (${hiddenColors.length}개 숨김)` : "카테고리 필터"}
        title={filtered ? `카테고리 ${hiddenColors.length}개 숨김` : "카테고리별 보기"}
        onClick={() => setOpen(prev => !prev)}
      >
        🏷
      </button>

      {open && (
        <div className="category-popover glass-panel" role="group" aria-label="보여 줄 카테고리">
          {TODO_COLORS.map(color => (
            <label key={color} className="category-option">
              <input
                type="checkbox"
                checked={!hiddenColors.includes(color)}
                onChange={() => toggle(color)}
              />
              <span className="category-dot" style={{ background: color }} aria-hidden="true" />
              {categoryName(color, colorLabels)}
            </label>
          ))}

          <div className="category-actions">
            <button type="button" className="modal-cancel" onClick={() => onChange([])}>모두 보기</button>
          </div>
          <p className="sg-hint">이름은 설정 → 카테고리에서 붙일 수 있어요.</p>
        </div>
      )}
    </div>
  );
};

export default CategoryFilter;
