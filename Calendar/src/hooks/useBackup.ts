// ═══════════════════════════════════════════════════════════
// useBackup Hook — export / import all local data as a JSON file
// ═══════════════════════════════════════════════════════════

import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import { FLASH_MESSAGE_KEY, MEMOS_KEY, SETTINGS_KEY, TODOS_KEY } from "../constants";
import { getLocalToday, loadJson } from "../utils";
import { normalizeTodos } from "./useTodos";
import { normalizeMemos } from "./useMemos";
import { normalizeSettings } from "./useSettings";

const BACKUP_VERSION = 1;

interface BackupPayload {
  version: number;
  exportedAt: string;
  todos: unknown;
  settings: unknown;
  memos: unknown;
}

/** Outcome shown to the user; `null` means the user cancelled the file dialog. */
export interface BackupResult {
  ok: boolean;
  message: string;
}

const isBackupPayload = (value: unknown): value is BackupPayload =>
  typeof value === "object" &&
  value !== null &&
  "todos" in value &&
  "settings" in value &&
  "memos" in value;

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export function useBackup() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const exportData = useCallback(async (): Promise<BackupResult | null> => {
    setIsExporting(true);

    try {
      const path = await save({
        title: "데이터 백업 내보내기",
        defaultPath: `calendar-backup-${getLocalToday()}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });

      if (!path) return null;

      const todos = loadJson<unknown[]>(TODOS_KEY, []);
      const payload: BackupPayload = {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        todos,
        settings: loadJson(SETTINGS_KEY, {}),
        memos: loadJson(MEMOS_KEY, []),
      };

      await invoke("write_text_file", {
        path,
        contents: JSON.stringify(payload, null, 2),
      });

      return { ok: true, message: `백업을 저장했어요 (일정 ${Array.isArray(todos) ? todos.length : 0}개)` };
    } catch (error) {
      console.error("Failed to export backup:", error);
      return { ok: false, message: `내보내기 실패: ${errorText(error)}` };
    } finally {
      setIsExporting(false);
    }
  }, []);

  const importData = useCallback(async (): Promise<BackupResult | null> => {
    setIsImporting(true);

    try {
      const selected = await open({
        title: "데이터 백업 가져오기",
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });

      const path = Array.isArray(selected) ? selected[0] : selected;
      if (!path) return null;

      const contents = await invoke<string>("read_text_file", { path });
      const parsed: unknown = JSON.parse(contents);

      if (!isBackupPayload(parsed) || !Array.isArray(parsed.todos)) {
        return { ok: false, message: "Calendar 백업 파일이 아니에요" };
      }

      // Write back normalized data so a hand-edited or older file can't break the app.
      const todos = normalizeTodos(parsed.todos);
      const settings = normalizeSettings(parsed.settings);

      localStorage.setItem(TODOS_KEY, JSON.stringify(todos));
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      localStorage.setItem(MEMOS_KEY, JSON.stringify(normalizeMemos(parsed.memos)));
      sessionStorage.setItem(FLASH_MESSAGE_KEY, `백업을 가져왔어요 (일정 ${todos.length}개)`);

      window.location.reload();
      return { ok: true, message: "백업을 가져왔어요" };
    } catch (error) {
      console.error("Failed to import backup:", error);
      return { ok: false, message: `가져오기 실패: ${errorText(error)}` };
    } finally {
      setIsImporting(false);
    }
  }, []);

  return {
    exportData,
    importData,
    isExporting,
    isImporting,
  };
}
