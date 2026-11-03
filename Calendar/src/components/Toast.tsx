// ═══════════════════════════════════════════════════════════
// Toast Component
// ═══════════════════════════════════════════════════════════

import React, { useEffect } from "react";
import type { ToastMessage } from "../types";

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

const DURATION_MS = 2400;
// Long enough to actually reach the "실행 취소" button.
const DURATION_WITH_ACTION_MS = 5000;

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(
      onDismiss,
      toast.onAction ? DURATION_WITH_ACTION_MS : DURATION_MS
    );
    return () => window.clearTimeout(timer);
    // Restart only for a new toast, not on every parent render.
  }, [toast?.id]);

  return (
    // The live region stays mounted so screen readers announce each new message.
    <div className="toast-container" role="status" aria-live="polite">
      {toast && (
        <div className="toast-bubble glass-panel" key={toast.id}>
          <span>{toast.message}</span>

          {toast.onAction && toast.actionLabel && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                toast.onAction?.();
                onDismiss();
              }}
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Toast;
