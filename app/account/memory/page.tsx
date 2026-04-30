import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "../../../auth";
import {
  listProjectsForOwner,
  listPinsForProject,
  type ProjectPinnedItem,
} from "../../../lib/projects";
import { ProjectsManager } from "../../../components/projects-manager";

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Create and manage projects. Pin context the AI carries every time you chat in a project.",
};

export const dynamic = "force-dynamic";

// /account/memory is the dedicated projects management surface.
// (Nav still says "Memory" in spots; same concept — a project's
// pinned context IS what sansxel remembers across sessions.)
//
// User feedback drove a real management page: the chat composer's
// dropdown was the only entry point, and people hunting through
// /account looking for a "Projects" tab found nothing, concluded
// projects didn't work. This page surfaces all the CRUD: list,
// create, edit metadata, manage pinned context, manage prompt
// pins, delete.

export default async function MemoryPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const projects = email ? await listProjectsForOwner(email) : [];

  // Pull pins for each project in parallel for the initial render
  // pin counts. ProjectsManager refetches per-project detail when
  // the user opens a card so this is just initial-paint data.
  const pinsByProject: Record<string, ProjectPinnedItem[]> = {};
  await Promise.all(
    projects.map(async (p) => {
      pinsByProject[p.id] = await listPinsForProject(p.id);
    }),
  );

  const projectsWithCounts = projects.map((p) => ({
    ...p,
    pinned: pinsByProject[p.id] ?? [],
  }));

  const totalPins = Object.values(pinsByProject).reduce(
    (acc, list) => acc + list.length,
    0,
  );

  return (
    <div className="max-w-3xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Projects</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Long-running context the AI carries between sessions.
            Each project auto-injects its description, goals, and
            pinned items into every chat that lives inside it.
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

      <div className="mt-6">
        <ProjectsManager initialProjects={projectsWithCounts} />
      </div>

      <p className="mt-8 text-xs text-neutral-600">
        Projects are private to your account.{" "}
        <Link href="/privacy" className="sansxel-subtle-link">
          Privacy policy &rarr;
        </Link>
      </p>
    </div>
  );
}
