// ═══════════════════════════════════════════════════════════
// Browser preview (dev only)
// ═══════════════════════════════════════════════════════════
//
// `npm run dev` opened in a normal browser has no Tauri runtime, and the first
// getCurrentWindow() call would crash the page. This answers the native calls
// with harmless defaults so the UI can be laid out and checked in any browser.
// It is only ever loaded by main.tsx in development outside Tauri.

import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { parseScheduleText } from "../utils/scheduleParser";

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

/** A generateContent reply built from the rule parser, so ✨ can be exercised offline. */
const fakeGeminiReply = (rawBody: string) => {
  const prompt = (JSON.parse(rawBody) as { contents: { parts: { text: string }[] }[] }).contents[0].parts[0].text;
  const field = (name: string) => new RegExp(`^${name}: (\\S+)`, "m").exec(prompt)?.[1] ?? "";
  const sentence = /^문장: (.*)$/m.exec(prompt)?.[1] ?? "";
  const { event } = parseScheduleText(sentence, {
    today: field("오늘"),
    selectedDate: field("선택한 날짜"),
    defaultKind: field("기본 종류") === "todo" ? "todo" : "schedule",
  });

  return {
    status: 200,
    body: JSON.stringify({
      candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ events: [event] }) }] } }],
    }),
  };
};

let fakeNotionPages = 0;

const fakeNotionReply = ({ method, path }: { method: string; path: string; body: string | null }) => {
  const ok = (body: unknown) => ({ status: 200, body: JSON.stringify(body), retry_after: null });

  if (method === "GET" && path.startsWith("/v1/databases/")) {
    return ok({ object: "database", title: [{ plain_text: "📅 일정 (미리보기)" }], data_sources: [{ id: "preview-source", name: "일정" }] });
  }
  if (method === "GET" && path.startsWith("/v1/data_sources/")) {
    return ok({ object: "data_source", properties: { 이름: { type: "title" } } });
  }
  if (method === "POST" && path === "/v1/pages") {
    fakeNotionPages += 1;
    return ok({ object: "page", id: `preview-page-${fakeNotionPages}` });
  }
  return ok({ object: method === "PATCH" && path.startsWith("/v1/pages/") ? "page" : "data_source" });
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
      // Claude conversation inbox: sessionStorage "preview:inbox" (an InboxFile
      // JSON) is handed over once, to exercise the receiving UI.
      case "take_inbox": {
        const pending = sessionStorage.getItem("preview:inbox");
        sessionStorage.removeItem("preview:inbox");
        return pending ? [pending] : [];
      }
      // Gemini: replies from the rule parser (no network, no key).
      case "has_gemini_api_key":
        return sessionStorage.getItem("preview:gemini-key") === "1";
      case "set_gemini_api_key": {
        const key = String((args as { key?: string } | undefined)?.key ?? "");
        if (key.length < 30) throw "Gemini API 키 형식이 아니에요. AI Studio에서 복사한 키(AIza…)를 붙여 넣어 주세요.";
        sessionStorage.setItem("preview:gemini-key", "1");
        return null;
      }
      case "delete_gemini_api_key":
        sessionStorage.removeItem("preview:gemini-key");
        return null;
      case "gemini_generate":
        return fakeGeminiReply(String((args as { body?: string } | undefined)?.body ?? "{}"));
      // Notion: an in-memory database so the export UI can be exercised.
      case "has_notion_token":
        return sessionStorage.getItem("preview:notion-token") === "1";
      case "set_notion_token": {
        const token = String((args as { token?: string } | undefined)?.token ?? "");
        if (!/^(ntn_|secret_)/.test(token)) throw "Notion 통합 토큰은 ntn_ (또는 secret_)으로 시작해요. 다시 확인해 주세요.";
        sessionStorage.setItem("preview:notion-token", "1");
        return null;
      }
      case "delete_notion_token":
        sessionStorage.removeItem("preview:notion-token");
        return null;
      case "notion_request":
        return fakeNotionReply(args as { method: string; path: string; body: string | null });
      default:
        return null;
    }
  }, { shouldMockEvents: true });

  console.info("[browser preview] Tauri APIs are mocked; native features are inactive.");
}
