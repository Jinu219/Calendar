import { useCallback, useEffect, useRef, useState } from "react";
import type { Memo } from "../types";
import { DEFAULT_MEMO_COLOR, MEMOS_KEY } from "../constants";
import { createId, persistItem } from "../utils";

const nowIso = () => new Date().toISOString();

const createMemo = (): Memo => ({
  id: createId("memo"),
  content: "",
  color: DEFAULT_MEMO_COLOR,
  createdAt: nowIso(),
  updatedAt: nowIso(),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const normalizeMemos = (value: unknown): Memo[] => {
  if (!Array.isArray(value)) {
    return [createMemo()];
  }

  const memos = value.filter(isRecord).map(memo => {
    const createdAt = typeof memo.createdAt === "string"
      ? memo.createdAt
      : nowIso();

    return {
      id: typeof memo.id === "string" ? memo.id : createId("memo"),
      content: typeof memo.content === "string" ? memo.content : "",
      color: typeof memo.color === "string" ? memo.color : DEFAULT_MEMO_COLOR,
      createdAt,
      updatedAt: typeof memo.updatedAt === "string" ? memo.updatedAt : createdAt,
      linkedDate: typeof memo.linkedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(memo.linkedDate)
        ? memo.linkedDate
        : undefined,
    };
  });

  return memos.length > 0 ? memos : [createMemo()];
};

const loadMemos = (): Memo[] => {
  try {
    const raw = localStorage.getItem(MEMOS_KEY);

    if (!raw) {
      return [createMemo()];
    }

    return normalizeMemos(JSON.parse(raw));
  } catch {
    return [createMemo()];
  }
};

export function useMemos() {
  const [memos, setMemos] = useState<Memo[]>(() => loadMemos());
  // The memos JSON this window last read from or wrote to storage. Both the
  // calendar and every memo window use this hook; without it a window saved
  // again what another window had just saved, and because storage events
  // arrive late, that echo could be an older version that overwrote the text
  // being typed (lost characters, broken Hangul composition).
  const syncedJsonRef = useRef<string | null>(localStorage.getItem(MEMOS_KEY));

  useEffect(() => {
    const json = JSON.stringify(memos);
    if (json === syncedJsonRef.current) return;

    syncedJsonRef.current = json;
    try {
      persistItem(MEMOS_KEY, json);
    } catch (error) {
      console.error("Failed to persist memos:", error);
    }
  }, [memos]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== MEMOS_KEY && event.key !== null) return;

      // Read what is saved now rather than event.newValue: the other window may
      // have saved again since this event was queued.
      const raw = localStorage.getItem(MEMOS_KEY);
      if (raw === syncedJsonRef.current) return;

      try {
        const next = raw ? normalizeMemos(JSON.parse(raw)) : [createMemo()];
        // Taken from storage, so the save effect must not write it back.
        syncedJsonRef.current = JSON.stringify(next);
        setMemos(next);
      } catch {
        // ignore invalid external storage changes
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const addMemo = useCallback(() => {
    const memo = createMemo();

    setMemos(prev => [...prev, memo]);

    return memo.id;
  }, []);

  const updateMemo = useCallback(
    (id: string, patch: Partial<Pick<Memo, "content" | "color" | "linkedDate">>) => {
      setMemos(prev =>
        prev.map(memo =>
          memo.id === id
            ? {
                ...memo,
                ...patch,
                updatedAt: nowIso(),
              }
            : memo
        )
      );
    },
    []
  );

  const deleteMemo = useCallback((id: string) => {
    setMemos(prev => {
      const next = prev.filter(memo => memo.id !== id);

      return next.length > 0 ? next : [createMemo()];
    });
  }, []);

  const moveMemo = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return;

    setMemos(prev => {
      const fromIndex = prev.findIndex(memo => memo.id === fromId);
      const toIndex = prev.findIndex(memo => memo.id === toId);

      if (fromIndex < 0 || toIndex < 0) {
        return prev;
      }

      const next = [...prev];
      const [movedMemo] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, movedMemo);

      return next;
    });
  }, []);

  return {
    memos,
    addMemo,
    updateMemo,
    deleteMemo,
    moveMemo,
  };
}
