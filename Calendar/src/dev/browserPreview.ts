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

// Kept for the tab session so a reload doesn't forget the pretend key.
let previewHasKey = sessionStorage.getItem("preview:claude-key") === "1";

/** A believable Messages API response for whichever Claude feature asked. */
const fakeClaudeReply = (rawBody: string) => {
  const body = JSON.parse(rawBody) as {
    messages: { content: string }[];
    output_config?: { format?: { schema?: { properties?: Record<string, unknown> } } };
  };
  const user = body.messages[0]?.content ?? "";
  const properties = body.output_config?.format?.schema?.properties ?? {};
  const selected = /선택한 날짜: (\S+)/.exec(user)?.[1] ?? "2026-11-03";
  const input = /입력: (.*)$/m.exec(user)?.[1] ?? "";

  const text = "steps" in properties
    ? JSON.stringify({ steps: ["자료 모으기", "개요 짜기", "초안 쓰기", "검토 부탁하기"] })
    : "title" in properties
      ? JSON.stringify({
          title: input.replace(/다음 주|화요일|\d+시|매주|30분 전 알림/g, "").trim() || "새 일정",
          kind: "schedule",
          startDate: selected,
          endDate: selected,
          allDay: false,
          startTime: "15:00",
          endTime: "16:00",
          repeat: /매주/.test(input) ? "weekly" : "none",
          repeatInterval: 1,
          repeatDays: [2],
          monthlyMode: "date",
          repeatEndDate: null,
          reminderMinutes: /알림/.test(input) ? 30 : null,
        })
      : "오늘은 오후 일정 두 개가 있는 보통 하루예요.\n• 16:00 스터디\n• 보고서 마감이 오늘이에요\n• 수요일 17:00 회의가 매주 있어요\n• 오전에 보고서를 먼저 끝내 보세요";

  return {
    status: 200,
    body: JSON.stringify({
      model: "claude-opus-5-5",
      stop_reason: "end_turn",
      content: [{ type: "thinking", thinking: "" }, { type: "text", text }],
      usage: { input_tokens: 620, output_tokens: 180 },
    }),
  };
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
      // Claude: canned replies (no network, no key) so the AI UI can be exercised.
      case "has_claude_api_key":
        return previewHasKey;
      case "set_claude_api_key": {
        const key = String((args as { key?: string } | undefined)?.key ?? "");
        if (!key.startsWith("sk-ant-")) throw "Claude API 키는 sk-ant- 로 시작해요. 다시 확인해 주세요.";
        previewHasKey = true;
        sessionStorage.setItem("preview:claude-key", "1");
        return null;
      }
      case "delete_claude_api_key":
        previewHasKey = false;
        sessionStorage.removeItem("preview:claude-key");
        return null;
      case "claude_messages":
        return fakeClaudeReply(String((args as { body?: string } | undefined)?.body ?? "{}"));
      default:
        return null;
    }
  }, { shouldMockEvents: true });

  console.info("[browser preview] Tauri APIs are mocked; native features are inactive.");
}
