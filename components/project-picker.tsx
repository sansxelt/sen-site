"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Active-project picker for the chat composer. Dropdown surfaces:
//   - List of the user's projects (click to select)
//   - "New project" form (name + optional description + goals)
//   - For the active project: description/goals editor and inline
//     pinned-context list (add, edit, remove)
// Active project is persisted in localStorage so a refresh keeps
// the same scope; WebChat reads the same key when sending.

const ACTIVE_KEY = "Vraelis.activeProjectId";

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
  window.dispatchEvent(new CustomEvent("Vraelis:project:changed", { detail: id }));
}

export function ProjectPicker() {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveIdLocal] = useState<string | null>(null);
  const [active, setActive] = useState<ProjectWithPins | null>(null);
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

  // Keep the chip in sync when an external caller clears the project
  // (e.g. + New button dispatches project:changed with null so the
  // picker resets without the user having to open and re-select).
  useEffect(() => {
    const onChanged = (e: Event) => {
      const id = (e as CustomEvent<string | null>).detail ?? null;
      setActiveIdLocal(id);
      void refreshActive(id);
    };
    window.addEventListener("Vraelis:project:changed", onChanged);
    return () => window.removeEventListener("Vraelis:project:changed", onChanged);
  }, [refreshActive]);

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

          {/* Phase H — picker is selection-only now. Creating a
              new project redirects to /account/memory where the
              full editor lives (better discoverability + no
              cramped inline form). */}
          <a
            href="/account/memory"
            className="project-picker-create-cta"
            onClick={() => setOpen(false)}
          >
            <span className="project-picker-create-cta-glyph" aria-hidden>+</span>
            <span className="project-picker-create-cta-body">
              <span className="project-picker-create-cta-title">
                Create new project
              </span>
              <span className="project-picker-create-cta-sub">
                Opens the full editor with pinned context
              </span>
            </span>
            <span className="project-picker-create-cta-arrow" aria-hidden>→</span>
          </a>

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

          {active && <ActiveProjectPanel project={active} />}
        </div>
      )}
    </div>
  );
}

// --- Sub-components -------------------------------------------

// Phase H — CreateProjectForm removed. Project creation is now
// only available on /account/memory (the dedicated management
// page). The picker dropdown's "+ Create new project" CTA links
// there instead. Less duplication, no cramped inline form, no
// confusion about whether the picker form actually saves.

// Phase H — compact active-project summary. The picker no longer
// owns inline editing / pin management — that all lives on
// /account/memory. This panel shows just enough to confirm what
// context will ride along + a one-click route to the editor.
function ActiveProjectPanel({
  project,
}: {
  project: ProjectWithPins;
}) {
  const contextPinCount = project.pinned.filter(
    (p) => (p.kind ?? "context") === "context",
  ).length;
  const promptPinCount = project.pinned.filter((p) => p.kind === "prompt").length;

  return (
    <div className="project-picker-active project-picker-active--compact">
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
      <div className="project-picker-summary-chips">
        <span className="project-picker-summary-chip">
          {contextPinCount} context pin{contextPinCount === 1 ? "" : "s"}
        </span>
        {promptPinCount > 0 && (
          <span className="project-picker-summary-chip">
            {promptPinCount} quick prompt{promptPinCount === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <a
        href={`/account/memory?project=${project.id}`}
        className="project-picker-edit-link"
      >
        Edit in Projects →
      </a>
    </div>
  );
}

