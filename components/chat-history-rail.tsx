"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Right-side rail showing the user's chat history + new-chat button.
// Mounted inside the workshop /app shell as a sibling of the canvas.
// Hides itself when the LEI panel is open (panel-kind !== "none")
// since both compete for the right side; the LEI panel is more
// contextual and wins.
export function ChatHistoryRail({ panelOpen }: { panelOpen: boolean }) {
  const [threads, setThreads] = useState<Array<{ id: string; title: string }> | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/threads", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) { setThreads([]); setLoading(false); }
          return;
        }
        const data = (await res.json()) as { threads?: Array<{ id: string; title: string }> };
        if (!cancelled) { setThreads(data.threads ?? []); setLoading(false); }
      } catch {
        if (!cancelled) { setThreads([]); setLoading(false); }
      }
    };
    void load();

    const onChanged = () => { void load(); };
    const onFocus = () => { void load(); };
    if (typeof window !== "undefined") {
      window.addEventListener("sansxel:threads:changed", onChanged);
      window.addEventListener("focus", onFocus);
    }
    return () => {
      cancelled = true;
      if (typeof window !== "undefined") {
        window.removeEventListener("sansxel:threads:changed", onChanged);
        window.removeEventListener("focus", onFocus);
      }
    };
  }, [pathname]);

  if (panelOpen) return null;

  const handleNew = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/app?new=1";
    }
  };

  return (
    <aside className="chat-history-rail">
      <div className="chat-history-head">
        <button
          type="button"
          onClick={handleNew}
          className="chat-history-new"
        >
          <span aria-hidden>＋</span>
          <span>New chat</span>
        </button>
      </div>
      <div className="chat-history-list">
        {loading && (
          <div className="chat-history-empty">Loading…</div>
        )}
        {!loading && (!threads || threads.length === 0) && (
          <div className="chat-history-empty">
            No chats yet — start one below.
          </div>
        )}
        {!loading && threads && threads.map((t) => (
          <Link
            key={t.id}
            href={`/app?thread=${t.id}`}
            className="chat-history-item"
            title={t.title}
          >
            {t.title}
          </Link>
        ))}
      </div>
    </aside>
  );
}
