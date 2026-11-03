// ═══════════════════════════════════════════════════════════
// useSelection Hook — the calendar occurrences currently selected
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import type { OccurrenceRef, Todo } from "../types";
import { doesOccurrenceStartOn } from "../utils";

const sameRef = (a: OccurrenceRef, b: OccurrenceRef) =>
  a.todoId === b.todoId && a.occurrenceDate === b.occurrenceDate;

export function useSelection(todos: Todo[]) {
  const [selection, setSelection] = useState<OccurrenceRef[]>([]);

  // Drop selections whose occurrence no longer exists (deleted, moved, undone).
  useEffect(() => {
    setSelection(prev => {
      const next = prev.filter(ref => {
        const todo = todos.find(t => t.id === ref.todoId);
        return todo !== undefined && doesOccurrenceStartOn(todo, ref.occurrenceDate);
      });
      return next.length === prev.length ? prev : next;
    });
  }, [todos]);

  /** Select one occurrence; with `additive` (Shift/Ctrl) toggle it within the selection. */
  const select = useCallback((ref: OccurrenceRef, additive = false) => {
    setSelection(prev => {
      if (!additive) return [ref];
      return prev.some(r => sameRef(r, ref)) ? prev.filter(r => !sameRef(r, ref)) : [...prev, ref];
    });
  }, []);

  const clearSelection = useCallback(() => setSelection([]), []);

  return { selection, select, setSelection, clearSelection };
}
