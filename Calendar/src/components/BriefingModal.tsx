// ═══════════════════════════════════════════════════════════
// BriefingModal — Claude's summary of today and the week ahead
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useRef, useState } from "react";
import { CLAUDE_BRIEFING_KEY } from "../constants";
import { loadJson } from "../utils";
import { ModalShell } from "./ModalShell";

interface BriefingModalProps {
  open: boolean;
  today: string;
  fetchBriefing: () => Promise<string>;
  onClose: () => void;
}

interface CachedBriefing {
  date: string;
  text: string;
  at: string;
}

type State =
  | { status: "loading" }
  | { status: "done"; briefing: CachedBriefing }
  | { status: "error"; message: string };

const BriefingModalContent: React.FC<Omit<BriefingModalProps, "open">> = ({ today, fetchBriefing, onClose }) => {
  const [state, setState] = useState<State>({ status: "loading" });
  // The parent re-renders while a request is in flight (timers, toasts); keeping
  // `load` stable means opening the modal sends exactly one paid request.
  const fetchRef = useRef(fetchBriefing);
  fetchRef.current = fetchBriefing;
  const inFlight = useRef(false);

  const load = useCallback(async (force: boolean) => {
    if (inFlight.current) return;
    // Reopening the same day shows the saved briefing instead of paying for a new one.
    const cached = loadJson<CachedBriefing | null>(CLAUDE_BRIEFING_KEY, null);
    if (!force && cached?.date === today) {
      setState({ status: "done", briefing: cached });
      return;
    }

    setState({ status: "loading" });
    inFlight.current = true;

    try {
      const text = await fetchRef.current();
      const now = new Date();
      const briefing = {
        date: today,
        text,
        at: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      };
      localStorage.setItem(CLAUDE_BRIEFING_KEY, JSON.stringify(briefing));
      setState({ status: "done", briefing });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
    } finally {
      inFlight.current = false;
    }
  }, [today]);

  useEffect(() => {
    void load(false);
  }, [load]);

  return (
    <ModalShell title="✨ 오늘 브리핑" onClose={onClose} className="briefing-modal">
      <div className="modal-body">
        <div className="briefing-body" aria-live="polite" aria-busy={state.status === "loading"}>
          {state.status === "loading" && <p className="briefing-loading">Claude가 일정을 정리하고 있어요…</p>}
          {state.status === "error" && <p className="form-error" role="alert">{state.message}</p>}
          {state.status === "done" && <p className="briefing-text">{state.briefing.text}</p>}
        </div>

        <p className="sg-hint">
          {state.status === "done" ? `${state.briefing.at}에 받은 브리핑 · ` : ""}
          일정 제목과 날짜만 Claude로 보내고, 메모는 보내지 않아요.
        </p>

        <div className="modal-actions">
          <button
            type="button"
            className="modal-cancel"
            disabled={state.status === "loading"}
            onClick={() => void load(true)}
          >
            다시 받기
          </button>
          <button type="button" className="modal-confirm" onClick={onClose}>닫기</button>
        </div>
      </div>
    </ModalShell>
  );
};

export const BriefingModal: React.FC<BriefingModalProps> = ({ open, ...props }) =>
  open ? <BriefingModalContent {...props} /> : null;

export default BriefingModal;
