import { useEffect, useMemo } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { WIN_POS_KEY } from "../constants";
import { loadJson } from "../utils";

export const useWindowPosition = (enabled: boolean) => {
  const appWin = useMemo(() => getCurrentWindow(), []);

  useEffect(() => {
    const saved = loadJson<{ x: number; y: number } | null>(WIN_POS_KEY, null);

    if (!saved) return;

    appWin
      .setPosition(new PhysicalPosition(saved.x, saved.y))
      .catch(console.error);
  }, [appWin]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const unlistenPromise = appWin.onMoved(({ payload }) => {
      if (!enabled) return;

      if (timer) {
        clearTimeout(timer);
      }

      timer = setTimeout(() => {
        localStorage.setItem(
          WIN_POS_KEY,
          JSON.stringify({
            x: payload.x,
            y: payload.y,
          })
        );
      }, 500);
    });

    return () => {
      if (timer) {
        clearTimeout(timer);
      }

      unlistenPromise.then(unlisten => unlisten()).catch(console.error);
    };
  }, [appWin, enabled]);
};