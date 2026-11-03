// ═══════════════════════════════════════════════════════════
// useToast Hook — one short-lived message, optionally with an action
// ═══════════════════════════════════════════════════════════

import { useCallback, useRef, useState } from "react";
import type { ToastMessage } from "../types";

export interface ToastAction {
  label: string;
  onAction: () => void;
}

export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, action?: ToastAction) => {
    nextId.current += 1;
    setToast({
      id: nextId.current,
      message,
      actionLabel: action?.label,
      onAction: action?.onAction,
    });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  return { toast, showToast, dismissToast };
}
