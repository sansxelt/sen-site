"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Thread = { id: string; title: string };

// Right-side rail: chat history + new-chat + per-row rename/delete.
// All navigation goes through router.push so the WebChat's
// search-params effect can re-load the active thread without a
// hard page reload (which was wiping the in-flight chat state).
export function ChatHistoryRail({ panelOpen }: { panelOpen: boolean }) {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const activeThreadId = params?.get("thread") ?? null;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/threads", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) { setThreads([]); setLoading(false); }
          return;
        }
        const data = (await res.json()) as { threads?: Thread[] };
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
    // Soft nav — WebChat watches searchParams and clears messages
    // when ?new=1 is present. Use replace so the back button
    // doesn't fill up with new-chat hops.
    router.replace("/app?new=1");
  };

  const startRename = (t: Thread) => {
    setEditingId(t.id);
    setEditValue(t.title);
  };

  const submitRename = async (id: string) => {
    const title = editValue.trim();
    setEditingId(null);
    if (!title || !threads) return;
    const previous = threads;
    // Optimistic update so the UI feels instant.
    setThreads(threads.map((x) => (x.id === id ? { ...x, title } : x)));
    try {
      const res = await fetch(`/api/threads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        setThreads(previous); // revert
      } else {
        // Broadcast so any other rail mounts re-fetch.
        window.dispatchEvent(new CustomEvent("sansxel:threads:changed"));
      }
    } catch {
      setThreads(previous);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this chat? This can't be undone.")) return;
    setBusyId(id);
    const previous = threads ?? [];
    setThreads(previous.filter((x) => x.id !== id));
    try {
      const res = await fetch(`/api/threads/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setThreads(previous);
        return;
      }
      window.dispatchEvent(new CustomEvent("sansxel:threads:changed"));
      // If we deleted the currently-open thread, bounce to a new chat.
      if (activeThreadId === id) {
        router.replace("/app?new=1");
      }
    } catch {
      setThreads(previous);
    } finally {
      setBusyId(null);
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
          <ThreadRow
            key={t.id}
            thread={t}
            isActive={activeThreadId === t.id}
            isEditing={editingId === t.id}
            editValue={editValue}
            setEditValue={setEditValue}
            busy={busyId === t.id}
            onClick={() => router.replace(`/app?thread=${t.id}`)}
            onStartRename={() => startRename(t)}
            onSubmitRename={() => submitRename(t.id)}
            onCancelRename={() => setEditingId(null)}
            onDelete={() => handleDelete(t.id)}
          />
        ))}
      </div>
    </aside>
  );
}

function ThreadRow({
  thread,
  isActive,
  isEditing,
  editValue,
  setEditValue,
  busy,
  onClick,
  onStartRename,
  onSubmitRename,
  onCancelRename,
  onDelete,
}: {
  thread: Thread;
  isActive: boolean;
  isEditing: boolean;
  editValue: string;
  setEditValue: (s: string) => void;
  busy: boolean;
  onClick: () => void;
  onStartRename: () => void;
  onSubmitRename: () => void;
  onCancelRename: () => void;
  onDelete: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <div className="chat-history-item chat-history-item--editing">
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmitRename();
            else if (e.key === "Escape") onCancelRename();
          }}
          onBlur={onSubmitRename}
          className="chat-history-edit-input"
        />
      </div>
    );
  }

  return (
    <div
      className={`chat-history-item${isActive ? " is-active" : ""}${busy ? " is-busy" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
      title={thread.title}
    >
      <span className="chat-history-item-title">{thread.title}</span>
      <span className="chat-history-item-actions" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onStartRename}
          className="chat-history-action"
          title="Rename"
          aria-label="Rename chat"
        >
          ✎
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="chat-history-action chat-history-action--danger"
          title="Delete"
          aria-label="Delete chat"
        >
          ×
        </button>
      </span>
    </div>
  );
}
