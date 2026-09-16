// ═══════════════════════════════════════════════════════════
// Toast Component
// ═══════════════════════════════════════════════════════════

import React, { useEffect } from "react";

interface ToastProps {
  message: string | null;
  onDismiss: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, onDismiss, duration = 2200 }) => {
  useEffect(() => {
    if (!message) return;

    const timer = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(timer);
  }, [message, duration, onDismiss]);

  if (!message) return null;

  return (
    <div className="toast-container">
      <div className="toast-bubble glass-panel">{message}</div>
    </div>
  );
};

export default Toast;
