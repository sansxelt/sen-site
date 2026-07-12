import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightOwner } from "@/lib/v-preflight-guard";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { SetupRequired } from "../applications/setup-required";
import { listAllIssues, type IssueRow } from "@/lib/preflight/overview-db";
import { I, EmptyIcon, DecisionMark } from "@/app/rank/_components/icons";

export const metadata: Metadata = { title: "Issues" };

// Relative "3m ago / 4h ago / Jul 2". Server component, rendered once per request, so a wall-clock
// relative time carries no hydration-mismatch risk. Same helper as app/rank/app/applications/page.tsx.
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

// Severity accent used for the row's left border. Unknown severities fall back to the medium tone.
const SEVERITY_COLOR: Record<string, string> = {
  critical: "#C0392B",
  high: "#B45309",
  medium: "var(--fg-3)",
  low: "var(--fg-4)",
};

// Severity pill tones. The .pill class uppercases the label, so status is always conveyed by text,
// never by colour alone.
function severityTone(severity: string): { color: string; bg: string; border: string } {
  switch (severity) {
    case "critical": return { color: "#C0392B", bg: "#FBEBEA", border: "#F0C7C2" };
    case "high": return { color: "#B45309", bg: "#FEF6E7", border: "#F3DFB0" };
    case "low": return { color: "var(--fg-4)", bg: "var(--bg-2)", border: "var(--line-2)" };
    default: return { color: "var(--fg-3)", bg: "var(--bg-2)", border: "var(--line-2)" };
  }
}

// "broken_form_submit" -> "broken form submit"
function humanizeCategory(category: string): string {
  return category.replace(/_/g, " ");
}

function StatChip({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "11px 16px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", minWidth: 92 }}>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, lineHeight: 1, color: color ?? "var(--fg-1)" }}>{value}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-4)" }}>{label}</span>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-2)", margin: "0 0 10px" }}>{children}</h2>
  );
}

// One open issue. The 3px left border carries the severity colour; the severity pill carries the same
// state as text. firstSeenRun / lastSeenRun are run ids (no per-run timestamp is exposed here), so the
// only honest time we can show is when the issue row was created: one "opened X ago".
function OpenIssueRow({ issue }: { issue: IssueRow }) {
  const accent = SEVERITY_COLOR[issue.severity] ?? SEVERITY_COLOR.medium;
  const tone = severityTone(issue.severity);
  const opened = timeAgo(issue.createdAt);
  return (
    <Link
      href={`/applications/${issue.applicationId}`}
      className="card card--hover"
      style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 16px", borderLeft: `3px solid ${accent}`, textDecoration: "none", color: "inherit" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="pill" style={{ fontSize: 10, color: tone.color, background: tone.bg, borderColor: tone.border }}>{issue.severity}</span>
        {issue.category ? <span className="pill" style={{ fontSize: 10 }}>{humanizeCategory(issue.category)}</span> : null}
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)", lineHeight: 1.35 }}>{issue.title}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, color: "var(--fg-4)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{issue.applicationName || "Unknown application"}</span>
        {opened ? <span style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-4)", flex: "none" }}>opened {opened}</span> : null}
      </div>
    </Link>
  );
}

// Resolved history stays visible but muted. When the resolving run is known the row links straight to
// that run's report; otherwise it falls back to the application page.
function ResolvedIssueRow({ issue }: { issue: IssueRow }) {
  const href = issue.resolvedRun
    ? `/applications/${issue.applicationId}/passes/${issue.resolvedRun}`
    : `/applications/${issue.applicationId}`;
  const opened = timeAgo(issue.createdAt);
  return (
    <Link
      href={href}
      className="card card--hover"
      style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 16px", borderLeft: "3px solid var(--line-2)", textDecoration: "none", color: "inherit", background: "var(--bg-2)" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="pill" style={{ fontSize: 10, color: "var(--acc-deep)", background: "var(--acc-soft)", borderColor: "var(--acc-line)" }}><DecisionMark decision="resolved" />Resolved</span>
        <span className="pill" style={{ fontSize: 10 }}>{issue.severity}</span>
        {issue.category ? <span className="pill" style={{ fontSize: 10 }}>{humanizeCategory(issue.category)}</span> : null}
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, color: "var(--fg-3)", lineHeight: 1.35 }}>{issue.title}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, color: "var(--fg-4)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{issue.applicationName || "Unknown application"}</span>
        {opened ? <span style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-4)", flex: "none" }}>opened {opened}</span> : null}
      </div>
    </Link>
  );
}

function NoOpenIssues() {
  return (
    <div className="empty">
      <EmptyIcon d={I.alert} />
      <h3>No open issues</h3>
      <p>Run a Production Pass and any launch blocker it finds appears here with evidence and reproduction steps.</p>
      <Link href="/applications" className="btn">Go to applications</Link>
    </div>
  );
}

// Owner-wide Issues index. Server component behind the preflight owner gate; the data layer degrades to
// [] when tables are unmigrated or a read fails, so this page never fabricates data.
export default async function IssuesPage() {
  const owner = await requirePreflightOwner("/issues");
  if (!(await preflightDbReady())) return <SetupRequired />;

  const [open, resolved] = await Promise.all([
    listAllIssues(owner, { status: "open", limit: 100 }),
    listAllIssues(owner, { status: "resolved", limit: 30 }),
  ]);

  const criticalCount = open.filter((i) => i.severity === "critical").length;
  const highCount = open.filter((i) => i.severity === "high").length;

  return (
    <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      {/* header */}
      <div style={{ marginBottom: 24 }}>
        <p className="eyebrow">Vraelis Preflight</p>
        <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", margin: "6px 0 10px" }}>Issues</h1>
        <p style={{ fontSize: 14.5, color: "var(--fg-3)", lineHeight: 1.6, margin: 0, maxWidth: 560 }}>
          Launch blockers found by real browser runs of your app, each with the evidence to fix it.
        </p>
      </div>

      {open.length === 0 && resolved.length === 0 ? (
        <NoOpenIssues />
      ) : (
        <>
          {/* counts */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
            <StatChip label="Open" value={open.length} color={open.length ? "var(--fg-1)" : undefined} />
            <StatChip label="Critical" value={criticalCount} color={criticalCount ? "#C0392B" : undefined} />
            <StatChip label="High" value={highCount} color={highCount ? "#B45309" : undefined} />
            <StatChip label="Resolved" value={resolved.length} color={resolved.length ? "var(--acc-deep)" : undefined} />
          </div>

          {/* open issues, most severe first (listAllIssues sorts by severity) */}
          <section style={{ marginBottom: 32 }}>
            <SectionHeading>Open</SectionHeading>
            {open.length === 0 ? (
              <NoOpenIssues />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {open.map((issue) => <OpenIssueRow key={issue.id} issue={issue} />)}
              </div>
            )}
          </section>

          {/* resolved history */}
          {resolved.length > 0 ? (
            <section>
              <SectionHeading>Resolved</SectionHeading>
              {resolved.length === 30 ? (
                <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "0 0 10px" }}>Showing the 30 most recently recorded.</p>
              ) : null}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {resolved.map((issue) => <ResolvedIssueRow key={issue.id} issue={issue} />)}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
