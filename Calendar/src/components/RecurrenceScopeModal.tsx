// ═══════════════════════════════════════════════════════════
// RecurrenceScopeModal Component
// ═══════════════════════════════════════════════════════════

import React from "react";

export type RecurrenceScope = "this" | "all";

interface RecurrenceScopeModalProps {
  open: boolean;
  actionLabel: string;
  onChoose: (scope: RecurrenceScope) => void;
  onCancel: () => void;
}

export const RecurrenceScopeModal: React.FC<RecurrenceScopeModalProps> = ({
  open,
  actionLabel,
  onChoose,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box glass-panel scope-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <span>반복 일정 {actionLabel}</span>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>

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
              이 일정만
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
      </div>
    </div>
  );
};

export default RecurrenceScopeModal;
