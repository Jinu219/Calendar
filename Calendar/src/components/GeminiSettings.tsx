// ═══════════════════════════════════════════════════════════
// GeminiSettings — free AI for sentences the rules don't get
// ═══════════════════════════════════════════════════════════

import React, { useState } from "react";
import type { Settings } from "../types";
import type { GeminiFeatures } from "../hooks/useGemini";
import { GEMINI_MODELS } from "../constants";
import { SelectRow, SettingRow, SwitchRow } from "./SettingControls";

interface GeminiSettingsProps {
  settings: Settings;
  gemini: GeminiFeatures;
  onSetSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

type Status = { kind: "idle" } | { kind: "ok" | "error"; text: string };

export const GeminiSettings: React.FC<GeminiSettingsProps> = ({ settings, gemini, onSetSetting }) => {
  const [keyInput, setKeyInput] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const run = async (action: () => Promise<string>) => {
    try {
      setStatus({ kind: "ok", text: await action() });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <>
      <SwitchRow
        label="✨ 문장 → 일정 (Gemini)"
        checked={settings.geminiEnabled}
        onChange={value => onSetSetting("geminiEnabled", value)}
      />

      {settings.geminiEnabled && (
        <>
          <SettingRow label={gemini.hasKey ? "API 키 🔑" : "API 키"} stacked>
            <form
              className="inline-form"
              onSubmit={e => {
                e.preventDefault();
                const key = keyInput.trim();
                if (!key) return;
                void run(async () => {
                  await gemini.saveKey(key);
                  setKeyInput("");
                  return "키를 Windows 자격 증명 관리자에 저장했어요.";
                });
              }}
            >
              <input
                className="set-input"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={gemini.hasKey ? "저장됨 · 바꾸려면 새 키" : "AIza…"}
                aria-label="Gemini API 키"
                value={keyInput}
                onChange={e => setKeyInput(e.target.value)}
              />
              <button type="submit" className="set-btn" disabled={!keyInput.trim()}>저장</button>
              {gemini.hasKey && (
                <button
                  type="button"
                  className="set-btn danger"
                  onClick={() => void run(async () => {
                    await gemini.deleteKey();
                    return "저장된 Gemini 키를 지웠어요.";
                  })}
                >
                  삭제
                </button>
              )}
            </form>
          </SettingRow>

          <SelectRow
            label="모델"
            options={GEMINI_MODELS.map(model => ({ value: model.id, label: model.label }))}
            value={settings.geminiModel}
            onChange={value => onSetSetting("geminiModel", value)}
          />

          <p className={`set-status ${status.kind === "error" ? "error" : ""}`} role="status">
            {status.kind !== "idle"
              ? status.text
              : `빠른 추가에서 ✨ 또는 Shift+Enter · 오늘 ${gemini.usageToday}회 · 무료 등급은 보낸 문장을 Google이 개선에 쓸 수 있어요`}
          </p>

          <details className="set-help">
            <summary>무료 키 받는 방법</summary>
            <ol>
              <li>aistudio.google.com 에 Google 계정으로 로그인</li>
              <li>Get API key → API 키 만들기 (카드 등록 필요 없음)</li>
              <li>복사한 키(AIza…)를 위에 저장</li>
            </ol>
          </details>
        </>
      )}
    </>
  );
};

export default GeminiSettings;
