import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightOwner } from "@/lib/v-preflight-guard";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { SetupRequired } from "../setup-required";
import {
  getApplication, getContract, listRequirements, listFlows,
  type ContractRequirement, type TestFlow, type RunSummary,
} from "@/lib/v-applications";
import { listRunsForApp } from "@/lib/preflight/runs-db";
import { listAllIssues, listRepairs } from "@/lib/preflight/overview-db";
import { AppTabs } from "./app-tabs";
import { LaunchPassButton } from "./launch-button";

export const metadata: Metadata = { title: "Application" };

// Friendly labels for the builder the app was created with (raw key falls through).
const BUILDER_LABELS: Record<string, string> = {
  claude_code: "Claude Code", cursor: "Cursor", lovable: "Lovable",
  bolt: "Bolt", replit: "Replit", v0: "v0", other: "Other",
};

// Stable UTC render (used as a hover title): "2026-07-02 14:31 UTC".
function when(iso: string): string {
  try { return new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC"; } catch { return ""; }
}

// "3m ago / 4h ago / Jul 12" (server component; rendered once per request).
function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// The launch-decision tones. Every status carries its label in text; color never stands alone.
type Tone = { fg: string; bg: string; line: string };
const TONE_READY: Tone = { fg: "var(--acc-deep)", bg: "var(--acc-soft)", line: "var(--acc-line)" };
const TONE_REVIEW: Tone = { fg: "#B45309", bg: "#FEF6E7", line: "#F3DFB0" };
const TONE_BLOCKED: Tone = { fg: "#C0392B", bg: "#FBEBEA", line: "#F0C7C2" };
const TONE_MUTED: Tone = { fg: "var(--fg-4)", bg: "var(--bg-2)", line: "var(--line-2)" };

const SEV_COLOR: Record<string, string> = { critical: "#C0392B", high: "#B45309", medium: "var(--fg-3)", low: "var(--fg-4)" };
const SEV_LABEL: Record<string, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };

const ACTIVE_RUN_STATES = new Set(["queued", "discovering", "running", "analyzing"]);
const isActiveRun = (r: RunSummary | null): boolean => !!r && !r.decision && ACTIVE_RUN_STATES.has(r.state);

// Run decision -> pill for the pass list.
function runPill(decision: string | null, state: string): Tone & { label: string } {
  if (decision === "ready") return { label: "Ready", ...TONE_READY };
  if (decision === "needs_review") return { label: "Needs review", ...TONE_REVIEW };
  if (decision === "blocked") return { label: "Blocked", ...TONE_BLOCKED };
  return { label: ACTIVE_RUN_STATES.has(state) ? "In progress" : "No decision", ...TONE_MUTED };
}

// Uppercase section label, matching the dashboard's section headers.
const headLbl = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--fg-4)" };
// Every section after the hero: whitespace plus a single hairline, no wrapper card.
const sectionStyle = { borderTop: "1px solid var(--line-1)", paddingTop: 22, marginTop: 26 } as const;

// One key/value row in the compact Details card. Missing values read "Not set" (muted), never a blank.
function KV({ k, v }: { k: string; v: string | null }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, fontSize: 12.5 }}>
      <span style={{ color: "var(--fg-4)", flex: "none" }}>{k}</span>
      <span style={{ color: v ? "var(--fg-2)" : "var(--fg-4)", fontWeight: v ? 600 : 400, textAlign: "right", wordBreak: "break-all", minWidth: 0 }}>
        {v || "Not set"}
      </span>
    </div>
  );
}

function RunRow({ appId, r }: { appId: string; r: RunSummary }) {
  const p = runPill(r.decision, r.state);
  return (
    <Link href={`/app/apps/${appId}/runs/${r.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", background: "var(--bg-1)", textDecoration: "none" }}>
      <span aria-hidden style={{ width: 9, height: 9, borderRadius: "50%", background: p.fg, flex: "none" }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, color: "var(--fg-2)", fontWeight: 600 }} title={when(r.created_at)}>{timeAgo(r.created_at) || "Pass"}</div>
        {r.deployment_url ? (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
            {r.deployment_url}
          </div>
        ) : null}
      </div>
      <span className="pill" style={{ fontSize: 10.5, color: p.fg, background: p.bg, borderColor: p.line, flex: "none" }}>{p.label}</span>
      <span aria-hidden style={{ color: "var(--fg-5)", flex: "none", fontSize: 13 }}>→</span>
    </Link>
  );
}

// Application overview (server component), health-first: the latest launch decision leads the page as a
// full-width tinted verdict panel with the one state-appropriate action, then the open blockers, the pass
// history, and the supporting records. All data is owner-scoped and degrades to empty/null before the
// tables exist, so this renders honest empty states with no fake runs, scores, or blockers.
export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requirePreflightOwner("/app/apps/" + id);
  if (!(await preflightDbReady())) return <SetupRequired />;

  const app = await getApplication(owner, id);
  if (!app) {
    return (
      <div className="wrap" style={{ maxWidth: 960, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
        <div className="empty">
          <div className="empty__icon">∅</div>
          <h3>Application not found</h3>
          <p>This application doesn&apos;t exist, or it belongs to another account.</p>
          <Link href="/app/apps" className="btn">Back to applications</Link>
        </div>
      </div>
    );
  }

  const [contract, runs, openIssues, repairs] = await Promise.all([
    getContract(owner, id),
    listRunsForApp(owner, id),
    listAllIssues(owner, { status: "open", applicationId: id }),
    listRepairs(owner),
  ]);
  let reqs: ContractRequirement[] = [];
  let flows: TestFlow[] = [];
  if (contract) [reqs, flows] = await Promise.all([listRequirements(owner, contract.id), listFlows(owner, contract.id)]);

  const builderLabel = app.builder ? (BUILDER_LABELS[app.builder] ?? app.builder) : null;
  const reqCount = reqs.length, flowCount = flows.length;

  // ── Production status: the latest run drives the verdict ──────────────────────────────────────────────
  const latest: RunSummary | null = runs[0] ?? null;
  const latestActive = isActiveRun(latest);
  const decision = latest?.decision ?? null;

  const blockers = openIssues.filter((i) => i.severity === "critical" || i.severity === "high");
  const verifiedRepairCount = repairs.filter((r) => r.applicationId === id && r.status === "verified").length;

  const contractApproved = contract?.status === "approved";
  // Run-eligible flows, exactly as the run route filters them: enabled AND review_state approved
  // (an absent review_state column reads as approved).
  const eligibleFlowIds = flows
    .filter((f) => f.enabled && (((f as { review_state?: string }).review_state ?? "approved") === "approved"))
    .map((f) => f.id);

  let hero: Tone = TONE_MUTED;
  let verdict = "NOT TESTED";
  if (latestActive) { verdict = "IN PROGRESS"; }
  else if (decision === "ready") { hero = TONE_READY; verdict = "READY"; }
  else if (decision === "needs_review") { hero = TONE_REVIEW; verdict = "NEEDS REVIEW"; }
  else if (decision === "blocked") { hero = TONE_BLOCKED; verdict = "BLOCKED"; }

  // Subline: real numbers only. Blocked leads with the open blocker count; any run with a critical-flow
  // summary states it plainly; an untested app says so.
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
  const critTotal = latest ? num(latest.summary?.critical_total) : 0;
  const critPassed = latest ? num(latest.summary?.critical_passed) : 0;
  const subParts: string[] = [];
  if (decision === "blocked" && blockers.length > 0) subParts.push(`${blockers.length} critical launch blocker${blockers.length === 1 ? "" : "s"}`);
  if (latest && !latestActive && critTotal > 0) subParts.push(`${critPassed} of ${critTotal} critical flows passed`);
  if (latestActive) subParts.push("A Production Pass is running right now");
  if (!latest) subParts.push("No Production Pass has run against this application yet");

  return (
    <div className="wrap" style={{ maxWidth: 960, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, marginBottom: 14 }}>
        <Link href="/app/apps" style={{ color: "var(--fg-4)", textDecoration: "none" }}>Applications</Link>
        <span aria-hidden style={{ color: "var(--fg-5)" }}>/</span>
        <span style={{ color: "var(--fg-2)", fontWeight: 600, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.name}</span>
      </nav>

      {/* header */}
      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", margin: "6px 0 10px" }}>{app.name}</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <a href={app.app_url} target="_blank" rel="noopener noreferrer"
          style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-4)", textDecoration: "none", wordBreak: "break-all" }}>
          {app.app_url}
        </a>
        {builderLabel ? <span className="pill" style={{ fontSize: 10.5 }}>{builderLabel}</span> : null}
      </div>

      <AppTabs appId={id} active="overview" />

      {/* ── PRODUCTION STATUS: the verdict panel ─────────────────────────────────────────────────────── */}
      <section aria-label="Production status"
        style={{ borderRadius: "var(--r-xl)", border: `1px solid ${hero.line}`, background: hero.bg, padding: "clamp(22px, 3.2vw, 34px)" }}>
        <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: hero.fg, marginBottom: 10 }}>
          Production status
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(1.9rem, 3.5vw, 2.6rem)", lineHeight: 1.05, letterSpacing: "-0.02em", color: hero.fg }}>
          {verdict}
        </div>
        {subParts.length > 0 ? (
          <p style={{ fontSize: 14.5, fontWeight: 500, color: "var(--fg-2)", margin: "12px 0 0", lineHeight: 1.5 }}>{subParts.join(". ")}.</p>
        ) : null}
        {latest ? (
          <p style={{ fontSize: 13, color: "var(--fg-3)", margin: "6px 0 0", lineHeight: 1.55, wordBreak: "break-all" }}>
            {latest.deployment_url ? <>{latestActive ? "Testing deployment" : "Last tested deployment"}: {latest.deployment_url}, </> : null}
            <span title={when(latest.completed_at ?? latest.created_at)} style={{ whiteSpace: "nowrap" }}>
              {latest.deployment_url
                ? (latestActive ? `started ${timeAgo(latest.created_at)}` : `completed ${timeAgo(latest.completed_at ?? latest.created_at)}`)
                : (latestActive ? `Started ${timeAgo(latest.created_at)}` : `Completed ${timeAgo(latest.completed_at ?? latest.created_at)}`)}
            </span>
          </p>
        ) : null}

        {/* State-aware action row: one primary path per state. */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start", marginTop: 20 }}>
          {!contractApproved ? (
            <Link href={`/app/apps/${id}/contract`} className="btn">Review Production Contract</Link>
          ) : latestActive && latest ? (
            <Link href={`/app/apps/${id}/runs/${latest.id}`} className="btn">View running pass</Link>
          ) : decision === "blocked" && latest ? (
            <>
              <Link href={`/app/apps/${id}/runs/${latest.id}`} className="btn">View blockers</Link>
              {eligibleFlowIds.length > 0 ? <LaunchPassButton appId={id} flowIds={eligibleFlowIds} label="Run new pass" ghost /> : null}
            </>
          ) : decision === "ready" && latest ? (
            <>
              <Link href={`/app/apps/${id}/runs/${latest.id}`} className="btn btn--ghost">View verified pass</Link>
              {eligibleFlowIds.length > 0 ? <LaunchPassButton appId={id} flowIds={eligibleFlowIds} label="Run new pass" /> : null}
            </>
          ) : decision === "needs_review" && latest ? (
            <>
              <Link href={`/app/apps/${id}/runs/${latest.id}`} className="btn">View report</Link>
              {eligibleFlowIds.length > 0 ? <LaunchPassButton appId={id} flowIds={eligibleFlowIds} label="Run new pass" ghost /> : null}
            </>
          ) : eligibleFlowIds.length > 0 ? (
            <LaunchPassButton appId={id} flowIds={eligibleFlowIds} label="Run Production Pass" />
          ) : (
            <Link href={`/app/apps/${id}/contract`} className="btn">Review Production Contract</Link>
          )}
        </div>
      </section>

      {/* ── Open blockers: what stands between this app and READY ────────────────────────────────────── */}
      {blockers.length > 0 && latest ? (
        <section style={sectionStyle} aria-label="Open blockers">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <div style={headLbl}>Open blockers ({blockers.length})</div>
            <Link href={`/app/apps/${id}/issues`} style={{ fontSize: 13, color: "var(--acc-deep)", textDecoration: "none" }}>All issues →</Link>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {blockers.map((iss) => (
              <Link key={iss.id} href={`/app/apps/${id}/runs/${latest.id}`}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", border: "1px solid var(--line-2)", borderLeft: `3px solid ${SEV_COLOR[iss.severity] ?? "var(--fg-4)"}`, borderRadius: "var(--r-sm)", background: "var(--bg-1)", textDecoration: "none", color: "inherit" }}>
                <span className="pill" style={{ fontSize: 10, color: SEV_COLOR[iss.severity] ?? "var(--fg-4)", borderColor: "var(--line-2)", background: "var(--bg-2)", flex: "none" }}>{SEV_LABEL[iss.severity] ?? iss.severity}</span>
                <span style={{ fontSize: 13.5, color: "var(--fg-1)", fontWeight: 500, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{iss.title}</span>
                <span aria-hidden style={{ color: "var(--fg-5)", flex: "none", fontSize: 13 }}>→</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── Latest Production Passes ──────────────────────────────────────────────────────────────────── */}
      <section style={sectionStyle} aria-label="Latest Production Passes">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <div style={headLbl}>Latest Production Passes</div>
          {runs.length > 0 ? <Link href={`/app/apps/${id}/runs`} style={{ fontSize: 13, color: "var(--acc-deep)", textDecoration: "none" }}>All passes →</Link> : null}
        </div>
        {runs.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {runs.slice(0, 5).map((r) => <RunRow key={r.id} appId={app.id} r={r} />)}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "var(--fg-4)", margin: 0 }}>No Production Passes yet. Once one finishes, its launch decision and evidence show here.</p>
        )}
      </section>

      {/* ── Production Contract coverage ──────────────────────────────────────────────────────────────── */}
      <section style={sectionStyle} aria-label="Production Contract coverage">
        <div className="card" style={{ padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14.5, color: "var(--fg-1)" }}>Production Contract</span>
              {contract ? (
                contractApproved
                  ? <span className="pill" style={{ fontSize: 10.5, color: TONE_READY.fg, background: TONE_READY.bg, borderColor: TONE_READY.line }}>Approved</span>
                  : <span className="pill" style={{ fontSize: 10.5, color: TONE_REVIEW.fg, background: TONE_REVIEW.bg, borderColor: TONE_REVIEW.line }}>Draft</span>
              ) : null}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--fg-3)", marginTop: 4 }}>
              {contract
                ? `${reqCount} requirement${reqCount === 1 ? "" : "s"}, ${flowCount} flow${flowCount === 1 ? "" : "s"}`
                : "Contract is being prepared. It will be ready to review shortly."}
            </div>
          </div>
          {contract ? (
            <Link href={`/app/apps/${id}/contract`} style={{ fontSize: 13, fontWeight: 600, color: "var(--acc-deep)", textDecoration: "none", flex: "none" }}>Open contract →</Link>
          ) : null}
        </div>
      </section>

      {/* ── Verified repairs (only when at least one exists) ─────────────────────────────────────────── */}
      {verifiedRepairCount > 0 ? (
        <Link href={`/app/apps/${id}/repairs`}
          style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, padding: "12px 18px", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", background: "var(--bg-1)", textDecoration: "none" }}>
          <span className="pill" style={{ fontSize: 10.5, color: TONE_READY.fg, background: TONE_READY.bg, borderColor: TONE_READY.line, flex: "none" }}>Verified</span>
          <span style={{ fontSize: 13, color: "var(--fg-2)", fontWeight: 500, flex: 1 }}>
            {verifiedRepairCount} verified repair{verifiedRepairCount === 1 ? "" : "s"} on this application
          </span>
          <span aria-hidden style={{ color: "var(--fg-5)", flex: "none", fontSize: 13 }}>→</span>
        </Link>
      ) : null}

      {/* ── Application details: last, compact ───────────────────────────────────────────────────────── */}
      <section style={sectionStyle} aria-label="Application details">
        <div className="card" style={{ padding: "14px 18px 16px" }}>
          <div style={{ ...headLbl, marginBottom: 10 }}>Details</div>
          <div style={{ display: "grid", gap: 8 }}>
            <KV k="Framework" v={app.framework} />
            <KV k="Repository" v={app.repo} />
            <KV k="Deployment" v={app.deployment_provider} />
            <KV k="Ownership confirmed" v={app.ownership_confirmed ? "Yes" : "No"} />
            <KV k="Connected" v={when(app.created_at)} />
          </div>
        </div>
      </section>
    </div>
  );
}
