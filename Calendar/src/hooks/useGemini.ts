// ═══════════════════════════════════════════════════════════
// useGemini Hook — a sentence → items with the user's free Gemini key
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Settings } from "../types";
import { GEMINI_USAGE_KEY } from "../constants";
import {
  buildGeminiRequest,
  GeminiError,
  getLocalToday,
  loadJson,
  readGeminiResponse,
  type GeminiContext,
  type InboxEventInput,
} from "../utils";

interface Usage {
  date: string;
  count: number;
}

const readUsageToday = (): number => {
  const usage = loadJson<Usage | null>(GEMINI_USAGE_KEY, null);
  return usage?.date === getLocalToday() ? usage.count : 0;
};

export function useGemini(settings: Settings) {
  const [hasKey, setHasKey] = useState(false);
  const [usageToday, setUsageToday] = useState(readUsageToday);
  // One press is one request, even if the user presses again while waiting.
  const inFlight = useRef(false);

  useEffect(() => {
    invoke<boolean>("has_gemini_api_key")
      .then(value => setHasKey(value === true))
      .catch(() => setHasKey(false));
  }, []);

  const ready = settings.geminiEnabled && hasKey;

  const parse = useCallback(async (text: string, ctx: GeminiContext): Promise<InboxEventInput[]> => {
    if (inFlight.current) throw new GeminiError("이미 Gemini가 읽는 중이에요.", "setup");
    inFlight.current = true;

    try {
      let response: { status: number; body: string } | null;
      try {
        response = await invoke("gemini_generate", {
          model: settings.geminiModel,
          body: JSON.stringify(buildGeminiRequest(text, ctx)),
        });
      } catch (error) {
        throw String(error).includes("저장되어 있지")
          ? new GeminiError("설정 → 연동에서 Gemini API 키를 먼저 저장해 주세요.", "setup")
          : new GeminiError("인터넷 연결을 확인해 주세요.", "network");
      }
      if (!response) throw new GeminiError("Gemini에 연결할 수 없는 환경이에요.", "network");

      if (response.status === 200) {
        // Counted outside any state updater (StrictMode runs those twice).
        const count = readUsageToday() + 1;
        localStorage.setItem(GEMINI_USAGE_KEY, JSON.stringify({ date: getLocalToday(), count }));
        setUsageToday(count);
      }

      return readGeminiResponse(response.status, response.body);
    } finally {
      inFlight.current = false;
    }
  }, [settings.geminiModel]);

  const saveKey = useCallback(async (key: string) => {
    await invoke("set_gemini_api_key", { key });
    setHasKey(true);
  }, []);

  const deleteKey = useCallback(async () => {
    await invoke("delete_gemini_api_key");
    setHasKey(false);
  }, []);

  return { hasKey, ready, usageToday, parse, saveKey, deleteKey };
}

export type GeminiFeatures = ReturnType<typeof useGemini>;
