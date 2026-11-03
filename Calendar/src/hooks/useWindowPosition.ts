import { useEffect, useMemo } from "react";
import { availableMonitors, getCurrentWindow } from "@tauri-apps/api/window";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { WIN_POS_KEY } from "../constants";
import { loadJson } from "../utils";

/** How much of the window must stay on some monitor for a saved position to be reused. */
const MIN_VISIBLE_PX = 120;

/**
 * Whether a window at (x, y) would still be grabbable on the current monitor
 * layout. A position saved on a monitor that has since been unplugged would
 * otherwise restore the widget somewhere off-screen, unreachable.
 */
const isOnSomeMonitor = async (x: number, y: number, width: number): Promise<boolean> => {
  try {
    const monitors = await availableMonitors();
    if (monitors.length === 0) return true;

    return monitors.some(({ position, size }) =>
      x + width - MIN_VISIBLE_PX > position.x &&
      x + MIN_VISIBLE_PX < position.x + size.width &&
      y >= position.y - 8 &&
      y + MIN_VISIBLE_PX < position.y + size.height
    );
  } catch {
    return true;
  }
};

export const useWindowPosition = () => {
  const appWin = useMemo(() => getCurrentWindow(), []);

  useEffect(() => {
    const saved = loadJson<{ x: number; y: number } | null>(WIN_POS_KEY, null);

    if (
      !saved ||
      !Number.isFinite(saved.x) ||
      !Number.isFinite(saved.y)
    ) return;

    const restore = async () => {
      const size = await appWin.outerSize().catch(() => null);

      if (!await isOnSomeMonitor(saved.x, saved.y, size?.width ?? MIN_VISIBLE_PX * 2)) {
        localStorage.removeItem(WIN_POS_KEY);
        return;
      }

      await appWin.setPosition(new PhysicalPosition(saved.x, saved.y));
    };

    restore().catch(console.error);
  }, [appWin]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    // The title bar can always be dragged, so every move is remembered.
    const unlistenPromise = appWin.onMoved(({ payload }) => {
      if (timer) {
        clearTimeout(timer);
      }

      timer = setTimeout(() => {
        try {
          localStorage.setItem(
            WIN_POS_KEY,
            JSON.stringify({ x: payload.x, y: payload.y })
          );
        } catch (error) {
          console.error("Failed to persist window position:", error);
        }
      }, 500);
    });

    return () => {
      if (timer) {
        clearTimeout(timer);
      }

      unlistenPromise.then(unlisten => unlisten()).catch(console.error);
    };
  }, [appWin]);
};
