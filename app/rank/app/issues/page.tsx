import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightOwner } from "@/lib/v-preflight-guard";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { SetupRequired } from "../systems/setup-required";
import { listAllIssues, type IssueRow } from "@/lib/preflight/overview-db";
import { I, EmptyIcon, DecisionMark } from "@/app/rank/_components/icons";
import { Page, PageHeader } from "@/app/rank/_components/page-header";

export const metadata: Metadata = { title: "Issues" };

// Relative "3m ago / 4h ago / Jul 2". Server component, rendered once per request, so a wall-clock
// relative time carries no hydration-mismatch risk. Same helper as app/rank/app/systems/page.tsx.
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

// Severity pill tones. The .pill class uppercases the label, so status is always conveyed by text,
// never by colour alone.
function severityTone(severity: string): { color: string; bg: string; border: string } {
  switch (severity) {
    case "critical": return { color: "var(--stop-ink)", bg: "var(--stop-wash)", border: "var(--stop-line)" };
    // High is a severity, not "a person is needed", so it does not borrow Blocked's amber.
    case "high": return { color: "var(--fg-1)", bg: "var(--bg-2)", border: "var(--line-3)" };
    case "low": return { color: "var(--fg-4)", bg: "var(--bg-2)", border: "var(--line-2)" };
    default: return { color: "var(--fg-3)", bg: "var(--bg-2)", border: "var(--line-2)" };
  }
}

// "broken_form_submit" -> "broken form submit"
// One word per severity, capitalised the way every other console surface prints it (audit P2-6).
const SEVERITY_WORD: Record<string, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
const severityWord = (s: string) => SEVERITY_WORD[s] ?? s.charAt(0).toUpperCase() + s.slice(1);

function humanizeCategory(category: string): string {
  return category.replace(/_/g, " ");
}

function StatChip({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "11px 16px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", minWidth: 92 }}>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, lineHeight: 1, color: color ?? "var(--fg-1)" }}>{value}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-4)" }}>{label}</span>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15.5, letterSpacing: "-0.005em", color: "var(--fg-1)", margin: "0 0 10px" }}>{children}</h2>
  );
}

// One open issue. The severity pill carries the severity as text; the row has no coloured edge, because a
// stack of coloured edges read as warning stripes rather than as a list. firstSeenRun / lastSeenRun are run ids (no per-run timestamp is exposed here), so the
// only honest time we can show is when the issue row was created: one "opened X ago".
function OpenIssueRow({ issue, showCategory }: { issue: IssueRow; showCategory: boolean }) {
  const tone = severityTone(issue.severity);
  const opened = timeAgo(issue.createdAt);
  return (
    <Link
      href={`/systems/${issue.applicationId}`}
      className="card card--hover"
      style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 16px", textDecoration: "none", color: "inherit" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="pill" style={{ color: tone.color, background: tone.bg, borderColor: tone.border }}>{severityWord(issue.severity)}</span>
        {showCategory && issue.category ? <span className="pill" style={{ fontSize: 10 }}>{humanizeCategory(issue.category)}</span> : null}
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)", lineHeight: 1.35 }}>{issue.title}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, color: "var(--fg-4)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{issue.applicationName || "Unknown system"}</span>
        {opened ? <span style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-4)", flex: "none" }}>opened {opened}</span> : null}
      </div>
    </Link>
  );
}

// Resolved history stays visible but muted. When the resolving run is known the row links straight to
// that run's report; otherwise it falls back to the application page.
function ResolvedIssueRow({ issue, showCategory }: { issue: IssueRow; showCategory: boolean }) {
  const href = issue.resolvedRun
    ? `/systems/${issue.applicationId}/passes/${issue.resolvedRun}`
    : `/systems/${issue.applicationId}`;
  const opened = timeAgo(issue.createdAt);
  return (
    <Link
      href={href}
      className="card card--hover"
      style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 16px", textDecoration: "none", color: "inherit", background: "var(--bg-2)" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="pill" style={{ color: "var(--acc-deep)", background: "var(--acc-soft)", borderColor: "var(--acc-line)" }}><DecisionMark decision="resolved" />Resolved</span>
        <span className="pill" style={{ fontSize: 10 }}>{severityWord(issue.severity)}</span>
        {showCategory && issue.category ? <span className="pill" style={{ fontSize: 10 }}>{humanizeCategory(issue.category)}</span> : null}
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, color: "var(--fg-3)", lineHeight: 1.35 }}>{issue.title}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, color: "var(--fg-4)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{issue.applicationName || "Unknown system"}</span>
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
      <p>Run a verification and any failure it finds appears here with evidence and reproduction steps.</p>
      <Link href="/systems" className="btn">Go to systems</Link>
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
    <Page>
      <PageHeader
        title="Issues"
        lead="Failures found by real browser runs of your app, each with the evidence to fix it."
      />

      {/* <Page> owns the measure and the shell overrides only padding-TOP, so the tail room this page has
          always had is kept here, on the content. Every sibling page carries the same 80px; without it the
          last row sat flush against the bottom of the window on this page alone. */}
      <div style={{ paddingBottom: 80 }}>

        {open.length === 0 && resolved.length === 0 ? (
          <NoOpenIssues />
        ) : (
          <>
            {/* counts */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
              <StatChip label="Open" value={open.length} color={open.length ? "var(--fg-1)" : undefined} />
              <StatChip label="Critical" value={criticalCount} color={criticalCount ? "var(--stop-ink)" : undefined} />
              <StatChip label="High" value={highCount} color={highCount ? "var(--wait-ink)" : undefined} />
              <StatChip label="Resolved" value={resolved.length} color={resolved.length ? "var(--acc-deep)" : undefined} />
            </div>

            {/* open issues, most severe first (listAllIssues sorts by severity) */}
            <section style={{ marginBottom: 32 }}>
              <SectionHeading>Open</SectionHeading>
              {open.length === 0 ? (
                <NoOpenIssues />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* The category only when it tells rows apart: the same chip on every row said nothing (P2-6). */}
                  {open.map((issue) => <OpenIssueRow key={issue.id} issue={issue} showCategory={new Set(open.map((x) => x.category)).size > 1} />)}
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
                  {resolved.map((issue) => <ResolvedIssueRow key={issue.id} issue={issue} showCategory={new Set(resolved.map((x) => x.category)).size > 1} />)}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </Page>
  );
}
