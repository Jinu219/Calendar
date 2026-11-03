// ═══════════════════════════════════════════════════════════
// RecurrenceScopeModal Component
// ═══════════════════════════════════════════════════════════

import React from "react";
import type { RecurrenceScope } from "../types";
import { formatShortDate } from "../utils";
import { ModalShell } from "./ModalShell";

interface RecurrenceScopeModalProps {
  open: boolean;
  actionLabel: string;
  /** The occurrence being changed, shown so the user knows which one "this" is. */
  occurrenceDate?: string;
  onChoose: (scope: RecurrenceScope) => void;
  onCancel: () => void;
}

export const RecurrenceScopeModal: React.FC<RecurrenceScopeModalProps> = ({
  open,
  actionLabel,
  occurrenceDate,
  onChoose,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <ModalShell title={`반복 일정 ${actionLabel}`} onClose={onCancel} className="scope-modal">
      <div className="modal-body">
        <p className="sg-hint">
          이 일정은 반복되고 있습니다. 어디까지 {actionLabel}할까요?
        </p>

        <div className="modal-actions scope-modal-actions">
          <button
            type="button"
            className="modal-cancel"
            onClick={() => onChoose("this")}
          >
            {occurrenceDate ? `${formatShortDate(occurrenceDate)}만` : "이 일정만"}
          </button>

          <button
            type="button"
            className="modal-confirm"
            onClick={() => onChoose("all")}
          >
            모든 반복 일정
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

export default RecurrenceScopeModal;
