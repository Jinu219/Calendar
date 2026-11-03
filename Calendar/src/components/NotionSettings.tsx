// ═══════════════════════════════════════════════════════════
// NotionSettings — token, database and export to Notion
// ═══════════════════════════════════════════════════════════

import React, { useState } from "react";
import type { Settings } from "../types";
import type { NotionFeatures } from "../hooks/useNotion";
import { SelectRow, SettingRow, SwitchRow } from "./SettingControls";

interface NotionSettingsProps {
  settings: Settings;
  notion: NotionFeatures;
  onSetSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  onExport: () => Promise<string>;
}

type Status = { kind: "idle" } | { kind: "busy" | "ok" | "error"; text: string };

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

const formatAt = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const SCOPES: { value: Settings["notionScope"]; label: string }[] = [
  { value: "upcoming", label: "오늘부터" },
  { value: "recent", label: "최근 30일부터" },
  { value: "all", label: "전체" },
];

export const NotionSettings: React.FC<NotionSettingsProps> = ({ settings, notion, onSetSetting, onExport }) => {
  const [tokenInput, setTokenInput] = useState("");
  const [databaseInput, setDatabaseInput] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const connected = Boolean(settings.notionDataSourceId);
  const last = notion.lastExport;

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
      <SwitchRow
        label="Notion으로 내보내기"
        checked={settings.notionEnabled}
        onChange={value => onSetSetting("notionEnabled", value)}
      />

      {settings.notionEnabled && (
        <>
          <SettingRow label={notion.hasToken ? "통합 토큰 🔑" : "통합 토큰"} stacked>
            <form
              className="inline-form"
              onSubmit={e => {
                e.preventDefault();
                const token = tokenInput.trim();
                if (!token) return;
                void run("토큰을 저장하는 중…", async () => {
                  await notion.saveToken(token);
                  setTokenInput("");
                  return "토큰을 Windows 자격 증명 관리자에 저장했어요.";
                });
              }}
            >
              <input
                className="set-input"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={notion.hasToken ? "저장됨 · 바꾸려면 새 토큰" : "ntn_…"}
                aria-label="Notion 통합 토큰"
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
              />
              <button type="submit" className="set-btn" disabled={!tokenInput.trim()}>저장</button>
              {notion.hasToken && (
                <button
                  type="button"
                  className="set-btn danger"
                  onClick={() => void run("토큰을 지우는 중…", async () => {
                    await notion.deleteToken();
                    return "저장된 Notion 토큰을 지웠어요.";
                  })}
                >
                  삭제
                </button>
              )}
            </form>
          </SettingRow>

          <SettingRow label={connected ? `📒 ${settings.notionDatabaseTitle}` : "데이터베이스"} stacked>
            <form
              className="inline-form"
              onSubmit={e => {
                e.preventDefault();
                const input = databaseInput.trim();
                if (!input) return;
                void run("데이터베이스에 연결하는 중…", async () => {
                  const connection = await notion.connect(input);
                  onSetSetting("notionDatabaseId", connection.databaseId);
                  onSetSetting("notionDataSourceId", connection.dataSourceId);
                  onSetSetting("notionDatabaseTitle", connection.title);
                  onSetSetting("notionTitleProperty", connection.titleProperty);
                  setDatabaseInput("");
                  return connection.added.length > 0
                    ? `'${connection.title}'에 연결하고 열 ${connection.added.length}개(${connection.added.join(", ")})를 만들었어요.`
                    : `'${connection.title}'에 연결했어요.`;
                });
              }}
            >
              <input
                className="set-input"
                placeholder={connected ? "다른 데이터베이스 주소" : "https://www.notion.so/…"}
                aria-label="Notion 데이터베이스 주소"
                value={databaseInput}
                onChange={e => setDatabaseInput(e.target.value)}
              />
              <button type="submit" className="set-btn" disabled={!notion.hasToken || !databaseInput.trim()}>연결</button>
            </form>
          </SettingRow>

          {connected && (
            <>
              <SelectRow
                label="범위"
                options={SCOPES}
                value={settings.notionScope}
                onChange={value => onSetSetting("notionScope", value)}
              />
              <SwitchRow
                label="고칠 때마다 자동"
                checked={settings.notionAutoSync}
                onChange={value => onSetSetting("notionAutoSync", value)}
              />
              <SettingRow label={last ? `마지막 ${formatAt(last.at)}` : "내보내기"}>
                <button
                  type="button"
                  className="set-btn primary"
                  disabled={!notion.ready || notion.progress !== null}
                  onClick={() => void run("내보내는 중…", onExport)}
                >
                  {notion.progress ? `${notion.progress.done}/${notion.progress.total}` : "지금 내보내기"}
                </button>
              </SettingRow>
            </>
          )}

          {status.kind !== "idle" && (
            <p className={`set-status ${status.kind === "error" ? "error" : ""}`} role="status">{status.text}</p>
          )}

          <details className="set-help">
            <summary>처음 설정하는 방법</summary>
            <ol>
              <li>notion.so/profile/integrations 에서 내부 통합을 만들고 토큰(ntn_…)을 복사</li>
              <li>내보낼 데이터베이스 ··· → 연결 → 그 통합 추가</li>
              <li>토큰 저장 → 데이터베이스 주소로 연결 (필요한 열은 자동 생성)</li>
            </ol>
          </details>
        </>
      )}
    </>
  );
};

export default NotionSettings;
