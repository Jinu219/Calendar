import { useEffect, useRef } from "react";
import type { CalendarViewType } from "../types";

export interface CalendarShortcutHandlers {
  hasSelection: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: CalendarViewType) => void;
  onNewItem: () => void;
  onFocusQuickAdd: () => void;
  onToggleSelected: () => void;
  onEditSelected: () => void;
  onDeleteSelected: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onEscape: () => void;
  onShowHelp: () => void;
  onOpenSearch: () => void;
  onOpenStats: () => void;
}

const VIEW_BY_DIGIT: Record<string, CalendarViewType> = {
  Digit1: "dayGridMonth",
  Digit2: "timeGridWeek",
  Digit3: "timeline",
  Numpad1: "dayGridMonth",
  Numpad2: "timeGridWeek",
  Numpad3: "timeline",
};

const isTextEntry = (el: HTMLElement | null): boolean =>
  !!el && (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  );

/**
 * App-wide keyboard shortcuts (see KEYBOARD_SHORTCUTS for the user-facing list).
 * Letter keys are matched by `event.code` so they also work while the Korean
 * IME is in 한글 mode. Open dialogs handle their own keys.
 */
export const useCalendarKeyboardShortcuts = (handlers: CalendarShortcutHandlers) => {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      if (document.querySelector('[aria-modal="true"]')) return;

      const h = handlersRef.current;
      const target = e.target instanceof HTMLElement ? e.target : null;
      const typing = isTextEntry(target);

      if (e.key === "Escape") {
        if (typing) target?.blur();
        h.onEscape();
        return;
      }

      if (typing) return;

      if (e.ctrlKey || e.metaKey) {
        switch (e.code) {
          case "KeyZ":
            e.preventDefault();
            if (e.shiftKey) h.onRedo();
            else h.onUndo();
            return;
          case "KeyY":
            e.preventDefault();
            h.onRedo();
            return;
          case "KeyC":
            if (h.hasSelection) h.onCopy();
            return;
          case "KeyV":
            e.preventDefault();
            h.onPaste();
            return;
          case "KeyF":
            e.preventDefault();
            h.onOpenSearch();
            return;
          default:
            return;
        }
      }

      if (e.altKey) return;

      // "?" is Shift+/ on most layouts, but not all report it as e.key "?".
      if (e.key === "F1" || (e.code === "Slash" && e.shiftKey)) {
        e.preventDefault();
        h.onShowHelp();
        return;
      }

      // Enter/Space already activate a focused button; don't double up.
      const onControl = !!target?.closest("button, a, [role='button']");

      switch (e.key) {
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          h.onPrevious();
          return;
        case "ArrowRight":
        case "PageDown":
          e.preventDefault();
          h.onNext();
          return;
        case "Delete":
        case "Backspace":
          if (h.hasSelection) {
            e.preventDefault();
            h.onDeleteSelected();
          }
          return;
        case "Enter":
        case " ":
          if (h.hasSelection && !onControl) {
            e.preventDefault();
            h.onToggleSelected();
          }
          return;
        case "F2":
          if (h.hasSelection) {
            e.preventDefault();
            h.onEditSelected();
          }
          return;
        case "?":
          e.preventDefault();
          h.onShowHelp();
          return;
        case "/":
          e.preventDefault();
          h.onFocusQuickAdd();
          return;
      }

      if (e.shiftKey) return;

      const view = VIEW_BY_DIGIT[e.code];
      if (view) {
        e.preventDefault();
        h.onViewChange(view);
        return;
      }

      switch (e.code) {
        case "KeyT":
          e.preventDefault();
          h.onToday();
          return;
        case "KeyN":
          e.preventDefault();
          h.onNewItem();
          return;
        case "KeyS":
          e.preventDefault();
          h.onOpenStats();
          return;
        case "KeyE":
          if (h.hasSelection) {
            e.preventDefault();
            h.onEditSelected();
          }
          return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
};
