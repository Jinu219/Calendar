import { useCallback, useState } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { fitOnScreen } from "../utils";

const MEMO_WINDOW_LABEL = "memo";
const MEMO_WINDOW_WIDTH = 320;
const MEMO_WINDOW_HEIGHT = 360;
const WINDOW_GAP_LOGICAL = 12;
const OFFSET_TOP_LOGICAL = 72;

/** Right next to the main window, kept on the screen that window is on. */
const getMemoWindowPosition = async () => {
  const mainWindow = getCurrentWindow();
  const [position, size, scale] = await Promise.all([
    mainWindow.outerPosition(),
    mainWindow.outerSize(),
    mainWindow.scaleFactor(),
  ]);

  return fitOnScreen(
    position.x + size.width + WINDOW_GAP_LOGICAL * scale,
    position.y + OFFSET_TOP_LOGICAL * scale,
    MEMO_WINDOW_WIDTH,
    MEMO_WINDOW_HEIGHT
  );
};

export const useMemoWindow = () => {
  const [memoOpen, setMemoOpen] = useState(false);

  const showMemoWindow = useCallback(async (toggle: boolean) => {
    try {
      const existingWindow = await WebviewWindow.getByLabel(MEMO_WINDOW_LABEL);

      if (existingWindow) {
        if (await existingWindow.isVisible()) {
          if (toggle) {
            await existingWindow.hide();
            setMemoOpen(false);
          }
          return;
        }

        await existingWindow.setPosition(await getMemoWindowPosition());
        await existingWindow.show();
        setMemoOpen(true);
        return;
      }

      const position = await getMemoWindowPosition();
      // Created hidden, then placed in physical pixels: creation-time x/y are
      // logical and land wrong on a monitor with a different 배율.
      const memoWindow = new WebviewWindow(MEMO_WINDOW_LABEL, {
        url: "/?window=memo",
        title: "Calendar Memo",
        width: MEMO_WINDOW_WIDTH,
        height: MEMO_WINDOW_HEIGHT,
        decorations: false,
        transparent: true,
        resizable: false,
        skipTaskbar: true,
        alwaysOnTop: false,
        visible: false,
        shadow: false,
      });

      memoWindow.once("tauri://created", async () => {
        await memoWindow.setPosition(position).catch(console.error);
        await memoWindow.show().catch(console.error);
        setMemoOpen(true);
      });
      memoWindow.once("tauri://destroyed", () => {
        setMemoOpen(false);
      });
      memoWindow.once("tauri://error", error => {
        console.error("Failed to create memo window:", error);
        setMemoOpen(false);
      });
    } catch (error) {
      console.error("Failed to open memo window:", error);
      setMemoOpen(false);
    }
  }, []);

  const toggleMemoWindow = useCallback(() => void showMemoWindow(true), [showMemoWindow]);
  /** Bring the memo window up without toggling it closed (e.g. to show a linked memo). */
  const openMemoWindow = useCallback(() => void showMemoWindow(false), [showMemoWindow]);

  return { memoOpen, toggleMemoWindow, openMemoWindow };
};
