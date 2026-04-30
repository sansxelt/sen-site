"use client";

import { useEffect, useState, type FormEvent } from "react";

// Full project management surface for /account/memory.
//
// The chat composer's project-picker dropdown was the only entry
// point for creating + managing projects. Users hunting through
// /account looking for a "Projects" page found nothing — projects
// felt invisible. This component is that missing page: list,
// create, edit metadata, manage pinned context, manage prompt
// pins, delete. All client-side via the same /api/projects
// endpoints the picker uses.

type Pin = {
  id: string;
  label: string | null;
  content: string;
  ord: number;
  kind?: "context" | "prompt";
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  goals: string | null;
  created_at?: string;
  updated_at?: string;
};

type ProjectWithPins = Project & { pinned: Pin[] };

export function ProjectsManager({
  initialProjects,
}: {
  initialProjects: Array<Project & { pinned?: Pin[] }>;
}) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const refreshList = async () => {
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      if (!res.ok) {
        setError(
          res.status === 401
            ? "Sign in to use projects."
            : `Couldn't load projects (HTTP ${res.status}).`,
        );
        return;
      }
      const data = (await res.json()) as { projects?: Project[] };
      setProjects(data.projects ?? []);
      setError(null);
    } catch {
      setError("Network error loading projects.");
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-400/30 bg-red-400/[0.08] p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      <CreateForm
        pending={creating}
        setPending={setCreating}
        onCreated={(p) => {
          setProjects((prev) =>
            prev.some((x) => x.id === p.id) ? prev : [p, ...prev],
          );
          setOpenId(p.id);
          void refreshList();
        }}
        onError={setError}
      />

      {projects.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-neutral-400">
          No projects yet. Use the form above to spin one up — pin
          context the AI should remember every time you chat in
          this project.
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              isOpen={openId === p.id}
              onToggle={() => setOpenId((cur) => (cur === p.id ? null : p.id))}
              onChanged={refreshList}
              onDeleted={() => {
                setProjects((prev) => prev.filter((x) => x.id !== p.id));
                if (openId === p.id) setOpenId(null);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CreateForm({
  pending,
  setPending,
  onCreated,
  onError,
}: {
  pending: boolean;
  setPending: (b: boolean) => void;
  onCreated: (p: Project) => void;
  onError: (msg: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goals, setGoals] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || pending) return;
    setPending(true);
    onError(null);
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
        onError(
          res.status === 401
            ? "Sign in to create projects."
            : `Couldn't save: ${d.error ?? `HTTP ${res.status}`}`,
        );
        return;
      }
      const data = (await res.json()) as { project: Project };
      setName("");
      setDescription("");
      setGoals("");
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2000);
      onCreated(data.project);
    } catch {
      onError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-violet-400/20 bg-violet-400/[0.04] p-5"
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300">
        New project
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr] sm:gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name"
          className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-violet-400/60 focus:outline-none"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (what is this for?)"
          className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-violet-400/60 focus:outline-none"
        />
      </div>
      <textarea
        value={goals}
        onChange={(e) => setGoals(e.target.value)}
        placeholder="Goals (what shipping looks like)"
        rows={2}
        className="mt-3 w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-violet-400/60 focus:outline-none"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-xs text-neutral-400">
          {savedFlash ? (
            <span className="text-emerald-300">
              Saved. Open the project below to add pinned context.
            </span>
          ) : (
            <span>
              Pin facts under each project so the AI gets them every
              time you chat there.
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={!name.trim() || pending}
          className="shrink-0 rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-black transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Creating…" : savedFlash ? "Saved" : "Create project"}
        </button>
      </div>
    </form>
  );
}

function ProjectCard({
  project,
  isOpen,
  onToggle,
  onChanged,
  onDeleted,
}: {
  project: Project;
  isOpen: boolean;
  onToggle: () => void;
  onChanged: () => void | Promise<void>;
  onDeleted: () => void;
}) {
  const [detail, setDetail] = useState<ProjectWithPins | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setDetail(null);
        return;
      }
      const data = (await res.json()) as { project?: ProjectWithPins };
      setDetail(data.project ?? null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) void refreshDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, project.id]);

  const remove = async () => {
    if (
      !confirm(
        `Delete "${project.name}"? Pinned items + chats attached will be unattached.`,
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onDeleted();
      }
    } catch {
      // ignore
    }
  };

  const pinCount = detail?.pinned?.length ?? 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 p-4 text-left transition hover:bg-white/[0.04]"
      >
        <div className="min-w-0">
          <div className="text-base font-semibold text-white">
            {project.name}
          </div>
          {project.description && (
            <p className="mt-0.5 line-clamp-2 text-sm text-neutral-400">
              {project.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isOpen && pinCount > 0 && (
            <span className="rounded-full border border-violet-400/30 bg-violet-400/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200">
              {pinCount} pinned
            </span>
          )}
          <span
            className="text-neutral-500 transition"
            style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
            aria-hidden
          >
            ▸
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-white/[0.06] p-4">
          {loading && !detail && (
            <div className="text-xs text-neutral-500">Loading…</div>
          )}
          {detail && (
            <ProjectEditor
              detail={detail}
              onChanged={async () => {
                await refreshDetail();
                await onChanged();
              }}
              onDelete={remove}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ProjectEditor({
  detail,
  onChanged,
  onDelete,
}: {
  detail: ProjectWithPins;
  onChanged: () => Promise<void> | void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(detail.name);
  const [description, setDescription] = useState(detail.description ?? "");
  const [goals, setGoals] = useState(detail.goals ?? "");
  const [saving, setSaving] = useState(false);
  const [metaSaved, setMetaSaved] = useState(false);

  useEffect(() => {
    setName(detail.name);
    setDescription(detail.description ?? "");
    setGoals(detail.goals ?? "");
  }, [detail.id, detail.name, detail.description, detail.goals]);

  const saveMeta = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() ? description.trim() : null,
          goals: goals.trim() ? goals.trim() : null,
        }),
      });
      if (res.ok) {
        setMetaSaved(true);
        window.setTimeout(() => setMetaSaved(false), 1500);
        await onChanged();
      }
    } finally {
      setSaving(false);
    }
  };

  const contextPins = detail.pinned.filter(
    (p) => (p.kind ?? "context") === "context",
  );
  const promptPins = detail.pinned.filter((p) => p.kind === "prompt");

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-neutral-400">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:border-violet-400/60 focus:outline-none"
          />
        </label>
        <label className="text-xs text-neutral-400">
          Description
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:border-violet-400/60 focus:outline-none"
          />
        </label>
      </div>
      <label className="block text-xs text-neutral-400">
        Goals
        <textarea
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          rows={2}
          className="mt-1 w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:border-violet-400/60 focus:outline-none"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void saveMeta()}
          disabled={!name.trim() || saving}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
        >
          {saving ? "Saving…" : metaSaved ? "Saved ✓" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg border border-red-400/30 bg-red-400/[0.05] px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-400/[0.15]"
        >
          Delete project
        </button>
      </div>

      <PinSection
        kind="context"
        title="Pinned context"
        helper="Auto-injected into every chat in this project."
        projectId={detail.id}
        pins={contextPins}
        onChanged={onChanged}
      />
      <PinSection
        kind="prompt"
        title="Quick prompts"
        helper="One-click prompts you can fire as a Duel from the picker. Not auto-injected."
        projectId={detail.id}
        pins={promptPins}
        onChanged={onChanged}
      />
    </div>
  );
}

function PinSection({
  kind,
  title,
  helper,
  projectId,
  pins,
  onChanged,
}: {
  kind: "context" | "prompt";
  title: string;
  helper: string;
  projectId: string;
  pins: Pin[];
  onChanged: () => Promise<void> | void;
}) {
  const [label, setLabel] = useState("");
  const [content, setContent] = useState("");
  const [pending, setPending] = useState(false);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim() || pending) return;
    setPending(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/pins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim() || undefined,
          content: content.trim(),
          kind,
        }),
      });
      if (res.ok) {
        setLabel("");
        setContent("");
        await onChanged();
      }
    } finally {
      setPending(false);
    }
  };

  const removePin = async (pinId: string) => {
    try {
      await fetch(`/api/pins/${pinId}`, { method: "DELETE" });
      await onChanged();
    } catch {
      // ignore
    }
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">
            {title}{" "}
            <span className="ml-1 text-xs text-neutral-500">({pins.length})</span>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
            {helper}
          </p>
        </div>
      </div>

      {pins.length > 0 && (
        <ul className="mt-3 space-y-2">
          {pins.map((pin) => (
            <li
              key={pin.id}
              className="group flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
            >
              <div className="min-w-0 flex-1">
                {pin.label && (
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200">
                    {pin.label}
                  </div>
                )}
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-neutral-200">
                  {pin.content}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void removePin(pin.id)}
                className="opacity-0 transition group-hover:opacity-100 text-xs text-red-300 hover:text-red-200"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="mt-3 space-y-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (optional)"
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-neutral-500 focus:border-violet-400/60 focus:outline-none"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            kind === "prompt"
              ? "Prompt to fire on click (e.g. \"Write the investor pitch\")"
              : "What should the AI remember?"
          }
          rows={2}
          className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-neutral-500 focus:border-violet-400/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!content.trim() || pending}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
        >
          {pending
            ? "Adding…"
            : kind === "prompt"
              ? "Save prompt"
              : "Pin to project"}
        </button>
      </form>
    </div>
  );
}
