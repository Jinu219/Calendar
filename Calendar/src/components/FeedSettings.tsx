// ═══════════════════════════════════════════════════════════
// FeedSettings — manage subscribed ICS calendars
// ═══════════════════════════════════════════════════════════

import React, { useState } from "react";
import type { CalendarFeed } from "../types";
import type { FeedStatus } from "../hooks/useCalendarFeeds";
import { TODO_COLORS } from "../constants";
import { createId } from "../utils";
import { ColorSwatches } from "./ColorSwatches";

interface FeedSettingsProps {
  feeds: CalendarFeed[];
  onChange: (feeds: CalendarFeed[]) => void;
  statusFor: (id: string) => FeedStatus;
  onRefresh: (id?: string) => void;
}

const formatFetchedAt = (time?: number): string => {
  if (!time) return "아직 받지 않음";
  const d = new Date(time);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} 갱신`;
};

export const FeedSettings: React.FC<FeedSettingsProps> = ({ feeds, onChange, statusFor, onRefresh }) => {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [color, setColor] = useState<string>(TODO_COLORS[4]);

  const update = (id: string, patch: Partial<CalendarFeed>) =>
    onChange(feeds.map(feed => feed.id === id ? { ...feed, ...patch } : feed));

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!/^(https?|webcal):\/\//i.test(trimmed)) return;

    onChange([...feeds, { id: createId("feed"), name: name.trim() || "구독 캘린더", url: trimmed, color, enabled: true }]);
    setName("");
    setUrl("");
  };

  return (
    <>
      {feeds.length === 0 && (
        <p className="sg-hint">
          Google 캘린더의 "iCal 형식의 비공개 주소"나 학사일정 .ics 주소를 붙여 넣으면 읽기 전용으로 겹쳐 보여요.
        </p>
      )}

      <ul className="feed-list">
        {feeds.map(feed => {
          const status = statusFor(feed.id);

          return (
            <li key={feed.id} className="feed-row">
              <label className="feed-toggle">
                <input
                  type="checkbox"
                  checked={feed.enabled}
                  onChange={e => update(feed.id, { enabled: e.target.checked })}
                />
                <span className="category-dot" style={{ background: feed.color }} aria-hidden="true" />
                <span className="feed-name">{feed.name}</span>
              </label>

              <span className={`feed-status ${status.error ? "error" : ""}`} role="status">
                {status.loading
                  ? "받는 중…"
                  : status.error
                    ? status.error
                    : `${status.count}개 · ${formatFetchedAt(status.fetchedAt)}`}
              </span>

              <div className="feed-actions">
                <button type="button" className="modal-cancel" onClick={() => onRefresh(feed.id)} disabled={!feed.enabled}>
                  새로고침
                </button>
                <button
                  type="button"
                  className="modal-danger"
                  onClick={() => onChange(feeds.filter(f => f.id !== feed.id))}
                  aria-label={`${feed.name} 구독 해지`}
                >
                  해지
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <form className="feed-add" onSubmit={add}>
        <input
          className="font-search"
          placeholder="이름 (예: 학사일정)"
          aria-label="구독 이름"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <input
          className="font-search"
          type="url"
          placeholder="https://… .ics 또는 webcal://…"
          aria-label="캘린더 주소"
          value={url}
          onChange={e => setUrl(e.target.value)}
        />
        <ColorSwatches colors={TODO_COLORS} value={color} onChange={setColor} label="구독 캘린더 색상" />
        <button type="submit" className="edit-mode-btn" disabled={!/^(https?|webcal):\/\//i.test(url.trim())}>
          구독 추가
        </button>
      </form>
    </>
  );
};

export default FeedSettings;
