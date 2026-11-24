"use client";

import { useCallback, useEffect, useState } from "react";

type Notice = {
  id: string;
  type: string;
  category: string;
  title: string;
  body: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  payload: unknown;
  readAt: string | null;
  createdAt: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
};

export default function NotificationsPage() {
  const [items, setItems] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [listResponse, countResponse] = await Promise.all([
        fetch("/api/notifications?limit=50", { cache: "no-store" }),
        fetch("/api/notifications/unread-count", { cache: "no-store" }),
      ]);
      if (!listResponse.ok || !countResponse.ok) throw new Error("Could not load notifications.");
      const list = await listResponse.json() as { notifications: Notice[] };
      const count = await countResponse.json() as { count: number };
      setItems(list.notifications);
      setUnread(count.count);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function markRead(id: string) {
    const response = await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" });
    if (!response.ok) return;
    setItems(current => current.map(item => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
    setUnread(current => Math.max(0, current - 1));
  }

  async function markAllRead() {
    const response = await fetch("/api/notifications/read-all", { method: "POST" });
    if (!response.ok) return;
    setItems(current => current.map(item => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    setUnread(0);
  }

  return (
    <div className="notification-page">
      <div className="notification-heading">
        <div>
          <p className="notification-eyebrow">SAJE OPERATIONS</p>
          <h1>Notifications</h1>
          <p className="notification-subtitle">Important updates for your restaurant team.</p>
        </div>
        <div className="notification-actions">
          <span className="notification-count">{unread} unread</span>
          <button type="button" onClick={() => void markAllRead()} disabled={unread === 0}>Mark all as read</button>
        </div>
      </div>
      {error ? <p className="notification-error" role="alert">{error}</p> : null}
      {loading ? <div className="notification-empty">Loading notifications…</div> : items.length === 0 ? (
        <div className="notification-empty"><span aria-hidden="true">♧</span><strong>You're all caught up</strong><p>New order and service updates will appear here.</p></div>
      ) : (
        <div className="notification-list">
          {items.map(item => (
            <article className={`notification-item ${item.readAt ? "is-read" : "is-unread"}`} key={item.id}>
              <span className={`notification-priority priority-${item.priority.toLowerCase()}`} aria-hidden="true" />
              <div className="notification-copy">
                <div className="notification-item-top">
                  <strong>{item.title}</strong>
                  <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
                </div>
                <p>{item.body}</p>
                <div className="notification-item-bottom">
                  <span>{item.category.replaceAll("_", " ")}</span>
                  {!item.readAt ? <button type="button" onClick={() => void markRead(item.id)}>Mark as read</button> : <span>Read</span>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
