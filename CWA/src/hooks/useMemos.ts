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
});

const loadMemos = (): Memo[] => {
  try {
    const raw = localStorage.getItem(MEMOS_KEY);

    if (!raw) {
      return [createMemo()];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [createMemo()];
    }

    return parsed.map((memo: Partial<Memo>) => ({
      id: memo.id || createId(),
      content: memo.content || "",
      color: memo.color || DEFAULT_MEMO_COLOR,
      createdAt: memo.createdAt || nowIso(),
      updatedAt: memo.updatedAt || memo.createdAt || nowIso(),
    }));
  } catch {
    return [createMemo()];
  }
};

export function useMemos() {
  const [memos, setMemos] = useState<Memo[]>(() => loadMemos());

  useEffect(() => {
    localStorage.setItem(MEMOS_KEY, JSON.stringify(memos));
  }, [memos]);

  const addMemo = useCallback(() => {
    const memo = createMemo();

    setMemos(prev => [...prev, memo]);

    return memo.id;
  }, []);

  const updateMemo = useCallback((id: string, patch: Partial<Pick<Memo, "content" | "color">>) => {
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
  }, []);

  const deleteMemo = useCallback((id: string) => {
    setMemos(prev => {
      const next = prev.filter(memo => memo.id !== id);

      return next.length > 0 ? next : [createMemo()];
    });
  }, []);

  return {
    memos,
    addMemo,
    updateMemo,
    deleteMemo,
  };
}