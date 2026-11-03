// ═══════════════════════════════════════════════════════════
// useClaude Hook — the app's Claude features, with the user's own API key
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ClaudeModelId, EventFormData, Settings } from "../types";
import { CLAUDE_USAGE_KEY } from "../constants";
import {
  BRIEFING_SYSTEM,
  buildBriefingUser,
  buildClaudeRequest,
  buildEventParseUser,
  buildSubtasksUser,
  ClaudeError,
  estimateCostUsd,
  EVENT_DRAFT_SCHEMA,
  EVENT_PARSE_SYSTEM,
  loadJson,
  parseJsonReply,
  readClaudeResponse,
  SUBTASKS_SCHEMA,
  SUBTASKS_SYSTEM,
  supportsFallback,
  toEventDraft,
  toSubtaskTitles,
  type BriefingItem,
  type ClaudeResult,
  type EventParseContext,
} from "../utils";

export interface ClaudeMonthlyUsage {
  month: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

const currentMonth = () => new Date().toISOString().slice(0, 7);

const readUsage = (): ClaudeMonthlyUsage => {
  const saved = loadJson<ClaudeMonthlyUsage | null>(CLAUDE_USAGE_KEY, null);
  return saved && saved.month === currentMonth()
    ? saved
    : { month: currentMonth(), calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
};

export type BriefingInput = Parameters<typeof buildBriefingUser>[0];

export function useClaude(settings: Pick<Settings, "claudeEnabled" | "claudeModel">) {
  const [hasKey, setHasKey] = useState(false);
  const [usage, setUsage] = useState<ClaudeMonthlyUsage>(readUsage);

  useEffect(() => {
    invoke<boolean>("has_claude_api_key")
      .then(value => setHasKey(value === true))
      .catch(() => setHasKey(false));
  }, []);

  // Read-modify-write outside the state updater: updaters may run twice
  // (StrictMode), which would count every call double.
  const recordUsage = useCallback((model: ClaudeModelId, result: ClaudeResult) => {
    const prev = readUsage();
    const next: ClaudeMonthlyUsage = {
      ...prev,
      calls: prev.calls + 1,
      inputTokens: prev.inputTokens + result.usage.input_tokens,
      outputTokens: prev.outputTokens + result.usage.output_tokens,
      costUsd: prev.costUsd + estimateCostUsd(model, result.usage),
    };

    try {
      localStorage.setItem(CLAUDE_USAGE_KEY, JSON.stringify(next));
    } catch {
      // Usage display is best-effort.
    }
    setUsage(next);
  }, []);

  /** One Messages API call through the Rust side (which holds the key). */
  const call = useCallback(async (request: ReturnType<typeof buildClaudeRequest>): Promise<ClaudeResult> => {
    let response: { status: number; body: string } | null;

    try {
      response = await invoke<{ status: number; body: string } | null>("claude_messages", {
        body: JSON.stringify(request),
        useFallback: supportsFallback(request.model),
      });
    } catch (error) {
      const text = String(error);
      throw text.includes("키가 저장되어 있지")
        ? new ClaudeError("설정 → Claude AI에서 API 키를 먼저 저장해 주세요.", "no-key")
        : new ClaudeError("인터넷 연결을 확인해 주세요.", "network");
    }

    if (!response) throw new ClaudeError("Claude에 연결할 수 없는 환경이에요.", "network");

    const result = readClaudeResponse(response.status, response.body);
    recordUsage(request.model, result);
    return result;
  }, [recordUsage]);

  const ready = settings.claudeEnabled && hasKey;

  const parseEvent = useCallback(async (text: string, context: EventParseContext): Promise<Partial<EventFormData>> => {
    const result = await call(buildClaudeRequest({
      model: settings.claudeModel,
      system: EVENT_PARSE_SYSTEM,
      user: buildEventParseUser(text, context),
      maxTokens: 4000,
      schema: EVENT_DRAFT_SCHEMA,
    }));

    return toEventDraft(parseJsonReply(result.text), context);
  }, [call, settings.claudeModel]);

  const suggestSubtasks = useCallback(async (title: string, dueDate: string, existing: string[]): Promise<string[]> => {
    const result = await call(buildClaudeRequest({
      model: settings.claudeModel,
      system: SUBTASKS_SYSTEM,
      user: buildSubtasksUser(title, dueDate, existing),
      maxTokens: 4000,
      schema: SUBTASKS_SCHEMA,
    }));

    return toSubtaskTitles(parseJsonReply(result.text), existing);
  }, [call, settings.claudeModel]);

  const briefing = useCallback(async (input: BriefingInput): Promise<string> => {
    const result = await call(buildClaudeRequest({
      model: settings.claudeModel,
      system: BRIEFING_SYSTEM,
      user: buildBriefingUser(input),
      maxTokens: 4000,
    }));

    return result.text;
  }, [call, settings.claudeModel]);

  /** Smallest possible request, to confirm the key and model work. */
  const testConnection = useCallback(async (): Promise<string> => {
    const result = await call(buildClaudeRequest({
      model: settings.claudeModel,
      system: "연결 확인용 요청입니다.",
      user: "'연결됐어요'라고만 답해 주세요.",
      maxTokens: 1000,
    }));

    return result.text;
  }, [call, settings.claudeModel]);

  const saveKey = useCallback(async (key: string) => {
    await invoke("set_claude_api_key", { key });
    setHasKey(true);
  }, []);

  const deleteKey = useCallback(async () => {
    await invoke("delete_claude_api_key");
    setHasKey(false);
  }, []);

  return {
    hasKey,
    ready,
    usage,
    parseEvent,
    suggestSubtasks,
    briefing,
    testConnection,
    saveKey,
    deleteKey,
  };
}

export type ClaudeFeatures = ReturnType<typeof useClaude>;
export type { BriefingItem };
