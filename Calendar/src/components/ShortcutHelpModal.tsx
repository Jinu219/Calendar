// ═══════════════════════════════════════════════════════════
// ShortcutHelpModal — keyboard & mouse cheat sheet ("?")
// ═══════════════════════════════════════════════════════════

import React from "react";
import { KEYBOARD_SHORTCUTS, MOUSE_TIPS } from "../constants";
import { ModalShell } from "./ModalShell";

interface ShortcutHelpModalProps {
  open: boolean;
  onClose: () => void;
}

export const ShortcutListSection: React.FC = () => (
  <>
    <dl className="shortcut-list">
      {KEYBOARD_SHORTCUTS.map(shortcut => (
        <div className="shortcut-row" key={shortcut.keys}>
          <dt><kbd>{shortcut.keys}</kbd></dt>
          <dd>{shortcut.description}</dd>
        </div>
      ))}
    </dl>

    <ul className="mouse-tips">
      {MOUSE_TIPS.map(tip => <li key={tip}>{tip}</li>)}
    </ul>
  </>
);

export const ShortcutHelpModal: React.FC<ShortcutHelpModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <ModalShell title="⌨ 단축키와 사용 팁" onClose={onClose} className="shortcut-modal">
      <div className="modal-body">
        <ShortcutListSection />

        <div className="modal-actions">
          <button type="button" className="modal-confirm" onClick={onClose}>확인</button>
        </div>
      </div>
    </ModalShell>
  );
};

export default ShortcutHelpModal;
