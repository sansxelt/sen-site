import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightAppAccess } from "@/lib/v-preflight-guard";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { SetupRequired } from "../../setup-required";
import { getApplication } from "@/lib/v-applications";
import { listAllIssues, type IssueRow } from "@/lib/preflight/overview-db";
import { AppTabs } from "../app-tabs";
import { I, EmptyIcon, DecisionMark } from "@/app/rank/_components/icons";

export const metadata: Metadata = { title: "Issues" };

// Relative "3m ago / 4h ago / Jul 2" (server component; rendered once per request, no hydration risk).
function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t)) return "";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Severity pill: label AND colour together, never colour alone.
type Pill = { label: string; color: string; bg: string; border: string };
const SEVERITY_PILLS: Record<string, Pill> = {
  critical: { label: "Critical", color: "var(--stop-ink)", bg: "var(--stop-wash)", border: "var(--stop-line)" },
  high: { label: "High", color: "var(--wait-ink)", bg: "var(--wait-wash)", border: "var(--wait-line)" },
  medium: { label: "Medium", color: "var(--fg-3)", bg: "var(--bg-2)", border: "var(--line-2)" },
  low: { label: "Low", color: "var(--fg-4)", bg: "var(--bg-2)", border: "var(--line-2)" },
};
function sevPill(sev: string): Pill {
  return SEVERITY_PILLS[sev] ?? { label: sev, color: "var(--fg-4)", bg: "var(--bg-2)", border: "var(--line-2)" };
}

function catLabel(c: string | null): string { return c ? c.replace(/_/g, " ") : ""; }

function IssueRowView({ appId, issue, resolved }: { appId: string; issue: IssueRow; resolved?: boolean }) {
  const p = sevPill(issue.severity);
  const body = (
    <>
      <span className="pill" style={{ fontSize: 10, color: p.color, background: p.bg, borderColor: p.border, flex: "none" }}>{p.label}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: resolved ? "var(--fg-3)" : "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {issue.title || "Untitled issue"}
        </div>
        <div style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 3 }}>
          {[catLabel(issue.category), timeAgo(issue.createdAt)].filter(Boolean).join(", ")}
        </div>
      </div>
      {resolved ? <span className="pill" style={{ fontSize: 10, color: "var(--acc-deep)", background: "var(--acc-soft)", borderColor: "var(--acc-line)", flex: "none" }}><DecisionMark decision="resolved" />Resolved</span> : null}
      {issue.lastSeenRun ? <span aria-hidden style={{ color: "var(--fg-5)", flex: "none", fontSize: 13 }}>→</span> : null}
    </>
  );
  const rowStyle = {
    display: "flex", alignItems: "center", gap: 12, padding: "13px 15px",
    border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", background: "var(--bg-1)",
    textDecoration: "none", opacity: resolved ? 0.85 : 1,
  } as const;
  // A row links to the run where the issue was last seen; without one there is nothing to open yet.
  return issue.lastSeenRun
    ? <Link href={`/systems/${appId}/passes/${issue.lastSeenRun}`} style={rowStyle}>{body}</Link>
    : <div style={rowStyle}>{body}</div>;
}

const sectionHead = { fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--fg-1)", margin: "0 0 12px" } as const;

// All issues found for one application, open first, resolved after. Owner-gated server component; every
// read degrades to an empty state, so nothing here is ever fabricated.
export default async function AppIssuesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requirePreflightAppAccess(id, "/systems/" + id);
  const owner = access?.owner ?? "";
  if (!(await preflightDbReady())) return <SetupRequired />;

  const app = await getApplication(owner, id);
  if (!app) {
    return (
      <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
        <div className="empty">
          <EmptyIcon d={I.slash} />
          <h3>Application not found</h3>
          <p>This application doesn&apos;t exist, or it belongs to another account.</p>
          <Link href="/systems" className="btn">Back to applications</Link>
        </div>
      </div>
    );
  }

  const issues = await listAllIssues(owner, { applicationId: id });
  const open = issues.filter((i) => i.status !== "resolved");
  const resolvedIssues = issues.filter((i) => i.status === "resolved");

  return (
    <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, marginBottom: 14 }}>
        <Link href="/systems" style={{ color: "var(--fg-4)", textDecoration: "none" }}>Applications</Link>
        <span aria-hidden style={{ color: "var(--fg-5)" }}>/</span>
        <span style={{ color: "var(--fg-2)", fontWeight: 600, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.name}</span>
      </nav>

      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", margin: "6px 0 10px" }}>{app.name}</h1>
      <a href={app.app_url} target="_blank" rel="noopener noreferrer"
        style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-4)", textDecoration: "none", wordBreak: "break-all" }}>
        {app.app_url}
      </a>

      <AppTabs appId={id} active="issues" />

      {issues.length === 0 ? (
        <div className="empty">
          <EmptyIcon d={I.alert} />
          <h3>No issues recorded</h3>
          <p>Issues are failures found by a verification, each with evidence and a repair prompt. Run a verification to see whether any of your approved flows break.</p>
          <Link href={`/systems/${id}`} className="btn">Back to overview</Link>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 28 }}>
          <section>
            <h2 style={sectionHead}>Open ({open.length})</h2>
            {open.length ? (
              <div style={{ display: "grid", gap: 8 }}>
                {open.map((i) => <IssueRowView key={i.id} appId={id} issue={i} />)}
              </div>
            ) : (
              <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: 0 }}>No open issues. Every recorded issue for this app has been resolved.</p>
            )}
          </section>
          {resolvedIssues.length ? (
            <section>
              <h2 style={sectionHead}>Resolved ({resolvedIssues.length})</h2>
              <div style={{ display: "grid", gap: 8 }}>
                {resolvedIssues.map((i) => <IssueRowView key={i.id} appId={id} issue={i} resolved />)}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
