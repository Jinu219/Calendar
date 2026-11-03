// ═══════════════════════════════════════════════════════════
// Browser preview (dev only)
// ═══════════════════════════════════════════════════════════
//
// `npm run dev` opened in a normal browser has no Tauri runtime, and the first
// getCurrentWindow() call would crash the page. This answers the native calls
// with harmless defaults so the UI can be laid out and checked in any browser.
// It is only ever loaded by main.tsx in development outside Tauri.

import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";

const MONITOR = {
  name: "Browser",
  position: { x: 0, y: 0 },
  size: { width: 1920, height: 1080 },
  workArea: { position: { x: 0, y: 0 }, size: { width: 1920, height: 1040 } },
  scaleFactor: 1,
};

export function installBrowserPreviewMocks() {
  const label = new URLSearchParams(window.location.search).get("window") === "memo"
    ? "memo"
    : "main";

  mockWindows(label);

  mockIPC((cmd, args) => {
    switch (cmd) {
      case "get_autostart_status":
        return false;
      case "set_autostart_status":
        return (args as { enabled?: boolean } | undefined)?.enabled ?? false;
      case "set_window_level":
      case "set_show_on_taskbar":
        return true;
      case "plugin:window|outer_position":
        return { x: 0, y: 0 };
      case "plugin:window|outer_size":
        return { width: window.innerWidth, height: window.innerHeight };
      case "plugin:window|available_monitors":
        return [MONITOR];
      case "plugin:window|get_all_windows":
        return [label];
      case "plugin:notification|is_permission_granted":
        return false;
      case "plugin:notification|request_permission":
        return "denied";
      default:
        return null;
    }
  }, { shouldMockEvents: true });

  console.info("[browser preview] Tauri APIs are mocked; native features are inactive.");
}
