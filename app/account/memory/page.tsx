import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "../../../auth";
import {
  listProjectsForOwner,
  listPinsForProject,
  type ProjectPinnedItem,
} from "../../../lib/projects";

export const metadata: Metadata = {
  title: "Memory",
  description:
    "What sansxel remembers about your projects. Pinned context that auto-injects into every chat.",
};

export const dynamic = "force-dynamic";

// Memory page surfaces the v0.2.0 wedge: every project the user
// owns + the pinned items inside, all in one read-only browse.
// Editing happens inline in the chat composer's project picker;
// this page is the "what's the AI carrying about me right now"
// surface, not a new editor.

export default async function MemoryPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const projects = email ? await listProjectsForOwner(email) : [];

  // Pull pins for each project in parallel. Failures are silent
  // (the data layer fails open) so a partial DB outage just shows
  // an empty pin list under each project, never a broken page.
  const pinsByProject: Record<string, ProjectPinnedItem[]> = {};
  await Promise.all(
    projects.map(async (p) => {
      pinsByProject[p.id] = await listPinsForProject(p.id);
    }),
  );

  const totalPins = Object.values(pinsByProject).reduce(
    (acc, list) => acc + list.length,
    0,
  );

  return (
    <div className="max-w-3xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Memory</h1>
          <p className="mt-1 text-sm text-neutral-400">
            What sansxel carries between sessions. Every project here auto-injects its description, goals, and pinned items into every chat that lives inside it.
          </p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="mt-6 grid grid-cols-3 gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div className="text-center">
          <div className="text-xl font-semibold text-white">{projects.length}</div>
          <div className="mt-0.5 text-xs text-neutral-500">Projects</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-semibold text-white">{totalPins}</div>
          <div className="mt-0.5 text-xs text-neutral-500">Pinned items</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-semibold text-white">
            {projects[0]
              ? new Date(projects[0].updated_at).toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "short",
                })
              : "—"}
          </div>
          <div className="mt-0.5 text-xs text-neutral-500">Last updated</div>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center">
          <p className="text-sm text-neutral-300">
            No projects yet. Open a chat and use the project picker in the composer to spin one up.
          </p>
          <p className="mt-3 max-w-prose mx-auto text-xs leading-relaxed text-neutral-500">
            Projects are how sansxel remembers you. Pin a description, goals, and any context you want carried, and every reply lands grounded in the same place you left off.
          </p>
          <Link
            href="/app"
            className="sansxel-white-button mt-5 inline-block rounded-lg border border-white/10 bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
          >
            Open the workshop
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {projects.map((project) => {
            const pins = pinsByProject[project.id] ?? [];
            return (
              <section
                key={project.id}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-base font-semibold text-white">
                      {project.name}
                    </div>
                    {project.description && (
                      <p className="mt-1 text-sm leading-relaxed text-neutral-300">
                        {project.description}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full border border-violet-400/25 bg-violet-400/[0.08] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-violet-200">
                    {pins.length} pinned
                  </span>
                </div>

                {project.goals && (
                  <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/20 p-3">
                    <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                      Goals
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">
                      {project.goals}
                    </p>
                  </div>
                )}

                {pins.length > 0 ? (
                  <ul className="mt-4 space-y-2">
                    {pins.map((pin) => (
                      <li
                        key={pin.id}
                        className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
                      >
                        {pin.label && (
                          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-violet-200">
                            {pin.label}
                          </div>
                        )}
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">
                          {pin.content}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-xs text-neutral-500">
                    No pinned items yet. Drop facts the AI should remember every time you chat in this project, in the picker on /app.
                  </p>
                )}

                <div className="mt-4 text-[11px] text-neutral-600">
                  Updated {new Date(project.updated_at).toLocaleString()}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p className="mt-8 text-xs text-neutral-600">
        Memory is private to your account.{" "}
        <Link href="/privacy" className="sansxel-subtle-link">
          Privacy policy &rarr;
        </Link>
      </p>
    </div>
  );
}
