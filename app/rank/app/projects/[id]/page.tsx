import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProject, projectStats, listProjects } from "@/lib/v-projects";
import { EvaluationList } from "../../_workspace/evaluation-list";
import { EditProjectForm } from "../../_workspace/workspace-client";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin?callbackUrl=%2Fapp%2Fprojects");

  const project = await getProject(email, id);
  if (!project) {
    return (
      <div className="wrap" style={{ maxWidth: 560, paddingTop: "clamp(28px, 5vw, 56px)", textAlign: "center" }}>
        <h1 className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", marginBottom: 12 }}>Project not found</h1>
        <p className="lead-copy" style={{ margin: "0 auto 22px" }}>It may have been removed, or it isn&apos;t yours.</p>
        <a href="/app/projects" className="btn btn--ghost">Back to projects</a>
      </div>
    );
  }

  const [stats, projects] = await Promise.all([projectStats(email, id), listProjects(email)]);
  const projOpts = projects.map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="wrap" style={{ maxWidth: 1040, paddingTop: "clamp(24px, 3vw, 38px)", paddingBottom: 80 }}>
      <a href="/app/projects" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, color: "var(--fg-3)", textDecoration: "none", marginBottom: 18 }}>← Projects</a>
      <div className="phead">
        <div style={{ minWidth: 0 }}>
          <p className="eyebrow">Project</p>
          <h1 className="display">{project.name}</h1>
          {project.description ? <p>{project.description}</p> : null}
          <EditProjectForm id={project.id} name={project.name} description={project.description} />
        </div>
        <a href="/app/new" className="btn">New evaluation <span aria-hidden>→</span></a>
      </div>

      <div className="tile-grid cols-3" style={{ marginBottom: 26, marginTop: 8 }}>
        <div className="stat"><div className="stat__l">Evaluations</div><div className="stat__v tnum">{stats.evaluations}</div><div className="stat__s">in this project</div></div>
        <div className="stat"><div className="stat__l">Completed</div><div className="stat__v tnum">{stats.completed}</div><div className="stat__s">decision reports</div></div>
        <div className="stat"><div className="stat__l">Valid judgments</div><div className="stat__v tnum">{stats.validJudgments.toLocaleString()}</div><div className="stat__s">collected</div></div>
      </div>

      <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Evaluations</div>
      {stats.rows.length > 0 ? (
        <EvaluationList rows={stats.rows} projects={projOpts} showProject={false} />
      ) : (
        <div className="card" style={{ textAlign: "center", padding: "clamp(24px, 4vw, 40px)" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, marginBottom: 6 }}>No evaluations in this project yet</div>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: "0 auto 16px", maxWidth: 380 }}>Create an evaluation and assign it to this project, or move an existing one here from the dashboard.</p>
          <a href="/app/new" className="btn">New evaluation →</a>
        </div>
      )}
    </div>
  );
}
