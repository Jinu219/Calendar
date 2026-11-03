// ═══════════════════════════════════════════════════════════
// useCalendarFeeds Hook — subscribed ICS calendars as read-only items
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { CalendarFeed, Todo } from "../types";
import { FEED_CACHE_KEY, FEED_REFRESH_MS } from "../constants";
import { loadJson, parseIcs } from "../utils";

interface CachedFeed {
  url: string;
  fetchedAt: number;
  todos: Todo[];
}

export interface FeedStatus {
  loading: boolean;
  error?: string;
  count: number;
  fetchedAt?: number;
}

// Big calendars are refetched rather than filling up localStorage.
const MAX_CACHE_CHARS = 1_500_000;
const STALE_CHECK_MS = 30 * 60_000;

const readCache = (): Record<string, CachedFeed> =>
  loadJson<Record<string, CachedFeed>>(FEED_CACHE_KEY, {});

const writeCache = (cache: Record<string, CachedFeed>) => {
  try {
    const json = JSON.stringify(cache);
    if (json.length <= MAX_CACHE_CHARS) localStorage.setItem(FEED_CACHE_KEY, json);
  } catch {
    // Cache is best-effort.
  }
};

export function useCalendarFeeds(feeds: CalendarFeed[]) {
  const [cache, setCache] = useState<Record<string, CachedFeed>>(readCache);
  const [statuses, setStatuses] = useState<Record<string, FeedStatus>>({});
  const inFlight = useRef(new Set<string>());

  const fetchFeed = useCallback(async (feed: CalendarFeed) => {
    if (inFlight.current.has(feed.id)) return;
    inFlight.current.add(feed.id);
    setStatuses(prev => ({ ...prev, [feed.id]: { ...prev[feed.id], loading: true, count: prev[feed.id]?.count ?? 0 } }));

    try {
      const text = await invoke<string | null>("fetch_calendar_feed", { url: feed.url });
      if (!text || !text.includes("BEGIN:VCALENDAR")) {
        throw new Error("캘린더(ICS) 파일이 아니에요. 공개 주소(.ics)인지 확인해 주세요.");
      }

      const todos = parseIcs(text, feed);
      const entry: CachedFeed = { url: feed.url, fetchedAt: Date.now(), todos };

      setCache(prev => {
        const next = { ...prev, [feed.id]: entry };
        writeCache(next);
        return next;
      });
      setStatuses(prev => ({ ...prev, [feed.id]: { loading: false, count: todos.length, fetchedAt: entry.fetchedAt } }));
    } catch (error) {
      setStatuses(prev => ({
        ...prev,
        [feed.id]: {
          ...prev[feed.id],
          loading: false,
          count: prev[feed.id]?.count ?? 0,
          error: error instanceof Error ? error.message : String(error),
        },
      }));
    } finally {
      inFlight.current.delete(feed.id);
    }
  }, []);

  // Fetch feeds that are new, changed or stale — now and every half hour.
  useEffect(() => {
    const refreshStale = () => {
      const current = readCache();

      for (const feed of feeds) {
        if (!feed.enabled) continue;

        const cached = current[feed.id];
        if (!cached || cached.url !== feed.url || Date.now() - cached.fetchedAt > FEED_REFRESH_MS) {
          void fetchFeed(feed);
        }
      }
    };

    refreshStale();
    const interval = window.setInterval(refreshStale, STALE_CHECK_MS);
    return () => window.clearInterval(interval);
  }, [feeds, fetchFeed]);

  const refresh = useCallback((id?: string) => {
    feeds
      .filter(feed => feed.enabled && (!id || feed.id === id))
      .forEach(feed => void fetchFeed(feed));
  }, [feeds, fetchFeed]);

  const feedTodos = useMemo(
    () => feeds
      .filter(feed => feed.enabled && cache[feed.id]?.url === feed.url)
      // Colors follow the current setting even for cached items.
      .flatMap(feed => cache[feed.id].todos.map(todo => ({ ...todo, color: feed.color }))),
    [feeds, cache]
  );

  const statusFor = useCallback((id: string): FeedStatus => statuses[id] ?? {
    loading: false,
    count: cache[id]?.todos.length ?? 0,
    fetchedAt: cache[id]?.fetchedAt,
  }, [statuses, cache]);

  return { feedTodos, statusFor, refresh };
}
