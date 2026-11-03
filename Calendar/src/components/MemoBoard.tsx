import React, { useEffect, useMemo, useRef, useState } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { COLOR_NAMES, MEMO_COLORS, MEMO_FOCUS_KEY } from "../constants";
import { useMemos, useToast } from "../hooks";
import { fitOnScreen, formatShortDate, screenPointOf } from "../utils";
import { Toast } from "./Toast";

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
const CHECKBOX_LINE = /^(\s*)- \[( |x|X)\] (.*)$/;

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

/** "id|timestamp" → id (the timestamp makes re-focusing the same memo fire again). */
const readFocusRequest = (value: string | null): string | null => value?.split("|")[0] || null;

/** Flip the "- [ ]" / "- [x]" mark on one line of the memo. */
const toggleChecklistLine = (content: string, lineIndex: number): string =>
  content
    .split("\n")
    .map((line, i) => {
      if (i !== lineIndex) return line;
      const match = CHECKBOX_LINE.exec(line);
      return match ? `${match[1]}- [${match[2] === " " ? "x" : " "}] ${match[3]}` : line;
    })
    .join("\n");

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
  const { toast, showToast, dismissToast } = useToast();

  const dragStateRef = useRef<DragState | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [checklistView, setChecklistView] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const visibleMemos = useMemo(() => {
    if (memoId) {
      return memos.filter(memo => memo.id === memoId);
    }

    return memos;
  }, [memos, memoId]);

  const [activeMemoId, setActiveMemoId] = useState<string | null>(
    () => memoId ?? readFocusRequest(localStorage.getItem(MEMO_FOCUS_KEY))
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

  // The main window asks to show a memo (e.g. one linked to a day in the todo panel).
  useEffect(() => {
    if (detached) return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== MEMO_FOCUS_KEY) return;
      const requested = readFocusRequest(event.newValue);
      if (requested) setActiveMemoId(requested);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [detached]);

  const createDetachedMemoWindow = async (
    targetMemoId: string,
    screenX: number,
    screenY: number
  ) => {
    const label = await getAvailableDetachedLabel();

    if (!label) {
      showToast("메모창은 5개까지 열 수 있어요. 하나를 닫고 다시 해 주세요.");
      return;
    }

    const point = screenPointOf({ screenX, screenY });
    const scale = window.devicePixelRatio;
    const position = await fitOnScreen(
      point.x - (DETACHED_MEMO_WIDTH / 2) * scale,
      point.y - 36 * scale,
      DETACHED_MEMO_WIDTH,
      DETACHED_MEMO_HEIGHT
    );

    // Created hidden and placed in physical pixels so it lands right on any monitor.
    const detachedWindow = new WebviewWindow(label, {
      url: `/?window=memo&detached=true&memoId=${encodeURIComponent(targetMemoId)}`,
      title: "Calendar Memo",
      width: DETACHED_MEMO_WIDTH,
      height: DETACHED_MEMO_HEIGHT,
      decorations: false,
      transparent: true,
      resizable: false,
      skipTaskbar: true,
      alwaysOnTop: false,
      visible: false,
      shadow: false,
    });

    detachedWindow.once("tauri://created", async () => {
      await detachedWindow.setPosition(position).catch(console.error);
      await detachedWindow.show().catch(console.error);
    });

    detachedWindow.once("tauri://error", error => {
      console.error("Failed to create detached memo window:", error);
      showToast(`메모창을 만들지 못했어요: ${String(error)}`);
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

    if (dragStateRef.current) {
      dragStateRef.current.droppedOnTab = true;
    }

    if (!sourceMemoId || sourceMemoId === targetMemoId) return;

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

  /** Start a "- [ ] " checklist item on the cursor's line (or a new line). */
  const insertCheckbox = () => {
    if (!activeMemo) return;

    const textarea = textareaRef.current;
    const content = activeMemo.content;
    const cursor = textarea?.selectionStart ?? content.length;
    const lineStart = content.lastIndexOf("\n", cursor - 1) + 1;
    const line = content.slice(lineStart, content.indexOf("\n", cursor) === -1 ? undefined : content.indexOf("\n", cursor));

    const next = CHECKBOX_LINE.test(line)
      ? content
      : line.trim()
        ? `${content.slice(0, lineStart)}- [ ] ${content.slice(lineStart)}`
        : `${content.slice(0, cursor)}- [ ] ${content.slice(cursor)}`;

    updateMemo(activeMemo.id, { content: next });
    setChecklistView(false);
    requestAnimationFrame(() => {
      textarea?.focus();
      const end = next.indexOf("\n", lineStart);
      textarea?.setSelectionRange(end === -1 ? next.length : end, end === -1 ? next.length : end);
    });
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

  const lines = activeMemo.content.split("\n");

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
              aria-label={`메모 ${index + 1}${memo.linkedDate ? `, ${formatShortDate(memo.linkedDate)}에 연결됨` : ""}`}
              aria-pressed={memo.id === activeMemo.id}
              title="클릭하면 선택, 다른 번호 위에 놓으면 순서 변경, 밖으로 끌면 새 메모창"
            >
              {index + 1}
              {memo.linkedDate && <span className="memo-tab-pin" aria-hidden="true">📅</span>}
            </button>
          ))}

          <button
            type="button"
            className="memo-tab memo-add-tab"
            onClick={handleAddMemo}
            aria-label="메모 추가"
            title="메모 추가"
          >
            +
          </button>
        </div>
      )}

      <div className="memo-paper">
        {(activeMemo.linkedDate || datePickerOpen) && (
          <div className="memo-date-row">
            <span aria-hidden="true">📅</span>
            <input
              type="date"
              className="memo-date-input"
              aria-label="메모를 연결할 날짜"
              value={activeMemo.linkedDate ?? ""}
              onChange={e => updateMemo(activeMemo.id, { linkedDate: e.target.value || undefined })}
            />
            {activeMemo.linkedDate && (
              <button
                type="button"
                className="memo-date-clear"
                aria-label="날짜 연결 해제"
                title="날짜 연결 해제"
                onClick={() => {
                  updateMemo(activeMemo.id, { linkedDate: undefined });
                  setDatePickerOpen(false);
                }}
              >
                ×
              </button>
            )}
          </div>
        )}

        {checklistView ? (
          <div className="memo-checklist" role="list" aria-label="메모 체크리스트 보기">
            {lines.map((line, index) => {
              const match = CHECKBOX_LINE.exec(line);

              return match ? (
                <label key={index} className={`memo-check-line ${match[2] !== " " ? "done" : ""}`} role="listitem">
                  <input
                    type="checkbox"
                    checked={match[2] !== " "}
                    onChange={() => updateMemo(activeMemo.id, { content: toggleChecklistLine(activeMemo.content, index) })}
                  />
                  <span style={{ paddingLeft: `${match[1].length * 0.5}em` }}>{match[3]}</span>
                </label>
              ) : (
                <p key={index} className="memo-plain-line" role="listitem">{line || " "}</p>
              );
            })}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            className="memo-textarea"
            value={activeMemo.content}
            onChange={event =>
              updateMemo(activeMemo.id, { content: event.target.value })
            }
            placeholder={"오늘 기억할 것, 공부 메모, 작업 아이디어를 적어보세요.\n☑ 버튼으로 체크리스트 줄을 만들 수 있어요."}
            aria-label="메모 내용"
          />
        )}

        <div className="memo-toolbar">
          <div className="memo-color-list" role="radiogroup" aria-label="메모 색상">
            {MEMO_COLORS.map(color => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={activeMemo.color === color}
                className={`memo-color-dot ${
                  activeMemo.color === color ? "active" : ""
                }`}
                style={{ backgroundColor: color }}
                onClick={() => updateMemo(activeMemo.id, { color })}
                title={`메모 색상: ${COLOR_NAMES[color] ?? color}`}
                aria-label={COLOR_NAMES[color] ?? color}
              />
            ))}
          </div>

          <div className="memo-action-list">
            <button
              type="button"
              className="memo-icon-btn"
              onClick={insertCheckbox}
              title="체크리스트 줄 추가"
              aria-label="체크리스트 줄 추가"
            >
              ☑
            </button>

            <button
              type="button"
              className={`memo-icon-btn ${checklistView ? "active" : ""}`}
              onClick={() => setChecklistView(prev => !prev)}
              aria-pressed={checklistView}
              title={checklistView ? "편집으로 돌아가기" : "체크리스트로 보기 (눌러서 체크)"}
              aria-label="체크리스트로 보기"
            >
              {checklistView ? "✎" : "✓"}
            </button>

            <button
              type="button"
              className={`memo-icon-btn ${activeMemo.linkedDate ? "active" : ""}`}
              onClick={() => setDatePickerOpen(prev => !prev)}
              title="날짜에 연결 — 달력과 할 일 패널에 표시돼요"
              aria-label="날짜에 연결"
            >
              📅
            </button>

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

      <Toast toast={toast} onDismiss={dismissToast} />
    </section>
  );
};

export default MemoBoard;
