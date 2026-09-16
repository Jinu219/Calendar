// ═══════════════════════════════════════════════════════════
// useBackup Hook — export / import all local data as a JSON file
// ═══════════════════════════════════════════════════════════

import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import { MEMOS_KEY, SETTINGS_KEY, TODOS_KEY } from "../constants";
import { loadJson } from "../utils";

const BACKUP_VERSION = 1;

interface BackupPayload {
  version: number;
  exportedAt: string;
  todos: unknown;
  settings: unknown;
  memos: unknown;
}

const isBackupPayload = (value: unknown): value is BackupPayload =>
  typeof value === "object" &&
  value !== null &&
  "todos" in value &&
  "settings" in value &&
  "memos" in value;

export function useBackup() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const exportData = useCallback(async () => {
    setIsExporting(true);

    try {
      const path = await save({
        title: "데이터 백업 내보내기",
        defaultPath: `cwa-backup-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });

      if (!path) return false;

      const payload: BackupPayload = {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        todos: loadJson(TODOS_KEY, []),
        settings: loadJson(SETTINGS_KEY, {}),
        memos: loadJson(MEMOS_KEY, []),
      };

      await invoke("write_text_file", {
        path,
        contents: JSON.stringify(payload, null, 2),
      });

      return true;
    } catch (error) {
      console.error("Failed to export backup:", error);
      return false;
    } finally {
      setIsExporting(false);
    }
  }, []);

  const importData = useCallback(async () => {
    setIsImporting(true);

    try {
      const selected = await open({
        title: "데이터 백업 가져오기",
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });

      const path = Array.isArray(selected) ? selected[0] : selected;
      if (!path) return false;

      const contents = await invoke<string>("read_text_file", { path });
      const parsed: unknown = JSON.parse(contents);

      if (!isBackupPayload(parsed)) {
        throw new Error("Invalid backup file format");
      }

      localStorage.setItem(TODOS_KEY, JSON.stringify(parsed.todos));
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed.settings));
      localStorage.setItem(MEMOS_KEY, JSON.stringify(parsed.memos));

      window.location.reload();
      return true;
    } catch (error) {
      console.error("Failed to import backup:", error);
      return false;
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
