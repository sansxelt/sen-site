import type { EvalRow } from "@/lib/v-projects";
import { MoveToProject, CopyReportLink } from "./workspace-client";
import { HealthBadge } from "./analytics-ui";

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  complete: { bg: "var(--acc-soft)", fg: "var(--acc-deep)" },
  active: { bg: "var(--bg-1)", fg: "var(--acc-deep)" },
};

// Read-only evaluation rows with project, status, recommended output + confidence,
// judgments, and actions (open report, copy public link, move to a project).
export function EvaluationList({ rows, projects, showProject = true, showMove = true }: {
  rows: EvalRow[]; projects: { id: string; name: string }[]; showProject?: boolean; showMove?: boolean;
}) {
  if (!rows.length) return null;
  return (
    <div style={{ border: "1px solid var(--line-2)", borderRadius: 12, overflow: "hidden", background: "var(--bg-1)", boxShadow: "var(--shadow-card)" }}>
      {rows.map((r, i) => {
        const tone = STATUS_TONE[r.status] ?? { bg: "var(--bg-2)", fg: "var(--fg-4)" };
        return (
          <div key={r.id} style={{ padding: "13px 18px", borderTop: i === 0 ? "none" : "1px solid var(--line-1)", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ minWidth: 0, flex: "1 1 240px" }}>
              <a href={`/tests/${r.id}/report`} style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-1)", textDecoration: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{r.followup_type ? <span className="pill" style={{ fontSize: 9, color: "var(--acc-deep)", marginRight: 8, verticalAlign: "middle" }}>Confirmation round</span> : null}{r.title}</a>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-4)", marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
                {showProject && r.project_name ? <span style={{ color: "var(--fg-3)" }}>{r.project_name}</span> : null}
                <span>{r.votes_valid}/{r.votes_target} qualified signals</span>
                {r.recommended ? <span style={{ color: "var(--acc-deep)", fontWeight: 600 }}>{r.recommended}{r.confidence ? ` | ${r.confidence}` : ""}</span> : null}
                <span style={{ color: "var(--fg-5)" }}>{new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </div>
            </div>
            {r.health ? <HealthBadge state={r.health} /> : <span className="pill" style={{ background: tone.bg, color: tone.fg, borderColor: "var(--acc-line)" }}>{r.status === "complete" ? "Decision made" : r.status === "active" ? "Collecting signal" : r.status}</span>}
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              {showMove ? <MoveToProject testId={r.id} projectId={r.project_id} projects={projects} /> : null}
              {r.share_enabled && r.share_token ? <CopyReportLink token={r.share_token} /> : null}
              <a href={`/tests/${r.id}/report`} className="btn btn--ghost" style={{ fontSize: 12.5, padding: "6px 12px" }}>{r.status === "complete" ? "Report →" : "View →"}</a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
