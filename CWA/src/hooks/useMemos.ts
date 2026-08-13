import { useCallback, useEffect, useState } from "react";
import type { Memo } from "../types";
import { DEFAULT_MEMO_COLOR, MEMOS_KEY } from "../constants";
import { createId } from "../utils";

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

const normalizeMemos = (value: unknown): Memo[] => {
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

  useEffect(() => {
    try {
      localStorage.setItem(MEMOS_KEY, JSON.stringify(memos));
    } catch (error) {
      console.error("Failed to persist memos:", error);
    }
  }, [memos]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== MEMOS_KEY) return;

      try {
        setMemos(event.newValue
          ? normalizeMemos(JSON.parse(event.newValue))
          : [createMemo()]
        );
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
    (id: string, patch: Partial<Pick<Memo, "content" | "color">>) => {
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
