import { useCallback, useEffect, useState } from "react";
import type { Memo } from "../types";
import { DEFAULT_MEMO_COLOR, MEMOS_KEY } from "../constants";

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `memo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const nowIso = () => new Date().toISOString();

const createMemo = (): Memo => ({
  id: createId(),
  content: "",
  color: DEFAULT_MEMO_COLOR,
  createdAt: nowIso(),
  updatedAt: nowIso(),
  detached: false,
});

const normalizeMemos = (value: unknown): Memo[] => {
  if (!Array.isArray(value) || value.length === 0) {
    return [createMemo()];
  }

  return value.map((memo: Partial<Memo>) => ({
    id: memo.id || createId(),
    content: memo.content || "",
    color: memo.color || DEFAULT_MEMO_COLOR,
    createdAt: memo.createdAt || nowIso(),
    updatedAt: memo.updatedAt || memo.createdAt || nowIso(),
    detached: memo.detached ?? false,
  }));
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
    localStorage.setItem(MEMOS_KEY, JSON.stringify(memos));
  }, [memos]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== MEMOS_KEY || !event.newValue) return;

      try {
        setMemos(normalizeMemos(JSON.parse(event.newValue)));
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
    (id: string, patch: Partial<Pick<Memo, "content" | "color" | "detached">>) => {
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

  const detachMemo = useCallback((id: string) => {
    updateMemo(id, { detached: true });
  }, [updateMemo]);

  const attachMemo = useCallback((id: string) => {
    updateMemo(id, { detached: false });
  }, [updateMemo]);

  return {
    memos,
    addMemo,
    updateMemo,
    deleteMemo,
    detachMemo,
    attachMemo,
  };
}