import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightOwner } from "@/lib/v-preflight-guard";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { getApplication } from "@/lib/v-applications";
import { getRun, type RunFlow, type RunStep, type RunIssue } from "@/lib/preflight/runs-db";
import { getRunInternal, listFlowRunMeta, type FlowRunMeta } from "@/lib/preflight/run-report-db";
import { SetupRequired } from "../../../setup-required";
import { RerunButton } from "./rerun-button";
import { CopyButton } from "./copy-button";
import { AutoRefresh } from "./auto-refresh";

export const metadata: Metadata = { title: "Preflight run" };

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

// Decision + status tones (the shared decision palette: ready / needs_review / blocked / muted).
type Tone = { label: string; color: string; bg: string; border: string };
const TONE_READY = { color: "var(--acc-deep)", bg: "var(--acc-soft)", border: "var(--acc-line)" };
const TONE_REVIEW = { color: "#B45309", bg: "#FEF6E7", border: "#F3DFB0" };
const TONE_BLOCKED = { color: "#C0392B", bg: "#FBEBEA", border: "#F0C7C2" };
const TONE_MUTED = { color: "var(--fg-4)", bg: "var(--bg-2)", border: "var(--line-2)" };

// The verdict tone. A run with no decision that ended anyway is labeled by its real terminal state,
// never left saying IN PROGRESS.
function runTone(decision: string | null, state: string): Tone {
  if (decision === "ready") return { label: "READY", ...TONE_READY };
  if (decision === "needs_review") return { label: "NEEDS REVIEW", ...TONE_REVIEW };
  if (decision === "blocked") return { label: "BLOCKED", ...TONE_BLOCKED };
  if (state === "cancelled") return { label: "CANCELLED", ...TONE_MUTED };
  if (state === "failed") return { label: "INCOMPLETE", ...TONE_MUTED };
  return { label: "IN PROGRESS", ...TONE_MUTED };
}

function flowTone(state: string): Tone {
  if (state === "passed") return { label: "Passed", ...TONE_READY };
  if (state === "failed") return { label: "Failed", ...TONE_BLOCKED };
  if (state === "blocked") return { label: "Blocked", ...TONE_BLOCKED };
  if (state === "running") return { label: "Running", ...TONE_REVIEW };
  if (state === "skipped") return { label: "Skipped", ...TONE_MUTED };
  const label = state ? state.charAt(0).toUpperCase() + state.slice(1) : "Pending";
  return { label, ...TONE_MUTED };
}

const SEV_COLOR: Record<string, string> = { critical: "#C0392B", high: "#B45309", medium: "var(--fg-3)", low: "var(--fg-4)" };
const SEV_LABEL: Record<string, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
const CATEGORY_LABEL: Record<string, string> = {
  persistence_failure: "Persistence", session_failure: "Session", cross_account: "Authorization",
  fake_success: "Fake success", stale_ui: "Stale UI", duplicate_action: "Duplicate action",
  authorization_failure: "Authorization", mobile_blocker: "Mobile", navigation_failure: "Navigation", functional_failure: "Functional",
};
function catLabel(c: string | null): string { return c ? (CATEGORY_LABEL[c] ?? c.replace(/_/g, " ")) : "Issue"; }

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

// Coarse, owner-safe failure codes (worker/preflight/provider-errors.ts) told as user sentences. An unknown
// or absent code keeps the generic line; a raw provider message never reaches this page. The "nothing was
// charged" claim is safe for these codes: they are thrown at session creation, before any flow ran, and the
// worker refunds the full hold on a terminal failure where no flow executed.
const FAILURE_LINE: Record<string, string> = {
  provider_auth_failed: "Browser provider authorization failed. Nothing was charged for flows that never ran.",
  provider_quota: "The browser usage allowance was exhausted. Nothing was charged for flows that never ran.",
  provider_capacity: "Browser capacity was unavailable. Nothing was charged for flows that never ran.",
  provider_unavailable: "The browser provider had an outage. Nothing was charged for flows that never ran.",
  infra_misconfigured: "The run infrastructure was misconfigured. This was on our side, not your deployment.",
  session_timeout: "The browser session timed out before the run could finish.",
  target_mismatch: "The run harness did not honor this run's target URL, so the result was invalidated. This was on our side, not your deployment. Nothing was charged.",
  flow_selection_invalid: "This run's flow selection was missing or invalid, so no browser was started. This was on our side, not your deployment. Nothing was charged.",
};

// The plain-English verdict sentence under the big decision word. Counts come straight from the run
// summary (or the deterministic issues) — nothing invented.
function verdictLine(decision: string | null, state: string, summary: Record<string, unknown>, criticalIssueCount: number, terminal: boolean, progress: string, failureCode: string | null): string {
  if (decision === "ready") return "Every critical flow held. This deployment is cleared to launch.";
  if (decision === "needs_review") return "Nearly there. A non-critical flow needs a human call.";
  if (decision === "blocked") {
    const n = Math.max(0, num(summary.critical_total) - num(summary.critical_passed)) || criticalIssueCount;
    return n > 0
      ? `This deployment is not ready. ${n} critical flow${n === 1 ? "" : "s"} failed.`
      : "This deployment is not ready.";
  }
  if (terminal) {
    if (state === "cancelled") return "This run was cancelled before it finished.";
    if (state === "failed") return (failureCode && FAILURE_LINE[failureCode]) || "This run stopped before it reached a decision.";
    return "This run finished without a launch decision.";
  }
  return progress;
}

// Quiet context line: "1 of 3 critical flows passed". Null when nothing has been recorded.
function flowsSummary(summary: Record<string, unknown>): string | null {
  const ct = num(summary.critical_total), cp = num(summary.critical_passed);
  const ft = num(summary.flows_total), fp = num(summary.flows_passed);
  if (ct > 0) return `${cp} of ${ct} critical flow${ct === 1 ? "" : "s"} passed`;
  if (ft > 0) return `${fp} of ${ft} flow${ft === 1 ? "" : "s"} passed`;
  return null;
}

// A human "what happened" sentence for a blocker, derived from the failed step the deterministic
// evidence already points at. The raw technical detail string stays inside the technical details element.
function humanObserved(issue: RunIssue): string {
  const ev = (issue.evidence && typeof issue.evidence === "object" ? issue.evidence : {}) as Record<string, unknown>;
  const repro = Array.isArray(issue.repro) ? (issue.repro as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const idx = typeof ev.failed_step_index === "number" ? ev.failed_step_index : -1;
  const stepLine = idx >= 0 && typeof repro[idx] === "string" ? repro[idx].replace(/^\d+\.\s*/, "").trim() : "";
  if (stepLine) return `The flow stopped at step ${idx + 1}: "${stepLine}".`;
  const action = typeof ev.failed_action === "string" && ev.failed_action && ev.failed_action !== "unknown" ? ev.failed_action.replace(/_/g, " ") : "";
  if (action) return `The flow stopped at the "${action}" step.`;
  return "The flow did not complete.";
}

// v_flow_runs.name falls back to the test flow id when the contract name could not be resolved; never
// put an id in a sentence.
function looksLikeId(name: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name.trim()); }

const labelStyle = { fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", margin: 0 } as const;
const techLine = { fontSize: 12.5, color: "var(--fg-3)", wordBreak: "break-all", lineHeight: 1.5 } as const;
const sectionHeading = { fontFamily: "var(--font-display)", fontWeight: 650, fontSize: "clamp(1.3rem, 2.4vw, 1.65rem)", color: "var(--fg-1)", margin: 0 } as const;
const quietHeading = { fontFamily: "var(--font-display)", fontWeight: 650, fontSize: "clamp(1.05rem, 1.8vw, 1.25rem)", color: "var(--fg-1)", margin: 0 } as const;

function Pill({ tone, size = 10.5 }: { tone: Tone; size?: number }) {
  return <span className="pill" style={{ fontSize: size, color: tone.color, background: tone.bg, borderColor: tone.border, flex: "none" }}>{tone.label}</span>;
}

// Evidence screenshots, large. Every image loads through the owner-checked artifacts route — never a
// storage path — and links to the same route full-size.
function ScreenshotGrid({ runId, ids, min = 320 }: { runId: string; ids: string[]; min?: number }) {
  if (!ids.length) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`, gap: 14 }}>
      {ids.map((sid) => (
        <figure key={sid} style={{ margin: 0, minWidth: 0 }}>
          <a href={`/api/preflight/runs/${runId}/artifacts/${sid}`} target="_blank" rel="noopener noreferrer" style={{ display: "block" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/preflight/runs/${runId}/artifacts/${sid}`} alt="Screenshot from this run" loading="lazy" style={{ display: "block", width: "100%", maxWidth: "100%", height: "auto", border: "1px solid var(--line-2)", borderRadius: 10 }} />
          </a>
          <figcaption style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 6 }}>Screenshot from this run</figcaption>
        </figure>
      ))}
    </div>
  );
}

// One launch blocker told as a full story: plain-English title, what Vraelis did, expected vs observed
// in prose, the evidence large, how to reproduce, the repair prompt. Raw technical strings (the observed
// detail, console errors, network failures) live ONLY inside the collapsed technical details element.
function BlockerStory({ issue, index, flowName, screenshotIds, runId }: { issue: RunIssue; index: number; flowName: string | null; screenshotIds: string[]; runId: string }) {
  const ev = (issue.evidence && typeof issue.evidence === "object" ? issue.evidence : {}) as Record<string, unknown>;
  const consoleErrors = Array.isArray(ev.console_errors) ? (ev.console_errors as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const networkFailures = Array.isArray(ev.network_failures) ? (ev.network_failures as { method?: string; path?: string; status?: number }[]) : [];
  const requirementRefs = Array.isArray(ev.requirement_refs) ? (ev.requirement_refs as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const repro = Array.isArray(issue.repro) ? (issue.repro as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const sevColor = SEV_COLOR[issue.severity] ?? "var(--fg-3)";
  const expected = (issue.expected ?? "").replace(/^Expected:\s*/i, "").trim();
  const observed = humanObserved(issue);
  const hasTechnical = Boolean(issue.observed) || consoleErrors.length > 0 || networkFailures.length > 0 || requirementRefs.length > 0;

  return (
    <section className="card" style={{ padding: "clamp(22px, 3vw, 32px)", borderLeft: `4px solid ${sevColor}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 650, fontSize: "clamp(19px, 2vw, 21px)", lineHeight: 1.35, color: "var(--fg-1)", margin: 0, flex: "1 1 300px", minWidth: 0, wordBreak: "break-word" }}>
          {index + 1}. {issue.title}
        </h3>
        <div style={{ display: "flex", gap: 7, flex: "none" }}>
          <span className="pill" style={{ fontSize: 10.5, color: sevColor, borderColor: "var(--line-2)", background: "var(--bg-2)" }}>{SEV_LABEL[issue.severity] ?? issue.severity}</span>
          <span className="pill" style={{ fontSize: 10.5, color: "var(--fg-3)", borderColor: "var(--line-2)", background: "var(--bg-2)" }}>{catLabel(issue.category)}</span>
        </div>
      </div>

      {flowName ? (
        <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.5, margin: "8px 0 0" }}>
          Vraelis hit this while running the &quot;{flowName}&quot; flow in a real browser.
        </p>
      ) : null}

      <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
        {expected ? (
          <div>
            <div style={labelStyle}>Expected</div>
            <p style={{ fontSize: 14.5, color: "var(--fg-2)", lineHeight: 1.55, margin: "5px 0 0" }}>{expected}</p>
          </div>
        ) : null}
        <div>
          <div style={labelStyle}>Observed</div>
          <p style={{ fontSize: 14.5, color: "var(--fg-2)", lineHeight: 1.55, margin: "5px 0 0" }}>{observed}</p>
        </div>
      </div>

      {screenshotIds.length ? (
        <div style={{ marginTop: 20 }}>
          <div style={labelStyle}>Evidence</div>
          <div style={{ marginTop: 8 }}>
            <ScreenshotGrid runId={runId} ids={screenshotIds} />
          </div>
        </div>
      ) : null}

      {repro.length ? (
        <div style={{ marginTop: 20 }}>
          <div style={labelStyle}>How to reproduce</div>
          <ol style={{ margin: "8px 0 0", padding: "0 0 0 18px", display: "grid", gap: 5 }}>
            {repro.map((r, i) => <li key={i} style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.5 }}>{r.replace(/^\d+\.\s*/, "")}</li>)}
          </ol>
        </div>
      ) : null}

      {issue.likely_cause ? (
        <div style={{ marginTop: 20, borderLeft: "3px solid var(--line-2)", paddingLeft: 14 }}>
          <div style={labelStyle}>Possible cause (interpretation)</div>
          <p style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.55, margin: "6px 0 0" }}>{issue.likely_cause}</p>
          {typeof issue.suggested_areas === "string" && issue.suggested_areas ? (
            <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "6px 0 0", wordBreak: "break-word" }}>Look at: {issue.suggested_areas}</p>
          ) : null}
        </div>
      ) : null}

      {issue.repair_prompt ? (
        <div style={{ marginTop: 20 }}>
          <CopyButton text={issue.repair_prompt} />
        </div>
      ) : null}

      {hasTechnical ? (
        <details style={{ marginTop: 18, border: "1px solid var(--line-1)", borderRadius: 8, padding: "10px 14px" }}>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--fg-4)" }}>View technical details</summary>
          <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
            {issue.observed ? <div style={techLine}>{issue.observed}</div> : null}
            {requirementRefs.length ? <div style={techLine}>Requirement refs: {requirementRefs.join(", ")}</div> : null}
            {consoleErrors.slice(0, 10).map((c, i) => <div key={`c${i}`} style={techLine}>{c}</div>)}
            {networkFailures.slice(0, 10).map((n, i) => (
              <div key={`n${i}`} style={techLine}>{n.status ?? ""} {n.method ?? ""} {n.path ?? ""}</div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

// One flow in the "What ran" timeline: a flat row with name + status + step count, the full step list
// inside a details element (open only when the flow failed). Screenshots render here only when they were
// not already shown as evidence on a blocker above.
function FlowBlock({ flow, displayName, screenshotIds, runId, showShots }: { flow: RunFlow; displayName: string; screenshotIds: string[]; runId: string; showShots: boolean }) {
  const tone = flowTone(flow.state);
  const failed = flow.state === "failed" || flow.state === "blocked";
  const passed = flow.state === "passed";
  return (
    <div style={{ border: "1px solid var(--line-1)", borderRadius: "var(--r-md)", background: "var(--bg-1)", padding: "12px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {passed ? <span aria-hidden style={{ color: "var(--acc-deep)", flex: "none" }}>✓</span> : null}
        <span style={{ fontSize: 13.5, fontWeight: failed ? 600 : 500, color: failed ? "var(--fg-1)" : "var(--fg-2)", flex: "1 1 auto", minWidth: 0, wordBreak: "break-word" }}>{displayName}</span>
        <Pill tone={tone} />
        <span style={{ fontSize: 12, color: "var(--fg-5)", flex: "none" }}>{flow.steps.length} step{flow.steps.length === 1 ? "" : "s"}</span>
      </div>

      {flow.steps.length ? (
        <details open={failed} style={{ marginTop: 8 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--fg-4)" }}>View steps</summary>
          <ol style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 6 }}>
            {flow.steps.map((s: RunStep, i) => {
              const ok = s.status === "ok";
              const stepFailed = !ok && s.status != null && s.status !== "";
              return (
                <li key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px", borderRadius: "var(--r-sm)",
                  background: stepFailed ? "#FBEBEA" : "var(--bg-2)",
                  border: `1px solid ${stepFailed ? "#F0C7C2" : "var(--line-1)"}`,
                }}>
                  <span aria-hidden style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-5)", flex: "none", marginTop: 2, width: 18, textAlign: "right" }}>{i + 1}</span>
                  <span aria-hidden style={{ color: ok ? "var(--acc-deep)" : stepFailed ? "#C0392B" : "var(--fg-4)", flex: "none", marginTop: 1, fontSize: 13 }}>{ok ? "✓" : stepFailed ? "✕" : "•"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "var(--fg-1)", lineHeight: 1.45, wordBreak: "break-word" }}>{stepText(s.action, s.target)}</div>
                    {stepFailed && s.observed ? (
                      <details style={{ marginTop: 4 }}>
                        <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--fg-4)" }}>Error detail</summary>
                        <div style={{ fontSize: 12, color: "var(--fg-3)", wordBreak: "break-all", lineHeight: 1.5, marginTop: 4 }}>{s.observed}</div>
                      </details>
                    ) : null}
                  </div>
                  <span style={{ fontSize: 11, color: "var(--fg-5)", flex: "none", marginTop: 2 }}>{s.ms != null ? `${s.ms} ms` : ""}</span>
                </li>
              );
            })}
          </ol>
        </details>
      ) : (
        <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "8px 0 0" }}>No steps recorded for this flow.</p>
      )}

      {showShots && screenshotIds.length ? (
        <div style={{ marginTop: 12 }}>
          <div style={labelStyle}>Evidence</div>
          <div style={{ marginTop: 8 }}>
            <ScreenshotGrid runId={runId} ids={screenshotIds} min={280} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Preflight RUN report (server component). Flag-gated + owner-scoped: getRun / getRunInternal are user-scoped,
// so a guessed run id 404s here. All data degrades to null/[] before the run tables exist, and nothing is
// fabricated — no numeric score, no fake progress, no invented metrics. Reads as a production investigation
// report: verdict hero first, launch blockers as full stories with the evidence large, then a quiet timeline.
export default async function RunReportPage({ params }: { params: Promise<{ id: string; runId: string }> }) {
  const { id, runId } = await params;
  const owner = await requirePreflightOwner(`/app/apps/${id}/runs/${runId}`);
  if (!(await preflightDbReady())) return <SetupRequired />;

  const [detail, internal, app, meta] = await Promise.all([
    getRun(owner, runId), getRunInternal(owner, runId), getApplication(owner, id), listFlowRunMeta(owner, runId),
  ]);

  // Not owned / not found, or the run belongs to a different application than the URL claims.
  if (!detail || !internal || internal.applicationId !== id) {
    return (
      <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
        <div className="empty">
          <div className="empty__icon">∅</div>
          <h3>Run not found</h3>
          <p>This preflight run doesn&apos;t exist, or it belongs to another account.</p>
          <Link href={`/app/apps/${id}`} className="btn">Back to application</Link>
        </div>
      </div>
    );
  }

  const { run, flows, issues } = detail;
  const tone = runTone(run.decision, run.state);
  const terminal = run.decision != null || ["completed", "failed", "cancelled"].includes(run.state);
  const active = !terminal;
  const progressHeadline = flows.length === 0
    ? "Waiting for the first flow"
    : `${flows.length} flow${flows.length === 1 ? "" : "s"} completed, still running`;

  // Join per-flow display metadata (readable name + screenshots) onto getRun's id-less flows by raw name.
  // rawName is v_flow_runs.name, which the worker sets to the test flow id — the same id v_issues.flow_id
  // carries — so a blocker maps to its flow's meta (name + screenshots) through the same map.
  const metaByRaw = new Map<string, FlowRunMeta>();
  for (const m of meta) if (!metaByRaw.has(m.rawName)) metaByRaw.set(m.rawName, m);
  const nameFor = (f: RunFlow) => metaByRaw.get(f.name)?.displayName || f.name;
  const shotsFor = (f: RunFlow) => metaByRaw.get(f.name)?.screenshotIds ?? [];
  const metaForIssue = (iss: RunIssue) => (iss.flow_id ? metaByRaw.get(iss.flow_id) : undefined);

  const blockers = issues.filter((i) => i.severity === "critical" || i.severity === "high");
  const otherIssues = issues.filter((i) => i.severity !== "critical" && i.severity !== "high");
  const criticalIssueCount = issues.filter((i) => i.severity === "critical").length;
  const hasFailures = flows.some((f) => f.state === "failed" || f.state === "blocked") || blockers.length > 0;
  const completedIso = run.completed_at || run.created_at;
  const heroLine = verdictLine(run.decision, run.state, run.summary, criticalIssueCount, terminal, progressHeadline, run.failure_code);
  const summaryLine = flowsSummary(run.summary);

  // Flows whose screenshots already appear as evidence on a blocker above; the timeline does not repeat them.
  // A blocker that cannot be mapped to a flow shows no screenshots itself — that flow's screenshots stay in
  // the timeline instead. Never fabricated either way.
  const shotsShownInBlockers = new Set<string>();
  for (const b of blockers) {
    const m = metaForIssue(b);
    if (m && m.screenshotIds.length) shotsShownInBlockers.add(m.rawName);
  }

  return (
    <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, marginBottom: 16 }}>
        <Link href="/app/apps" style={{ color: "var(--fg-4)", textDecoration: "none" }}>Applications</Link>
        <span aria-hidden style={{ color: "var(--fg-5)" }}>/</span>
        <Link href={`/app/apps/${id}`} style={{ color: "var(--fg-4)", textDecoration: "none", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app?.name ?? "Application"}</Link>
        <span aria-hidden style={{ color: "var(--fg-5)" }}>/</span>
        <span style={{ color: "var(--fg-2)", fontWeight: 600 }}>Preflight run</span>
      </nav>

      <div style={{ display: "grid", gap: "clamp(26px, 3.5vw, 38px)", marginTop: 10 }}>

        {/* (1) VERDICT HERO: the launch decision, full width, in the decision tone */}
        <section style={{ background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: "var(--r-lg)", padding: "clamp(28px, 4vw, 44px)" }}>
          <div style={labelStyle}>Launch decision</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(2.2rem, 4.5vw, 3.2rem)", lineHeight: 1.05, letterSpacing: "-0.01em", color: tone.color, marginTop: 10 }}>
            {tone.label}
          </div>
          <p style={{ fontSize: 16.5, color: "var(--fg-1)", lineHeight: 1.55, margin: "14px 0 0", maxWidth: "58ch" }}>{heroLine}</p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", marginTop: 18, fontSize: 13, color: "var(--fg-3)" }}>
            {run.deployment_url ? (
              <a href={run.deployment_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--fg-2)", textDecoration: "none", wordBreak: "break-all" }}>{run.deployment_url}</a>
            ) : null}
            {run.commit_sha ? <span>commit {run.commit_sha.slice(0, 10)}</span> : null}
            <span title={when(completedIso)}>{terminal ? `Completed ${ago(completedIso)}` : `Started ${ago(run.created_at)}`}</span>
            {run.parent_run_id && run.selected_flow_ids?.length ? (
              <span>Targeted rerun: {run.selected_flow_ids.length} flow{run.selected_flow_ids.length === 1 ? "" : "s"} selected</span>
            ) : null}
            {summaryLine ? <span>{summaryLine}</span> : null}
            {active ? <span>Updates automatically</span> : null}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 22 }}>
            {terminal ? (
              <RerunButton appId={id} runId={runId} scope={hasFailures ? "failed" : "all"} label={hasFailures ? "Rerun failed flows" : "Run again"} />
            ) : null}
            <Link href={`/app/apps/${id}`} className="btn btn--ghost">Back to application</Link>
          </div>
        </section>

        {/* (2) LAUNCH BLOCKERS as full stories, evidence large */}
        {blockers.length ? (
          <section style={{ display: "grid", gap: 16 }}>
            <h2 style={sectionHeading}>{blockers.length} launch blocker{blockers.length === 1 ? "" : "s"}</h2>
            {blockers.map((iss, i) => {
              const m = metaForIssue(iss);
              const rawFlowName = m?.displayName ?? "";
              return (
                <BlockerStory
                  key={iss.id}
                  issue={iss}
                  index={i}
                  flowName={rawFlowName && !looksLikeId(rawFlowName) ? rawFlowName : null}
                  screenshotIds={m?.screenshotIds ?? []}
                  runId={runId}
                />
              );
            })}
          </section>
        ) : terminal && run.decision === "ready" ? (
          <div style={{ border: "1px solid var(--line-1)", borderLeft: "4px solid var(--acc-line)", borderRadius: "var(--r-md)", background: "var(--bg-1)", padding: "16px 20px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)" }}>No launch blockers</div>
            <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.55, margin: "4px 0 0" }}>Every critical flow passed against this deployment.</p>
          </div>
        ) : null}

        {/* Lower-severity findings (kept, never hidden) */}
        {otherIssues.length ? (
          <section style={{ borderTop: "1px solid var(--line-1)", paddingTop: 22 }}>
            <h2 style={quietHeading}>Other findings</h2>
            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              {otherIssues.map((iss) => (
                <div key={iss.id} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span className="pill" style={{ fontSize: 10, color: SEV_COLOR[iss.severity] ?? "var(--fg-4)", borderColor: "var(--line-2)", background: "var(--bg-2)", flex: "none" }}>{SEV_LABEL[iss.severity] ?? iss.severity}</span>
                  <span style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.5, minWidth: 0, wordBreak: "break-word" }}>{iss.title}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* (3) WHAT RAN: the quiet flow timeline */}
        {flows.length ? (
          <section style={{ borderTop: "1px solid var(--line-1)", paddingTop: 22, display: "grid", gap: 12 }}>
            <h2 style={quietHeading}>What ran</h2>
            {flows.map((f, i) => (
              <FlowBlock
                key={`${f.name}-${i}`}
                flow={f}
                displayName={nameFor(f)}
                screenshotIds={shotsFor(f)}
                runId={runId}
                showShots={!shotsShownInBlockers.has(f.name)}
              />
            ))}
          </section>
        ) : null}

        {/* (4) Empty body for an in-progress run with nothing yet */}
        {!blockers.length && !otherIssues.length && !flows.length ? (
          <div style={{ border: "1px solid var(--line-1)", borderRadius: "var(--r-md)", background: "var(--bg-1)", padding: "18px 20px", display: "flex", alignItems: "flex-start", gap: 14 }}>
            <span className="pulse" aria-hidden style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--acc)", flex: "none", marginTop: 4 }} />
            <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.55, margin: 0 }}>
              {active ? "Waiting for the first flow to run. This page updates on its own." : "This run recorded no flows."}
            </p>
          </div>
        ) : null}
      </div>

      {active ? <AutoRefresh /> : null}
    </div>
  );
}
