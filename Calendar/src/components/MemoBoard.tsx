import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { COLOR_NAMES, MEMO_COLORS, MEMO_FOCUS_KEY } from "../constants";
import { useMemos, useToast } from "../hooks";
import {
  continueList,
  cycleHeading,
  fitOnScreen,
  formatShortDate,
  indentSelection,
  lineEndOffset,
  screenPointOf,
  toggleChecklistLine,
  toggleInlineMark,
  toggleLineFormat,
  type MemoEdit,
} from "../utils";
import { MemoRichView } from "./MemoRichView";
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

const MEMO_PLACEHOLDER =
  "오늘 기억할 것, 공부 메모, 작업 아이디어를 적어보세요.\n" +
  "# 제목 · - 목록 · - [ ] 체크 · **굵게** · ~~취소~~\n" +
  "Tab 들여쓰기 · Esc 편집 끝";

type EditMaker = (value: string, start: number, end: number) => MemoEdit | null;

/** Formatting buttons and their shortcuts, shown while editing. */
const FORMAT_BUTTONS: { label: string; title: string; className?: string; make: EditMaker }[] = [
  { label: "H", title: "제목 (누를 때마다 큰 제목 → 중간 → 작게 → 본문) · Ctrl+1·2·3", make: cycleHeading },
  { label: "B", title: "굵게 · Ctrl+B", className: "memo-b", make: (v, s, e) => toggleInlineMark(v, s, e, "**") },
  { label: "I", title: "기울임 · Ctrl+I", className: "memo-i", make: (v, s, e) => toggleInlineMark(v, s, e, "*") },
  { label: "S", title: "취소선 · Ctrl+Shift+S", className: "memo-s", make: (v, s, e) => toggleInlineMark(v, s, e, "~~") },
  { label: "•", title: "글머리 목록", make: (v, s, e) => toggleLineFormat(v, s, e, "bullet") },
  { label: "☑", title: "체크리스트", make: (v, s, e) => toggleLineFormat(v, s, e, "check") },
];

/** Editor shortcuts; Tab and Shift+Tab indent. */
const shortcutEdit = (event: React.KeyboardEvent<HTMLTextAreaElement>): EditMaker | null => {
  const ctrl = event.ctrlKey || event.metaKey;
  if (event.key === "Tab" && !ctrl && !event.altKey) {
    return (v, s, e) => indentSelection(v, s, e, event.shiftKey);
  }
  if (!ctrl || event.altKey) return null;

  const key = event.key.toLowerCase();
  if (!event.shiftKey && key === "b") return FORMAT_BUTTONS[1].make;
  if (!event.shiftKey && key === "i") return FORMAT_BUTTONS[2].make;
  if (event.shiftKey && event.code === "KeyS") return FORMAT_BUTTONS[3].make;
  if (!event.shiftKey && (key === "1" || key === "2" || key === "3")) {
    return (v, s, e) => toggleLineFormat(v, s, e, `h${key}` as "h1" | "h2" | "h3");
  }
  return null;
};

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
  // The memo shows formatted until it is clicked; then the plain text is edited.
  const [editing, setEditing] = useState(false);
  const pendingCaretRef = useRef<number | null>(null);
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

  const activeMemoKey = activeMemo?.id;
  const showEditor = !!activeMemo && (editing || !activeMemo.content.trim());

  /**
   * Apply an edit through the browser's own text insertion, so it fires the
   * normal input event (→ onChange) and Ctrl+Z can undo it.
   */
  const applyEdit = useCallback((edit: MemoEdit) => {
    const textarea = textareaRef.current;
    if (!textarea || !activeMemoKey) return;

    textarea.focus();
    textarea.setSelectionRange(edit.from, edit.to);
    const applied = edit.insert
      ? document.execCommand("insertText", false, edit.insert)
      : edit.from === edit.to || document.execCommand("delete");

    if (!applied) {
      const value = textarea.value;
      updateMemo(activeMemoKey, { content: value.slice(0, edit.from) + edit.insert + value.slice(edit.to) });
      requestAnimationFrame(() => textarea.setSelectionRange(edit.selStart, edit.selEnd));
      return;
    }

    textarea.setSelectionRange(edit.selStart, edit.selEnd);
  }, [activeMemoKey, updateMemo]);

  const runFormat = (make: EditMaker) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const edit = make(textarea.value, textarea.selectionStart, textarea.selectionEnd);
    if (edit) applyEdit(edit);
  };

  // Coming from the formatted view: focus the editor at the clicked line.
  useEffect(() => {
    if (!editing) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (document.activeElement !== textarea) textarea.focus();
    if (pendingCaretRef.current !== null) {
      const caret = Math.min(pendingCaretRef.current, textarea.value.length);
      pendingCaretRef.current = null;
      textarea.setSelectionRange(caret, caret);
    }
  }, [editing]);

  // Enter in a list starts the next item. Handled on the line break itself
  // (not keydown) so Korean input finishing a syllable with Enter still works.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!showEditor || !textarea) return;

    const handleBeforeInput = (event: InputEvent) => {
      if (event.inputType !== "insertLineBreak" && event.inputType !== "insertParagraph") return;
      if (event.isComposing || textarea.selectionStart !== textarea.selectionEnd) return;
      const edit = continueList(textarea.value, textarea.selectionStart);
      if (!edit) return;
      event.preventDefault();
      applyEdit(edit);
    };

    textarea.addEventListener("beforeinput", handleBeforeInput);
    return () => textarea.removeEventListener("beforeinput", handleBeforeInput);
  }, [showEditor, applyEdit]);

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;

    if (event.key === "Escape") {
      event.preventDefault();
      event.currentTarget.blur();
      return;
    }

    const make = shortcutEdit(event);
    if (!make) return;
    event.preventDefault();
    runFormat(make);
  };

  const startEditingAt = (lineIndex: number) => {
    if (!activeMemo) return;
    pendingCaretRef.current = lineEndOffset(activeMemo.content, lineIndex);
    setEditing(true);
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

        {showEditor ? (
          <textarea
            ref={textareaRef}
            className="memo-textarea"
            value={activeMemo.content}
            onChange={event =>
              updateMemo(activeMemo.id, { content: event.target.value })
            }
            onFocus={() => setEditing(true)}
            onBlur={() => setEditing(false)}
            onKeyDown={handleEditorKeyDown}
            placeholder={MEMO_PLACEHOLDER}
            aria-label="메모 내용 (Tab 들여쓰기, Esc 편집 끝)"
            spellCheck={false}
          />
        ) : (
          <MemoRichView
            content={activeMemo.content}
            onEditLine={startEditingAt}
            onToggleCheck={index => updateMemo(activeMemo.id, { content: toggleChecklistLine(activeMemo.content, index) })}
          />
        )}

        {editing ? (
          <div className="memo-toolbar memo-format-bar" role="toolbar" aria-label="서식">
            <div className="memo-format-list">
              {FORMAT_BUTTONS.map(button => (
                <button
                  key={button.label}
                  type="button"
                  className={`memo-icon-btn ${button.className ?? ""}`}
                  // Keep the caret in the memo while formatting.
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => runFormat(button.make)}
                  title={button.title}
                  aria-label={button.title}
                >
                  {button.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="memo-small-action-btn"
              onClick={() => textareaRef.current?.blur()}
              title="편집 끝 (Esc)"
            >
              완료
            </button>
          </div>
        ) : (
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
        )}
      </div>

      <Toast toast={toast} onDismiss={dismissToast} />
    </section>
  );
};

export default MemoBoard;
