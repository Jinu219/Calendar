import { useEffect } from "react";

/** Text fields keep the cut/copy/paste menu. */
const EDITABLE = "textarea, [contenteditable=''], [contenteditable='true'], input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color])";

/**
 * Hide what gives away the WebView: the browser's right-click menu (새로고침,
 * 다른 이름으로 저장…) always, and reload/print/save/devtools keys in builds
 * (development keeps them for debugging).
 */
export function usePreventBrowserBehaviors() {
  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      if (!(event.target as Element | null)?.closest?.(EDITABLE)) event.preventDefault();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isBrowserKey =
        event.key === "F12" ||
        event.key === "F5" ||
        (event.ctrlKey && event.shiftKey && (key === "i" || key === "j" || key === "c")) ||
        (event.ctrlKey && !event.shiftKey && (key === "u" || key === "r" || key === "p" || key === "s"));

      if (isBrowserKey) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("contextmenu", handleContextMenu, true);
    if (!import.meta.env.DEV) window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu, true);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);
}
