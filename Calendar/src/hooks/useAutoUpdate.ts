// ═══════════════════════════════════════════════════════════
// useAutoUpdate Hook — check GitHub releases for a newer build
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { LAST_UPDATE_CHECK_KEY } from "../constants";

export type UpdateStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "up-to-date" }
  | { state: "available"; version: string }
  | { state: "installing" }
  | { state: "error"; message: string };

const DAY_MS = 24 * 60 * 60 * 1000;
// Don't compete with startup work (hydration, holiday loading).
const STARTUP_DELAY_MS = 15_000;

interface UseAutoUpdateOptions {
  /** Check quietly once a day in the background. */
  autoCheck: boolean;
  /** Called when the background check finds a newer version. */
  onAvailable: (version: string) => void;
}

export function useAutoUpdate({ autoCheck, onAvailable }: UseAutoUpdateOptions) {
  const [status, setStatus] = useState<UpdateStatus>({ state: "idle" });
  const onAvailableRef = useRef(onAvailable);
  onAvailableRef.current = onAvailable;

  const checkForUpdate = useCallback(async (silent = false): Promise<string | null> => {
    if (!silent) setStatus({ state: "checking" });

    try {
      const update = await check();
      localStorage.setItem(LAST_UPDATE_CHECK_KEY, String(Date.now()));

      if (!update?.available) {
        if (!silent) setStatus({ state: "up-to-date" });
        return null;
      }

      setStatus({ state: "available", version: update.version });
      return update.version;
    } catch (error) {
      console.error("Failed to check for update:", error);
      if (!silent) {
        setStatus({
          state: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
      return null;
    }
  }, []);

  useEffect(() => {
    if (!autoCheck) return;

    const lastCheck = Number(localStorage.getItem(LAST_UPDATE_CHECK_KEY) ?? 0);
    if (Date.now() - lastCheck < DAY_MS) return;

    const timer = window.setTimeout(async () => {
      const version = await checkForUpdate(true);
      if (version) onAvailableRef.current(version);
    }, STARTUP_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [autoCheck, checkForUpdate]);

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

  return { status, checkForUpdate: () => void checkForUpdate(false), installUpdate };
}
