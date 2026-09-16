import React from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { MemoBoard } from "../components";

export const MemoWindowPage: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const memoId = params.get("memoId");
  const detached = params.get("detached") === "true";

  const handleStartDrag = async (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    const appWindow = getCurrentWindow();
    await appWindow.startDragging();
  };

  return (
    <div className="memo-window-root">
      <button
        type="button"
        className="memo-window-drag-handle"
        onMouseDown={handleStartDrag}
        title="드래그해서 메모창 이동"
      >
        ⋮⋮
      </button>

      <MemoBoard memoId={memoId ?? undefined} detached={detached} />
    </div>
  );
};

export default MemoWindowPage;