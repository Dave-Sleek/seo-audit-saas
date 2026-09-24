"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  /* ---------- Fetch on mount + every 60s ---------- */

  async function refresh() {
    try {
      const res = await fetch("/api/notifications?limit=20", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications ?? []);
      setUnread(data.unread ?? 0);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, []);

  /* ---------- Fetch when opening ---------- */

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [open]);

  /* ---------- Close on outside click ---------- */

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  /* ---------- Actions ---------- */

  async function markRead(id: string) {
    setItems((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, readAt: new Date().toISOString() } : n
      )
    );
    setUnread((n) => Math.max(0, n - 1));

    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
  }

  async function markAllRead() {
    setItems((prev) =>
      prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
    );
    setUnread(0);

    await fetch("/api/notifications/read-all", { method: "POST" });
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative rounded-lg p-2 transition hover:bg-slate-100"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unread > 0 && (
          <span
            className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-xs font-bold text-white"
            style={{ background: "var(--danger)" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-96 overflow-hidden rounded-xl border shadow-lg"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
          }}
        >
          <header
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: "var(--border)" }}
          >
            <h3 className="text-sm font-semibold">Notifications</h3>

            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-medium"
                style={{ color: "var(--primary)" }}
              >
                Mark all read
              </button>
            )}
          </header>

          <div className="max-h-96 overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="p-6 text-center">
                <p
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Loading...
                </p>
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center">
                <p
                  className="text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  No notifications yet.
                </p>
              </div>
            ) : (
              <ul>
                {items.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={n.actionUrl ?? "#"}
                      onClick={() => {
                        if (!n.readAt) markRead(n.id);
                        if (!n.actionUrl) {
                          // If there's no action URL, don't navigate
                          // away — just mark as read.
                          return;
                        }
                        setOpen(false);
                      }}
                      className="flex gap-3 border-b px-4 py-3 transition hover:bg-slate-50"
                      style={{
                        borderColor: "var(--border-light)",
                        opacity: n.readAt ? 0.7 : 1,
                      }}
                    >
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                        style={{
                          background: n.readAt
                            ? "transparent"
                            : "var(--primary)",
                        }}
                        aria-hidden="true"
                      />

                      <div className="min-w-0 flex-1">
                        <div
                          className="text-sm font-medium"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {n.title}
                        </div>
                        {n.body && (
                          <div
                            className="mt-0.5 text-xs"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {n.body}
                          </div>
                        )}
                        <div
                          className="mt-1 text-xs"
                          style={{ color: "var(--text-subtle)" }}
                        >
                          {formatRelative(n.createdAt)}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}