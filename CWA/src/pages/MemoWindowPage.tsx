import React from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { MemoBoard } from "../components";

export const MemoWindowPage: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const memoId = params.get("memoId");
  const detached = params.get("detached") === "true";

  const handleStartDrag = async (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    const target = event.target as HTMLElement;

    if (
      target.closest("button") ||
      target.closest("textarea") ||
      target.closest("input")
    ) {
      return;
    }

    const appWindow = getCurrentWindow();
    await appWindow.startDragging();
  };

  return (
    <div className="memo-window-root" onMouseDown={handleStartDrag}>
      <MemoBoard memoId={memoId ?? undefined} detached={detached} />
    </div>
  );
};

export default MemoWindowPage;