import React from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { MemoBoard } from "../components";

export const MemoWindowPage: React.FC = () => {
  const handleStartDrag = async (
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    if (event.button !== 0) return;

    const target = event.target as HTMLElement;

    // 버튼, textarea, input, 메모 색상 버튼을 누를 때는 드래그 금지
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

  const handleClose = async (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const appWindow = getCurrentWindow();

    // hide가 안 먹는 환경이 있어서 close로 확실히 닫음
    await appWindow.close();
  };

  return (
    <div className="memo-window-root" onMouseDown={handleStartDrag}>
      <div className="memo-window-card">
        <div className="memo-window-titlebar">
          <span>Memo</span>

          <button
            type="button"
            className="memo-window-close-btn"
            onMouseDown={event => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={handleClose}
            title="메모 창 닫기"
          >
            ×
          </button>
        </div>

        <MemoBoard />
      </div>
    </div>
  );
};

export default MemoWindowPage;