// ═══════════════════════════════════════════════════════════
// Persistence — localStorage with a file mirror on disk
// ═══════════════════════════════════════════════════════════
//
// The app reads its data synchronously from localStorage, but WebView storage
// can be wiped (WebView2 reset, reinstall, changed app id). Every important key
// is therefore also written to a JSON file in the app data folder, and on
// startup whichever copy is newer wins.

import { invoke } from "@tauri-apps/api/core";
import { MEMOS_KEY, SETTINGS_KEY, TODOS_KEY } from "../constants";

/** localStorage key → file name (without .json) in the app data folder. */
const STORE_FILES: Record<string, string> = {
  [TODOS_KEY]: "todos",
  [SETTINGS_KEY]: "settings",
  [MEMOS_KEY]: "memos",
};

const SAVED_AT_PREFIX = "cwa:saved-at:";
// Typing in a memo saves on every keystroke; the disk only needs the result.
const DISK_WRITE_DELAY_MS = 300;

interface StoreFile {
  savedAt: number;
  data: unknown;
}

const pendingWrites = new Map<string, { timer: number; flush: () => void }>();

const writeFile = (key: string, json: string, savedAt: number) => {
  const name = STORE_FILES[key];
  if (!name) return;

  invoke("write_store", { name, contents: `{"savedAt":${savedAt},"data":${json}}` })
    .catch(error => console.error(`Failed to save ${name} to disk:`, error));
};

const parseStoreFile = (contents: string | undefined): StoreFile | null => {
  if (!contents) return null;

  try {
    const parsed = JSON.parse(contents) as Partial<StoreFile>;
    return typeof parsed.savedAt === "number" && "data" in parsed
      ? { savedAt: parsed.savedAt, data: parsed.data }
      : null;
  } catch {
    return null;
  }
};

/** Save a JSON string under `key`; important keys are mirrored to disk. */
export const persistItem = (key: string, json: string): void => {
  localStorage.setItem(key, json);
  if (!STORE_FILES[key]) return;

  const savedAt = Date.now();
  localStorage.setItem(SAVED_AT_PREFIX + key, String(savedAt));

  const pending = pendingWrites.get(key);
  if (pending) window.clearTimeout(pending.timer);

  const flush = () => {
    pendingWrites.delete(key);
    writeFile(key, json, savedAt);
  };

  pendingWrites.set(key, { timer: window.setTimeout(flush, DISK_WRITE_DELAY_MS), flush });
};

/** Write anything still waiting for its delay (window closing, reload). */
export const flushPendingWrites = (): void => {
  for (const { timer, flush } of [...pendingWrites.values()]) {
    window.clearTimeout(timer);
    flush();
  }
};

/**
 * Reconcile localStorage with the files before the app reads anything:
 * a newer (or the only) file restores localStorage; newer localStorage — the
 * first run, or a write that never reached the disk — is copied to the file.
 */
export async function hydrateFromDisk(): Promise<void> {
  let files: Record<string, string> | null = null;

  try {
    files = await invoke<Record<string, string> | null>("read_store");
  } catch (error) {
    console.error("Failed to read data files:", error);
  }

  if (!files || typeof files !== "object") return;

  for (const [key, name] of Object.entries(STORE_FILES)) {
    const local = localStorage.getItem(key);
    const localSavedAt = Number(localStorage.getItem(SAVED_AT_PREFIX + key) ?? 0);
    const disk = parseStoreFile(files[name]);

    if (disk && disk.savedAt >= localSavedAt) {
      localStorage.setItem(key, JSON.stringify(disk.data));
      localStorage.setItem(SAVED_AT_PREFIX + key, String(disk.savedAt));
    } else if (local !== null) {
      const savedAt = localSavedAt || Date.now();
      localStorage.setItem(SAVED_AT_PREFIX + key, String(savedAt));
      writeFile(key, local, savedAt);
    }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushPendingWrites);
}
