// ═══════════════════════════════════════════════════════════
// useAutoUpdate Hook — check GitHub releases for a newer build
// ═══════════════════════════════════════════════════════════

import { useCallback, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "up-to-date" }
  | { state: "available"; version: string }
  | { state: "installing" }
  | { state: "error"; message: string };

export function useAutoUpdate() {
  const [status, setStatus] = useState<UpdateStatus>({ state: "idle" });

  const checkForUpdate = useCallback(async () => {
    setStatus({ state: "checking" });

    try {
      const update = await check();

      if (!update?.available) {
        setStatus({ state: "up-to-date" });
        return;
      }

      setStatus({ state: "available", version: update.version });
    } catch (error) {
      console.error("Failed to check for update:", error);
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  const installUpdate = useCallback(async () => {
    setStatus({ state: "installing" });

    try {
      const update = await check();
      if (!update?.available) {
        setStatus({ state: "up-to-date" });
        return;
      }

      await update.downloadAndInstall();
      await relaunch();
    } catch (error) {
      console.error("Failed to install update:", error);
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  return { status, checkForUpdate, installUpdate };
}
