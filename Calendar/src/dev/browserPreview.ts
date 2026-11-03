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

const DEMO_ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:demo-class",
  "SUMMARY:대기역학 수업 (구독)",
  "DTSTART:20261102T100000",
  "DTEND:20261102T113000",
  "RRULE:FREQ=WEEKLY;BYDAY=MO,TH",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:demo-festival",
  "SUMMARY:대동제",
  "DTSTART;VALUE=DATE:20261111",
  "DTEND;VALUE=DATE:20261114",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

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
      // No disk in the browser: localStorage alone is the store.
      case "read_store":
        return {};
      case "write_auto_backup":
        return "(browser preview) backup skipped";
      case "list_auto_backups":
        return [];
      case "get_backup_dir":
        return null;
      case "get_global_shortcut":
        return "Win+Alt+C";
      case "set_tray_tooltip":
        return true;
      // Any subscription URL gets a small demo calendar, to exercise the feed UI.
      case "fetch_calendar_feed":
        return DEMO_ICS;
      default:
        return null;
    }
  }, { shouldMockEvents: true });

  console.info("[browser preview] Tauri APIs are mocked; native features are inactive.");
}
