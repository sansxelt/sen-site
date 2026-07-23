import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { requirePreflightAppAccess } from "@/lib/v-preflight-guard";
import { capabilities } from "@/lib/preflight/role-capabilities";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { getApplication, getContractById, listRequirements, type ContractRequirement } from "@/lib/v-applications";
import { getRun, runContractId, listChildRuns, type RunFlow, type RunIssue, type ChildRun } from "@/lib/preflight/runs-db";
import { getRunInternal, listFlowRunMeta, type FlowRunMeta } from "@/lib/preflight/run-report-db";
import { runVersionPins, getDeployment, deploymentStoreReady } from "@/lib/preflight/deployments-db";
import { getSnapshot } from "@/lib/preflight/context-snapshots";
import { runVerdict, isActiveRun, runningStage, type Tone as ToneKey } from "@/lib/preflight/home-verdict";
import { SetupRequired } from "../../../setup-required";
import { RerunButton } from "./rerun-button";
import { CancelRunButton } from "./cancel-run-button";
import { CopyButton } from "./copy-button";
import { AutoRefresh } from "./auto-refresh";
import { Ic, I, EmptyIcon } from "@/app/rank/_components/icons";
import { passPricingEnabled, rerunPriceCents } from "@/lib/preflight/pass-pricing";
import { usdFromCents } from "@/lib/preflight/pass-pricing-format";
import { gatePassLaunch } from "@/lib/preflight/entitlements-v1";

// Design 02 — the Verification Result page. VISIBLE product language is "Verification", never "Pass".
export const metadata: Metadata = { title: "Verification" };

// ── formatting helpers (server-rendered; stable) ──
function num(v: unknown): number { return typeof v === "number" ? v : Number(v) || 0; }
function when(iso: string): string { try { return new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC"; } catch { return ""; } }
function ago(iso: string): string {
  const t = Date.parse(iso); if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24); return `${d} day${d === 1 ? "" : "s"} ago`;
}
function shortId(v: string): string { return v.length > 12 ? `${v.slice(0, 8)}…${v.slice(-4)}` : v; }

// ── the ONE decision vocabulary, shared with Home (lib/preflight/home-verdict). It renders only the public
// Verified / Failed / Blocked (repair_verified -> Verified, a proven repair) plus the honest non-conclusions
// In progress / Not yet verified. It never exposes an internal decision string, and it uses the approved
// warm-neutral tokens — no retired teal. This page implements NO second decision mapping. ──
const TONE: Record<ToneKey, { color: string; bg: string; border: string }> = {
  verified: { color: "var(--acc-deep)", bg: "var(--acc-soft)", border: "var(--acc-line)" },
  failed: { color: "var(--a-failed, #A8452A)", bg: "#F6ECE7", border: "#E7CFC5" },
  blocked: { color: "var(--a-blocked, #7E6F43)", bg: "#F2ECDD", border: "#E4D9BE" },
  progress: { color: "var(--fg-3)", bg: "var(--bg-2)", border: "var(--line-2)" },
  unproven: { color: "var(--fg-4)", bg: "var(--bg-2)", border: "var(--line-2)" },
};

// Per-flow status label for the execution journey (reuses the same tone palette).
function flowStatus(state: string): { label: string; tone: ToneKey } {
  if (state === "passed") return { label: "Passed", tone: "verified" };
  if (state === "failed" || state === "blocked") return { label: state === "failed" ? "Failed" : "Blocked", tone: "failed" };
  if (state === "blocked_by_policy") return { label: "Blocked by policy", tone: "unproven" };
  if (state === "auth_config_failed") return { label: "Auth not available", tone: "unproven" };
  if (state === "running") return { label: "Running", tone: "progress" };
  if (state === "skipped") return { label: "Skipped", tone: "unproven" };
  return { label: state ? state.charAt(0).toUpperCase() + state.slice(1) : "Pending", tone: "unproven" };
}

const SEV_COLOR: Record<string, string> = { critical: "var(--a-failed, #A8452A)", high: "#B45309", medium: "var(--fg-3)", low: "var(--fg-4)" };
const SEV_LABEL: Record<string, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
const ENV_LABELS: Record<string, string> = { preview: "Preview", staging: "Staging", production: "Production" };
const DEPLOY_PROVIDER_LABELS: Record<string, string> = { vercel: "Vercel", railway: "Railway", netlify: "Netlify", custom: "Custom" };

// Coarse, owner-safe failure sentences (worker/preflight/provider-errors.ts). An unknown/absent code keeps the
// generic line; a raw provider message never reaches this page.
const FAILURE_LINE: Record<string, string> = {
  provider_auth_failed: "Browser provider authorization failed. Nothing was charged for flows that never ran.",
  provider_quota: "The browser usage allowance was exhausted. Nothing was charged for flows that never ran.",
  provider_capacity: "Browser capacity was unavailable. Nothing was charged for flows that never ran.",
  provider_unavailable: "The browser provider had an outage. Nothing was charged for flows that never ran.",
  infra_misconfigured: "The run infrastructure was misconfigured. This was on our side, not your deployment.",
  session_timeout: "The browser session timed out before the run could finish.",
  target_mismatch: "The run harness did not honor this run's target URL, so the result was invalidated. This was on our side, not your deployment. Nothing was charged.",
  flow_selection_invalid: "This run's flow selection was missing or invalid, so no browser was started. This was on our side, not your deployment. Nothing was charged.",
  blocked_by_policy: "Vraelis did not run these flows: your test boundaries do not permit an action they require. Widen the boundaries and run again. Nothing was charged for flows that never ran.",
  worker_vault_failure: "Vraelis could not decrypt this application's test credentials, so no flow ran. This was on our side, not your deployment. Nothing was charged.",
  invalid_or_revoked_credential: "The test account needed to sign in is missing or was revoked, so no authenticated flow ran. Add it under Connections and run again. Nothing was charged.",
  login_ui_not_found: "Vraelis could not find a sign-in screen where these flows expected one, so nothing ran. Check the flow start path. Nothing was charged.",
  credential_field_not_found: "Vraelis could not locate the sign-in form's fields, so nothing ran. The login page may have changed. Nothing was charged.",
  mfa_required: "Sign-in required multi-factor authentication, which Vraelis will not bypass. Use a test account without MFA. Nothing was charged.",
  captcha_encountered: "A CAPTCHA or bot check blocked sign-in, which Vraelis will not bypass. Nothing was charged.",
  provider_infra_failure: "The browser provider failed during sign-in. This was on our side, not your deployment. Nothing was charged.",
};

// The plain-English "why" sentence. Counts come straight from the run summary — nothing invented.
function whyLine(decision: string | null, state: string, summary: Record<string, unknown>, criticalIssueCount: number, terminal: boolean, failureCode: string | null): string {
  if (decision === "ready") return "Every critical flow in this verification passed on the tested deployment.";
  if (decision === "repair_verified") {
    const n = num(summary.selected_total) || num(summary.flows_total) || 1;
    return `${n} selected flow${n === 1 ? "" : "s"} passed. The reported failure${n === 1 ? " was" : "s were"} not reproduced. Full critical verification is still required before this deployment can be marked Verified.`;
  }
  if (decision === "needs_review") {
    const pb = num(summary.policy_blocked);
    if (pb > 0) return `${pb} flow${pb === 1 ? "" : "s"} could not run: your test boundaries do not permit an action they require. Widen the boundaries and run again.`;
    return "A non-critical flow needs your review before a reliable conclusion can be reached.";
  }
  if (decision === "blocked") {
    const n = Math.max(0, num(summary.critical_total) - num(summary.critical_passed)) || criticalIssueCount;
    return n > 0 ? `The claim did not hold. ${n} critical flow${n === 1 ? "" : "s"} failed on the tested deployment.` : "The claim did not hold on the tested deployment.";
  }
  if (terminal) {
    if (state === "cancelled") return "This verification was cancelled before it finished, so no conclusion was reached.";
    if (state === "failed") return (failureCode && FAILURE_LINE[failureCode]) || "This verification stopped before it reached a conclusion.";
    return "This verification finished without reaching a conclusion.";
  }
  return "";
}

function flowsSummary(summary: Record<string, unknown>): string | null {
  const ct = num(summary.critical_total), cp = num(summary.critical_passed);
  const ft = num(summary.flows_total), fp = num(summary.flows_passed);
  if (ct > 0) return `${cp} of ${ct} critical flow${ct === 1 ? "" : "s"} passed`;
  if (ft > 0) return `${fp} of ${ft} flow${ft === 1 ? "" : "s"} passed`;
  return null;
}

// v_flow_runs.name falls back to the flow id when the contract name is unresolved; never put an id in prose.
function looksLikeId(name: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name.trim()); }

const label = { fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", margin: 0 } as const;
const h2Style = { fontFamily: "var(--font-display)", fontWeight: 650, fontSize: "clamp(1.15rem, 2vw, 1.4rem)", color: "var(--fg-1)", margin: 0 } as const;
const metaText = { fontSize: 13, color: "var(--fg-3)" } as const;

function Chip({ tone, label: text, size = 10.5 }: { tone: ToneKey; label: string; size?: number }) {
  const t = TONE[tone];
  return <span className="pill" style={{ fontSize: size, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: t.color, background: t.bg, borderColor: t.border, flex: "none" }}>{text}</span>;
}

// Each locked section: a labelled region with an ordered h2. Sections that have no data render their own quiet
// empty state (never a crash, never a placeholder heading). This establishes the hierarchy + data ownership;
// the rich per-section treatment lands in later increments.
function Section({ n, title, aria, children }: { n: string; title: string; aria: string; children: ReactNode }) {
  return (
    <section aria-label={aria} style={{ borderTop: "1px solid var(--line-2)", paddingTop: 22, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-5)", fontWeight: 600 }}>{n}</span>
        <h2 style={h2Style}>{title}</h2>
      </div>
      {children}
    </section>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return <p style={{ fontSize: 13.5, color: "var(--fg-4)", lineHeight: 1.55, margin: 0 }}>{children}</p>;
}

// Verification RESULT page (server component, READ-ONLY). Owner+workspace scoped through
// requirePreflightAppAccess; getRun / getRunInternal are user-scoped, so a guessed run id 404s and another
// tenant's run is never confirmed to exist. The page writes nothing, recomputes no conclusion, and resolves
// ONLY the historical objects pinned to the run (never the latest deployment/snapshot/contract).
export default async function VerificationResultPage({ params }: { params: Promise<{ id: string; runId: string }> }) {
  const { id, runId } = await params;
  const access = await requirePreflightAppAccess(id, `/applications/${id}/passes/${runId}`);
  const owner = access?.owner ?? "";
  const caps = capabilities(access?.role);
  if (!(await preflightDbReady())) return <SetupRequired />;

  // One loading wave: everything keyed only on owner+id+runId. Steps are batched inside getRun (one .in query),
  // never per-flow. contract/requirements/pins fan out in a second wave once their ids are known.
  const [detail, internal, app, meta, contractId, children] = await Promise.all([
    getRun(owner, runId), getRunInternal(owner, runId), getApplication(owner, id), listFlowRunMeta(owner, runId),
    runContractId(owner, runId), listChildRuns(owner, runId),
  ]);

  // Not owned / not found, or the run belongs to a different application than the URL claims. Same 404 for
  // "does not exist" and "not yours" — the page never reveals whether another tenant's run exists.
  if (!detail || !internal || internal.applicationId !== id) {
    return (
      <div className="wrap" style={{ maxWidth: 1080, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
        <div className="empty">
          <EmptyIcon d={I.slash} />
          <h3 style={{ ...h2Style, fontSize: "1.4rem" }}>Verification not found</h3>
          <p>This verification does not exist, or it belongs to another account.</p>
          <Link href={`/applications/${id}`} className="btn">Back to application</Link>
        </div>
      </div>
    );
  }

  const { run, flows, issues } = detail;

  // Second wave: the contract behind the run's claim/requirements, and the PINNED historical version rows.
  // Missing ids resolve to null (never substituted with a latest/current object).
  const pins = await runVersionPins(owner, runId);
  const [contract, requirements, deployment, contextSnap, deploymentsReady] = await Promise.all([
    contractId ? getContractById(owner, contractId) : Promise.resolve(null),
    contractId ? listRequirements(owner, contractId) : Promise.resolve([] as ContractRequirement[]),
    pins.deploymentId ? getDeployment(owner, pins.deploymentId) : Promise.resolve(null),
    pins.contextSnapshotId ? getSnapshot(owner, pins.contextSnapshotId) : Promise.resolve(null),
    deploymentStoreReady(owner),
  ]);

  // ── derived, nothing invented ──
  const verdict = runVerdict(run.state, run.decision);           // Verified | Failed | Blocked | In progress | Not yet verified
  const terminal = run.decision != null || ["completed", "failed", "cancelled"].includes(run.state);
  const active = isActiveRun(run) || !terminal;
  const hasConclusion = verdict.tone === "verified" || verdict.tone === "failed" || verdict.tone === "blocked";
  const claim = (contract?.source_prompt ?? "").trim();
  const contractVersion = internal.contractVersion;
  const criticalIssueCount = issues.filter((i) => i.severity === "critical").length;
  const why = whyLine(run.decision, run.state, run.summary, criticalIssueCount, terminal, run.failure_code);
  const summaryLine = flowsSummary(run.summary);
  const completedIso = run.completed_at || run.created_at;

  const metaByRaw = new Map<string, FlowRunMeta>();
  for (const m of meta) if (!metaByRaw.has(m.rawName)) metaByRaw.set(m.rawName, m);
  const flowName = (f: RunFlow) => { const n = metaByRaw.get(f.name)?.displayName || f.name; return looksLikeId(n) ? "Flow" : n; };

  // Evidence AVAILABILITY (counts only in Increment 1; the full visual evidence experience is a later
  // increment). All owner-safe: screenshot ids resolve through the signed artifacts route, never storage paths.
  const screenshotCount = meta.reduce((s, m) => s + m.screenshotIds.length, 0);
  const issueEv = (iss: RunIssue) => (iss.evidence && typeof iss.evidence === "object" ? iss.evidence : {}) as Record<string, unknown>;
  const consoleCount = issues.reduce((s, iss) => s + (Array.isArray(issueEv(iss).console_errors) ? (issueEv(iss).console_errors as unknown[]).length : 0), 0);
  const networkCount = issues.reduce((s, iss) => s + (Array.isArray(issueEv(iss).network_failures) ? (issueEv(iss).network_failures as unknown[]).length : 0), 0);

  // Affected requirements: ONLY the requirement_refs the worker stamped on FAILED-flow issues, resolved to
  // text via the contract's current requirements. There is NO requirement->step/flow coverage matrix, so none
  // is built. Unresolved refs are dropped from the readable list (never shown as raw UUIDs here).
  const reqTextById = new Map<string, string>();
  for (const r of requirements) reqTextById.set(r.id, r.requirement);
  const affectedIds = new Set<string>();
  for (const iss of issues) { const refs = issueEv(iss).requirement_refs; if (Array.isArray(refs)) for (const r of refs) if (typeof r === "string") affectedIds.add(r); }
  const affectedRequirements = [...affectedIds].map((rid) => reqTextById.get(rid)).filter((t): t is string => !!t);
  const affectedUnresolved = [...affectedIds].filter((rid) => !reqTextById.has(rid)).length;

  // Repair handoff: the findings that carry a REAL per-issue repair_prompt (no invented repair object).
  const repairIssues = issues.filter((iss) => typeof iss.repair_prompt === "string" && iss.repair_prompt.trim().length > 0);

  // Reverification: existing rerun/cancel actions stay structurally present (not redesigned). The price note
  // reflects the SAME gatePassLaunch({rerun:true}) the rerun route enforces, so it can never diverge.
  const hasFailures = flows.some((f) => f.state === "failed" || f.state === "blocked") || issues.some((i) => i.severity === "critical" || i.severity === "high");
  const rerunSelectedCount =
    run.decision === "repair_verified" ? Math.max(1, run.summary ? num(run.summary.critical_total) : 1)
    : hasFailures ? Math.max(1, flows.filter((f) => f.state === "failed" || f.state === "blocked").length)
    : Math.max(1, flows.length);
  let rerunPriceNote: string | null = null;
  if (passPricingEnabled() && caps.canLaunch && terminal) {
    const gate = await gatePassLaunch(owner, rerunSelectedCount, { rerun: true });
    if (gate.mode === "subscription") rerunPriceNote = gate.ok ? `Included on your plan. A rerun meters only the ${rerunSelectedCount} selected flow${rerunSelectedCount === 1 ? "" : "s"}.` : gate.message;
    else if (gate.mode === "payg") rerunPriceNote = `Targeted rerun: ${usdFromCents(gate.cents)} (${usdFromCents(rerunPriceCents(1))} per failed flow), charged when you launch. Not covered by the free verification.`;
    else if (gate.mode === "frozen") rerunPriceNote = gate.message;
  }

  const deployEnvLabel = deployment?.environment ? (ENV_LABELS[deployment.environment] ?? null) : null;
  const deployProviderLabel = deployment?.provider ? (DEPLOY_PROVIDER_LABELS[deployment.provider] ?? deployment.provider) : null;
  const deployCommit = (deployment?.commit_sha ?? run.commit_sha ?? "").slice(0, 10);

  return (
    <div className="wrap" style={{ maxWidth: 1080, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, marginBottom: 18 }}>
        <Link href="/applications" style={{ color: "var(--fg-4)", textDecoration: "none" }}>Systems</Link>
        <span aria-hidden style={{ color: "var(--fg-5)" }}>/</span>
        <Link href={`/applications/${id}`} style={{ color: "var(--fg-4)", textDecoration: "none", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app?.name ?? "System"}</Link>
        <span aria-hidden style={{ color: "var(--fg-5)" }}>/</span>
        <span style={{ color: "var(--fg-2)", fontWeight: 600 }}>Verification</span>
      </nav>

      {/* ── 01 CONTEXT: what was checked, where, when — the head of a proof-first page (no giant verdict banner) ── */}
      <header style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={label}>Verification</div>
          {hasConclusion ? <Chip tone={verdict.tone} label={verdict.label} /> : (
            <span className="pill" style={{ fontSize: 10.5, color: "var(--fg-3)", background: "var(--bg-2)", borderColor: "var(--line-2)" }}>
              {active ? runningStage(run.state) : verdict.label}
            </span>
          )}
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(1.7rem, 3.4vw, 2.3rem)", letterSpacing: "-0.02em", lineHeight: 1.08, color: "var(--fg-1)", margin: 0, wordBreak: "break-word" }}>
          {app?.name ?? "System"}
        </h1>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", ...metaText }}>
          {run.deployment_url ? <a href={run.deployment_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--fg-2)", textDecoration: "none", wordBreak: "break-all" }}>{run.deployment_url}</a> : null}
          {deployCommit ? <span>commit {deployCommit}</span> : null}
          {deployEnvLabel ? <span>{deployEnvLabel}</span> : null}
          {contractVersion != null ? <span>Contract v{contractVersion}</span> : null}
          <span title={when(completedIso)}>{active ? `Started ${ago(run.created_at)}` : `Completed ${ago(completedIso)}`}</span>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-4)" }} title={`Verification ${runId}`}>#{shortId(runId)}</span>
          {active ? <span style={{ color: "var(--fg-4)" }}>Updates automatically</span> : null}
        </div>
      </header>

      <div style={{ display: "grid", gap: "clamp(20px, 3vw, 30px)", marginTop: "clamp(20px, 3vw, 30px)" }}>

        {/* ── 02 SUBMITTED CLAIM — the outcome this verification checked (from contract.source_prompt only; NOT a
              stored guarantee object). Omitted cleanly when absent — never a fabricated or broken heading. ── */}
        {claim ? (
          <Section n="02" title="What had to be true" aria="Submitted claim">
            <p style={{ fontSize: "clamp(15px, 1.8vw, 17px)", color: "var(--fg-1)", lineHeight: 1.55, margin: 0, maxWidth: "68ch", wordBreak: "break-word" }}>{claim}</p>
          </Section>
        ) : null}

        {/* ── 03 OUTCOME — what happened + why; the public conclusion is SUPPORTING metadata, never a banner. ── */}
        <Section n="03" title="Outcome" aria="Outcome">
          {active ? (
            <Empty>{runningStage(run.state)}. The conclusion is not final yet. This page updates on its own.</Empty>
          ) : (
            <>
              {why ? <p style={{ fontSize: 15, color: "var(--fg-1)", lineHeight: 1.55, margin: 0, maxWidth: "64ch" }}>{why}</p> : null}
              <div style={{ display: "flex", alignItems: "center", gap: "6px 14px", flexWrap: "wrap", ...metaText, marginTop: 2 }}>
                {hasConclusion ? <span>Conclusion <Chip tone={verdict.tone} label={verdict.label} /></span> : <span>{verdict.label}</span>}
                {summaryLine ? <span>{summaryLine}</span> : null}
                {issues.length ? <span>{issues.length} finding{issues.length === 1 ? "" : "s"}</span> : null}
              </div>
              {/* A summary of what was found (title + severity + lineage). The full evidence for each finding —
                  screenshots, expected/observed, reproduction — is the evidence increment; the lineage pill
                  (Recurring vs first-seen), backed by issue.first_seen_run, stays because it is transparency,
                  not decoration. */}
              {issues.length > 0 ? (
                <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
                  {issues.map((issue) => (
                    <div key={issue.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span className="pill" style={{ fontSize: 10, color: SEV_COLOR[issue.severity] ?? "var(--fg-4)", borderColor: "var(--line-2)", background: "var(--bg-2)", flex: "none" }}>{SEV_LABEL[issue.severity] ?? issue.severity}</span>
                      <span style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.5, flex: "1 1 auto", minWidth: 0, wordBreak: "break-word" }}>{issue.title}</span>
                      {issue.first_seen_run && issue.first_seen_run !== runId
                        ? <span className="pill" style={{ fontSize: 10, color: "#B45309", borderColor: "#F3DFB0", background: "#FEF6E7", flex: "none" }} title="This finding was first detected in an earlier verification">Recurring</span>
                        : <span className="pill" style={{ fontSize: 10, color: "var(--fg-4)", borderColor: "var(--line-2)", background: "var(--bg-2)", flex: "none" }} title="First detected in this verification">First seen here</span>}
                    </div>
                  ))}
                </div>
              ) : null}
              {run.decision === "repair_verified" ? (
                <Empty>This is a targeted rerun record. It does not change the earlier verification it reran.</Empty>
              ) : null}
            </>
          )}
        </Section>

        {/* ── 04 EVIDENCE — placeholder structure: real availability counts / empty states only (the full visual
              evidence experience arrives in a later increment). Artifacts are only ever the signed route. ── */}
        <Section n="04" title="Evidence" aria="Evidence">
          {screenshotCount + consoleCount + networkCount + issues.length === 0 ? (
            <Empty>{active ? "Evidence is still being collected." : "No evidence was captured for this verification."}</Empty>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", ...metaText }}>
              {screenshotCount > 0 ? <span>{screenshotCount} screenshot{screenshotCount === 1 ? "" : "s"}</span> : null}
              {issues.length > 0 ? <span>{issues.length} finding{issues.length === 1 ? "" : "s"}</span> : null}
              {consoleCount > 0 ? <span>{consoleCount} console error{consoleCount === 1 ? "" : "s"}</span> : null}
              {networkCount > 0 ? <span>{networkCount} network failure{networkCount === 1 ? "" : "s"}</span> : null}
            </div>
          )}
        </Section>

        {/* ── 05 EXECUTION JOURNEY — the flows that ran (skeleton: name + status + step count; the ordered step
              timeline lands in a later increment). ── */}
        <Section n="05" title="Execution journey" aria="Execution journey">
          {flows.length === 0 ? (
            <Empty>{active ? "Waiting for the first flow to run." : "No flows were recorded for this verification."}</Empty>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {flows.map((f, i) => {
                const st = flowStatus(f.state);
                // A policy-blocked flow names the permission that would let it run, straight from the refused
                // step's recorded detail — transparency the owner needs to widen a boundary, kept in the
                // skeleton. The full step timeline is the evidence increment.
                const permitNeeded = f.state === "blocked_by_policy"
                  ? (f.steps.map((s) => (s.observed ?? "").match(/permit_[a-z_]+|allowed_domains/)?.[0]).find(Boolean) ?? null)
                  : null;
                return (
                  <div key={`${f.name}-${i}`} style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-md, 10px)", background: "var(--bg-1)", padding: "10px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13.5, color: "var(--fg-1)", flex: "1 1 auto", minWidth: 0, wordBreak: "break-word" }}>{flowName(f)}</span>
                      {f.auth ? <span className="pill" style={{ fontSize: 10, color: "var(--fg-3)", borderColor: "var(--line-2)", background: "var(--bg-2)" }}>Authenticated</span> : null}
                      <Chip tone={st.tone} label={st.label} />
                      <span style={{ fontSize: 12, color: "var(--fg-5)", flex: "none" }}>{f.steps.length} step{f.steps.length === 1 ? "" : "s"}</span>
                    </div>
                    {f.state === "blocked_by_policy" ? (
                      <p style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5, margin: "6px 0 0" }}>
                        {permitNeeded
                          ? <>Additional permission required: <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>{permitNeeded}</span></>
                          : "This flow requires an action your test boundaries do not permit."}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* ── 06 AFFECTED REQUIREMENTS — ONLY requirement refs the findings actually stored (failed flows); no
              coverage matrix is fabricated. ── */}
        <Section n="06" title="Affected requirements" aria="Affected requirements">
          {affectedRequirements.length === 0 && affectedUnresolved === 0 ? (
            <Empty>No specific requirements were flagged by the findings on this verification.</Empty>
          ) : (
            <>
              {affectedRequirements.length > 0 ? (
                <ul style={{ margin: 0, padding: "0 0 0 18px", display: "grid", gap: 5 }}>
                  {affectedRequirements.map((t, i) => <li key={i} style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.5, wordBreak: "break-word" }}>{t}</li>)}
                </ul>
              ) : null}
              {affectedUnresolved > 0 ? <Empty>{affectedUnresolved} referenced requirement{affectedUnresolved === 1 ? "" : "s"} could not be resolved to current contract text.</Empty> : null}
            </>
          )}
        </Section>

        {/* ── 07 REPAIR HANDOFF — the REAL per-finding repair_prompt only (no invented repair object). The copy
              control is read-only (clipboard), so it is available to every role. Grouping/polish lands later. ── */}
        <Section n="07" title="Repair handoff" aria="Repair handoff">
          {repairIssues.length === 0 ? (
            <Empty>No repair guidance was generated for this verification.</Empty>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {repairIssues.map((iss) => (
                <div key={iss.id} style={{ display: "grid", gap: 8, border: "1px solid var(--line-2)", borderRadius: "var(--r-md, 10px)", background: "var(--bg-1)", padding: "12px 14px" }}>
                  <div style={{ fontSize: 13.5, color: "var(--fg-1)", fontWeight: 500, wordBreak: "break-word" }}>{iss.title}</div>
                  <CopyButton text={iss.repair_prompt as string} />
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── 08 REVERIFICATION — parent + child lineage; a later verification is a SEPARATE record. The existing
              rerun/cancel action stays structurally present (not redesigned). ── */}
        <Section n="08" title="Reverification" aria="Reverification">
          {run.parent_run_id ? (
            <p style={{ ...metaText, margin: 0 }}>
              This is a reverification of an <Link href={`/applications/${id}/passes/${run.parent_run_id}`} style={{ color: "var(--acc-deep)" }}>earlier verification</Link>.
              {run.selected_flow_ids?.length ? ` Targeted rerun: ${run.selected_flow_ids.length} flow${run.selected_flow_ids.length === 1 ? "" : "s"} selected.` : ""}
              {" "}That earlier record is unchanged.
            </p>
          ) : null}
          {children.length > 0 ? (
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ ...metaText, color: "var(--fg-4)" }}>{children.length} later reverification{children.length === 1 ? "" : "s"} (each a separate record):</div>
              {children.map((c: ChildRun) => {
                const cv = runVerdict(c.state, c.decision);
                return (
                  <Link key={c.id} href={`/applications/${id}/passes/${c.id}`} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", color: "inherit", textDecoration: "none", border: "1px solid var(--line-2)", borderRadius: "var(--r-md, 10px)", background: "var(--bg-1)", padding: "9px 13px" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)", flex: "none" }}>#{shortId(c.id)}</span>
                    <span style={{ fontSize: 12.5, color: "var(--fg-4)", flex: "1 1 auto" }} title={when(c.completed_at || c.created_at)}>{ago(c.completed_at || c.created_at)}</span>
                    <Chip tone={cv.tone} label={cv.label} />
                  </Link>
                );
              })}
            </div>
          ) : null}
          {caps.canLaunch ? (
            <div style={{ marginTop: 4 }}>
              {terminal ? (
                run.decision === "repair_verified"
                  ? <RerunButton appId={id} runId={runId} scope="critical" label="Run full critical verification" priceNote={rerunPriceNote} />
                  : <RerunButton appId={id} runId={runId} scope={hasFailures ? "failed" : "all"} label={hasFailures ? "Rerun failed flows" : "Run again"} priceNote={rerunPriceNote} />
              ) : (
                <CancelRunButton appId={id} runId={runId} />
              )}
            </div>
          ) : null}
        </Section>

        {/* ── 09 PROVENANCE & IMMUTABLE HISTORY — the PINNED deployment / snapshot / contract this record tested;
              never the latest. Honest limitations, never a placeholder or a substituted newer object. ── */}
        <Section n="09" title="Provenance" aria="Provenance and immutable history">
          <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-md, 10px)", background: "var(--bg-1)", padding: "14px 16px", display: "grid", gap: 8 }}>
            <div style={{ ...label, display: "flex", alignItems: "center", gap: 6 }}><Ic d={I.deploy} size={13} sw={2} />Tested deployment</div>
            {run.deployment_url ? <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--fg-1)", wordBreak: "break-all" }}>{run.deployment_url}</div> : null}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", fontSize: 12.5, color: "var(--fg-3)" }}>
              {deployEnvLabel ? <span className="pill" style={{ fontSize: 10 }}>{deployEnvLabel}</span> : null}
              {deployProviderLabel ? <span>Provider: {deployProviderLabel}</span> : null}
              {deployCommit ? <span>Commit {deployCommit}</span> : null}
              {deployment?.branch ? <span>Branch {deployment.branch}</span> : null}
              {internal.contractVersion != null ? <span>Contract v{internal.contractVersion}</span> : null}
              {contextSnap ? <span>Context v{contextSnap.version}</span> : null}
              <span title={when(completedIso)}>{active ? `Started ${when(run.created_at)}` : `Executed ${when(completedIso)}`}</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-4)" }}>#{shortId(runId)}</span>
            </div>
            {contractVersion != null && requirements.length > 0 ? (
              <p style={{ fontSize: 12, color: "var(--fg-4)", lineHeight: 1.5, margin: 0 }}>
                Requirements shown elsewhere are the current requirements for Contract v{contractVersion}. Historical requirement text was not separately snapshotted for this verification.
              </p>
            ) : null}
            {!deploymentsReady ? (
              <p style={{ fontSize: 12, color: "var(--fg-4)", lineHeight: 1.5, margin: 0 }}>
                Deployment identity is not recorded yet: apply <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>sql/vraelis-preflight-8-deployments.sql</span> (migration 8).
              </p>
            ) : pins.deploymentId && !deployment ? (
              <p style={{ fontSize: 12, color: "var(--fg-4)", lineHeight: 1.5, margin: 0 }}>The deployment recorded for this verification is no longer available. It is not replaced with a newer one.</p>
            ) : null}
            {deployment?.provider_deployment_id ? (
              <details style={{ marginTop: 2 }}>
                <summary style={{ cursor: "pointer", fontSize: 12.5, color: "var(--fg-4)" }}>View technical details</summary>
                <div style={{ fontSize: 12.5, color: "var(--fg-3)", wordBreak: "break-all", lineHeight: 1.5, marginTop: 6 }}>Provider deployment id: {deployment.provider_deployment_id}</div>
              </details>
            ) : null}
          </div>
          <Link href={`/applications/${id}`} className="btn btn--ghost" style={{ justifySelf: "start" }}>Back to {app?.name ?? "system"}</Link>
        </Section>
      </div>

      {active ? <AutoRefresh /> : null}
    </div>
  );
}
