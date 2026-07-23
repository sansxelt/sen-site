import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { requirePreflightAppAccess } from "@/lib/v-preflight-guard";
import { capabilities } from "@/lib/preflight/role-capabilities";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { getApplication, getContractById, listRequirements, type ContractRequirement } from "@/lib/v-applications";
import { getRun, listChildRuns, getRunLite, type RunFlow, type RunStep, type RunIssue, type ChildRun } from "@/lib/preflight/runs-db";
import { getRunInternal, listFlowRunMeta, type FlowRunMeta } from "@/lib/preflight/run-report-db";
import { runVersionPins, getDeployment, deploymentStoreReady } from "@/lib/preflight/deployments-db";
import { getSnapshot } from "@/lib/preflight/context-snapshots";
import { getReviewedPlanByRunId } from "@/lib/preflight/reviewed-plan-db";
import { runVerdict, isActiveRun, runningStage, type Tone as ToneKey } from "@/lib/preflight/home-verdict";
import { SetupRequired } from "../../../setup-required";
import { RerunButton } from "./rerun-button";
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
// Verified / Failed / Blocked (a targeted repair rerun maps to Blocked, not Verified) plus the honest
// non-conclusions In progress / Not yet verified. It never exposes an internal decision string, and it uses the
// approved warm-neutral tokens — no retired teal. This page implements NO second decision mapping. ──
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
    // repair_verified maps to the public Blocked conclusion (one contract with the API/webhook): a targeted
    // repair rerun proved its selected flows but did NOT cover the full verification scope. Say exactly that.
    const n = num(summary.selected_total) || num(summary.flows_total) || 1;
    return `The targeted repair check passed: ${n} selected flow${n === 1 ? "" : "s"} produced the expected result. This did not cover the full verification scope, so a full critical verification is still required before Vraelis can return Verified.`;
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

// The failed step told as a human sentence, derived from the deterministic evidence the issue already points
// at — never a raw failure_message. Empty when the evidence carries no step, so the caller can fall back.
function humanObserved(issue: RunIssue): string {
  const ev = (issue.evidence && typeof issue.evidence === "object" ? issue.evidence : {}) as Record<string, unknown>;
  const repro = Array.isArray(issue.repro) ? (issue.repro as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const idx = typeof ev.failed_step_index === "number" ? ev.failed_step_index : -1;
  const stepLine = idx >= 0 && typeof repro[idx] === "string" ? repro[idx].replace(/^\d+\.\s*/, "").trim() : "";
  return stepLine ? `The flow stopped at step ${idx + 1}: "${stepLine}".` : "";
}

// The DETERMINISTIC primary finding: critical before high before the rest, stable tiebreak on persisted order.
// Never an LLM choice.
const SEV_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
function primaryIssue(issues: RunIssue[]): RunIssue | null {
  if (!issues.length) return null;
  return [...issues].map((iss, i) => [iss, i] as const).sort((a, b) => ((SEV_RANK[a[0].severity] ?? 9) - (SEV_RANK[b[0].severity] ?? 9)) || (a[1] - b[1]))[0][0];
}

// "What actually happened" — composed from REAL persisted data along a deterministic priority. It is a
// presentation sentence, never a stored column, and it is scoped to the CHECKED WORKFLOW, never generalized to
// the whole system. Empty for an incomplete run (no observed outcome before one exists). Never raw
// failure_message, never a provider error.
function composeObservedOutcome(pub: string | null, decision: string | null, summary: Record<string, unknown>, issues: RunIssue[]): string {
  if (pub === null) return "";
  if (decision === "repair_verified") {
    const n = num(summary.selected_total) || num(summary.flows_total) || 1;
    return `The targeted repair check passed: ${n} selected flow${n === 1 ? "" : "s"} produced the expected result.`;
  }
  if (pub === "verified") return "The checked workflow completed with the expected result.";
  if (pub === "failed") {
    const p = primaryIssue(issues);                       // prefer the specific observed step, then the observational title
    if (p) return humanObserved(p) || p.title || "The checked workflow did not produce the required result.";
    const n = Math.max(0, num(summary.critical_total) - num(summary.critical_passed));
    return n > 0
      ? `${n} critical flow${n === 1 ? "" : "s"} did not produce the required result.`
      : "The checked workflow did not produce the required result. Detailed finding evidence is unavailable for this record.";
  }
  // blocked (needs_review / indeterminate / cancelled / infra): NO reliable conclusion — never a confirmed failure.
  const pb = num(summary.policy_blocked);
  if (pb > 0) return `Vraelis could not reach a reliable conclusion: ${pb} flow${pb === 1 ? "" : "s"} could not run under your current test boundaries.`;
  return issues.length
    ? "Vraelis could not reach a reliable conclusion for this verification."
    : "Vraelis could not reach a reliable conclusion. Detailed blocking evidence is unavailable for this record.";
}

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

// ── Increment 3: evidence + execution journey ──
const CATEGORY_LABEL: Record<string, string> = {
  persistence_failure: "Persistence", session_failure: "Session", cross_account: "Authorization",
  fake_success: "Fake success", stale_ui: "Stale UI", duplicate_action: "Duplicate action",
  authorization_failure: "Authorization", mobile_blocker: "Mobile", navigation_failure: "Navigation", functional_failure: "Functional",
};
function catLabel(c: string | null): string { return c ? (CATEGORY_LABEL[c] ?? c.replace(/_/g, " ")) : "Issue"; }
const CRED_STATE_LABEL: Record<string, string> = { active: "Active", missing: "Missing", revoked: "Revoked" };

// Auth-failure classifications told as owner-safe sentences (never a raw provider/credential error).
const AUTH_FAILURE_LINE: Record<string, string> = {
  invalid_or_revoked_credential: "The test account for this role is missing or was revoked. Add or re-add it under Connections, then run again.",
  login_ui_not_found: "No sign-in screen was found where this flow expected one. Check the flow's start path.",
  credential_field_not_found: "The sign-in form's fields could not be located. The login page may have changed.",
  mfa_required: "This account requires multi-factor authentication. Vraelis will not bypass it. Use a test account without MFA.",
  captcha_encountered: "A CAPTCHA or bot check blocked sign-in. Vraelis will not bypass it.",
  worker_vault_failure: "Vraelis could not decrypt this application's test credentials. This is on our side, not your deployment.",
  provider_infra_failure: "The browser provider failed during sign-in. This is on our side, not your deployment.",
  boundary_blocked: "An action this flow needed was refused by your test boundaries. Widen the boundaries and run again.",
};

function stepText(action: string | null, target: string | null): string {
  const t = (target ?? "").trim();
  switch (action) {
    case "navigate": return `Open ${t || "the page"}`;
    case "click": return `Click ${t || "the control"}`;
    case "fill": return `Fill ${t || "the field"}`;
    case "select": return `Select ${t || "an option"}`;
    case "check": return `Check ${t || "the box"}`;
    case "uncheck": return `Uncheck ${t || "the box"}`;
    case "press": return `Press ${t || "a key"}`;
    case "wait_for": return `Wait for ${t || "the element"}`;
    case "assert_visible": return `Confirm ${t || "the content"} is visible`;
    case "assert_text": return `Confirm the text ${t}`.trim();
    case "assert_url": return `Confirm the URL ${t}`.trim();
    case "refresh": return "Refresh the page";
    case "new_context": return "Open a fresh session";
    case "screenshot": return "Capture a screenshot";
    default: return `${action ?? "Step"}${t ? ` ${t}` : ""}`;
  }
}

const techLine = { fontSize: 12.5, color: "var(--fg-3)", wordBreak: "break-all" as const, lineHeight: 1.5 } as const;

// Screenshots load through the owner-checked signed artifacts route ONLY (the route mints a 120s signed URL
// server-side and authorizes the viewer). No storage path, provider session id, or raw artifact location ever
// reaches the HTML. Absent artifacts render nothing.
function ScreenshotGrid({ runId, ids, min = 300 }: { runId: string; ids: string[]; min?: number }) {
  if (!ids.length) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`, gap: 14 }}>
      {ids.map((sid) => (
        <figure key={sid} style={{ margin: 0, minWidth: 0 }}>
          <a href={`/api/preflight/runs/${runId}/artifacts/${sid}`} target="_blank" rel="noopener noreferrer" style={{ display: "block" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {/* Reserve the box before the bytes arrive (a fixed aspect-ratio) so scrolling past lazy-loaded
                evidence does not shift the page; object-fit: contain keeps each screenshot's true ratio
                (no crop, no distortion, full evidence visible) inside the reserved space. */}
            <img src={`/api/preflight/runs/${runId}/artifacts/${sid}`} alt="Screenshot from this verification" loading="lazy" style={{ display: "block", width: "100%", maxWidth: "100%", aspectRatio: "16 / 10", objectFit: "contain", background: "var(--bg-2)", border: "1px solid var(--line-2)", borderRadius: 10 }} />
          </a>
          <figcaption style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 6 }}>Screenshot from this verification</figcaption>
        </figure>
      ))}
    </div>
  );
}

// One finding as full evidence: expected vs observed in prose, the screenshots large, the reproduction steps, a
// possible cause (interpretation), and the raw console/network/requirement-refs inside a COLLAPSED technical
// details element. Never a raw failure_message, storage path, or session id. The repair prompt is section 07.
function FindingEvidence({ issue, index, flowName, screenshotIds, runId }: { issue: RunIssue; index: number; flowName: string | null; screenshotIds: string[]; runId: string }) {
  const ev = (issue.evidence && typeof issue.evidence === "object" ? issue.evidence : {}) as Record<string, unknown>;
  const consoleErrors = Array.isArray(ev.console_errors) ? (ev.console_errors as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const networkFailures = Array.isArray(ev.network_failures) ? (ev.network_failures as { method?: string; path?: string; status?: number }[]) : [];
  const requirementRefs = Array.isArray(ev.requirement_refs) ? (ev.requirement_refs as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const repro = Array.isArray(issue.repro) ? (issue.repro as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const sevColor = SEV_COLOR[issue.severity] ?? "var(--fg-3)";
  const expected = (issue.expected ?? "").replace(/^Expected:\s*/i, "").trim();
  const observed = humanObserved(issue) || "The flow did not complete.";
  const hasTechnical = Boolean(issue.observed) || consoleErrors.length > 0 || networkFailures.length > 0 || requirementRefs.length > 0;
  return (
    <div id={`finding-${issue.id}`} style={{ border: "1px solid var(--line-2)", borderLeft: `3px solid ${sevColor}`, borderRadius: "var(--r-md, 10px)", background: "var(--bg-1)", padding: "clamp(16px, 2.4vw, 22px)", scrollMarginTop: "16px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "clamp(15px, 1.7vw, 17px)", lineHeight: 1.35, color: "var(--fg-1)", margin: 0, flex: "1 1 280px", minWidth: 0, wordBreak: "break-word" }}>{index + 1}. {issue.title}</h3>
        <div style={{ display: "flex", gap: 6, flex: "none", flexWrap: "wrap" }}>
          <span className="pill" style={{ fontSize: 10, color: sevColor, borderColor: "var(--line-2)", background: "var(--bg-2)" }}>{SEV_LABEL[issue.severity] ?? issue.severity}</span>
          <span className="pill" style={{ fontSize: 10, color: "var(--fg-3)", borderColor: "var(--line-2)", background: "var(--bg-2)" }}>{catLabel(issue.category)}</span>
          {issue.first_seen_run && issue.first_seen_run !== runId
            ? <span className="pill" style={{ fontSize: 10, color: "#B45309", borderColor: "#F3DFB0", background: "#FEF6E7" }} title="First detected in an earlier verification">Recurring</span>
            : <span className="pill" style={{ fontSize: 10, color: "var(--fg-4)", borderColor: "var(--line-2)", background: "var(--bg-2)" }} title="First detected in this verification">First seen here</span>}
        </div>
      </div>
      {flowName ? <p style={{ fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.5, margin: "6px 0 0" }}>Seen while running the &quot;{flowName}&quot; flow in a real browser.</p> : null}
      <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
        {expected ? <div><div style={label}>Expected</div><p style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.55, margin: "4px 0 0", wordBreak: "break-word" }}>{expected}</p></div> : null}
        <div><div style={label}>Observed</div><p style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.55, margin: "4px 0 0", wordBreak: "break-word" }}>{observed}</p></div>
      </div>
      {screenshotIds.length ? <div style={{ marginTop: 16 }}><div style={{ ...label, display: "flex", alignItems: "center", gap: 6 }}><Ic d={I.camera} size={13} sw={2} />Evidence</div><div style={{ marginTop: 8 }}><ScreenshotGrid runId={runId} ids={screenshotIds} /></div></div> : null}
      {repro.length ? <div style={{ marginTop: 16 }}><div style={label}>How to reproduce</div><ol style={{ margin: "8px 0 0", padding: "0 0 0 18px", display: "grid", gap: 5 }}>{repro.map((r, i) => <li key={i} style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.5, wordBreak: "break-word" }}>{r.replace(/^\d+\.\s*/, "")}</li>)}</ol></div> : null}
      {issue.likely_cause ? <div style={{ marginTop: 16, borderLeft: "3px solid var(--line-2)", paddingLeft: 12 }}><div style={label}>Possible cause (interpretation)</div><p style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55, margin: "6px 0 0", wordBreak: "break-word" }}>{issue.likely_cause}</p></div> : null}
      {hasTechnical ? (
        <details style={{ marginTop: 14, border: "1px solid var(--line-2)", borderRadius: 8, padding: "10px 14px" }}>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--fg-4)", padding: "6px 0" }}>View technical details</summary>
          <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
            {issue.observed ? <div style={techLine}>{issue.observed}</div> : null}
            {requirementRefs.length ? <div style={techLine}>Requirement refs: {requirementRefs.join(", ")}</div> : null}
            {consoleErrors.slice(0, 10).map((c, i) => <div key={`c${i}`} style={techLine}>{c}</div>)}
            {networkFailures.slice(0, 10).map((n, i) => <div key={`n${i}`} style={techLine}>{n.status ?? ""} {n.method ?? ""} {n.path ?? ""}</div>)}
          </div>
        </details>
      ) : null}
    </div>
  );
}

// One flow in the execution journey: status + ordered steps (action + pass/fail + observed detail + real ms
// timing — the ONLY real timing, never a derived wall-clock), the authenticated-flow panel (allowlisted
// owner-safe fields only), and the policy-permit line.
function FlowTimeline({ flow, displayName, screenshotIds, runId, showShots }: { flow: RunFlow; displayName: string; screenshotIds: string[]; runId: string; showShots: boolean }) {
  const st = flowStatus(flow.state);
  const failed = flow.state === "failed" || flow.state === "blocked";
  const permitNeeded = flow.state === "blocked_by_policy" ? (flow.steps.map((s) => (s.observed ?? "").match(/permit_[a-z_]+|allowed_domains/)?.[0]).find(Boolean) ?? null) : null;
  const auth = flow.auth;
  const authFailLine = auth?.authFailure ? (AUTH_FAILURE_LINE[auth.authFailure] ?? null) : null;
  return (
    <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-md, 10px)", background: "var(--bg-1)", padding: "12px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13.5, fontWeight: failed ? 600 : 500, color: failed ? "var(--fg-1)" : "var(--fg-2)", flex: "1 1 auto", minWidth: 0, wordBreak: "break-word" }}>{displayName}</span>
        {auth ? <span className="pill" style={{ fontSize: 10, color: "var(--fg-3)", borderColor: "var(--line-2)", background: "var(--bg-2)" }}>Authenticated</span> : null}
        <Chip tone={st.tone} label={st.label} />
        <span style={{ fontSize: 12, color: "var(--fg-5)", flex: "none" }}>{flow.steps.length} step{flow.steps.length === 1 ? "" : "s"}</span>
      </div>
      {flow.state === "blocked_by_policy" ? <p style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5, margin: "6px 0 0" }}>{permitNeeded ? <>Additional permission required: <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>{permitNeeded}</span></> : "This flow requires an action your test boundaries do not permit."}</p> : null}
      {auth ? (
        <div style={{ marginTop: 8, border: "1px solid var(--line-2)", borderRadius: "var(--r-sm, 8px)", background: "var(--bg-2)", padding: "10px 12px" }}>
          <div style={{ ...label, display: "flex", alignItems: "center", gap: 6 }}><Ic d={I.lock} size={12} sw={2} />Authenticated flow</div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "5px 14px", marginTop: 7, fontSize: 12.5, color: "var(--fg-3)" }}>
            {auth.roles.length ? <span style={{ overflowWrap: "anywhere", minWidth: 0 }}>Role{auth.roles.length === 1 ? "" : "s"}: <span style={{ color: "var(--fg-2)", fontWeight: 600 }}>{auth.roles.join(", ")}</span></span> : null}
            {auth.accountLabel ? <span style={{ overflowWrap: "anywhere", minWidth: 0 }}>Account: {auth.accountLabel}</span> : null}
            {auth.environment ? <span className="pill" style={{ fontSize: 10 }}>{ENV_LABELS[auth.environment] ?? auth.environment}</span> : null}
            <span>Credential: <span style={{ color: auth.credentialState === "active" ? "var(--acc-deep)" : "#B45309", fontWeight: 600 }}>{CRED_STATE_LABEL[auth.credentialState] ?? auth.credentialState}</span></span>
            {auth.sessionReuse ? <span>Session reuse on</span> : null}
          </div>
          {authFailLine ? <p style={{ fontSize: 12, color: "var(--fg-3)", lineHeight: 1.5, margin: "7px 0 0" }}>{authFailLine}</p> : null}
        </div>
      ) : null}
      {flow.steps.length ? (
        <details open={failed} style={{ marginTop: 8 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--fg-4)", padding: "6px 0" }}>View steps</summary>
          <ol style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 6 }}>
            {flow.steps.map((s: RunStep, i) => {
              const okk = s.status === "ok";
              const stepFailed = !okk && s.status != null && s.status !== "";
              return (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px", borderRadius: "var(--r-sm, 8px)", background: stepFailed ? "#F6ECE7" : "var(--bg-2)", border: `1px solid ${stepFailed ? "#E7CFC5" : "var(--line-2)"}` }}>
                  <span aria-hidden style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-5)", flex: "none", marginTop: 2, width: 18, textAlign: "right" }}>{i + 1}</span>
                  <span aria-hidden style={{ display: "inline-flex", color: okk ? "var(--acc-deep)" : stepFailed ? "var(--a-failed, #A8452A)" : "var(--fg-4)", flex: "none", marginTop: 3 }}><Ic d={okk ? I.check : stepFailed ? I.x : I.dash} size={13} sw={2.4} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* The pass/fail/not-run outcome is otherwise only an aria-hidden icon + background tint;
                        this makes the per-step outcome available to assistive tech (WCAG 1.1.1 / 1.4.1). */}
                    <span className="sr-only">{okk ? "Passed. " : stepFailed ? "Failed. " : "Not run. "}</span>
                    <div style={{ fontSize: 13, color: "var(--fg-1)", lineHeight: 1.45, wordBreak: "break-word" }}>{stepText(s.action, s.target)}</div>
                    {stepFailed && s.observed ? <details style={{ marginTop: 4 }}><summary style={{ cursor: "pointer", fontSize: 12, color: "var(--fg-4)", padding: "4px 0" }}>Error detail</summary><div style={{ fontSize: 12, color: "var(--fg-3)", wordBreak: "break-all", lineHeight: 1.5, marginTop: 4 }}>{s.observed}</div></details> : null}
                  </div>
                  <span style={{ fontSize: 11, color: "var(--fg-5)", flex: "none", marginTop: 2 }}>{s.ms != null ? `${s.ms} ms` : ""}</span>
                </li>
              );
            })}
          </ol>
        </details>
      ) : <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "8px 0 0" }}>No steps recorded for this flow.</p>}
      {showShots && screenshotIds.length ? <div style={{ marginTop: 12 }}><div style={{ ...label, display: "flex", alignItems: "center", gap: 6 }}><Ic d={I.camera} size={13} sw={2} />Evidence</div><div style={{ marginTop: 8 }}><ScreenshotGrid runId={runId} ids={screenshotIds} min={260} /></div></div> : null}
    </div>
  );
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
  // never per-flow. contract/requirements/pins fan out in a second wave once their ids are known. getRunInternal
  // already returns the run's contract_id, so it is not read a second time here.
  const [detail, internal, app, meta, children] = await Promise.all([
    getRun(owner, runId), getRunInternal(owner, runId), getApplication(owner, id), listFlowRunMeta(owner, runId),
    listChildRuns(owner, runId),
  ]);

  // Not owned / not found, or the run belongs to a different application than the URL claims. Same 404 for
  // "does not exist" and "not yours" — the page never reveals whether another tenant's run exists.
  if (!detail || !internal || internal.applicationId !== id) {
    return (
      <div className="wrap" style={{ maxWidth: 1080, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
        <div className="empty">
          <EmptyIcon d={I.slash} />
          <h1 style={{ ...h2Style, fontSize: "1.4rem" }}>Verification not found</h1>
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
  const [contract, requirements, deployment, contextSnap, deploymentsReady, parentLite, reviewedPlan] = await Promise.all([
    internal.contractId ? getContractById(owner, internal.contractId) : Promise.resolve(null),
    internal.contractId ? listRequirements(owner, internal.contractId) : Promise.resolve([] as ContractRequirement[]),
    pins.deploymentId ? getDeployment(owner, pins.deploymentId) : Promise.resolve(null),
    pins.contextSnapshotId ? getSnapshot(owner, pins.contextSnapshotId) : Promise.resolve(null),
    deploymentStoreReady(owner),
    // The parent record (read-only, owner-scoped): null if missing/deleted/non-owned, so the lineage never
    // leaks another tenant's run and never rewrites the parent.
    run.parent_run_id ? getRunLite(owner, run.parent_run_id) : Promise.resolve(null),
    // The reviewed plan this run consumed (the REAL persisted run_id binding), or null for a legacy/direct run.
    getReviewedPlanByRunId(owner, runId),
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
  // The public decision (from the shared translator's tone) drives the observed-outcome composition.
  const pub = verdict.tone === "verified" ? "verified" : verdict.tone === "failed" ? "failed" : verdict.tone === "blocked" ? "blocked" : null;
  const observed = composeObservedOutcome(pub, run.decision, run.summary, issues);
  // Drift is PROVEN only when the run's recorded contract_version differs from the loaded contract's version.
  // When it cannot be proven we make no claim that the requirements changed (only the general limitation note).
  const contractDrifted = !!contract && contractVersion != null && typeof contract.version === "number" && contract.version !== contractVersion;

  // Per-flow display metadata (readable name + screenshots) joined onto getRun's id-less flows by raw name.
  // A blocker maps to its flow's meta through the same map (v_flow_runs.name == v_issues.flow_id).
  const metaByRaw = new Map<string, FlowRunMeta>();
  for (const m of meta) if (!metaByRaw.has(m.rawName)) metaByRaw.set(m.rawName, m);
  const flowName = (f: RunFlow) => { const n = metaByRaw.get(f.name)?.displayName || f.name; return looksLikeId(n) ? "Flow" : n; };
  const shotsFor = (f: RunFlow) => metaByRaw.get(f.name)?.screenshotIds ?? [];
  const metaForIssue = (iss: RunIssue) => (iss.flow_id ? metaByRaw.get(iss.flow_id) : undefined);
  // Screenshots already shown as a finding's evidence are not repeated in the execution journey below.
  const shotsShownInFindings = new Set<string>();
  for (const iss of issues) { const m = metaForIssue(iss); if (m && m.screenshotIds.length) shotsShownInFindings.add(m.rawName); }

  const screenshotCount = meta.reduce((s, m) => s + m.screenshotIds.length, 0);
  const issueEv = (iss: RunIssue) => (iss.evidence && typeof iss.evidence === "object" ? iss.evidence : {}) as Record<string, unknown>;

  // Affected requirements: ONLY the requirement_refs the worker actually stamped on findings, resolved to the
  // CURRENT contract text and linked back to the finding that raised each. There is NO requirement->step/flow
  // coverage matrix, so none is built and a run never marks a requirement passed. Refs are deduped in stable
  // first-seen order; an unresolved ref becomes a restrained "unavailable" entry, never a raw UUID or invented
  // text.
  const reqTextById = new Map<string, string>();
  for (const r of requirements) reqTextById.set(r.id, r.requirement);
  const affected: { rid: string; text: string | null; findingIndex: number; findingId: string }[] = [];
  const seenReq = new Set<string>();
  issues.forEach((iss, idx) => {
    const refs = issueEv(iss).requirement_refs;
    if (Array.isArray(refs)) for (const r of refs) if (typeof r === "string" && !seenReq.has(r)) {
      seenReq.add(r);
      affected.push({ rid: r, text: reqTextById.get(r) ?? null, findingIndex: idx, findingId: iss.id });
    }
  });
  const affectedResolved = affected.filter((a) => a.text);
  const affectedUnavailable = affected.filter((a) => !a.text);

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

  // Immutable lineage: parent (if any) -> this record -> direct children, each a SEPARATE persisted run. Built
  // only from parent_run_id + listChildRuns (never v_repairs, never inferred ancestry), ordered chronologically
  // by real timestamps. A later child never rewrites the parent; each row shows its OWN public decision.
  type LineageNode = { runId: string; state: string; decision: string | null; iso: string; isCurrent: boolean };
  const lineage: LineageNode[] = [
    ...(parentLite ? [{ runId: parentLite.id, state: parentLite.state, decision: parentLite.decision, iso: parentLite.completed_at || parentLite.created_at, isCurrent: false }] : []),
    { runId, state: run.state, decision: run.decision, iso: run.completed_at || run.created_at, isCurrent: true },
    ...children.map((c) => ({ runId: c.id, state: c.state, decision: c.decision, iso: c.completed_at || c.created_at, isCurrent: false })),
  ].sort((a, b) => (Date.parse(a.iso) || 0) - (Date.parse(b.iso) || 0));

  // The reverification intro is scoped to the public conclusion — honest about what a reverification does and
  // does not mean. Verified frames another run as OPTIONAL; repair_verified points at full critical coverage.
  const reverifyIntro =
    pub === "failed" ? "This deployment failed verification. Rerun the failed flows to check a repair. Every reverification is a separate, immutable record."
    : run.decision === "repair_verified" ? "A full critical verification is still required before Vraelis can return Verified. Running it produces a separate, immutable record; this one is unchanged."
    : pub === "blocked" ? "Vraelis could not reach a reliable conclusion. Running again produces a separate, immutable record."
    : pub === "verified" ? "This verification passed on the tested deployment. You can run another independent verification at any time; it is not required, and it produces a separate record."
    : "";

  const deployEnvLabel = deployment?.environment ? (ENV_LABELS[deployment.environment] ?? null) : null;
  const deployProviderLabel = deployment?.provider ? (DEPLOY_PROVIDER_LABELS[deployment.provider] ?? deployment.provider) : null;
  const deployCommit = (deployment?.commit_sha ?? run.commit_sha ?? "").slice(0, 10);

  // Evidence RETAINED (owner-safe counts for the provenance ledger; the artifacts themselves stay behind the
  // signed route, never a storage path). Missing evidence is stated honestly, never read as a pass.
  const stepCount = flows.reduce((s, f) => s + f.steps.length, 0);
  const consoleCount = issues.reduce((s, iss) => s + (Array.isArray(issueEv(iss).console_errors) ? (issueEv(iss).console_errors as unknown[]).length : 0), 0);
  const networkCount = issues.reduce((s, iss) => s + (Array.isArray(issueEv(iss).network_failures) ? (issueEv(iss).network_failures as unknown[]).length : 0), 0);
  const anyEvidence = issues.length + flows.length + stepCount + screenshotCount + consoleCount + networkCount > 0;

  // Record-SPECIFIC historical limitations: only the ones that genuinely apply to this run. Never a generic
  // disclaimer wall, never undermining valid evidence.
  const limitations: string[] = ["Vraelis observed the deployed workflow, not every behavior in the application.", "Source code was not installed, modified, or necessarily inspected."];
  if (pub === "verified") limitations.push("Verified applies only to the checked workflow and claim, not the whole system.");
  if (pub === "blocked" && run.decision !== "repair_verified") limitations.push("A Blocked result is not a confirmed product failure.");
  if (run.decision === "repair_verified") limitations.push("A targeted repair check passing is not equivalent to a full critical verification.");
  if (active) limitations.push("This run is not complete, so it has no final conclusion yet.");
  if (contractVersion != null) limitations.push("Requirement text is loaded from the current contract; the exact historical wording was not snapshotted.");
  if (repairIssues.length > 0) limitations.push("Repair guidance is a suggested fix, not a proven root-cause analysis.");

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

        {/* ── 02 SUBMITTED CLAIM — the outcome this verification checked. It is contract.source_prompt (the
              SUBMITTED CLAIM behind this verification), NOT a stored guarantee object. The claim leads as plain,
              readable text (React-escaped, no HTML/Markdown, no quote marks, no chat styling); the contract
              identity + its CURRENT requirements sit beneath, labeled honestly (current, not an executed
              snapshot). Omitted cleanly with a quiet note when the claim is absent. ── */}
        {(claim || contract || requirements.length > 0) ? (
          <Section n="02" title="What had to be true" aria="Submitted claim">
            {claim ? (
              <p style={{ fontSize: "clamp(1.05rem, 1.9vw, 1.3rem)", color: "var(--fg-1)", lineHeight: 1.5, letterSpacing: "-0.005em", margin: 0, maxWidth: "60ch", wordBreak: "break-word", whiteSpace: "pre-line" }}>{claim}</p>
            ) : (
              <Empty>The original submitted claim is not available for this historical record.</Empty>
            )}
            {(contractVersion != null || requirements.length > 0) ? (
              <div style={{ marginTop: 6, display: "grid", gap: 8 }}>
                <div style={label}>{contractVersion != null ? `Current requirements for Contract v${contractVersion}` : "Current contract requirements"}</div>
                {contractDrifted ? (
                  <p style={{ fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.5, margin: 0 }}>The contract has changed since this verification. The requirements below reflect the current contract, not a historical text snapshot.</p>
                ) : requirements.length > 0 ? (
                  <p style={{ fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.5, margin: 0 }}>These are the current requirements associated with this contract. Historical requirement text was not separately snapshotted for this verification.</p>
                ) : null}
                {/* Current requirement TEXT only — no per-requirement pass mark (a current requirement is context,
                    not proof this run checked it; the requirement->finding linkage is a later increment). */}
                {requirements.filter((r) => r.enabled).length > 0 ? (
                  <ul style={{ margin: 0, padding: "0 0 0 18px", display: "grid", gap: 5, maxWidth: "68ch" }}>
                    {requirements.filter((r) => r.enabled).map((r) => (
                      <li key={r.id} style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.5, wordBreak: "break-word" }}>{r.requirement}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </Section>
        ) : null}

        {/* ── 03 OUTCOME — what ACTUALLY happened leads; the public conclusion is supporting metadata; a concise
              "why" sits beneath. Scoped to the checked workflow, never generalized to the whole system. ── */}
        <Section n="03" title="Outcome" aria="Outcome">
          {active ? (
            <p role="status" aria-live="polite" style={{ fontSize: 13.5, color: "var(--fg-4)", lineHeight: 1.55, margin: 0 }}>{runningStage(run.state)}. The conclusion is not final yet. This page updates on its own.</p>
          ) : (
            <>
              {observed ? <p style={{ fontSize: "clamp(15px, 1.7vw, 17px)", color: "var(--fg-1)", lineHeight: 1.55, margin: 0, maxWidth: "62ch", wordBreak: "break-word" }}>{observed}</p> : null}
              <div style={{ display: "flex", alignItems: "center", gap: "6px 14px", flexWrap: "wrap", ...metaText, marginTop: 2 }}>
                {hasConclusion ? <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>Conclusion <Chip tone={verdict.tone} label={verdict.label} /></span> : <span>{verdict.label}</span>}
                {summaryLine ? <span>{summaryLine}</span> : null}
              </div>
              {why ? (
                <div style={{ marginTop: 2 }}>
                  <div style={label}>Why Vraelis reached this conclusion</div>
                  <p style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.55, margin: "4px 0 0", maxWidth: "64ch", wordBreak: "break-word" }}>{why}</p>
                </div>
              ) : null}
              {run.decision === "repair_verified" ? (
                <Empty>This is a separate targeted rerun record. The earlier verification it reran remains unchanged.</Empty>
              ) : null}
              {issues.length > 1 ? <Empty>This verification recorded {issues.length} findings.</Empty> : null}
              {/* A quiet enumeration (title + severity + lineage) so no real failure is hidden and the Recurring
                  vs first-seen lineage (issue.first_seen_run) stays visible. Full per-finding evidence is later. */}
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
            </>
          )}
        </Section>

        {/* ── 04 EVIDENCE — the real proof for each finding: expected vs observed in prose, the screenshots large
              (through the signed artifacts route ONLY), reproduction steps, a possible cause, and the raw
              console/network inside a collapsed technical-details element. No storage path, session id, or raw
              failure_message ever reaches the page. ── */}
        <Section n="04" title="Evidence" aria="Evidence">
          {issues.length > 0 ? (
            <div style={{ display: "grid", gap: 14 }}>
              {issues.map((issue, i) => {
                const m = metaForIssue(issue);
                const fname = m?.displayName ?? "";
                return <FindingEvidence key={issue.id} issue={issue} index={i} flowName={fname && !looksLikeId(fname) ? fname : null} screenshotIds={m?.screenshotIds ?? []} runId={runId} />;
              })}
            </div>
          ) : (
            <Empty>{active ? "Evidence is still being collected." : screenshotCount > 0 ? `${screenshotCount} screenshot${screenshotCount === 1 ? "" : "s"} were captured; they appear in the execution journey below.` : "No evidence was captured for this verification."}</Empty>
          )}
        </Section>

        {/* ── 05 EXECUTION JOURNEY — each flow that ran, with its ORDERED step timeline (action, pass/fail, error
              detail, real per-step ms — the only real timing, never a derived wall-clock), the authenticated-flow
              panel (allowlisted owner-safe fields only), and the policy-permit line. Screenshots already shown
              as a finding's evidence are not repeated here. ── */}
        <Section n="05" title="Execution journey" aria="Execution journey">
          {flows.length === 0 ? (
            <Empty>{active ? "Waiting for the first flow to run." : "No flows were recorded for this verification."}</Empty>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {flows.map((f, i) => (
                <FlowTimeline key={`${f.name}-${i}`} flow={f} displayName={flowName(f)} screenshotIds={shotsFor(f)} runId={runId} showShots={!shotsShownInFindings.has(f.name)} />
              ))}
            </div>
          )}
        </Section>

        {/* ── 06 AFFECTED REQUIREMENTS — ONLY the requirement refs the findings actually stored, resolved to the
              CURRENT contract text and linked back to the finding that raised each. No coverage matrix, no pass
              marks; an unresolved ref becomes an honest "unavailable" entry, never a raw id or invented text. ── */}
        <Section n="06" title="Affected requirements" aria="Affected requirements">
          {affected.length === 0 ? (
            <Empty>No specific requirements were flagged by the findings on this verification.</Empty>
          ) : (
            <>
              <p style={{ fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.5, margin: 0 }}>
                {contractVersion != null ? `Current requirements for Contract v${contractVersion} that a finding referenced. ` : ""}A verification does not mark a requirement passed; these are the ones its findings pointed at.
              </p>
              {affectedResolved.length > 0 ? (
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
                  {affectedResolved.map((a) => (
                    <li key={a.rid} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", borderLeft: "2px solid var(--line-3)", paddingLeft: 12 }}>
                      <span style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.5, flex: "1 1 auto", minWidth: 0, maxWidth: "68ch", wordBreak: "break-word" }}>{a.text}</span>
                      <a href={`#finding-${a.findingId}`} style={{ fontSize: 12.5, color: "var(--acc-deep)", flex: "none", textDecoration: "none" }}>See finding {a.findingIndex + 1}</a>
                    </li>
                  ))}
                </ul>
              ) : null}
              {affectedUnavailable.length > 0 ? (
                <Empty>{affectedUnavailable.length} referenced requirement{affectedUnavailable.length === 1 ? "" : "s"} could not be resolved to current contract text. It may have been removed or renamed since this verification.</Empty>
              ) : null}
            </>
          )}
        </Section>

        {/* ── 07 REPAIR HANDOFF — the REAL per-finding repair_prompt only: instructions for a coding agent, shown
              as plain (React-escaped) text with its line breaks preserved and a copy control. Copying it changes
              nothing; Vraelis verifies a repair, it never modifies the application from this page. No apply
              action, no raw failure_message, no secret. A quiet honest fallback when there is none. ── */}
        <Section n="07" title="Repair handoff" aria="Repair handoff">
          {repairIssues.length === 0 ? (
            <Empty>No repair guidance was generated for this verification.</Empty>
          ) : (
            <>
              <p style={{ fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.5, margin: 0 }}>Each prompt describes the observed failure and the requested repair for a coding agent. Copying it does not change your application; Vraelis verifies a repair, it does not modify your code from this page.</p>
              <div style={{ display: "grid", gap: 12 }}>
                {repairIssues.map((iss) => (
                  <div key={iss.id} style={{ display: "grid", gap: 8, border: "1px solid var(--line-2)", borderRadius: "var(--r-md, 10px)", background: "var(--bg-1)", padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={label}>Repair prompt for a coding agent</div>
                        <div style={{ fontSize: 13, color: "var(--fg-2)", marginTop: 2, wordBreak: "break-word" }}>{iss.title}</div>
                      </div>
                      <CopyButton text={iss.repair_prompt as string} />
                    </div>
                    <pre style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-2)", lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word", background: "var(--bg-2)", border: "1px solid var(--line-2)", borderRadius: 8, padding: "10px 12px", maxHeight: 340, overflow: "auto" }}>{iss.repair_prompt}</pre>
                  </div>
                ))}
              </div>
            </>
          )}
        </Section>

        {/* ── 08 REVERIFICATION — a read-only CTA into the EXISTING rerun/cancel flow (the page itself never
              creates a run, reserves credit, or mutates state), plus the immutable lineage: parent -> this
              record -> children, each a SEPARATE persisted run rendered through the canonical translator. A
              later success never rewrites an earlier failure. ── */}
        <Section n="08" title="Reverification" aria="Reverification">
          {reverifyIntro ? <p style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.55, margin: 0, maxWidth: "64ch", wordBreak: "break-word" }}>{reverifyIntro}</p> : null}
          {caps.canLaunch ? (
            <div>
              {terminal ? (
                run.decision === "repair_verified"
                  ? <RerunButton appId={id} runId={runId} scope="critical" label="Run full critical verification" priceNote={rerunPriceNote} />
                  : pub === "failed" ? <RerunButton appId={id} runId={runId} scope={hasFailures ? "failed" : "all"} label="Rerun the failed flows" priceNote={rerunPriceNote} />
                  : <RerunButton appId={id} runId={runId} scope={hasFailures ? "failed" : "all"} label="Run another verification" priceNote={rerunPriceNote} />
              ) : (
                // A running verification is NOT cancelled from this read-only record. This links to the run's
                // controls in the application, where cancellation keeps its own owner-checked confirmation flow;
                // the result page itself mutates nothing.
                <Link href={`/applications/${id}`} className="btn btn--ghost" style={{ justifySelf: "start" }}>View run controls</Link>
              )}
            </div>
          ) : null}

          {/* Immutable lineage — only shown when there is a parent or a child (a lone record needs no timeline). */}
          {lineage.length > 1 ? (
            <div style={{ marginTop: 6, display: "grid", gap: 8 }}>
              <div style={label}>Verification history</div>
              <div style={{ display: "grid", gap: 6 }}>
                {lineage.map((node) => {
                  const nv = runVerdict(node.state, node.decision);
                  const inner = (
                    <>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)", flex: "none" }}>#{shortId(node.runId)}</span>
                      {node.isCurrent ? <span style={{ fontSize: 12, color: "var(--fg-3)", fontWeight: 600, flex: "none" }}>This record</span> : null}
                      <span style={{ fontSize: 12.5, color: "var(--fg-4)", flex: "1 1 auto" }} title={when(node.iso)}>{ago(node.iso)}</span>
                      <Chip tone={nv.tone} label={nv.label} />
                    </>
                  );
                  const rowStyle = { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const, border: "1px solid var(--line-2)", borderRadius: "var(--r-md, 10px)", padding: "9px 13px", background: node.isCurrent ? "var(--bg-2)" : "var(--bg-1)" };
                  return node.isCurrent
                    ? <div key={node.runId} style={{ ...rowStyle, outline: "1px solid var(--acc-line)" }}>{inner}</div>
                    : <Link key={node.runId} href={`/applications/${id}/passes/${node.runId}`} style={{ ...rowStyle, color: "inherit", textDecoration: "none" }}>{inner}</Link>;
                })}
              </div>
              <Empty>Every verification is a separate, immutable record. A later success does not overwrite an earlier failure, and a targeted repair check passing is not the same as a full Verified.</Empty>
            </div>
          ) : null}
        </Section>

        {/* ── 09 PROVENANCE & IMMUTABLE HISTORY — a compact ledger of exactly what this record IS: its identity,
              the reviewed plan / deployment / snapshot / contract it was BOUND to (pinned, never the latest),
              the evidence retained, and the honest limits of what it can conclude. "Immutable" here means Vraelis
              preserves the prior result rather than rewriting it after a repair — NOT a cryptographic claim. No
              secret, token, session id, or storage path is ever a provenance value. ── */}
        <Section n="09" title="Provenance" aria="Provenance and immutable history">
          {/* Record identity */}
          <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-md, 10px)", background: "var(--bg-1)", padding: "14px 16px", display: "grid", gap: 8 }}>
            <div style={label}>This record</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", alignItems: "center", fontSize: 12.5, color: "var(--fg-3)" }}>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)", wordBreak: "break-all", maxWidth: "100%" }} title={runId}>Verification {shortId(runId)}</span>
              <CopyButton text={runId} label="Copy id" />
              {hasConclusion ? <Chip tone={verdict.tone} label={verdict.label} /> : <span>{verdict.label}</span>}
              {contractVersion != null ? <span>Contract v{contractVersion}</span> : null}
              {run.parent_run_id ? <Link href={`/applications/${id}/passes/${run.parent_run_id}`} style={{ color: "var(--acc-deep)" }}>Parent verification →</Link> : null}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", fontSize: 12, color: "var(--fg-4)" }}>
              <span title={when(run.created_at)}>Created {when(run.created_at)}</span>
              {run.completed_at ? <span title={when(run.completed_at)}>Completed {when(run.completed_at)}</span> : active ? <span>In progress</span> : null}
            </div>
          </div>

          {/* Reviewed-plan provenance — shown ONLY when the persisted run->plan binding proves it. */}
          <div style={{ display: "grid", gap: 6 }}>
            <div style={label}>Reviewed plan</div>
            {reviewedPlan ? (
              <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-md, 10px)", background: "var(--bg-1)", padding: "12px 14px", display: "grid", gap: 6 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", alignItems: "center", fontSize: 12.5, color: "var(--fg-3)" }}>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)", wordBreak: "break-all" }} title={reviewedPlan.id}>Plan {shortId(reviewedPlan.id)}</span>
                  <CopyButton text={reviewedPlan.id} label="Copy plan id" />
                  {reviewedPlan.approvalState === "approved" ? <span style={{ color: "var(--acc-deep)", fontWeight: 600 }}>Approved</span> : <span>Pending approval</span>}
                  {reviewedPlan.approvedAt ? <span title={when(reviewedPlan.approvedAt)}>Approved {when(reviewedPlan.approvedAt)}</span> : null}
                  {reviewedPlan.approvalState === "approved" ? <span>Human review recorded</span> : null}
                </div>
                {reviewedPlan.planHash ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", alignItems: "center", fontSize: 12, color: "var(--fg-4)" }}>
                    <span style={{ fontFamily: "var(--font-mono)", wordBreak: "break-all" }} title={reviewedPlan.planHash}>Plan hash {shortId(reviewedPlan.planHash)}</span>
                    <CopyButton text={reviewedPlan.planHash} label="Copy hash" />
                  </div>
                ) : null}
                {reviewedPlan.executionState === "consumed" ? <p style={{ fontSize: 12, color: "var(--fg-4)", lineHeight: 1.5, margin: 0 }}>This verification consumed the approved reviewed plan above.</p> : null}
              </div>
            ) : (
              <Empty>Reviewed-plan provenance is not available for this historical record.</Empty>
            )}
          </div>

          {/* Tested deployment + snapshot — PINNED to the run, never the latest. */}
          <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-md, 10px)", background: "var(--bg-1)", padding: "14px 16px", display: "grid", gap: 8 }}>
            <div style={{ ...label, display: "flex", alignItems: "center", gap: 6 }}><Ic d={I.deploy} size={13} sw={2} />Tested deployment</div>
            {run.deployment_url ? <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--fg-1)", wordBreak: "break-all" }}>{run.deployment_url}</div> : null}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", fontSize: 12.5, color: "var(--fg-3)" }}>
              {deployEnvLabel ? <span className="pill" style={{ fontSize: 10 }}>{deployEnvLabel}</span> : null}
              {deployProviderLabel ? <span>Provider: {deployProviderLabel}</span> : null}
              {deployCommit ? <span>Commit {deployCommit}</span> : null}
              {deployment?.branch ? <span style={{ overflowWrap: "anywhere", minWidth: 0 }}>Branch {deployment.branch}</span> : null}
              {contextSnap ? <span>Context v{contextSnap.version}</span> : null}
              <span title={when(completedIso)}>{active ? `Started ${when(run.created_at)}` : `Executed ${when(completedIso)}`}</span>
            </div>
            {!deploymentsReady ? (
              <p style={{ fontSize: 12, color: "var(--fg-4)", lineHeight: 1.5, margin: 0 }}>Deployment identity is not recorded yet: apply <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>sql/vraelis-preflight-8-deployments.sql</span> (migration 8).</p>
            ) : pins.deploymentId && !deployment ? (
              <p style={{ fontSize: 12, color: "var(--fg-4)", lineHeight: 1.5, margin: 0 }}>The deployment recorded for this verification is no longer available. It is not replaced with a newer one.</p>
            ) : null}
            {deployment?.provider_deployment_id ? (
              <details style={{ marginTop: 2 }}>
                <summary style={{ cursor: "pointer", fontSize: 12.5, color: "var(--fg-4)", padding: "6px 0" }}>View technical details</summary>
                <div style={{ fontSize: 12.5, color: "var(--fg-3)", wordBreak: "break-all", lineHeight: 1.5, marginTop: 6 }}>Provider deployment id: {deployment.provider_deployment_id}</div>
              </details>
            ) : null}
          </div>

          {/* Contract & requirements history */}
          {contractVersion != null || contract ? (
            <div style={{ display: "grid", gap: 5 }}>
              <div style={label}>Contract history</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", fontSize: 12.5, color: "var(--fg-3)" }}>
                {contractVersion != null ? <span>Recorded for this run: Contract v{contractVersion}</span> : null}
                {contract && typeof contract.version === "number" ? <span>Current contract: v{contract.version}</span> : null}
              </div>
              <p style={{ fontSize: 12, color: "var(--fg-4)", lineHeight: 1.5, margin: 0 }}>
                {contractDrifted
                  ? "The contract has changed since this verification. The requirement text shown above is loaded from the current contract and may differ from the text associated with this historical run."
                  : "Requirement text is loaded from the current contract records; a historical requirement snapshot was not separately persisted for this verification."}
              </p>
            </div>
          ) : null}

          {/* Evidence retained */}
          <div style={{ display: "grid", gap: 5 }}>
            <div style={label}>Evidence retained</div>
            {anyEvidence ? (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", fontSize: 12.5, color: "var(--fg-3)" }}>
                  {issues.length ? <span>{issues.length} finding{issues.length === 1 ? "" : "s"}</span> : null}
                  {flows.length ? <span>{flows.length} flow{flows.length === 1 ? "" : "s"}</span> : null}
                  {stepCount ? <span>{stepCount} step{stepCount === 1 ? "" : "s"}</span> : null}
                  {screenshotCount ? <span>{screenshotCount} screenshot{screenshotCount === 1 ? "" : "s"}</span> : null}
                  {consoleCount ? <span>{consoleCount} console error{consoleCount === 1 ? "" : "s"}</span> : null}
                  {networkCount ? <span>{networkCount} network failure{networkCount === 1 ? "" : "s"}</span> : null}
                </div>
                <p style={{ fontSize: 12, color: "var(--fg-4)", margin: 0 }}>Screenshots and artifacts are accessible only through the owner-checked signed route.</p>
              </>
            ) : (
              <Empty>{active ? "Evidence is still being collected." : "No evidence was retained for this record. That does not mean the workflow passed."}</Empty>
            )}
          </div>

          {/* Historical limitations — only those relevant to this record */}
          <div style={{ display: "grid", gap: 5 }}>
            <div style={label}>What this record can and cannot conclude</div>
            <ul style={{ margin: 0, padding: "0 0 0 18px", display: "grid", gap: 4 }}>
              {limitations.map((l, i) => <li key={i} style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5, wordBreak: "break-word" }}>{l}</li>)}
            </ul>
          </div>

          <Empty>This result is preserved as a separate historical record. Later verifications do not alter this conclusion.</Empty>
          <Link href={`/applications/${id}`} className="btn btn--ghost" style={{ justifySelf: "start" }}>Back to {app?.name ?? "system"}</Link>
        </Section>
      </div>

      {active ? <AutoRefresh /> : null}
    </div>
  );
}
