// ═══════════════════════════════════════════════════════════
// useAutoBackup Hook — one rotating backup per day in the app data folder
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { buildBackupPayload, errorText, type BackupResult } from "./useBackup";

const LAST_AUTO_BACKUP_KEY = "cwa:last-auto-backup";
// Let startup (hydration, first renders) settle before touching the disk.
const STARTUP_DELAY_MS = 5000;

const readLastBackup = (): string | null => {
  try {
    return localStorage.getItem(LAST_AUTO_BACKUP_KEY);
  } catch {
    return null;
  }
};

/**
 * Writes `calendar-backup-YYYY-MM-DD.json` once a day (the Rust side keeps the
 * newest 7). `today` comes from useToday, so a widget left open overnight
 * backs up again after midnight.
 */
export function useAutoBackup(enabled: boolean, today: string) {
  const [lastBackup, setLastBackup] = useState<string | null>(readLastBackup);

  const backupNow = useCallback(async (): Promise<BackupResult> => {
    try {
      await invoke("write_auto_backup", {
        date: today,
        contents: JSON.stringify(buildBackupPayload(), null, 2),
      });
      localStorage.setItem(LAST_AUTO_BACKUP_KEY, today);
      setLastBackup(today);
      return { ok: true, message: "백업 폴더에 오늘 백업을 저장했어요" };
    } catch (error) {
      console.error("Automatic backup failed:", error);
      return { ok: false, message: `자동 백업 실패: ${errorText(error)}` };
    }
  }, [today]);

  useEffect(() => {
    if (!enabled || lastBackup === today) return;

    const timer = window.setTimeout(() => void backupNow(), STARTUP_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [enabled, today, lastBackup, backupNow]);

  const openBackupFolder = useCallback(async (): Promise<BackupResult | null> => {
    try {
      await invoke("open_backup_dir");
      return null;
    } catch (error) {
      return { ok: false, message: `백업 폴더를 열지 못했어요: ${errorText(error)}` };
    }
  }, []);

  return { lastBackup, backupNow, openBackupFolder };
}
