// ═══════════════════════════════════════════════════════════
// SearchModal — find an item by title (Ctrl+F) and jump to it
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useState } from "react";
import type { Todo } from "../types";
import {
  describeRepeat,
  formatShortDate,
  getTodoStartDate,
  getTodoTimeLabel,
  listOccurrenceStarts,
  shiftDate,
} from "../utils";
import { ModalShell } from "./ModalShell";

interface SearchModalProps {
  open: boolean;
  todos: Todo[];
  today: string;
  use24Hour: boolean;
  colorLabels: Record<string, string>;
  onPick: (todo: Todo, date: string) => void;
  onClose: () => void;
}

interface SearchResult {
  todo: Todo;
  /** The occurrence to jump to: the next one for a series, else the item's date. */
  date: string;
  upcoming: boolean;
}

const MAX_RESULTS = 50;
const LOOKAHEAD_DAYS = 730;

const occurrenceToShow = (todo: Todo, today: string): string => {
  if (todo.repeat === "none") return getTodoStartDate(todo);

  const [next] = listOccurrenceStarts(todo, today, shiftDate(today, LOOKAHEAD_DAYS));
  return next ?? getTodoStartDate(todo);
};

const SearchModalContent: React.FC<Omit<SearchModalProps, "open">> = ({
  todos,
  today,
  use24Hour,
  colorLabels,
  onPick,
  onClose,
}) => {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLocaleLowerCase("ko-KR");
    if (!q) return [];

    return todos
      .filter(todo =>
        todo.title.toLocaleLowerCase("ko-KR").includes(q) ||
        todo.subtasks?.some(s => s.title.toLocaleLowerCase("ko-KR").includes(q)) ||
        (colorLabels[todo.color] ?? "").toLocaleLowerCase("ko-KR").includes(q)
      )
      .map(todo => {
        const date = occurrenceToShow(todo, today);
        return { todo, date, upcoming: date >= today };
      })
      // Upcoming first (soonest first), then the past (most recent first).
      .sort((a, b) =>
        a.upcoming !== b.upcoming
          ? (a.upcoming ? -1 : 1)
          : a.upcoming ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)
      )
      .slice(0, MAX_RESULTS);
  }, [query, todos, today, colorLabels]);

  const pick = (result: SearchResult | undefined) => {
    if (result) onPick(result.todo, result.date);
  };

  return (
    <ModalShell title="🔍 일정 검색" onClose={onClose} className="search-modal">
      <div className="modal-body">
        <input
          className="todo-input modal-input"
          type="search"
          placeholder="제목, 체크리스트, 카테고리 이름으로 찾기"
          aria-label="검색어"
          aria-controls="search-results"
          aria-activedescendant={results[active] ? `search-result-${active}` : undefined}
          value={query}
          autoFocus
          onChange={e => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={e => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive(i => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive(i => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              pick(results[active]);
            }
          }}
        />

        {query.trim() && results.length === 0 && (
          <p className="todo-empty">찾는 일정이 없어요.</p>
        )}

        <ul className="search-results" id="search-results" role="listbox" aria-label="검색 결과">
          {results.map((result, index) => {
            const time = getTodoTimeLabel(result.todo, use24Hour);
            const repeat = result.todo.repeat !== "none" ? describeRepeat(result.todo) : "";

            return (
              <li
                key={result.todo.id}
                id={`search-result-${index}`}
                role="option"
                aria-selected={index === active}
                className={`search-result ${index === active ? "active" : ""} ${result.upcoming ? "" : "past"}`}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(result)}
              >
                <span className="todo-color-bar" style={{ background: result.todo.color }} aria-hidden="true" />
                <span className="search-result-title">{result.todo.title}</span>
                <span className="search-result-meta">
                  {formatShortDate(result.date)}
                  {time && ` · ${time}`}
                  {repeat && ` · ↻ ${repeat}`}
                  {result.todo.sourceId && " · 구독"}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="sg-hint">↑↓로 고르고 Enter를 누르면 그 날짜로 이동합니다.</p>
      </div>
    </ModalShell>
  );
};

export const SearchModal: React.FC<SearchModalProps> = ({ open, ...props }) =>
  open ? <SearchModalContent {...props} /> : null;

export default SearchModal;
