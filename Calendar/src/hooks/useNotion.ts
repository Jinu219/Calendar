// ═══════════════════════════════════════════════════════════
// useNotion Hook — export items to the user's Notion database
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Settings, Todo } from "../types";
import { NOTION_LAST_EXPORT_KEY, NOTION_MAP_KEY } from "../constants";
import {
  buildPageChildren,
  buildPageProperties,
  findTitleProperty,
  fingerprint,
  getLocalToday,
  loadJson,
  NotionError,
  notionTitleOf,
  parseNotionId,
  planSchemaChanges,
  readNotionResponse,
  selectTodosForExport,
} from "../utils";

// Notion allows about three requests a second per integration.
const REQUEST_GAP_MS = 350;
const MAX_RATE_RETRIES = 3;

interface PageEntry {
  pageId: string;
  fingerprint: string;
}

/** dataSourceId → todoId → page */
type PageMap = Record<string, Record<string, PageEntry>>;

export interface NotionExportResult {
  at: string;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  /** First per-item error, to show the user what went wrong. */
  firstError?: string;
}

export interface NotionConnection {
  databaseId: string;
  dataSourceId: string;
  title: string;
  titleProperty: string;
  added: string[];
}

const sleep = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

const savePageMap = (map: PageMap) => {
  try {
    localStorage.setItem(NOTION_MAP_KEY, JSON.stringify(map));
  } catch {
    // Without the map the next export updates by creating again; not fatal.
  }
};

export function useNotion(settings: Settings) {
  const [hasToken, setHasToken] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [lastExport, setLastExport] = useState<NotionExportResult | null>(
    () => loadJson<NotionExportResult | null>(NOTION_LAST_EXPORT_KEY, null)
  );
  const exporting = useRef(false);

  useEffect(() => {
    invoke<boolean>("has_notion_token")
      .then(value => setHasToken(value === true))
      .catch(() => setHasToken(false));
  }, []);

  /** One API call through Rust; waits and retries when Notion says "slow down". */
  const request = useCallback(async <T,>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T> => {
    for (let attempt = 0; ; attempt++) {
      let response: { status: number; body: string; retry_after?: number | null } | null;

      try {
        response = await invoke("notion_request", {
          method,
          path,
          body: body === undefined ? null : JSON.stringify(body),
        });
      } catch (error) {
        const text = String(error);
        throw text.includes("토큰이 저장되어 있지")
          ? new NotionError("설정 → Notion에서 통합 토큰을 먼저 저장해 주세요.", "setup")
          : new NotionError("인터넷 연결을 확인해 주세요.", "network");
      }

      if (!response) throw new NotionError("Notion에 연결할 수 없는 환경이에요.", "network");

      if (response.status === 429 && attempt < MAX_RATE_RETRIES) {
        await sleep((response.retry_after ?? 1) * 1000);
        continue;
      }

      return readNotionResponse<T>(response.status, response.body);
    }
  }, []);

  const ready = settings.notionEnabled && hasToken && Boolean(settings.notionDataSourceId && settings.notionTitleProperty);

  /** Find the database, and add the columns the export needs if they're missing. */
  const connect = useCallback(async (input: string): Promise<NotionConnection> => {
    const databaseId = parseNotionId(input);
    if (!databaseId) {
      throw new NotionError("데이터베이스 주소에서 ID를 찾지 못했어요. 데이터베이스를 전체 페이지로 열고 주소를 복사해 주세요.", "setup");
    }

    const database = await request<{ title?: { plain_text?: string }[]; data_sources?: { id: string }[] }>(
      "GET",
      `/v1/databases/${databaseId}`
    );
    const dataSourceId = database.data_sources?.[0]?.id;
    if (!dataSourceId) throw new NotionError("이 데이터베이스에서 데이터 소스를 찾지 못했어요.", "setup");

    const source = await request<{ properties?: Record<string, { type?: string }> }>("GET", `/v1/data_sources/${dataSourceId}`);
    const properties = source.properties ?? {};
    const titleProperty = findTitleProperty(properties);
    if (!titleProperty) throw new NotionError("데이터베이스에 제목 열이 없어요.", "setup");

    const { missing, conflicts } = planSchemaChanges(properties);
    if (conflicts.length > 0) {
      throw new NotionError(
        `데이터베이스의 '${conflicts.join("', '")}' 열이 다른 종류예요. 그 열 이름을 바꾸면 Calendar가 새로 만들어요.`,
        "setup"
      );
    }

    if (Object.keys(missing).length > 0) {
      await request("PATCH", `/v1/data_sources/${dataSourceId}`, { properties: missing });
    }

    return { databaseId, dataSourceId, title: notionTitleOf(database), titleProperty, added: Object.keys(missing) };
  }, [request]);

  /**
   * Create or update one page per item. Unchanged items are skipped, so
   * repeated (and automatic) exports cost a request only for real changes.
   */
  const exportTodos = useCallback(async (todos: Todo[]): Promise<NotionExportResult | null> => {
    if (exporting.current || !settings.notionDataSourceId || !settings.notionTitleProperty) return null;
    exporting.current = true;

    const dataSourceId = settings.notionDataSourceId;
    const map = loadJson<PageMap>(NOTION_MAP_KEY, {});
    const pages = (map[dataSourceId] ??= {});
    const items = selectTodosForExport(todos, settings.notionScope, getLocalToday());
    const result: NotionExportResult = {
      at: new Date().toISOString(),
      total: items.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    };

    setProgress({ done: 0, total: items.length });

    try {
      for (const [index, todo] of items.entries()) {
        const properties = buildPageProperties(todo, settings.notionTitleProperty, settings.colorLabels);
        const print = fingerprint(properties);
        const known: PageEntry | undefined = pages[todo.id];

        if (known?.fingerprint === print) {
          result.skipped++;
          setProgress({ done: index + 1, total: items.length });
          continue;
        }

        try {
          let pageId: string | undefined = known?.pageId;

          if (pageId) {
            try {
              await request("PATCH", `/v1/pages/${pageId}`, { properties });
              result.updated++;
            } catch (error) {
              // The page was deleted or trashed in Notion: make a fresh one.
              if (!(error instanceof NotionError) || (error.status !== 404 && error.status !== 400)) throw error;
              pageId = undefined;
            }
          }

          if (!pageId) {
            const page = await request<{ id: string }>("POST", "/v1/pages", {
              parent: { type: "data_source_id", data_source_id: dataSourceId },
              properties,
              children: buildPageChildren(todo),
            });
            pageId = page.id;
            result.created++;
          }

          pages[todo.id] = { pageId, fingerprint: print };
          savePageMap(map);
        } catch (error) {
          // A token/permission/database problem fails every item: stop right away.
          if (error instanceof NotionError && ["auth", "forbidden", "network", "setup"].includes(error.code)) throw error;
          result.failed++;
          result.firstError ??= error instanceof Error ? error.message : String(error);
        }

        setProgress({ done: index + 1, total: items.length });
        await sleep(REQUEST_GAP_MS);
      }

      localStorage.setItem(NOTION_LAST_EXPORT_KEY, JSON.stringify(result));
      setLastExport(result);
      return result;
    } finally {
      exporting.current = false;
      setProgress(null);
    }
  }, [request, settings.notionDataSourceId, settings.notionTitleProperty, settings.notionScope, settings.colorLabels]);

  const saveToken = useCallback(async (token: string) => {
    await invoke("set_notion_token", { token });
    setHasToken(true);
  }, []);

  const deleteToken = useCallback(async () => {
    await invoke("delete_notion_token");
    setHasToken(false);
  }, []);

  return {
    hasToken,
    ready,
    progress,
    lastExport,
    connect,
    exportTodos,
    saveToken,
    deleteToken,
  };
}

export type NotionFeatures = ReturnType<typeof useNotion>;
