// ═══════════════════════════════════════════════════════════
// Calendar MCP server — add items to the Calendar app from a Claude conversation
// ═══════════════════════════════════════════════════════════
//
// Build:    npm run build:mcp   → mcp/dist/calendar-mcp.mjs (bundles the shared TS)
// Register: claude mcp add calendar -s user -- node <repo>/Calendar/mcp/dist/calendar-mcp.mjs
//
// Speaks MCP (JSON-RPC 2.0, one message per line) over stdio; logs go to stderr.
// It never edits the app's data files. An addition becomes one JSON file in
// <app data>/inbox/, which the running app takes within seconds (or at its next
// start) and adds as a single undo step.

import { createInterface } from "node:readline";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

import { SERVER_INSTRUCTIONS, TOOLS, listEvents, prepareAdd } from "../src/mcp/calendarTools";
import { INBOX_VERSION } from "../src/utils/inboxUtils";
import { normalizeTodos } from "../src/utils/normalizeTodos";
import { getLocalToday } from "../src/utils/dateUtils";

const APP_ID = "com.calendar.app";
const SERVER_INFO = { name: "calendar", title: "Calendar", version: "1.0.0" };
const FALLBACK_PROTOCOL = "2025-06-18";
// How long an add waits to see the app take its request.
const PICKUP_WAIT_MS = 6000;
const PICKUP_POLL_MS = 200;

/** Same folder Tauri's app_data_dir() resolves to (CALENDAR_DATA_DIR overrides, for tests). */
const dataDir = () => {
  if (process.env.CALENDAR_DATA_DIR) return process.env.CALENDAR_DATA_DIR;
  if (process.platform === "win32") return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), APP_ID);
  if (process.platform === "darwin") return join(homedir(), "Library", "Application Support", APP_ID);
  return join(process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"), APP_ID);
};

const inboxDir = () => join(dataDir(), "inbox");

/** The `data` of a mirrored store file ({ savedAt, data }), or null. */
const readStore = name => {
  try {
    return JSON.parse(readFileSync(join(dataDir(), `${name}.json`), "utf8")).data ?? null;
  } catch {
    return null;
  }
};

const readSettings = () => {
  const settings = readStore("settings");
  const labels = settings?.colorLabels;

  return {
    colorLabels: labels && typeof labels === "object"
      ? Object.fromEntries(Object.entries(labels).filter(([, v]) => typeof v === "string"))
      : {},
    // Missing (older settings file) means on, like the app's default.
    acceptsInbox: settings?.assistantInbox !== false,
  };
};

/** Requests written earlier that the app hasn't taken yet. */
const pendingItems = () => {
  try {
    return readdirSync(inboxDir())
      .filter(name => name.endsWith(".json"))
      .flatMap(name => {
        try {
          const file = JSON.parse(readFileSync(join(inboxDir(), name), "utf8"));
          return Array.isArray(file.items) ? file.items : [];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const text = (value, isError = false) => ({ content: [{ type: "text", text: value }], isError });

async function addEvents(args) {
  const { colorLabels, acceptsInbox } = readSettings();
  if (!acceptsInbox) {
    return text("사용자가 캘린더 앱 설정 → 연동에서 '대화에서 일정 받기'를 꺼 두었어요. 켜 달라고 안내해 주세요.", true);
  }

  const prepared = prepareAdd(args ?? {}, colorLabels);
  if (!prepared.ok) return text(prepared.error, true);

  mkdirSync(inboxDir(), { recursive: true });
  const name = `${Date.now()}-${randomUUID().slice(0, 8)}.json`;
  const path = join(inboxDir(), name);
  const file = { version: INBOX_VERSION, createdAt: new Date().toISOString(), items: prepared.items };

  // Write then rename, so the app never reads a half-written request.
  writeFileSync(`${path}.tmp`, JSON.stringify(file));
  renameSync(`${path}.tmp`, path);

  let taken = false;
  for (let waited = 0; waited < PICKUP_WAIT_MS; waited += PICKUP_POLL_MS) {
    await sleep(PICKUP_POLL_MS);
    if (!existsSync(path)) {
      taken = true;
      break;
    }
  }

  const list = prepared.summary.map(line => `- ${line}`).join("\n");
  return text(taken
    ? `캘린더 앱에 추가했어요 (앱에서 실행 취소 가능):\n${list}`
    : `요청을 남겼어요. 앱이 꺼져 있는 것 같아서, 다음에 앱을 켜면 추가돼요:\n${list}`);
}

function listCalendar(args) {
  const { colorLabels } = readSettings();
  const result = listEvents({
    todos: normalizeTodos(readStore("todos")),
    args: args ?? {},
    today: getLocalToday(),
    pending: pendingItems(),
    colorLabels,
  });

  return text(result.text, result.isError);
}

async function callTool(name, args) {
  switch (name) {
    case "add_calendar_events":
      return addEvents(args);
    case "list_calendar_events":
      return listCalendar(args);
    default:
      return text(`알 수 없는 도구: ${name}`, true);
  }
}

const send = message => process.stdout.write(`${JSON.stringify(message)}\n`);

async function handle(message) {
  const { id, method, params } = message ?? {};
  const isRequest = id !== undefined && id !== null;
  const reply = result => isRequest && send({ jsonrpc: "2.0", id, result });

  try {
    switch (method) {
      case "initialize":
        return reply({
          protocolVersion: typeof params?.protocolVersion === "string" ? params.protocolVersion : FALLBACK_PROTOCOL,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: SERVER_INSTRUCTIONS,
        });
      case "ping":
        return reply({});
      case "tools/list":
        return reply({ tools: TOOLS });
      case "tools/call":
        return reply(await callTool(params?.name, params?.arguments));
      default:
        // Notifications (no id) need no answer.
        if (isRequest) send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
    }
  } catch (error) {
    console.error("[calendar-mcp]", error);
    if (isRequest) send({ jsonrpc: "2.0", id, error: { code: -32603, message: String(error?.message ?? error) } });
  }
}

createInterface({ input: process.stdin })
  .on("line", line => {
    if (!line.trim()) return;

    let message;
    try {
      message = JSON.parse(line);
    } catch {
      send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
      return;
    }

    void handle(message);
  })
  .on("close", () => process.exit(0));
