import React, { useEffect, useMemo, useRef, useState } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { LogicalPosition } from "@tauri-apps/api/window";
import { MEMO_COLORS } from "../constants";
import { useMemos } from "../hooks";

interface MemoBoardProps {
  memoId?: string;
  detached?: boolean;
}

type DragDetachState = {
  memoId: string;
  startX: number;
  startY: number;
  detached: boolean;
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
    detachMemo,
    attachMemo,
  } = useMemos();

  const dragDetachRef = useRef<DragDetachState | null>(null);

  const visibleMemos = useMemo(() => {
    if (memoId) {
      return memos.filter(memo => memo.id === memoId);
    }

    return memos.filter(memo => !memo.detached);
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
    const label = `memo-${targetMemoId}`;

    const existing = await WebviewWindow.getByLabel(label);

    if (existing) {
      await existing.show();

      // 이미 분리창이 있으면 그때만 원래 보드에서 숨김 처리
      detachMemo(targetMemoId);
      return;
    }

    const memoWidth = 300;
    const memoHeight = 320;

    const safeX = Math.min(
      Math.max(8, screenX - memoWidth / 2),
      window.screen.availWidth - memoWidth - 8
    );

    const safeY = Math.min(
      Math.max(8, screenY - 34),
      window.screen.availHeight - memoHeight - 8
    );

    const detachedWindow = new WebviewWindow(label, {
      url: `/?window=memo&detached=true&memoId=${targetMemoId}`,
      title: "CWA Memo",
      width: memoWidth,
      height: memoHeight,
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

    detachedWindow.once("tauri://created", async () => {
      await detachedWindow.setPosition(new LogicalPosition(safeX, safeY));
      await detachedWindow.show();

      // 중요:
      // 새 창이 진짜 만들어진 다음에만 원래 메모 보드에서 숨김 처리
      detachMemo(targetMemoId);
    });

    detachedWindow.once("tauri://error", error => {
      console.error("Failed to detach memo:", error);

      // 실패하면 원래 보드에 그대로 남아야 하므로 detachMemo 호출 안 함
      alert(`메모 분리 실패: ${String(error)}`);
    });
  };

  const handleTabPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    targetMemoId: string
  ) => {
    if (detached) return;

    dragDetachRef.current = {
      memoId: targetMemoId,
      startX: event.clientX,
      startY: event.clientY,
      detached: false,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleTabPointerMove = async (
    event: React.PointerEvent<HTMLButtonElement>
  ) => {
    const dragState = dragDetachRef.current;

    if (!dragState || dragState.detached || detached) return;

    const distanceX = event.clientX - dragState.startX;
    const distanceY = event.clientY - dragState.startY;
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

    // 너무 조금 움직였을 때는 클릭으로 처리
    if (distance < 90) return;

    dragState.detached = true;

    await createDetachedMemoWindow(
      dragState.memoId,
      event.screenX,
      event.screenY
    );
  };

  const handleTabPointerUp = (
    event: React.PointerEvent<HTMLButtonElement>,
    targetMemoId: string
  ) => {
    const dragState = dragDetachRef.current;

    if (!dragState || !dragState.detached) {
      setActiveMemoId(targetMemoId);
    }

    dragDetachRef.current = null;

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // pointer capture가 없는 경우 무시
    }
  };

  const handleAddMemo = () => {
    const newMemoId = addMemo();
    setActiveMemoId(newMemoId);
  };

  const handleDeleteMemo = () => {
    if (!activeMemo) return;

    deleteMemo(activeMemo.id);
  };

  const handleAttachMemo = async () => {
    if (!activeMemo) return;

    attachMemo(activeMemo.id);

    const currentWindow = await WebviewWindow.getByLabel(`memo-${activeMemo.id}`);

    if (currentWindow) {
      await currentWindow.close();
    }
  };

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
              className={`memo-tab ${
                memo.id === activeMemo.id ? "active" : ""
              }`}
              style={{ "--memo-tab-color": memo.color } as React.CSSProperties}
              onPointerDown={event => handleTabPointerDown(event, memo.id)}
              onPointerMove={handleTabPointerMove}
              onPointerUp={event => handleTabPointerUp(event, memo.id)}
              title="클릭하면 선택, 드래그하면 별도 메모로 분리"
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
              />
            ))}
          </div>

          <div className="memo-action-list">
            {detached && (
              <button
                type="button"
                className="memo-small-action-btn"
                onClick={handleAttachMemo}
                title="현재 메모를 다시 메모 보드로 합치기"
              >
                합치기
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