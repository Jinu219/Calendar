// ═══════════════════════════════════════════════════════════
// ModalShell — accessible dialog frame shared by every modal
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useId, useRef, useState } from "react";

interface ModalShellProps {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

const FOCUSABLE = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Escape closes, Tab stays inside the dialog, focus returns to whatever was
 * focused before it opened, and screen readers announce it as a dialog.
 */
export const ModalShell: React.FC<ModalShellProps> = ({
  title,
  onClose,
  children,
  className = "",
}) => {
  const titleId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  // Captured during the first render, before an autoFocus child steals focus.
  const [restoreFocusTo] = useState(() => document.activeElement as HTMLElement | null);

  useEffect(() => {
    const box = boxRef.current;

    if (box && !box.contains(document.activeElement)) {
      (box.querySelector<HTMLElement>(`.modal-body ${FOCUSABLE}`) ?? box).focus();
    }

    return () => {
      restoreFocusTo?.focus?.();
    };
  }, [restoreFocusTo]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }

    if (e.key !== "Tab" || !boxRef.current) return;

    const focusable = Array.from(boxRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="modal-overlay"
      // mousedown, not click: finishing a text drag outside the box shouldn't close it.
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={boxRef}
        className={`modal-box glass-panel ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="modal-hdr">
          <span id={titleId}>{title}</span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="닫기" title="닫기 (Esc)">
            ✕
          </button>
        </div>

        {children}
      </div>
    </div>
  );
};

export default ModalShell;
