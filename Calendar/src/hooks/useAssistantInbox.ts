// ═══════════════════════════════════════════════════════════
// useAssistantInbox Hook — items Claude adds from a conversation
// ═══════════════════════════════════════════════════════════
//
// The Calendar MCP server leaves requests in the app data folder; this takes
// them every few seconds (and when the window gets focus) and hands the
// validated items to `onItems`.

import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { INBOX_LAST_KEY } from "../constants";
import { loadJson, readInboxFiles, type InboxTodoInput } from "../utils";

const POLL_MS = 2000;

export interface InboxReceipt {
  at: string;
  titles: string[];
}

export function useAssistantInbox(
  enabled: boolean,
  colorLabels: Record<string, string>,
  onItems: (inputs: InboxTodoInput[]) => void
) {
  const [lastInbox, setLastInbox] = useState<InboxReceipt | null>(
    () => loadJson<InboxReceipt | null>(INBOX_LAST_KEY, null)
  );
  const colorLabelsRef = useRef(colorLabels);
  const onItemsRef = useRef(onItems);
  colorLabelsRef.current = colorLabels;
  onItemsRef.current = onItems;

  useEffect(() => {
    if (!enabled) return;

    let busy = false;

    const take = async () => {
      if (busy) return;
      busy = true;

      try {
        const files = await invoke<string[] | null>("take_inbox");
        if (!files?.length) return;

        const { inputs, errors } = readInboxFiles(files, colorLabelsRef.current);
        if (errors.length > 0) console.warn("Skipped inbox items:", errors);
        if (inputs.length === 0) return;

        onItemsRef.current(inputs);

        const receipt = { at: new Date().toISOString(), titles: inputs.map(input => input.title) };
        localStorage.setItem(INBOX_LAST_KEY, JSON.stringify(receipt));
        setLastInbox(receipt);
      } catch (error) {
        console.error("Failed to read the inbox:", error);
      } finally {
        busy = false;
      }
    };

    void take();
    const timer = window.setInterval(take, POLL_MS);
    window.addEventListener("focus", take);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", take);
    };
  }, [enabled]);

  return { lastInbox };
}
