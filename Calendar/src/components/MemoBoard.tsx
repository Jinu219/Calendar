import React, { useEffect, useMemo, useRef, useState } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { MEMO_COLORS } from "../constants";
import { useMemos } from "../hooks";

interface MemoBoardProps {
  memoId?: string;
  detached?: boolean;
}

type DragState = {
  memoId: string;
  startScreenX: number;
  startScreenY: number;
  droppedOnTab: boolean;
};

const DETACHED_LABELS = [
  "memo-detached-1",
  "memo-detached-2",
  "memo-detached-3",
  "memo-detached-4",
  "memo-detached-5",
] as const;

const DETACHED_MEMO_WIDTH = 300;
const DETACHED_MEMO_HEIGHT = 320;
const WINDOW_MARGIN = 8;

const getAvailableDetachedLabel = async () => {
  for (const label of DETACHED_LABELS) {
    if (!await WebviewWindow.getByLabel(label)) {
      return label;
    }
  }

  return null;
};

const closeCurrentWindow = async () => {
  try {
    await getCurrentWindow().close();
  } catch (error) {
    console.error("Failed to close memo window:", error);
  }
};

export const MemoBoard: React.FC<MemoBoardProps> = ({
  memoId,
  detached = false,
}) => {
  const {
    memos,
    addMemo,
    updateMemo,
    deleteMemo,
    moveMemo,
  } = useMemos();

  const dragStateRef = useRef<DragState | null>(null);

  const visibleMemos = useMemo(() => {
    if (memoId) {
      return memos.filter(memo => memo.id === memoId);
    }

    return memos;
  }, [memos, memoId]);

  const [activeMemoId, setActiveMemoId] = useState<string | null>(
    memoId ?? null
  );

  const activeMemo = useMemo(() => {
    return (
      visibleMemos.find(memo => memo.id === activeMemoId) ||
      visibleMemos[0] ||
      memos.find(memo => memo.id === memoId)
    );
  }, [visibleMemos, activeMemoId, memos, memoId]);

  useEffect(() => {
    if (memoId) {
      setActiveMemoId(memoId);
      return;
    }

    if (!activeMemoId || !visibleMemos.some(memo => memo.id === activeMemoId)) {
      setActiveMemoId(visibleMemos[0]?.id ?? null);
    }
  }, [activeMemoId, visibleMemos, memoId]);

  const createDetachedMemoWindow = async (
    targetMemoId: string,
    screenX: number,
    screenY: number
  ) => {
    const label = await getAvailableDetachedLabel();

    if (!label) {
      alert("열 수 있는 메모창 개수를 초과했어요. 기존 메모창을 닫은 뒤 다시 시도해주세요.");
      return;
    }

    const safeX = Math.min(
      Math.max(WINDOW_MARGIN, screenX - DETACHED_MEMO_WIDTH / 2),
      window.screen.availWidth - DETACHED_MEMO_WIDTH - WINDOW_MARGIN
    );

    const safeY = Math.min(
      Math.max(WINDOW_MARGIN, screenY - 36),
      window.screen.availHeight - DETACHED_MEMO_HEIGHT - WINDOW_MARGIN
    );

    const detachedWindow = new WebviewWindow(label, {
      url: `/?window=memo&detached=true&memoId=${encodeURIComponent(targetMemoId)}`,
      title: "Calendar Memo",
      width: DETACHED_MEMO_WIDTH,
      height: DETACHED_MEMO_HEIGHT,
      x: safeX,
      y: safeY,
      decorations: false,
      transparent: true,
      resizable: false,
      skipTaskbar: true,
      alwaysOnTop: false,
      visible: true,
      shadow: false,
    });

    detachedWindow.once("tauri://error", error => {
      console.error("Failed to create detached memo window:", error);
      alert(`메모창 생성 실패: ${String(error)}`);
    });
  };

  const handleTabClick = (targetMemoId: string) => {
    if (detached) return;

    setActiveMemoId(targetMemoId);
  };

  const handleTabDragStart = (
    event: React.DragEvent<HTMLButtonElement>,
    targetMemoId: string
  ) => {
    if (detached) return;

    dragStateRef.current = {
      memoId: targetMemoId,
      startScreenX: event.screenX,
      startScreenY: event.screenY,
      droppedOnTab: false,
    };

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", targetMemoId);

    try {
      event.dataTransfer.setDragImage(event.currentTarget, 20, 20);
    } catch {
      // ignore drag image errors
    }
  };

  const handleTabDragOver = (
    event: React.DragEvent<HTMLButtonElement>
  ) => {
    if (detached) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleTabDrop = (
    event: React.DragEvent<HTMLButtonElement>,
    targetMemoId: string
  ) => {
    if (detached) return;

    event.preventDefault();

    const sourceMemoId =
      event.dataTransfer.getData("text/plain") ||
      dragStateRef.current?.memoId;

    if (!sourceMemoId || sourceMemoId === targetMemoId) {
      if (dragStateRef.current) {
        dragStateRef.current.droppedOnTab = true;
      }
      return;
    }

    if (dragStateRef.current) {
      dragStateRef.current.droppedOnTab = true;
    }

    moveMemo(sourceMemoId, targetMemoId);
    setActiveMemoId(sourceMemoId);
  };

  const handleTabDragEnd = async (
    event: React.DragEvent<HTMLButtonElement>
  ) => {
    if (detached) return;

    const dragState = dragStateRef.current;
    dragStateRef.current = null;

    if (!dragState || dragState.droppedOnTab) {
      return;
    }

    const distanceX = event.screenX - dragState.startScreenX;
    const distanceY = event.screenY - dragState.startScreenY;
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

    if (distance < 80) {
      return;
    }

    await createDetachedMemoWindow(
      dragState.memoId,
      event.screenX || dragState.startScreenX + 180,
      event.screenY || dragState.startScreenY + 80
    );
  };

  const handleAddMemo = () => {
    const newMemoId = addMemo();
    setActiveMemoId(newMemoId);
  };

  const handleDeleteMemo = async () => {
    if (!activeMemo) return;

    deleteMemo(activeMemo.id);

    if (detached) {
      await closeCurrentWindow();
    }
  };

  const handleCloseDetachedWindow = closeCurrentWindow;

  if (!activeMemo) {
    return (
      <section className="memo-board memo-board-empty">
        <button
          type="button"
          className="memo-empty-add-btn"
          onClick={handleAddMemo}
        >
          + 메모 만들기
        </button>
      </section>
    );
  }

  return (
    <section
      className={`memo-board ${detached ? "detached" : ""}`}
      style={{ "--active-memo-color": activeMemo.color } as React.CSSProperties}
    >
      {!detached && (
        <div className="memo-tabs">
          {visibleMemos.map((memo, index) => (
            <button
              key={memo.id}
              type="button"
              draggable
              className={`memo-tab ${
                memo.id === activeMemo.id ? "active" : ""
              }`}
              style={{ "--memo-tab-color": memo.color } as React.CSSProperties}
              onClick={() => handleTabClick(memo.id)}
              onDragStart={event => handleTabDragStart(event, memo.id)}
              onDragOver={handleTabDragOver}
              onDrop={event => handleTabDrop(event, memo.id)}
              onDragEnd={handleTabDragEnd}
              title="클릭하면 선택, 다른 번호 위에 놓으면 순서 변경, 밖으로 끌면 새 메모창"
            >
              {index + 1}
            </button>
          ))}

          <button
            type="button"
            className="memo-tab memo-add-tab"
            onClick={handleAddMemo}
            title="메모 추가"
          >
            +
          </button>
        </div>
      )}

      <div className="memo-paper">
        <textarea
          className="memo-textarea"
          value={activeMemo.content}
          onChange={event =>
            updateMemo(activeMemo.id, { content: event.target.value })
          }
          placeholder="오늘 기억할 것, 공부 메모, 작업 아이디어를 적어보세요."
        />

        <div className="memo-toolbar">
          <div className="memo-color-list" aria-label="메모 색상 선택">
            {MEMO_COLORS.map(color => (
              <button
                key={color}
                type="button"
                className={`memo-color-dot ${
                  activeMemo.color === color ? "active" : ""
                }`}
                style={{ backgroundColor: color }}
                onClick={() => updateMemo(activeMemo.id, { color })}
                title="메모 색상 변경"
                aria-label={`메모 색상을 ${color}로 변경`}
              />
            ))}
          </div>

          <div className="memo-action-list">
            {detached && (
              <button
                type="button"
                className="memo-small-action-btn"
                onClick={handleCloseDetachedWindow}
                title="이 메모창 닫기"
              >
                닫기
              </button>
            )}

            <button
              type="button"
              className="memo-delete-btn"
              onClick={handleDeleteMemo}
              title="현재 메모 삭제"
            >
              삭제
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MemoBoard;
