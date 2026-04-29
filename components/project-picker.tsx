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

type Pin = {
  id: string;
  label: string | null;
  content: string;
  ord: number;
};

export type ProjectWithPins = Project & { pinned: Pin[] };

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

  const refreshList = useCallback(async () => {
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { projects?: Project[] };
      setProjects(data.projects ?? []);
    } catch {
      // ignore
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
        setActive(null);
        return;
      }
      const data = (await res.json()) as { project?: ProjectWithPins };
      setActive(data.project ?? null);
    } catch {
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

  return (
    <div ref={wrapRef} className="project-picker">
      <button
        type="button"
        className={`project-picker-trigger${activeId ? " is-active" : ""}`}
        onClick={() => setOpen((o) => !o)}
        title={activeName ? `Project: ${activeName}` : "No project"}
      >
        <span className="project-picker-glyph" aria-hidden>
          {"◇"}
        </span>
        <span className="project-picker-label">
          {activeName ?? "No project"}
        </span>
        <span className="project-picker-caret" aria-hidden>
          {"▾"}
        </span>
      </button>

      {open && (
        <div className="project-picker-menu" role="menu">
          <div className="project-picker-section-label">Projects</div>
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
              void refreshList();
              select(p.id);
              setOpen(true);
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
        setErr(d.error ?? "Could not create.");
        return;
      }
      const data = (await res.json()) as { project: Project };
      setName("");
      setDescription("");
      setGoals("");
      onCreated(data.project);
    } catch {
      setErr("Network error.");
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
      <button
        type="submit"
        disabled={!name.trim() || pending}
        className="project-picker-submit"
      >
        {pending ? "Creating…" : "Create project"}
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

      <PinList project={project} onChanged={onChanged} onLoading={onLoading} />
    </div>
  );
}

function PinList({
  project,
  onChanged,
  onLoading,
}: {
  project: ProjectWithPins;
  onChanged: () => Promise<void> | void;
  onLoading: (b: boolean) => void;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [newContent, setNewContent] = useState("");

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

  return (
    <div className="project-picker-pins">
      <div className="project-picker-section-label">
        Pinned context ({project.pinned.length})
      </div>
      {project.pinned.length === 0 && (
        <p className="project-picker-empty">
          Nothing pinned yet. Add facts the AI should remember every time you chat in this project.
        </p>
      )}
      {project.pinned.map((p) => (
        <PinRow key={p.id} pin={p} onChanged={onChanged} onRemove={() => void remove(p.id)} />
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
          placeholder="What should the AI remember?"
          rows={2}
          className="project-picker-textarea"
        />
        <button
          type="submit"
          disabled={!newContent.trim()}
          className="project-picker-submit"
        >
          Pin to project
        </button>
      </form>
    </div>
  );
}

function PinRow({
  pin,
  onChanged,
  onRemove,
}: {
  pin: Pin;
  onChanged: () => Promise<void> | void;
  onRemove: () => void;
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
