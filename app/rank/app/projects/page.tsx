import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ensureProfile } from "@/lib/v-db";
import { listProjects } from "@/lib/v-projects";
import { getWorkspaceContext } from "@/lib/v-workspace";
import { NewProjectForm } from "../_workspace/workspace-client";
import { SharedWithYou } from "../_workspace/shared-with-you";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin?callbackUrl=%2Fapp%2Fprojects");
  await ensureProfile(email, session.user?.name ?? undefined);
  const [projects, ctx] = await Promise.all([listProjects(email), getWorkspaceContext(email)]);
  const sharedCard = <SharedWithYou shared={ctx.shared.map((w) => ({ workspace_id: w.workspace_id, name: w.name, role: w.role }))} sharedProjects={ctx.sharedProjects.map((p) => ({ project_id: p.project_id, name: p.name, workspace_name: p.workspace_name, role: p.role }))} />;

  return (
    <div className="wrap" style={{ maxWidth: 1040, paddingTop: "clamp(24px, 3vw, 38px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1 className="display">Projects</h1>
          <p>Group your evaluations by campaign, client, redesign, or decision.</p>
        </div>
        <NewProjectForm label="New project" primary />
      </div>

      {sharedCard}

      {projects.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "clamp(28px, 5vw, 52px)", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17, marginBottom: 6 }}>No projects yet</div>
            <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: "0 auto", maxWidth: 420, lineHeight: 1.55 }}>Projects keep related evaluations together — a summer campaign, a website redesign, a client&apos;s creative, your AI-output tests. Create one, then file evaluations under it.</p>
          </div>
          <NewProjectForm label="Create your first project" primary />
        </div>
      ) : (
        <div className="tile-grid cols-3">
          {projects.map((p) => (
            <a key={p.id} href={`/app/projects/${p.id}`} className="acard" style={{ textDecoration: "none", gap: 7, minHeight: 120, justifyContent: "flex-start" }}>
              <div className="acard__t" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
              {p.description ? <div className="acard__d" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.description}</div> : null}
              <div style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-4)", marginTop: "auto" }}>{p.evaluation_count ?? 0} evaluation{(p.evaluation_count ?? 0) === 1 ? "" : "s"} · updated {new Date(p.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
