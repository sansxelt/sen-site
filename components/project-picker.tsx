"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { estimateTokens } from "@/lib/projects";

// Active-project picker for the chat composer. Dropdown surfaces:
//   - List of the user's projects (click to select)
//   - "New project" form (name + optional description + goals)
//   - For the active project: description/goals editor and inline
//     pinned-context list (add, edit, remove)
// Active project is persisted in localStorage so a refresh keeps
// the same scope; WebChat reads the same key when sending.

const ACTIVE_KEY = "sansxel.activeProjectId";

export type Project = {
  id: string;
  name: string;
  description: string | null;
  goals: string | null;
};

// v0.2.0 phase G+ — pin kind. "context" pins auto-inject into the
// chat system prompt (the original memory wedge); "prompt" pins are
// one-click run-as-Duel shortcuts shown in the project panel.
export type PinKind = "context" | "prompt";

type Pin = {
  id: string;
  label: string | null;
  content: string;
  ord: number;
  kind?: PinKind;
};

export type ProjectWithPins = Project & { pinned: Pin[] };

export type DuelStats = {
  gpt_wins: number;
  claude_wins: number;
  total: number;
  recent: Array<{
    id: string;
    side: "left" | "right";
    model: string | null;
    content: string;
    picked_at: string;
  }>;
};

export function getActiveProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_KEY);
}

export function setActiveProjectId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(ACTIVE_KEY, id);
  else window.localStorage.removeItem(ACTIVE_KEY);
  window.dispatchEvent(new CustomEvent("sansxel:project:changed", { detail: id }));
}

export function ProjectPicker() {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveIdLocal] = useState<string | null>(null);
  const [active, setActive] = useState<ProjectWithPins | null>(null);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Menu ref so we can scroll the active panel into view after a
  // create — the form sits in the middle of the dropdown and the
  // panel renders below it, so a fresh save lands offscreen
  // unless we scroll there manually.
  const menuRef = useRef<HTMLDivElement>(null);

  // v0.2.0 phase H — visible API status. When list / detail fetches
  // fail (auth, DB, network) we surface a banner inside the picker
  // instead of silently returning empty arrays — that was hiding
  // real failures behind a "no projects yet" state.
  const [apiStatus, setApiStatus] = useState<
    | { kind: "ok" }
    | { kind: "loading" }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  const refreshList = useCallback(async () => {
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const d = (await res.json()) as { error?: string };
          if (d.error) detail = d.error;
        } catch {}
        console.warn("[projects] list failed:", res.status, detail);
        setApiStatus({
          kind: "error",
          message:
            res.status === 401
              ? "Sign in to use projects."
              : `Couldn't load projects (${detail}).`,
        });
        return;
      }
      const data = (await res.json()) as { projects?: Project[] };
      setProjects(data.projects ?? []);
      setApiStatus({ kind: "ok" });
    } catch (err) {
      console.warn("[projects] list threw:", err);
      setApiStatus({
        kind: "error",
        message: "Network error loading projects.",
      });
    }
  }, []);

  const refreshActive = useCallback(async (id: string | null) => {
    if (!id) {
      setActive(null);
      return;
    }
    try {
      const res = await fetch(`/api/projects/${id}`, { cache: "no-store" });
      if (!res.ok) {
        console.warn("[projects] detail failed:", id, res.status);
        setActive(null);
        return;
      }
      const data = (await res.json()) as { project?: ProjectWithPins };
      setActive(data.project ?? null);
    } catch (err) {
      console.warn("[projects] detail threw:", err);
      setActive(null);
    }
  }, []);

  useEffect(() => {
    const id = getActiveProjectId();
    setActiveIdLocal(id);
    void refreshList();
    void refreshActive(id);
  }, [refreshList, refreshActive]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const select = useCallback(
    (id: string | null) => {
      setActiveProjectId(id);
      setActiveIdLocal(id);
      void refreshActive(id);
    },
    [refreshActive],
  );

  const activeName =
    activeId && projects.find((p) => p.id === activeId)?.name;
  // Pin count surfaces at a glance how much context is attached
  // to the active project — addresses the "I added pins, did
  // anything happen?" feedback. Counts both kinds (context +
  // prompt pins) so the chip reflects total weight.
  const activePinCount = active?.pinned?.length ?? 0;

  return (
    <div ref={wrapRef} className="project-picker">
      <button
        type="button"
        className={`project-picker-trigger${activeId ? " is-active" : ""}`}
        onClick={() => setOpen((o) => !o)}
        title={
          activeName
            ? `Project: ${activeName}${
                activePinCount > 0
                  ? ` (${activePinCount} pin${activePinCount === 1 ? "" : "s"})`
                  : ""
              }`
            : "No project"
        }
      >
        <span className="project-picker-glyph" aria-hidden>
          {"◇"}
        </span>
        <span className="project-picker-label">
          {activeName ?? "No project"}
        </span>
        {activeId && activePinCount > 0 && (
          <span className="project-picker-pin-count" aria-hidden>
            {activePinCount}
          </span>
        )}
        <span className="project-picker-caret" aria-hidden>
          {"▾"}
        </span>
      </button>

      {open && (
        <div className="project-picker-menu" role="menu" ref={menuRef}>
          {apiStatus.kind === "error" && (
            <div className="project-picker-error" role="alert">
              {apiStatus.message}
            </div>
          )}
          <div className="project-picker-section-label">
            Projects
            <a
              href="/account/memory"
              className="project-picker-manage-link"
              title="Open the full Projects page"
            >
              Manage all →
            </a>
          </div>
          <button
            type="button"
            className={`project-picker-item${!activeId ? " is-selected" : ""}`}
            onClick={() => {
              select(null);
              setOpen(false);
            }}
          >
            <span className="project-picker-item-name">No project</span>
            <span className="project-picker-item-sub">Plain chat, no extra context</span>
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`project-picker-item${p.id === activeId ? " is-selected" : ""}`}
              onClick={() => {
                select(p.id);
                setOpen(false);
              }}
            >
              <span className="project-picker-item-name">{p.name}</span>
              {p.description && (
                <span className="project-picker-item-sub">
                  {p.description.slice(0, 90)}
                </span>
              )}
            </button>
          ))}

          <CreateProjectForm
            onCreated={(p) => {
              // Optimistic insert at the top so the trigger label
              // updates IMMEDIATELY to the new project's name.
              // Without this the picker said "No project" until
              // refreshList returned a beat later (because the
              // trigger reads the name from the projects list,
              // which was still stale). refreshList runs anyway
              // and reconciles with the server's authoritative
              // list a moment later.
              setProjects((prev) =>
                prev.some((x) => x.id === p.id) ? prev : [p, ...prev],
              );
              void refreshList();
              select(p.id);
              setOpen(true);
              // Scroll the menu so the user actually sees the new
              // active panel land (otherwise the form clears and
              // it feels like nothing happened).
              window.setTimeout(() => {
                const m = menuRef.current;
                if (m) m.scrollTo({ top: m.scrollHeight, behavior: "smooth" });
              }, 220);
            }}
          />

          {active && (
            <ActiveProjectPanel
              project={active}
              onChanged={async () => {
                await Promise.all([refreshList(), refreshActive(activeId)]);
              }}
              onLoading={setLoading}
              loading={loading}
            />
          )}
        </div>
      )}
    </div>
  );
}

// --- Sub-components -------------------------------------------

function CreateProjectForm({
  onCreated,
}: {
  onCreated: (p: Project) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goals, setGoals] = useState("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Success ribbon: shows for 1.5s after a successful create so
  // the user has clear visual confirmation. Without this the
  // form just silently cleared and the save felt invisible.
  const [savedFlash, setSavedFlash] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || pending) return;
    setPending(true);
    setErr(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          goals: goals.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        const detail = d.error ?? `HTTP ${res.status}`;
        console.warn("[projects] create failed:", res.status, detail);
        setErr(
          res.status === 401
            ? "Sign in to create projects."
            : `Couldn't save: ${detail}`,
        );
        return;
      }
      const data = (await res.json()) as { project: Project };
      console.log("[projects] created:", data.project?.id, data.project?.name);
      setName("");
      setDescription("");
      setGoals("");
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1500);
      onCreated(data.project);
    } catch (err) {
      console.warn("[projects] create threw:", err);
      setErr("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="project-picker-create" onSubmit={submit}>
      <div className="project-picker-section-label">New project</div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Project name"
        className="project-picker-input"
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="project-picker-input"
      />
      <input
        value={goals}
        onChange={(e) => setGoals(e.target.value)}
        placeholder="Goals (optional)"
        className="project-picker-input"
      />
      {err && <div className="project-picker-error">{err}</div>}
      {savedFlash && (
        <div className="project-picker-saved" role="status">
          Saved. Pick it from the list above to attach this chat.
        </div>
      )}
      <button
        type="submit"
        disabled={!name.trim() || pending}
        className="project-picker-submit"
      >
        {pending ? "Creating…" : savedFlash ? "Saved!" : "Create project"}
      </button>
    </form>
  );
}

function ActiveProjectPanel({
  project,
  onChanged,
  onLoading,
  loading,
}: {
  project: ProjectWithPins;
  onChanged: () => Promise<void> | void;
  onLoading: (b: boolean) => void;
  loading: boolean;
}) {
  const [editingMeta, setEditingMeta] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [goals, setGoals] = useState(project.goals ?? "");

  // Sync local copy when the active project changes (switch from
  // outside the panel) so we don't keep stale text in the inputs.
  useEffect(() => {
    setName(project.name);
    setDescription(project.description ?? "");
    setGoals(project.goals ?? "");
  }, [project.id, project.name, project.description, project.goals]);

  const saveMeta = async () => {
    if (!name.trim()) return;
    onLoading(true);
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() ? description.trim() : null,
          goals: goals.trim() ? goals.trim() : null,
        }),
      });
      setEditingMeta(false);
      await onChanged();
    } finally {
      onLoading(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete project "${project.name}"? Pinned items will also be removed.`)) return;
    onLoading(true);
    try {
      await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      setActiveProjectId(null);
      await onChanged();
    } finally {
      onLoading(false);
    }
  };

  // Token estimate of the context that will be injected on the
  // next request. Mirrors lib/projects:buildProjectContextBlock so
  // the user sees what's about to ride along.
  const contextText = [
    `# Project: ${project.name}`,
    project.description?.trim() ? `Description: ${project.description.trim()}` : "",
    project.goals?.trim() ? `Goals: ${project.goals.trim()}` : "",
    project.pinned.length > 0 ? "Pinned context:" : "",
    ...project.pinned.map((p) =>
      p.label ? `- [${p.label}] ${p.content}` : `- ${p.content}`,
    ),
  ]
    .filter(Boolean)
    .join("\n\n");
  const tokenEstimate = estimateTokens(contextText);

  return (
    <div className="project-picker-active">
      <div className="project-picker-section-label">
        Active context
        <span className="project-picker-token-pill">~{tokenEstimate} tokens</span>
      </div>

      {editingMeta ? (
        <div className="project-picker-meta-edit">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            className="project-picker-input"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this project?"
            rows={2}
            className="project-picker-textarea"
          />
          <textarea
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            placeholder="Goals (what shipping looks like)"
            rows={2}
            className="project-picker-textarea"
          />
          <div className="project-picker-row">
            <button
              type="button"
              className="project-picker-submit"
              onClick={() => void saveMeta()}
              disabled={loading}
            >
              Save
            </button>
            <button
              type="button"
              className="project-picker-secondary"
              onClick={() => {
                setEditingMeta(false);
                setName(project.name);
                setDescription(project.description ?? "");
                setGoals(project.goals ?? "");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="project-picker-meta">
          {project.description?.trim() && (
            <div className="project-picker-meta-row">
              <div className="project-picker-meta-label">Description</div>
              <div className="project-picker-meta-body">{project.description}</div>
            </div>
          )}
          {project.goals?.trim() && (
            <div className="project-picker-meta-row">
              <div className="project-picker-meta-label">Goals</div>
              <div className="project-picker-meta-body">{project.goals}</div>
            </div>
          )}
          <div className="project-picker-row">
            <button
              type="button"
              className="project-picker-secondary"
              onClick={() => setEditingMeta(true)}
            >
              Edit details
            </button>
            <button
              type="button"
              className="project-picker-danger"
              onClick={() => void remove()}
              disabled={loading}
            >
              Delete project
            </button>
          </div>
        </div>
      )}

      <PinList
        project={project}
        kind="context"
        onChanged={onChanged}
        onLoading={onLoading}
      />
      <PinList
        project={project}
        kind="prompt"
        onChanged={onChanged}
        onLoading={onLoading}
      />
      <DuelScoreboard projectId={project.id} />
    </div>
  );
}

// v0.2.0 phase G+ — per-project GPT vs Claude scoreboard + recent
// winners. Fetches /api/projects/[id]/duel-stats on mount and
// listens for sansxel:duel-pick events to bump the local count
// instantly when the user picks a winner. A debounced server
// re-fetch reconciles the optimistic count with the real one.
function DuelScoreboard({ projectId }: { projectId: string }) {
  const [stats, setStats] = useState<DuelStats | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/duel-stats`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as DuelStats;
      setStats(data);
    } catch {
      // ignore
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Optimistic bump on pick — server reconciles a moment later.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPick = (e: Event) => {
      const detail = (e as CustomEvent<{ side?: string; projectId?: string | null }>).detail;
      if (!detail?.side) return;
      // Only react to picks from chats inside THIS project. The
      // event includes the active-project-id at click time, so a
      // duel in a different project won't pollute this scoreboard.
      if (detail.projectId && detail.projectId !== projectId) return;
      setStats((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          gpt_wins:
            detail.side === "left" ? prev.gpt_wins + 1 : prev.gpt_wins,
          claude_wins:
            detail.side === "right" ? prev.claude_wins + 1 : prev.claude_wins,
          total: prev.total + 1,
        };
      });
      // Reconcile against server in the background; the loser row
      // delete + winner-flag update completes after the optimistic
      // bump, so a brief delay before the refetch lets it settle.
      window.setTimeout(() => {
        void refresh();
      }, 1200);
    };
    window.addEventListener("sansxel:duel-pick", onPick);
    return () => window.removeEventListener("sansxel:duel-pick", onPick);
  }, [projectId, refresh]);

  if (!stats || stats.total === 0) {
    return (
      <div className="project-picker-scoreboard project-picker-scoreboard--empty">
        <div className="project-picker-section-label">Compare scoreboard</div>
        <p className="project-picker-empty">
          No duels picked yet. Run a duel and pick a winner to start tracking.
        </p>
      </div>
    );
  }

  const total = Math.max(1, stats.total);
  const gptPct = Math.round((stats.gpt_wins / total) * 100);
  return (
    <div className="project-picker-scoreboard">
      <div className="project-picker-section-label">
        Compare scoreboard
        <span className="project-picker-token-pill">{stats.total} pick{stats.total === 1 ? "" : "s"}</span>
      </div>
      <div className="project-picker-score-row">
        <div className="project-picker-score project-picker-score--left">
          <span className="project-picker-score-dot project-picker-score-dot--left" aria-hidden />
          <span className="project-picker-score-label">GPT</span>
          <span className="project-picker-score-num">{stats.gpt_wins}</span>
        </div>
        <div className="project-picker-score-bar" aria-hidden>
          <div
            className="project-picker-score-bar-fill"
            style={{ width: `${gptPct}%` }}
          />
        </div>
        <div className="project-picker-score project-picker-score--right">
          <span className="project-picker-score-num">{stats.claude_wins}</span>
          <span className="project-picker-score-label">Claude</span>
          <span className="project-picker-score-dot project-picker-score-dot--right" aria-hidden />
        </div>
      </div>
      {stats.recent.length > 0 && (
        <div className="project-picker-winners">
          <div className="project-picker-winners-label">Recent winners</div>
          {stats.recent.slice(0, 3).map((w) => (
            <RecentWinnerRow key={w.id} winner={w} />
          ))}
        </div>
      )}
    </div>
  );
}

function RecentWinnerRow({
  winner,
}: {
  winner: DuelStats["recent"][number];
}) {
  const [copied, setCopied] = useState(false);
  const sideLabel = winner.side === "left" ? "GPT" : "Claude";
  const snippet = winner.content.length > 140
    ? winner.content.slice(0, 140).trimEnd() + "…"
    : winner.content;
  return (
    <div className="project-picker-winner">
      <div className="project-picker-winner-meta">
        <span
          className={`project-picker-score-dot project-picker-score-dot--${winner.side}`}
          aria-hidden
        />
        <span className="project-picker-winner-label">{sideLabel}</span>
        <button
          type="button"
          className="project-picker-winner-copy"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(winner.content);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            } catch {
              // ignore
            }
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="project-picker-winner-snippet">{snippet}</p>
    </div>
  );
}

function PinList({
  project,
  kind,
  onChanged,
  onLoading,
}: {
  project: ProjectWithPins;
  kind: PinKind;
  onChanged: () => Promise<void> | void;
  onLoading: (b: boolean) => void;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [newContent, setNewContent] = useState("");

  // Filter to this kind. Old rows that came in pre-migration default
  // to "context" so the existing pin set keeps appearing under
  // Pinned context, not under Quick prompts.
  const pins = project.pinned.filter((p) => (p.kind ?? "context") === kind);

  const sectionLabel = kind === "prompt" ? "Quick prompts" : "Pinned context";
  const emptyCopy =
    kind === "prompt"
      ? "Save prompts you reuse — clicking one fires a duel with the project context attached."
      : "Nothing pinned yet. Add facts the AI should remember every time you chat in this project.";
  const submitLabel =
    kind === "prompt" ? "Save prompt" : "Pin to project";
  const contentPlaceholder =
    kind === "prompt"
      ? "Prompt to fire on click (e.g. \"Write the investor pitch\")"
      : "What should the AI remember?";

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    onLoading(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/pins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newLabel.trim() || undefined,
          content: newContent.trim(),
          kind,
        }),
      });
      if (res.ok) {
        setNewLabel("");
        setNewContent("");
        await onChanged();
      }
    } finally {
      onLoading(false);
    }
  };

  const remove = async (pinId: string) => {
    onLoading(true);
    try {
      await fetch(`/api/pins/${pinId}`, { method: "DELETE" });
      await onChanged();
    } finally {
      onLoading(false);
    }
  };

  // Click-to-fire: prompt pins dispatch a window event the
  // WebChat listens for and runs immediately as a Duel turn.
  // Active project context auto-injects via the duel route the
  // same way solo chat does, so no extra wiring needed here.
  const fireDuel = (content: string) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("sansxel:duel-prompt", {
        detail: { prompt: content },
      }),
    );
  };

  return (
    <div className={`project-picker-pins project-picker-pins--${kind}`}>
      <div className="project-picker-section-label">
        {sectionLabel} ({pins.length})
      </div>
      {pins.length === 0 && (
        <p className="project-picker-empty">{emptyCopy}</p>
      )}
      {pins.map((p) => (
        <PinRow
          key={p.id}
          pin={p}
          kind={kind}
          onChanged={onChanged}
          onRemove={() => void remove(p.id)}
          onFireDuel={kind === "prompt" ? () => fireDuel(p.content) : undefined}
        />
      ))}

      <form className="project-picker-add-pin" onSubmit={add}>
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Label (optional)"
          className="project-picker-input"
        />
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder={contentPlaceholder}
          rows={2}
          className="project-picker-textarea"
        />
        <button
          type="submit"
          disabled={!newContent.trim()}
          className="project-picker-submit"
        >
          {submitLabel}
        </button>
      </form>
    </div>
  );
}

function PinRow({
  pin,
  kind,
  onChanged,
  onRemove,
  onFireDuel,
}: {
  pin: Pin;
  kind: PinKind;
  onChanged: () => Promise<void> | void;
  onRemove: () => void;
  onFireDuel?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(pin.label ?? "");
  const [content, setContent] = useState(pin.content);
  const [pending, setPending] = useState(false);

  const save = async () => {
    if (!content.trim()) return;
    setPending(true);
    try {
      await fetch(`/api/pins/${pin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim() ? label.trim() : null,
          content: content.trim(),
        }),
      });
      setEditing(false);
      await onChanged();
    } finally {
      setPending(false);
    }
  };

  if (editing) {
    return (
      <div className="project-picker-pin is-editing">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label"
          className="project-picker-input"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          className="project-picker-textarea"
        />
        <div className="project-picker-row">
          <button
            type="button"
            className="project-picker-submit"
            onClick={() => void save()}
            disabled={pending}
          >
            Save
          </button>
          <button
            type="button"
            className="project-picker-secondary"
            onClick={() => {
              setEditing(false);
              setLabel(pin.label ?? "");
              setContent(pin.content);
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Prompt-kind pins are clickable shortcuts: the whole row is a
  // button that fires the prompt as a Duel turn. Edit / Remove
  // become small inline icons so a stray click doesn't accidentally
  // trigger a chat. Context-kind pins keep the original layout.
  if (kind === "prompt" && onFireDuel) {
    return (
      <div className="project-picker-pin project-picker-pin--prompt">
        <button
          type="button"
          className="project-picker-prompt-fire"
          onClick={onFireDuel}
          title="Run as Duel — sends to GPT and Claude with this project's context"
        >
          {pin.label && (
            <span className="project-picker-pin-label">{pin.label}</span>
          )}
          <span className="project-picker-pin-content">{pin.content}</span>
          <span className="project-picker-prompt-cta" aria-hidden>Run ▶</span>
        </button>
        <div className="project-picker-pin-actions">
          <button
            type="button"
            className="project-picker-pin-action"
            onClick={() => setEditing(true)}
            title="Edit"
          >
            Edit
          </button>
          <button
            type="button"
            className="project-picker-pin-action is-danger"
            onClick={onRemove}
            title="Remove"
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="project-picker-pin">
      <div className="project-picker-pin-body">
        {pin.label && <div className="project-picker-pin-label">{pin.label}</div>}
        <div className="project-picker-pin-content">{pin.content}</div>
      </div>
      <div className="project-picker-pin-actions">
        <button
          type="button"
          className="project-picker-pin-action"
          onClick={() => setEditing(true)}
          title="Edit"
        >
          Edit
        </button>
        <button
          type="button"
          className="project-picker-pin-action is-danger"
          onClick={onRemove}
          title="Remove"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
