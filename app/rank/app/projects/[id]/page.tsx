import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProject, projectStats, listProjects } from "@/lib/v-projects";
import { projectAnalytics, projectSourceQuality } from "@/lib/v-analytics";
import { managedProjectMeta, getProjectAccessRole } from "@/lib/v-workspace";
import { EvaluationList } from "../../_workspace/evaluation-list";
import { EditProjectForm } from "../../_workspace/workspace-client";
import { SectionHead, Dist, Bars, CONF_COLORS, SIGNAL_COLORS } from "../../_workspace/analytics-ui";
import { ProjectAccess } from "./project-access";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin?callbackUrl=%2Fapp%2Fprojects");

  const project = await getProject(email, id);
  if (!project) {
    // Not the project owner — but a workspace owner/admin can still manage access,
    // and project/workspace read-members get the client-safe shared view.
    const managed = await managedProjectMeta(email, id);
    if (managed) {
      return (
        <div className="wrap" style={{ maxWidth: 880, paddingTop: "clamp(24px, 3vw, 38px)", paddingBottom: 80 }}>
          <Link href="/app/team" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, color: "var(--fg-3)", textDecoration: "none", marginBottom: 18 }}>← Team</Link>
          <div className="phead"><div><p className="eyebrow">Program access · Workspace admin</p><h1 className="display">{managed.name}</h1>{managed.description ? <p>{managed.description}</p> : null}</div></div>
          <p style={{ fontSize: 13, color: "var(--fg-4)", margin: "0 0 4px", maxWidth: 620, lineHeight: 1.6 }}>You manage this program&apos;s access as a workspace admin. The program&apos;s analytics stay with its owner; you can invite clients and collaborators and manage their roles below.</p>
          <ProjectAccess projectId={id} />
          <div style={{ marginTop: 22 }}><Link href={`/app/shared/projects/${id}`} className="btn btn--ghost">Open client-safe view →</Link></div>
        </div>
      );
    }
    if (await getProjectAccessRole(email, id)) redirect(`/app/shared/projects/${id}`);
    return (
      <div className="wrap" style={{ maxWidth: 560, paddingTop: "clamp(28px, 5vw, 56px)", textAlign: "center" }}>
        <h1 className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", marginBottom: 12 }}>Program not found</h1>
        <p className="lead-copy" style={{ margin: "0 auto 22px" }}>It may have been removed, or you don&apos;t have access to it.</p>
        <Link href="/app/projects" className="btn btn--ghost">Back to programs</Link>
      </div>
    );
  }

  const [stats, projects, pa, sources] = await Promise.all([projectStats(email, id), listProjects(email), projectAnalytics(email, id), projectSourceQuality(email, id)]);
  const projOpts = projects.map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="wrap" style={{ maxWidth: 1040, paddingTop: "clamp(24px, 3vw, 38px)", paddingBottom: 80 }}>
      <Link href="/app/projects" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, color: "var(--fg-3)", textDecoration: "none", marginBottom: 18 }}>← Programs</Link>
      <div className="phead">
        <div style={{ minWidth: 0 }}>
          <p className="eyebrow">Program</p>
          <h1 className="display">{project.name}</h1>
          {project.description ? <p>{project.description}</p> : null}
          <EditProjectForm id={project.id} name={project.name} description={project.description} />
        </div>
        <Link href="/app/new" className="btn">New workflow <span aria-hidden>→</span></Link>
      </div>

      <div className="tile-grid cols-3" style={{ marginBottom: 26, marginTop: 8 }}>
        <div className="stat"><div className="stat__l">Workflows</div><div className="stat__v tnum">{stats.evaluations}</div><div className="stat__s">in this program</div></div>
        <div className="stat"><div className="stat__l">Decisions made</div><div className="stat__v tnum">{stats.completed}</div><div className="stat__s">decision records</div></div>
        <div className="stat"><div className="stat__l">Qualified signals</div><div className="stat__v tnum">{stats.validJudgments.toLocaleString()}</div><div className="stat__s">across workflows</div></div>
      </div>

      {pa.completed > 0 ? (
        <div className="tile-grid cols-2" style={{ marginBottom: 26 }}>
          <div className="card">
            <SectionHead>Decision quality</SectionHead>
            <Dist items={[
              { label: "Strong", value: pa.quality.strong, color: CONF_COLORS.Strong },
              { label: "Moderate", value: pa.quality.moderate, color: CONF_COLORS.Moderate },
              { label: "Tentative", value: pa.quality.tentative, color: CONF_COLORS.Tentative },
              { label: "Inconclusive", value: pa.quality.inconclusive, color: CONF_COLORS.Inconclusive },
            ]} />
            <p style={{ fontSize: 12, color: "var(--fg-5)", marginTop: 12, marginBottom: 0 }}>Avg preference margin {pa.avgMargin == null ? "—" : `${pa.avgMargin} pts`} · {pa.filtered.toLocaleString()} filtered</p>
          </div>
          <div className="card">
            <SectionHead>{pa.byCategory.length > 1 ? "Categories" : "Signal quality"}</SectionHead>
            {pa.byCategory.length > 1
              ? <Bars rows={pa.byCategory.map((c) => ({ label: c.label, value: c.count }))} unit=" evals" />
              : <Dist items={[
                  { label: "Clean", value: pa.quality.clean, color: SIGNAL_COLORS.Clean },
                  { label: "Limited", value: pa.quality.limited, color: SIGNAL_COLORS.Limited },
                  { label: "Needs more", value: pa.quality.needsMore, color: SIGNAL_COLORS.NeedsMore },
                ]} />}
          </div>
        </div>
      ) : null}

      {pa.completed > 0 ? (
        <div className="tile-grid cols-2" style={{ marginBottom: 26 }}>
          <div className="card">
            <SectionHead>Decision readiness</SectionHead>
            <Bars rows={[
              { label: "Ready to decide", value: pa.health.ready },
              { label: "Needs more judgments", value: pa.health.needsMore },
              { label: "Noisy signal", value: pa.health.noisy },
              { label: "Too close to call", value: pa.health.tooClose },
              { label: "Low-quality traffic", value: pa.health.lowQuality },
            ].filter((r) => r.value > 0)} unit=" evals" />
          </div>
          <div className="card">
            <SectionHead>Signal sources</SectionHead>
            {sources.length > 0 ? <Bars rows={sources.map((sq) => ({ label: sq.label, value: sq.valid, sub: `${sq.filterRate}% filtered` }))} unit=" valid" /> : <p style={{ fontSize: 13, color: "var(--fg-4)", margin: 0 }}>Source analytics appear for judgments collected after the latest update.</p>}
          </div>
        </div>
      ) : null}

      <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Decision workflows</div>
      {stats.rows.length > 0 ? (
        <EvaluationList rows={stats.rows} projects={projOpts} showProject={false} />
      ) : (
        <div className="card" style={{ textAlign: "center", padding: "clamp(24px, 4vw, 40px)" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, marginBottom: 6 }}>No workflows in this program yet</div>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: "0 auto 16px", maxWidth: 380 }}>Create a decision workflow and add it to this program, or move an existing one here from your dashboard.</p>
          <Link href="/app/new" className="btn">New workflow →</Link>
        </div>
      )}

      <ProjectAccess projectId={project.id} />
    </div>
  );
}
