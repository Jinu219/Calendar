// ═══════════════════════════════════════════════════════════
// useRecurrenceScopePrompt Hook — "this date only, from here on, or the whole series?"
// ═══════════════════════════════════════════════════════════

import { useCallback, useState } from "react";
import type { RecurrenceScope, Todo } from "../types";

interface ScopePrompt {
  actionLabel: string;
  occurrenceDate: string;
  /** Offer "this and following" (only deleting supports it so far). */
  allowFollowing: boolean;
  onChoose: (scope: RecurrenceScope) => void;
  onCancel?: () => void;
}

/**
 * One place that decides whether an edit/delete/move needs the question:
 * one-off items act right away, recurring ones ask first.
 */
export function useRecurrenceScopePrompt() {
  const [prompt, setPrompt] = useState<ScopePrompt | null>(null);

  const withScope = useCallback((
    todo: Todo,
    occurrenceDate: string,
    actionLabel: string,
    action: (scope: RecurrenceScope) => void,
    onCancel?: () => void,
    allowFollowing = false
  ) => {
    if (todo.repeat === "none") {
      action("all");
      return;
    }

    setPrompt({ actionLabel, occurrenceDate, allowFollowing, onChoose: action, onCancel });
  }, []);

  const choose = useCallback((scope: RecurrenceScope) => {
    const current = prompt;
    setPrompt(null);
    current?.onChoose(scope);
  }, [prompt]);

  const cancel = useCallback(() => {
    prompt?.onCancel?.();
    setPrompt(null);
  }, [prompt]);

  return { prompt, withScope, choose, cancel };
}
