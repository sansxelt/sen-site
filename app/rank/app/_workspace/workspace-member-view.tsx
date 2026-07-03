// Read-only, workspace-scoped view for a member who selected a SHARED workspace in
// the switcher. Non-client roles see aggregate tiles + a project list linking to the
// per-project shared analytics; client viewers see client-safe reports only. No
// private controls (billing/API/webhooks/collection-links/screening) are rendered.
import Link from "next/link";
import type { SelectedWorkspace, WorkspaceSummary } from "@/lib/v-workspace";

const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Admin", editor: "Editor", viewer: "Viewer", client_viewer: "Client viewer" };
const TITLE: Record<string, string> = { dashboard: "Dashboard", projects: "Projects", data: "Analytics", "data-quality": "Data quality" };

export function WorkspaceMemberView({ selected, summary, variant }: { selected: SelectedWorkspace; summary: WorkspaceSummary; variant: "dashboard" | "projects" | "data" | "data-quality" }) {
  const clientSafe = summary.clientSafe;
  const t = summary.totals;
  const projectsWithWork = summary.projects.filter((p) => p.evaluations > 0);

  return (
    <div className="wrap" style={{ maxWidth: 1040, paddingTop: "clamp(24px, 3vw, 38px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Workspace: {selected.name}</p>
          <h1 className="display">{TITLE[variant]}</h1>
          <p>{clientSafe ? "Client-safe access — shared reports only." : "Read-only workspace analytics for the projects you can access."}</p>
        </div>
      </div>

      <div className="card" style={{ background: "var(--bg-2)", marginBottom: 22, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13.5, color: "var(--fg-2)" }}><strong style={{ color: "var(--fg-1)" }}>Workspace: {selected.name}</strong> · Role: {ROLE_LABEL[selected.role]} · {clientSafe ? "Client-safe access" : "Read-only"}</div>
        <Link href="/app/team" className="btn btn--ghost" style={{ fontSize: 12.5 }}>Team →</Link>
      </div>

      {clientSafe ? (
        <>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", marginBottom: 16 }}>Client viewers can access client-safe reports only.</p>
          {summary.projects.length === 0 ? (
            <div className="empty"><div className="empty__icon">📂</div><h3>No projects shared with you yet</h3><p>Projects shared with you in this workspace will appear here.</p></div>
          ) : (
            <div className="tile-grid cols-3">
              {summary.projects.map((p) => (
                <Link key={p.id} href={`/app/shared/projects/${p.id}`} className="acard" style={{ textDecoration: "none", gap: 7 }}>
                  <div className="acard__t" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                  <div className="acard__d">{p.completed} report{p.completed === 1 ? "" : "s"} · client-safe</div>
                  <div style={{ fontSize: 12, color: "var(--acc-deep)" }}>View reports →</div>
                </Link>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {variant !== "projects" && (
            <div className="tile-grid cols-4" style={{ marginBottom: 22 }}>
              <div className="stat"><div className="stat__l">Decision workflows</div><div className="stat__v tnum">{t.evaluations.toLocaleString()}</div><div className="stat__s">{t.completed} decided, {t.active} collecting</div></div>
              <div className="stat"><div className="stat__l">Decisions made</div><div className="stat__v tnum">{t.completed.toLocaleString()}</div><div className="stat__s">decision records</div></div>
              <div className="stat"><div className="stat__l">Collecting signal</div><div className="stat__v tnum">{t.active.toLocaleString()}</div><div className="stat__s">active workflows</div></div>
              <div className="stat"><div className="stat__l">Qualified signals</div><div className="stat__v tnum">{t.validJudgments.toLocaleString()}</div><div className="stat__s">quality-filtered human signal</div></div>
            </div>
          )}
          <p style={{ fontSize: 12.5, color: "var(--fg-4)", marginBottom: 14 }}>You are viewing analytics for decision programs shared with you in this workspace. Open a program for its full decision and signal-quality analytics.</p>
          {summary.projects.length === 0 ? (
            <div className="empty"><div className="empty__icon">📂</div><h3>This workspace has no decision programs yet</h3><p>Decision programs created in this workspace will appear here.</p></div>
          ) : projectsWithWork.length === 0 ? (
            <div className="empty"><div className="empty__icon">◷</div><h3>No decisions made yet</h3><p>Completed decision workflows will appear here with decision quality and signal analytics.</p></div>
          ) : (
            <div className="tile-grid cols-3">
              {summary.projects.map((p) => (
                <Link key={p.id} href={`/app/shared/projects/${p.id}`} className="acard" style={{ textDecoration: "none", gap: 7 }}>
                  <div className="acard__t" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                  <div className="acard__d">{p.evaluations} workflow{p.evaluations === 1 ? "" : "s"} · {p.completed} decided · {p.validJudgments.toLocaleString()} qualified</div>
                  <div style={{ fontSize: 12, color: "var(--acc-deep)" }}>Open analytics →</div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
