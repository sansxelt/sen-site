import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightAppAccess } from "@/lib/v-preflight-guard";
import { capabilities } from "@/lib/preflight/role-capabilities";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { SetupRequired } from "../setup-required";
import {
  getApplication, getContract, listRequirements, listFlows,
  type ContractRequirement, type TestFlow, type RunSummary,
} from "@/lib/v-applications";
import { listRunsForApp, issuesResolvedByRun } from "@/lib/preflight/runs-db";
import { toPublicDecision } from "@/lib/preflight/public-decision";
import { unverifiedNewerDeployment } from "@/lib/preflight/deployments-db";
import { pickHealthRun, isLaunchHealthCandidate } from "@/lib/preflight/target-url";
import { listAllIssues, listRepairs } from "@/lib/preflight/overview-db";
import { apiBetaVisible } from "@/lib/preflight/api-beta-gate";
import { getApiStatus } from "@/lib/preflight/runtime/platform-status";
import { AppTabs } from "./app-tabs";
import { LaunchPassButton } from "./launch-button";
import { CancelRunControl } from "./cancel-run-control";
import { PassPreview } from "./contract/pass-preview";
import { CommandCenter } from "./command-center";
import { GuaranteesSection } from "./guarantees-section";
import { nextAction, stateRibbon, type CommandState } from "@/lib/preflight/command-center";
import { Ic, I, EmptyIcon, DecisionMark } from "@/app/rank/_components/icons";

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
const TONE_REVIEW: Tone = { fg: "var(--wait-ink)", bg: "var(--wait-wash)", line: "var(--wait-line)" };
const TONE_BLOCKED: Tone = { fg: "var(--stop-ink)", bg: "var(--stop-wash)", line: "var(--stop-line)" };
const TONE_MUTED: Tone = { fg: "var(--fg-4)", bg: "var(--bg-2)", line: "var(--line-2)" };

const SEV_COLOR: Record<string, string> = { critical: "var(--stop-ink)", high: "var(--wait-ink)", medium: "var(--fg-3)", low: "var(--fg-4)" };
const SEV_LABEL: Record<string, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };

const ACTIVE_RUN_STATES = new Set(["queued", "discovering", "running", "analyzing"]);
const isActiveRun = (r: RunSummary | null): boolean => !!r && !r.decision && ACTIVE_RUN_STATES.has(r.state);

// Run decision -> pill, delegated to the ONE canonical public-decision translator so a run reads the SAME
// verdict here as on Home, the result page, the API, and the webhook. repair_verified is public Blocked.
function runPill(decision: string | null, state: string): Tone & { label: string } {
  const pub = toPublicDecision(state, decision);
  if (pub === "verified") return { label: "Verified", ...TONE_READY };
  if (pub === "failed") return { label: "Failed", ...TONE_BLOCKED };
  if (pub === "blocked") return { label: "Blocked", ...TONE_REVIEW };
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
    <Link href={`/applications/${appId}/passes/${r.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", background: "var(--bg-1)", textDecoration: "none" }}>
      <span aria-hidden style={{ width: 9, height: 9, borderRadius: "50%", background: p.fg, flex: "none" }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, color: "var(--fg-2)", fontWeight: 600 }} title={when(r.created_at)}>{timeAgo(r.created_at) || "Verification"}</div>
        {r.deployment_url ? (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
            {r.deployment_url}
          </div>
        ) : null}
      </div>
      <span className="pill" style={{ fontSize: 10.5, color: p.fg, background: p.bg, borderColor: p.line, flex: "none" }}><DecisionMark decision={r.decision} />{p.label}</span>
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
  // Team-aware: resolves the caller to the app OWNER (data-plane key) + role — the owner or an active
  // workspace member. `owner` flows into every owner-scoped read below unchanged.
  const access = await requirePreflightAppAccess(id, "/applications/" + id);
  if (!(await preflightDbReady())) return <SetupRequired />;

  // Affordance capabilities for this member (UX only; the server routes independently enforce the same
  // policy). Read-only members (viewer + client_viewer) see the READ content but no launch/author controls.
  const caps = capabilities(access?.role);
  const owner = access?.owner ?? "";
  const app = access ? await getApplication(owner, id) : null;
  if (!access || !app) {
    return (
      <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
        <div className="empty">
          <EmptyIcon d={I.slash} />
          <h3>Application not found</h3>
          <p>This application doesn&apos;t exist, or you don&apos;t have access to it.</p>
          <Link href="/applications" className="btn">Back to applications</Link>
        </div>
      </div>
    );
  }

  // API beta: show the tab + an INDEPENDENT API status only for an enabled account. webOnly scopes the web
  // blocker list so an API-runtime issue never appears as a web launch blocker.
  const apiVisible = await apiBetaVisible(owner);
  const [contract, runs, openIssues, repairs, apiStatus] = await Promise.all([
    getContract(owner, id),
    listRunsForApp(owner, id),
    listAllIssues(owner, { status: "open", applicationId: id, webOnly: true }),
    listRepairs(owner),
    apiVisible ? getApiStatus(owner, id) : Promise.resolve(null),
  ]);
  let reqs: ContractRequirement[] = [];
  let flows: TestFlow[] = [];
  if (contract) [reqs, flows] = await Promise.all([listRequirements(owner, contract.id), listFlows(owner, contract.id)]);

  const builderLabel = app.builder ? (BUILDER_LABELS[app.builder] ?? app.builder) : null;
  const reqCount = reqs.length, flowCount = flows.length;

  // ── Production status: the newest valid FULL-COVERAGE pass drives the verdict (pickHealthRun). A
  // targeted rerun may verify a repair, but it never replaces the launch-health decision — it surfaces
  // separately as "Latest repair" below while the previous launch health stands until full verification.
  const latest: RunSummary | null = pickHealthRun(runs) ?? null;
  const latestActive = isActiveRun(latest);
  const decision = latest?.decision ?? null;

  // ── New deployment unverified (S4): when a deployment NEWER than (and different from) the one the
  // health run tested has been recorded, a banner says so ABOVE the verdict; the decision below never
  // silently migrates to an untested deployment. Best-effort: pre-migration-8 this is always null and
  // the page renders exactly as before.
  const newerDeploy = latest && !latestActive && latest.decision
    ? await unverifiedNewerDeployment(owner, id, latest)
    : null;

  const latestRepair: RunSummary | null = runs.find((r) => r.state === "completed" && r.decision === "repair_verified") ?? null;
  const repairIsSeparate = !!latestRepair && !!latest && latestRepair.id !== latest.id
    && new Date(latestRepair.created_at).getTime() >= new Date(latest.created_at).getTime();
  const repairResolvedTitles = repairIsSeparate && latestRepair ? await issuesResolvedByRun(owner, latestRepair.id) : [];

  const blockers = openIssues.filter((i) => i.severity === "critical" || i.severity === "high");
  const verifiedRepairCount = repairs.filter((r) => r.applicationId === id && r.status === "verified").length;

  const contractApproved = contract?.status === "approved";
  // Run-eligible flows, exactly as the run route filters them: enabled AND review_state approved
  // (an absent review_state column reads as approved).
  const eligibleFlowIds = flows
    .filter((f) => f.enabled && (((f as { review_state?: string }).review_state ?? "approved") === "approved"))
    .map((f) => f.id);

  // The hero verdict is delegated to the ONE canonical public-decision translator (no per-decision switch), so
  // this surface reads the SAME verdict as Home, the result page, the API, and the webhook. repair_verified is
  // public BLOCKED (a targeted repair rerun did not pass the full verification scope) — the scope is explained
  // in the subline, never dressed as a Verified success.
  let hero: Tone = TONE_MUTED;
  let verdict = "NOT TESTED";
  if (latestActive) { verdict = "IN PROGRESS"; }
  else if (decision) {
    const pub = toPublicDecision(latest?.state ?? "completed", decision);
    if (pub === "verified") { hero = TONE_READY; verdict = "VERIFIED"; }
    else if (pub === "failed") { hero = TONE_BLOCKED; verdict = "FAILED"; }
    else if (pub === "blocked") { hero = TONE_REVIEW; verdict = "BLOCKED"; }
  }

  // Subline: real numbers only. Blocked leads with the open blocker count; any run with a critical-flow
  // summary states it plainly; an untested app says so.
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
  const critTotal = latest ? num(latest.summary?.critical_total) : 0;
  const critPassed = latest ? num(latest.summary?.critical_passed) : 0;
  const subParts: string[] = [];
  if (decision === "blocked" && blockers.length > 0) subParts.push(`${blockers.length} critical failure${blockers.length === 1 ? "" : "s"}`);
  if (latest && !latestActive && critTotal > 0) subParts.push(`${critPassed} of ${critTotal} critical flows passed`);
  if (decision === "repair_verified") subParts.push("Targeted repair check passed. A full critical verification is still required.");
  if (latestActive) subParts.push("A verification is running right now");
  if (!latest) subParts.push("This app hasn't been verified yet");

  // Full-verification selection for a repair-verified state: every eligible critical flow.
  const criticalEligibleIds = flows
    .filter((f) => f.enabled && (((f as { review_state?: string }).review_state ?? "approved") === "approved") && f.priority === "critical")
    .map((f) => f.id);

  // ── Command Center: one dominant next action + the true-facts ribbon, from the real state above. ──
  const deploymentLabel = (() => {
    const url = latest?.deployment_url ?? app.app_url;
    if (!url) return null;
    try { const u = new URL(url); return `${u.host}${u.pathname === "/" ? "" : u.pathname}`; } catch { return url; }
  })();
  const commandState: CommandState = {
    appId: id,
    contractExists: !!contract,
    contractApproved,
    requirementCount: reqCount,
    flowCount,
    eligibleFlowCount: eligibleFlowIds.length,
    criticalEligibleCount: criticalEligibleIds.length,
    // decision is one of the known verdicts or null; narrow the upstream string to the resolver's union.
    decision: (decision === "ready" || decision === "blocked" || decision === "needs_review" || decision === "repair_verified") ? decision : null,
    runActive: latestActive,
    latestRunId: latest?.id ?? null,
    blockerCount: blockers.length,
    repairPendingFullVerify: decision === "repair_verified" || (repairIsSeparate && decision !== "ready"),
    newerUnverifiedDeploy: !!newerDeploy,
    criticalTotal: critTotal,
    criticalPassed: critPassed,
    // The latest run counts as full coverage only when it is a real launch-health candidate (a
    // full-coverage run WITH a decision) — a targeted/partial repair run's subset must not read as coverage.
    coverageFull: !!latest && !latestActive && isLaunchHealthCandidate(latest),
    deploymentLabel,
    contractVersion: contract?.version ?? null,
  };
  const cmdAction = nextAction(commandState);
  const cmdRibbon = stateRibbon(commandState);
  // The flow ids a LAUNCH action queues (resolved here; the resolver only says eligible|critical).
  const cmdLaunchFlowIds = cmdAction.launch?.flowIds === "critical" ? criticalEligibleIds : cmdAction.launch?.flowIds === "eligible" ? eligibleFlowIds : [];

  return (
    <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, marginBottom: 14 }}>
        <Link href="/applications" style={{ color: "var(--fg-4)", textDecoration: "none" }}>Applications</Link>
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

      <AppTabs appId={id} active="overview" showApiTab={apiVisible} />

      {/* ── COMMAND CENTER: the primary operating strip — verdict + the ONE dominant next action + the
          true-facts ribbon. The detailed sections below support it; they never repeat the verdict. ── */}
      <div style={{ marginTop: 8, marginBottom: 22 }}>
        <CommandCenter appId={id} verdict={verdict} subline={subParts.length > 0 ? `${subParts.join(". ")}.` : null} tone={hero} action={cmdAction} ribbon={cmdRibbon} launchFlowIds={cmdLaunchFlowIds} canLaunch={caps.canLaunch} canEditContract={caps.canEditContract} />
      </div>

      {/* ── INDEPENDENT PLATFORM STATUS (API beta): web and API are shown as SEPARATE truths, never one
          scalar. The web verdict above is unchanged; this adds an API line only for an enabled account. ── */}
      {apiStatus && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", border: "1px solid var(--line-2)", borderRadius: 10, background: "var(--bg-1)" }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: "var(--fg-4)" }}>WEB</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--fg-2)" }}>{verdict}</span>
          </div>
          <Link href={`/applications/${id}/api-runtime`} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", border: "1px solid var(--line-2)", borderRadius: 10, background: "var(--bg-1)" }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: "var(--fg-4)" }}>API</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: apiStatus.verdict === "VERIFIED" ? "var(--ok)" : apiStatus.verdict === "FAILED" ? "var(--err)" : apiStatus.verdict === "BLOCKED" ? "var(--warn)" : "var(--fg-3)" }}>{apiStatus.hasTarget ? apiStatus.verdict : "NOT SET UP"}</span>
          </Link>
        </div>
      )}

      {/* ── NEW DEPLOYMENT UNVERIFIED (S4): above the verdict, never replacing it. The health decision
          below stays pinned to the deployment that was actually tested; this banner only says a newer,
          different deployment exists and offers the one honest way forward: run a pass against it. ── */}
      {newerDeploy ? (
        <section aria-label="New deployment unverified"
          style={{ border: "1px solid var(--wait-line)", borderLeft: "4px solid var(--wait-ink)", borderRadius: "var(--r-md)", background: "var(--wait-wash)", padding: "16px 18px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span aria-hidden style={{ display: "inline-flex", color: "var(--wait-ink)" }}><Ic d={I.deploy} size={15} sw={2} /></span>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 650, fontSize: 15, color: "var(--wait-ink)" }}>New deployment unverified</span>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 600, color: "var(--fg-1)", margin: "8px 0 0", wordBreak: "break-all" }}>
            {newerDeploy.deployment.url}
          </div>
          <p style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55, margin: "6px 0 0" }}>
            <span title={when(newerDeploy.deployment.detected_at)}>Recorded {timeAgo(newerDeploy.deployment.detected_at)}</span>, after the
            last verification. The status below still describes the deployment that was tested;
            a Verified decision is never carried forward to an untested deployment.
          </p>
          {newerDeploy.changes.length ? (
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, display: "grid", gap: 4 }}>
              {newerDeploy.changes.map((c) => (
                <li key={c} style={{ fontSize: 12.5, color: "var(--fg-2)", lineHeight: 1.5, wordBreak: "break-word" }}>{c}</li>
              ))}
            </ul>
          ) : null}
          {/* Action is EDITOR+ (launch, or an author/review CTA into the contract editor). A read-only
              member keeps the informational banner above but sees no action here. */}
          {caps.canLaunch ? (
            <div style={{ marginTop: 12 }}>
              {eligibleFlowIds.length > 0
                ? <LaunchPassButton appId={id} flowIds={eligibleFlowIds} label="Run a verification" />
                : <Link href={`/applications/${id}/contract`} className="btn">
                    {reqCount === 0 ? "Author your Production Contract" : contractApproved ? "Add flows to your contract" : "Review Production Contract"}
                  </Link>}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ── TESTED DEPLOYMENT + repair detail: supporting the Command Center verdict, never repeating it.
          The deployment this decision applies to, when it ran, the run behind it, and the latest repair. ── */}
      {latest ? (
        <section aria-label="Tested deployment" style={sectionStyle}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <p style={{ fontSize: 13, color: "var(--fg-3)", margin: 0, lineHeight: 1.55, wordBreak: "break-all" }}>
              {latest.deployment_url ? <>{latestActive ? "Testing deployment" : "Last tested deployment"}: {latest.deployment_url}, </> : null}
              <span title={when(latest.completed_at ?? latest.created_at)} style={{ whiteSpace: "nowrap" }}>
                {latest.deployment_url
                  ? (latestActive ? `started ${timeAgo(latest.created_at)}` : `completed ${timeAgo(latest.completed_at ?? latest.created_at)}`)
                  : (latestActive ? `Started ${timeAgo(latest.created_at)}` : `Completed ${timeAgo(latest.completed_at ?? latest.created_at)}`)}
              </span>
            </p>
            <Link href={`/applications/${id}/passes/${latest.id}`} style={{ fontSize: 13, fontWeight: 600, color: "var(--acc-deep)", textDecoration: "none", flex: "none" }}>
              {latestActive ? "View running verification" : decision === "blocked" ? "View failures" : decision === "needs_review" ? "View report" : "View verification report"} <span aria-hidden>→</span>
            </Link>
          </div>
          {/* Run controls for a LIVE run — the cancellation surface. The read-only result page links here; the
              mutation only ever happens on this application-detail run-control surface, EDITOR+ only, behind a
              two-step confirm. Hidden entirely once the run reaches a terminal state (latestActive is false). */}
          {latestActive && caps.canLaunch ? (
            <div style={{ marginTop: 12 }}>
              <CancelRunControl appId={id} runId={latest.id} />
            </div>
          ) : null}
          {/* A verified targeted repair NEWER than the launch health: shown separately, never as the verdict.
              The previous launch health stands until full verification completes. */}
          {repairIsSeparate && latestRepair ? (
            <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--acc-deep)", margin: "12px 0 0", lineHeight: 1.55 }}>
              Latest repair: {repairResolvedTitles.length ? `${repairResolvedTitles.join(", ")} not reproduced on rerun` : "the selected flows passed and their failures were not reproduced"}.{" "}
              <Link href={`/applications/${id}/passes/${latestRepair.id}`} style={{ color: "var(--acc-deep)" }}>View repair report</Link>
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Launch a fresh full pass — ALWAYS reachable here whenever the app is launchable (approved contract,
          eligible flows, no active run, editor+), independent of the verdict or whether a newer deployment
          exists. The Command Center's ONE dominant action can be "Inspect blocker" when BLOCKED, so a
          free-pass-eligible owner must still have a real launch control on the Overview — this is it. The
          PassPreview beside it shows the gate-parity price (e.g. "Included" for the lifetime free pass, or the
          PAYG dollars), so the button and its true cost always appear together. Reruns are NOT launched here —
          those stay PAYG on the pass report; a fresh full pass is what the free pass covers.
          Hidden only when a newer-deployment banner already renders its own launch control (no double button);
          in every other state — including BLOCKED with no newer deployment — this is the launch affordance. */}
      {caps.canLaunch && contractApproved && !latestActive && !newerDeploy && (decision === "repair_verified" ? criticalEligibleIds.length > 0 : eligibleFlowIds.length > 0) ? (
        <section aria-label="Verify this deployment" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "clamp(12px, 2vw, 20px)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
            <LaunchPassButton
              appId={id}
              flowIds={decision === "repair_verified" ? criticalEligibleIds : eligibleFlowIds}
              label={decision === "repair_verified" ? "Run full critical verification" : "Verify this deployment"}
            />
            <p style={{ fontSize: 12.5, color: "var(--fg-2)", lineHeight: 1.45, margin: 0, maxWidth: 320 }}>
              {decision === "repair_verified"
                ? "Run every critical flow to earn a full launch decision."
                : "Runs a full verification against the current deployment and returns a launch decision with evidence."}
            </p>
          </div>
          <div style={{ maxWidth: 420, flex: "1 1 300px" }}>
            <PassPreview appId={id} flowIds={decision === "repair_verified" ? criticalEligibleIds : eligibleFlowIds} />
          </div>
        </section>
      ) : null}

      {/* ── Open blockers: what stands between this app and READY ────────────────────────────────────── */}
      {blockers.length > 0 && latest ? (
        <section style={sectionStyle} aria-label="Open failures">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <div style={{ ...headLbl, display: "flex", alignItems: "center", gap: 7 }}><Ic d={I.alert} size={13} sw={2} />Open failures ({blockers.length})</div>
            <Link href={`/applications/${id}/issues`} style={{ fontSize: 13, color: "var(--acc-deep)", textDecoration: "none" }}>All issues →</Link>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {blockers.map((iss) => (
              <Link key={iss.id} href={`/applications/${id}/passes/${latest.id}`}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", border: "1px solid var(--line-2)", borderLeft: `3px solid ${SEV_COLOR[iss.severity] ?? "var(--fg-4)"}`, borderRadius: "var(--r-sm)", background: "var(--bg-1)", textDecoration: "none", color: "inherit" }}>
                <span className="pill" style={{ fontSize: 10, color: SEV_COLOR[iss.severity] ?? "var(--fg-4)", borderColor: "var(--line-2)", background: "var(--bg-2)", flex: "none" }}>{SEV_LABEL[iss.severity] ?? iss.severity}</span>
                <span style={{ fontSize: 13.5, color: "var(--fg-1)", fontWeight: 500, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{iss.title}</span>
                <span aria-hidden style={{ color: "var(--fg-5)", flex: "none", fontSize: 13 }}>→</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── Verification history ──────────────────────────────────────────────────────────────────── */}
      <section style={sectionStyle} aria-label="Verification history">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <div style={{ ...headLbl, display: "flex", alignItems: "center", gap: 7 }}><Ic d={I.shield} size={13} sw={2} />Verification history</div>
          {runs.length > 0 ? <Link href={`/applications/${id}/passes`} style={{ fontSize: 13, color: "var(--acc-deep)", textDecoration: "none" }}>Full history →</Link> : null}
        </div>
        {runs.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {runs.slice(0, 5).map((r) => <RunRow key={r.id} appId={app.id} r={r} />)}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "var(--fg-4)", margin: 0 }}>Not verified yet. Once a run finishes, its launch decision and the evidence behind it show here.</p>
        )}
      </section>

      {/* ── Guarantees: the live map of what this system depends on and whether each is currently proven.
          The durable product object; the Production Contract below is now internal synthesis substrate. ── */}
      <GuaranteesSection owner={owner} appId={id} canEdit={caps.canEditContract} />

      {/* ── Production Contract coverage ──────────────────────────────────────────────────────────────── */}
      <section style={sectionStyle} aria-label="Production Contract coverage">
        <div className="card" style={{ padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span aria-hidden style={{ display: "inline-flex", color: "var(--fg-4)" }}><Ic d={I.fileText} size={15} sw={1.8} /></span>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14.5, color: "var(--fg-1)" }}>Production Contract</span>
              {contract ? (
                contractApproved
                  ? <span className="pill" style={{ fontSize: 10.5, color: TONE_READY.fg, background: TONE_READY.bg, borderColor: TONE_READY.line }}><DecisionMark decision="approved" />Approved</span>
                  : <span className="pill" style={{ fontSize: 10.5, color: TONE_REVIEW.fg, background: TONE_REVIEW.bg, borderColor: TONE_REVIEW.line }}>Draft</span>
              ) : null}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--fg-3)", marginTop: 4 }}>
              {contract
                ? (reqCount === 0
                    ? "No requirements yet. Open the contract to define what Vraelis should verify."
                    : `${reqCount} requirement${reqCount === 1 ? "" : "s"}, ${flowCount} flow${flowCount === 1 ? "" : "s"}`)
                : "Open the contract to define what Vraelis should verify."}
            </div>
          </div>
          {contract ? (
            <Link href={`/applications/${id}/contract`} style={{ fontSize: 13, fontWeight: 600, color: "var(--acc-deep)", textDecoration: "none", flex: "none" }}>Open contract →</Link>
          ) : null}
        </div>
      </section>

      {/* ── Verified repairs (only when at least one exists) ─────────────────────────────────────────── */}
      {verifiedRepairCount > 0 ? (
        <Link href={`/applications/${id}/repairs`}
          style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, padding: "12px 18px", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", background: "var(--bg-1)", textDecoration: "none" }}>
          <span className="pill" style={{ fontSize: 10.5, color: TONE_READY.fg, background: TONE_READY.bg, borderColor: TONE_READY.line, flex: "none" }}><DecisionMark decision="verified" />Verified</span>
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
