import { useCallback, useState } from "react";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";

const MEMO_WINDOW_LABEL = "memo";
const MEMO_WINDOW_WIDTH = 320;
const MEMO_WINDOW_HEIGHT = 360;
const WINDOW_MARGIN = 8;
const WINDOW_GAP = 12;

const getMemoWindowPosition = async (): Promise<PhysicalPosition> => {
  const mainWindow = getCurrentWindow();
  const [position, size] = await Promise.all([
    mainWindow.outerPosition(),
    mainWindow.outerSize(),
  ]);
  const wantedX = position.x + size.width + WINDOW_GAP;
  const wantedY = position.y + 72;
  const maxX = window.screen.availWidth - MEMO_WINDOW_WIDTH - WINDOW_MARGIN;
  const maxY = window.screen.availHeight - MEMO_WINDOW_HEIGHT - WINDOW_MARGIN;

  return new PhysicalPosition(
    Math.min(Math.max(WINDOW_MARGIN, wantedX), maxX),
    Math.min(Math.max(WINDOW_MARGIN, wantedY), maxY)
  );
};

export const useMemoWindow = () => {
  const [memoOpen, setMemoOpen] = useState(false);

  const toggleMemoWindow = useCallback(async () => {
    try {
      const existingWindow = await WebviewWindow.getByLabel(MEMO_WINDOW_LABEL);

      if (existingWindow) {
        if (await existingWindow.isVisible()) {
          await existingWindow.hide();
          setMemoOpen(false);
          return;
        }

        await existingWindow.setPosition(await getMemoWindowPosition());
        await existingWindow.show();
        setMemoOpen(true);
        return;
      }

      const position = await getMemoWindowPosition();
      const memoWindow = new WebviewWindow(MEMO_WINDOW_LABEL, {
        url: "/?window=memo",
        title: "CWA Memo",
        width: MEMO_WINDOW_WIDTH,
        height: MEMO_WINDOW_HEIGHT,
        x: position.x,
        y: position.y,
        decorations: false,
        transparent: true,
        resizable: false,
        skipTaskbar: true,
        alwaysOnTop: false,
        visible: true,
        shadow: false,
      });

      memoWindow.once("tauri://created", () => {
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
      console.error("Failed to toggle memo window:", error);
      setMemoOpen(false);
    }
  }, []);

  return { memoOpen, toggleMemoWindow };
};
