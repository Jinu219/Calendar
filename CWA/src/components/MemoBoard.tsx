import React, { useEffect, useMemo, useState } from "react";
import { MEMO_COLORS } from "../constants";
import { useMemos } from "../hooks";

export const MemoBoard: React.FC = () => {
  const { memos, addMemo, updateMemo, deleteMemo } = useMemos();
  const [activeMemoId, setActiveMemoId] = useState<string | null>(null);

  const activeMemo = useMemo(() => {
    return memos.find(memo => memo.id === activeMemoId) || memos[0];
  }, [memos, activeMemoId]);

  const otherMemos = useMemo(() => {
    if (!activeMemo) return [];
    return memos.filter(memo => memo.id !== activeMemo.id);
  }, [memos, activeMemo]);

  useEffect(() => {
    if (!activeMemoId || !memos.some(memo => memo.id === activeMemoId)) {
      setActiveMemoId(memos[0]?.id ?? null);
    }
  }, [activeMemoId, memos]);

  const handleAddMemo = () => {
    const newMemoId = addMemo();
    setActiveMemoId(newMemoId);
  };

  const handleDeleteMemo = () => {
    if (!activeMemo) return;
    deleteMemo(activeMemo.id);
  };

  if (!activeMemo) {
    return null;
  }

  return (
    <section
      className="memo-board"
      style={{ "--active-memo-color": activeMemo.color } as React.CSSProperties}
    >
      <div className="memo-tabs">
        {memos.map((memo, index) => (
          <button
            key={memo.id}
            type="button"
            className={`memo-tab ${memo.id === activeMemo.id ? "active" : ""}`}
            style={{ "--memo-tab-color": memo.color } as React.CSSProperties}
            onClick={() => setActiveMemoId(memo.id)}
            title={`메모 ${index + 1}`}
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

      <div className="memo-board-scroll">
        <div className="memo-paper">
          <textarea
            className="memo-textarea"
            value={activeMemo.content}
            onChange={e => updateMemo(activeMemo.id, { content: e.target.value })}
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

        {otherMemos.length > 0 && (
          <div className="memo-preview-stack">
            {otherMemos.map((memo, index) => (
              <button
                key={memo.id}
                type="button"
                className="memo-preview-card"
                style={{ backgroundColor: memo.color }}
                onClick={() => setActiveMemoId(memo.id)}
                title={`메모 ${index + 1} 열기`}
              >
                <span className="memo-preview-title">
                  메모 {memos.findIndex(item => item.id === memo.id) + 1}
                </span>
                <span className="memo-preview-text">
                  {memo.content.trim() || "비어 있는 메모"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default MemoBoard;