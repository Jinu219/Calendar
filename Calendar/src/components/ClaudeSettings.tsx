// ═══════════════════════════════════════════════════════════
// ClaudeSettings — opt-in, API key, model and usage for Claude features
// ═══════════════════════════════════════════════════════════

import React, { useState } from "react";
import type { ClaudeModelId } from "../types";
import type { ClaudeMonthlyUsage } from "../hooks/useClaude";
import { CLAUDE_MODELS } from "../constants";
import { SegmentedControl } from "./SegmentedControl";

interface ClaudeSettingsProps {
  enabled: boolean;
  model: ClaudeModelId;
  hasKey: boolean;
  usage: ClaudeMonthlyUsage;
  onEnabledChange: (enabled: boolean) => void;
  onModelChange: (model: ClaudeModelId) => void;
  onSaveKey: (key: string) => Promise<void>;
  onDeleteKey: () => Promise<void>;
  onTest: () => Promise<string>;
}

type Status = { kind: "idle" } | { kind: "busy"; text: string } | { kind: "ok" | "error"; text: string };

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const ClaudeSettings: React.FC<ClaudeSettingsProps> = ({
  enabled,
  model,
  hasKey,
  usage,
  onEnabledChange,
  onModelChange,
  onSaveKey,
  onDeleteKey,
  onTest,
}) => {
  const [keyInput, setKeyInput] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const run = async (busyText: string, action: () => Promise<string>) => {
    setStatus({ kind: "busy", text: busyText });
    try {
      setStatus({ kind: "ok", text: await action() });
    } catch (error) {
      setStatus({ kind: "error", text: errorText(error) });
    }
  };

  return (
    <>
      <SegmentedControl<boolean>
        label="Claude AI 사용"
        options={[
          { value: true, label: "Claude 사용" },
          { value: false, label: "사용 안 함" },
        ]}
        value={enabled}
        onChange={onEnabledChange}
      />

      <p className="sg-hint">
        켜면 ✨ 버튼으로 문장을 일정으로 바꾸고(빠른 추가 칸에서 Shift+Enter), 할 일을 단계로 나누고, 오늘 브리핑을 받을 수 있어요.
        누를 때만 그 일정의 제목·날짜가 Anthropic으로 전송되고, 메모는 보내지 않아요.
      </p>

      {enabled && (
        <>
          <form
            className="claude-key-row"
            onSubmit={e => {
              e.preventDefault();
              const key = keyInput.trim();
              if (!key) return;
              void run("키를 저장하는 중…", async () => {
                await onSaveKey(key);
                setKeyInput("");
                return "API 키를 Windows 자격 증명 관리자에 저장했어요.";
              });
            }}
          >
            <input
              className="font-search"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder={hasKey ? "저장된 키가 있어요 (바꾸려면 새 키 입력)" : "sk-ant-… API 키 붙여넣기"}
              aria-label="Claude API 키"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
            />
            <button type="submit" className="edit-mode-btn" disabled={!keyInput.trim()}>저장</button>
          </form>

          <p className="sg-hint">
            키는 console.anthropic.com에서 발급해요(Claude 구독과 별개로 크레딧 충전 필요). 앱 파일이나 백업에는 저장되지 않아요.
          </p>

          <label className="repeat-row">
            <span className="repeat-label">모델</span>
            <select
              className="repeat-select"
              value={model}
              onChange={e => onModelChange(e.target.value as ClaudeModelId)}
            >
              {CLAUDE_MODELS.map(option => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>

          <div className="btn-row">
            <button
              type="button"
              className="edit-mode-btn"
              disabled={!hasKey || status.kind === "busy"}
              onClick={() => void run("연결 확인 중…", async () => `연결 확인: ${await onTest()}`)}
            >
              연결 테스트
            </button>
            <button
              type="button"
              className="edit-mode-btn"
              disabled={!hasKey || status.kind === "busy"}
              onClick={() => void run("키를 지우는 중…", async () => {
                await onDeleteKey();
                return "저장된 API 키를 지웠어요.";
              })}
            >
              키 삭제
            </button>
          </div>

          {status.kind !== "idle" && (
            <p className={`sg-hint ${status.kind === "error" ? "claude-error" : ""}`} role="status">{status.text}</p>
          )}

          <p className="sg-hint">
            {hasKey ? "🔑 키 저장됨" : "🔑 키 없음"} · 이번 달 {usage.calls}회 사용
            {usage.calls > 0 && ` · 약 $${usage.costUsd < 0.01 ? usage.costUsd.toFixed(4) : usage.costUsd.toFixed(2)} (추정)`}
          </p>
        </>
      )}
    </>
  );
};

export default ClaudeSettings;
