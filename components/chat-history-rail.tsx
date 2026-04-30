"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Thread = {
  id: string;
  title: string;
  updated_at?: string;
  // v0.2.0 — project this thread is filed under (null = ungrouped).
  // Drives the rail's project-folder grouping + the per-row
  // Move-to-project action.
  project_id?: string | null;
};
type ProjectLite = { id: string; name: string };

// Mirror of the FLIGHT_KEY in web-chat.tsx, cross-component shared
// signal for "this thread is currently being generated". WebChat
// writes; the rail reads to show a pulsing dot.
const FLIGHT_KEY = "sansxel.inflight.threads";
function readFlightIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(FLIGHT_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as Record<string, { startedAt: number }>;
    const now = Date.now();
    const live = new Set<string>();
    for (const [id, v] of Object.entries(parsed)) {
      if (v && typeof v.startedAt === "number" && now - v.startedAt < 5 * 60_000) {
        live.add(id);
      }
    }
    return live;
  } catch {
    return new Set();
  }
}

function relativeTime(iso?: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

// Right-side rail: chat history + new-chat + per-row rename/delete.
// All navigation goes through router.push so the WebChat's
// search-params effect can re-load the active thread without a
// hard page reload (which was wiping the in-flight chat state).
export function ChatHistoryRail({ panelOpen }: { panelOpen: boolean }) {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [movingId, setMovingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // v0.2.0 — collapsed state per project section. Persisted in
  // localStorage so a user who folds up a project keeps it folded
  // across reloads. Default = expanded.
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(
    () => {
      if (typeof window === "undefined") return new Set();
      try {
        const raw = window.localStorage.getItem("sansxel.rail.collapsedProjects");
        if (!raw) return new Set();
        const parsed = JSON.parse(raw) as string[];
        return new Set(Array.isArray(parsed) ? parsed : []);
      } catch {
        return new Set();
      }
    },
  );
  const toggleProjectCollapse = (id: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "sansxel.rail.collapsedProjects",
          JSON.stringify([...next]),
        );
      }
      return next;
    });
  };
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const activeThreadId = params?.get("thread") ?? null;

  // ChatGPT pattern: when the user is on a fresh "+ New chat" (URL
  // has ?new=1 or no thread param yet), prepend a virtual entry at
  // the top of the rail that reads "New chat" with the active
  // outline. This way the new chat is VISIBLE before the first
  // message even gets sent, so the user can see + click off and
  // back without losing their place.
  const isOnNewChat =
    (pathname === "/app" || pathname.startsWith("/app/")) &&
    !activeThreadId;

  const visibleThreads = useMemo(() => {
    if (!threads) return [];
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => t.title.toLowerCase().includes(q));
  }, [threads, query]);

  // v0.2.0 — group filtered threads by project_id. "ungrouped" lands
  // on top so a user without projects sees the same flat list as
  // before. Each project section header is collapsible. When the
  // user is searching (query non-empty) we auto-expand all sections
  // so matches don't hide behind a folded header.
  //
  // EMPTY sections are intentionally included: a freshly-created
  // project with zero attached chats still gets a folder header in
  // the rail so the user has visible proof the project exists. The
  // empty state inside renders a "Start a chat in this project"
  // hint instead of thread rows.
  const grouped = useMemo(() => {
    const ungrouped: Thread[] = [];
    const byProject = new Map<string, Thread[]>();
    for (const t of visibleThreads) {
      const pid = t.project_id ?? null;
      if (!pid) {
        ungrouped.push(t);
        continue;
      }
      const list = byProject.get(pid) ?? [];
      list.push(t);
      byProject.set(pid, list);
    }
    // Build a section per project, including projects with no
    // attached threads so they're still visible in the rail.
    // Sort: projects with recent activity first; empty projects
    // sink to the bottom (newest empty first by id stability).
    const projectSections = projects
      .map((p) => ({
        id: p.id,
        name: p.name,
        threads: byProject.get(p.id) ?? [],
      }))
      .sort((a, b) => {
        const ta = new Date(a.threads[0]?.updated_at ?? 0).getTime();
        const tb = new Date(b.threads[0]?.updated_at ?? 0).getTime();
        return tb - ta;
      });
    return { ungrouped, projectSections };
  }, [visibleThreads, projects]);

  // Move thread → project (or detach with null). Optimistic update;
  // reverts on server error.
  const moveThreadToProject = async (
    threadId: string,
    projectId: string | null,
  ) => {
    if (!threads) return;
    const previous = threads;
    setThreads(
      previous.map((x) =>
        x.id === threadId ? { ...x, project_id: projectId } : x,
      ),
    );
    setMovingId(null);
    try {
      const res = await fetch(`/api/threads/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId }),
      });
      if (!res.ok) {
        setThreads(previous);
        return;
      }
      window.dispatchEvent(new CustomEvent("sansxel:threads:changed"));
    } catch {
      setThreads(previous);
    }
  };

  // Density toggle, persists to localStorage so the user's choice
  // sticks across reloads. Default is "compact" because the original
  // size felt overweight for a sidebar of titles ("the titles are
  // too big" feedback). Click the icon in the rail header to flip.
  const [density, setDensity] = useState<"compact" | "comfy">(() => {
    if (typeof window === "undefined") return "compact";
    return window.localStorage.getItem("sansxel.rail.density") === "comfy"
      ? "comfy"
      : "compact";
  });
  const toggleDensity = () => {
    setDensity((d) => {
      const next = d === "compact" ? "comfy" : "compact";
      if (typeof window !== "undefined") {
        window.localStorage.setItem("sansxel.rail.density", next);
      }
      return next;
    });
  };

  // Live in-flight thread set, refreshed on every flight:changed
  // event from WebChat (write side).
  const [flightIds, setFlightIds] = useState<Set<string>>(() => readFlightIds());
  useEffect(() => {
    const onChanged = () => setFlightIds(readFlightIds());
    if (typeof window !== "undefined") {
      window.addEventListener("sansxel:flight:changed", onChanged);
      window.addEventListener("focus", onChanged);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("sansxel:flight:changed", onChanged);
        window.removeEventListener("focus", onChanged);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        // Fetch threads + projects in parallel; the rail uses
        // projects to label project-section headers and to populate
        // the per-row "Move to project" picker.
        const [threadsRes, projectsRes] = await Promise.all([
          fetch("/api/threads", { cache: "no-store" }),
          fetch("/api/projects", { cache: "no-store" }),
        ]);
        if (!threadsRes.ok) {
          if (!cancelled) { setThreads([]); setLoading(false); }
          return;
        }
        const data = (await threadsRes.json()) as { threads?: Thread[] };
        if (!cancelled) { setThreads(data.threads ?? []); setLoading(false); }
        if (projectsRes.ok) {
          const pdata = (await projectsRes.json().catch(() => ({}))) as {
            projects?: ProjectLite[];
          };
          if (!cancelled) setProjects(pdata.projects ?? []);
        }
      } catch {
        if (!cancelled) { setThreads([]); setLoading(false); }
      }
    };
    void load();

    // One-shot per-session backfill: re-run AI title generation for
    // any threads still showing snippet/placeholder titles. Silent
    // success just broadcasts threads:changed which retriggers load.
    // sessionStorage key prevents the request from firing on every
    // route change in the same tab session.
    if (typeof window !== "undefined") {
      const key = "sansxel.titles.backfilled";
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        void (async () => {
          try {
            const res = await fetch("/api/threads/backfill-titles", { method: "POST" });
            if (res.ok) {
              const data = (await res.json()) as { updated?: number };
              if ((data.updated ?? 0) > 0) {
                window.dispatchEvent(new CustomEvent("sansxel:threads:changed"));
              }
            }
          } catch {
            // ignore, backfill is best-effort
          }
        })();
      }
    }

    const onChanged = () => { void load(); };
    const onFocus = () => { void load(); };
    if (typeof window !== "undefined") {
      window.addEventListener("sansxel:threads:changed", onChanged);
      // Re-fetch when a project is created / renamed / picked so
      // the rail's project sections + move-target list stay live.
      window.addEventListener("sansxel:project:changed", onChanged);
      window.addEventListener("focus", onFocus);
    }
    return () => {
      cancelled = true;
      if (typeof window !== "undefined") {
        window.removeEventListener("sansxel:threads:changed", onChanged);
        window.removeEventListener("sansxel:project:changed", onChanged);
        window.removeEventListener("focus", onFocus);
      }
    };
  }, [pathname]);

  if (panelOpen) return null;

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
    <aside className={`chat-history-rail chat-history-rail--${density}`}>
      <div className="chat-history-head">
        <div className="chat-history-head-row">
          <div>
            <div className="chat-history-title">Chat history</div>
            <div className="chat-history-count">
              {threads ? `${threads.length} saved` : "—"}
            </div>
          </div>
          <div className="chat-history-head-actions">
            <button
              type="button"
              onClick={toggleDensity}
              className="chat-history-density-toggle"
              title={density === "compact" ? "Switch to comfy size" : "Switch to compact size"}
              aria-label="Toggle thread row density"
            >
              {density === "compact" ? "↕" : "↔"}
            </button>
            <button
              type="button"
              onClick={() => {
                // ChatGPT pattern: hard-cancel any in-flight stream so
                // the workspace flips to fresh state instantly. WebChat
                // listens for this and aborts + clears.
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("sansxel:new-chat"));
                }
                router.replace("/app?new=1");
              }}
              className="chat-history-new-pill"
              title="Start a new chat"
            >
              <span aria-hidden className="pill-glyph">＋</span>
              <span>New</span>
            </button>
          </div>
        </div>
        {threads && threads.length > 0 && (
          <div className="chat-history-search">
            <span aria-hidden className="chat-history-search-icon">🔍</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search threads…"
              className="chat-history-search-input"
            />
          </div>
        )}
      </div>
      <div className="chat-history-list">
        {/* Phantom 'New chat' entry at the very top when the user is
            on a fresh + New chat that hasn't been sent yet. Vanishes
            once the URL gets a real ?thread=<id> after first send. */}
        {isOnNewChat && (
          <div
            className="chat-history-item is-active is-pending"
            aria-label="New chat (not yet saved)"
          >
            <div className="chat-history-item-body">
              <div className="chat-history-item-title">New chat</div>
              <div className="chat-history-item-meta">
                Start typing, saves on first message
              </div>
            </div>
          </div>
        )}
        {loading && (
          <div className="chat-history-empty">Loading…</div>
        )}
        {!loading && (!threads || threads.length === 0) && !isOnNewChat && (
          <div className="chat-history-empty">
            No chats yet, start one below.
          </div>
        )}
        {!loading && threads && threads.length > 0 && visibleThreads.length === 0 && (
          <div className="chat-history-empty">No matches.</div>
        )}
        {!loading && grouped.ungrouped.map((t) => (
          <ThreadRow
            key={t.id}
            thread={t}
            isActive={activeThreadId === t.id}
            isEditing={editingId === t.id}
            editValue={editValue}
            setEditValue={setEditValue}
            busy={busyId === t.id}
            inFlight={flightIds.has(t.id)}
            isMoveOpen={movingId === t.id}
            projects={projects}
            onClick={() => router.replace(`/app?thread=${t.id}`)}
            onStartRename={() => startRename(t)}
            onSubmitRename={() => submitRename(t.id)}
            onCancelRename={() => setEditingId(null)}
            onDelete={() => handleDelete(t.id)}
            onOpenMove={() =>
              setMovingId((cur) => (cur === t.id ? null : t.id))
            }
            onCloseMove={() => setMovingId(null)}
            onMove={(pid) => void moveThreadToProject(t.id, pid)}
          />
        ))}
        {!loading &&
          grouped.projectSections.map((section) => {
            // While searching, force-expand sections so matches
            // never hide behind a folded header.
            const collapsed =
              !query.trim() && collapsedProjects.has(section.id);
            return (
              <div key={section.id} className="chat-history-project-section">
                <button
                  type="button"
                  className={`chat-history-project-head${collapsed ? " is-collapsed" : ""}`}
                  onClick={() => toggleProjectCollapse(section.id)}
                  title={
                    collapsed
                      ? `Expand ${section.name}`
                      : `Collapse ${section.name}`
                  }
                >
                  <span className="chat-history-project-caret" aria-hidden>
                    {collapsed ? "▸" : "▾"}
                  </span>
                  <span className="chat-history-project-name">
                    {section.name}
                  </span>
                  <span className="chat-history-project-count">
                    {section.threads.length}
                  </span>
                </button>
                {!collapsed && section.threads.length === 0 && (
                  <button
                    type="button"
                    className="chat-history-project-empty"
                    onClick={() => {
                      // Set this project active + start a fresh chat
                      // so the user can attach work to it right away.
                      // (setActiveProjectId also dispatches the
                      // sansxel:project:changed event the picker +
                      // composer listen for.)
                      if (typeof window !== "undefined") {
                        window.localStorage.setItem(
                          "sansxel.activeProjectId",
                          section.id,
                        );
                        window.dispatchEvent(
                          new CustomEvent("sansxel:project:changed", {
                            detail: section.id,
                          }),
                        );
                        window.dispatchEvent(
                          new CustomEvent("sansxel:new-chat"),
                        );
                      }
                      router.replace("/app?new=1");
                    }}
                    title={`Start a chat in ${section.name}`}
                  >
                    <span className="chat-history-project-empty-glyph" aria-hidden>+</span>
                    <span>Start a chat here</span>
                  </button>
                )}
                {!collapsed &&
                  section.threads.map((t) => (
                    <ThreadRow
                      key={t.id}
                      thread={t}
                      isActive={activeThreadId === t.id}
                      isEditing={editingId === t.id}
                      editValue={editValue}
                      setEditValue={setEditValue}
                      busy={busyId === t.id}
                      inFlight={flightIds.has(t.id)}
                      isMoveOpen={movingId === t.id}
                      projects={projects}
                      onClick={() => router.replace(`/app?thread=${t.id}`)}
                      onStartRename={() => startRename(t)}
                      onSubmitRename={() => submitRename(t.id)}
                      onCancelRename={() => setEditingId(null)}
                      onDelete={() => handleDelete(t.id)}
                      onOpenMove={() =>
                        setMovingId((cur) => (cur === t.id ? null : t.id))
                      }
                      onCloseMove={() => setMovingId(null)}
                      onMove={(pid) => void moveThreadToProject(t.id, pid)}
                    />
                  ))}
              </div>
            );
          })}
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
  inFlight,
  isMoveOpen,
  projects,
  onClick,
  onStartRename,
  onSubmitRename,
  onCancelRename,
  onDelete,
  onOpenMove,
  onCloseMove,
  onMove,
}: {
  thread: Thread;
  isActive: boolean;
  isEditing: boolean;
  editValue: string;
  setEditValue: (s: string) => void;
  busy: boolean;
  inFlight: boolean;
  isMoveOpen: boolean;
  projects: ProjectLite[];
  onClick: () => void;
  onStartRename: () => void;
  onSubmitRename: () => void;
  onCancelRename: () => void;
  onDelete: () => void;
  onOpenMove: () => void;
  onCloseMove: () => void;
  onMove: (projectId: string | null) => void;
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
      <div className="chat-history-item-body">
        <div className="chat-history-item-title">
          {inFlight && <span className="chat-history-flight-dot" aria-label="Generating" />}
          {thread.title}
        </div>
        <div className="chat-history-item-meta">
          {inFlight ? "Generating…" : relativeTime(thread.updated_at)}
        </div>
      </div>
      <span className="chat-history-item-actions" onClick={(e) => e.stopPropagation()}>
        {projects.length > 0 && (
          <div className="chat-history-move-wrap">
            <button
              type="button"
              onClick={onOpenMove}
              className={`chat-history-action${isMoveOpen ? " is-open" : ""}`}
              title="Move to project"
              aria-label="Move chat to project"
              aria-expanded={isMoveOpen}
            >
              ⤴
            </button>
            {isMoveOpen && (
              <MoveToProjectMenu
                projects={projects}
                currentProjectId={thread.project_id ?? null}
                onPick={onMove}
                onClose={onCloseMove}
              />
            )}
          </div>
        )}
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

// Small popover that anchors next to the move-icon. Lists the
// user's projects + a "No project" detach option. Closes on
// outside-click and on pick. Owner check happens server-side
// in the PATCH handler so we don't need to filter here.
function MoveToProjectMenu({
  projects,
  currentProjectId,
  onPick,
  onClose,
}: {
  projects: ProjectLite[];
  currentProjectId: string | null;
  onPick: (id: string | null) => void;
  onClose: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div ref={wrapRef} className="chat-history-move-menu" role="menu">
      <button
        type="button"
        className={`chat-history-move-item${currentProjectId === null ? " is-current" : ""}`}
        onClick={() => onPick(null)}
      >
        No project
      </button>
      {projects.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`chat-history-move-item${p.id === currentProjectId ? " is-current" : ""}`}
          onClick={() => onPick(p.id)}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}
