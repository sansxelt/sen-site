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

type Tone = { label: string; color: string; bg: string; border: string };
const TONE_GREEN = { color: "var(--acc-deep)", bg: "var(--acc-soft)", border: "var(--acc-line)" };
const TONE_AMBER = { color: "#c2831a", bg: "rgba(194,131,26,0.08)", border: "rgba(194,131,26,0.30)" };
const TONE_RED = { color: "var(--err)", bg: "rgba(255,100,112,0.08)", border: "rgba(255,100,112,0.30)" };
const TONE_MUTED = { color: "var(--fg-4)", bg: "var(--bg-2)", border: "var(--line-2)" };

function decisionTone(decision: string | null): Tone {
  if (decision === "ready") return { label: "READY", ...TONE_GREEN };
  if (decision === "needs_review") return { label: "NEEDS REVIEW", ...TONE_AMBER };
  if (decision === "blocked") return { label: "BLOCKED", ...TONE_RED };
  return { label: "IN PROGRESS", ...TONE_MUTED };
}

// The plain reason for the decision, straight from the run summary — never a numeric score.
function reasonLine(summary: Record<string, unknown>): string {
  const ct = num(summary.critical_total), cp = num(summary.critical_passed);
  const ft = num(summary.flows_total), fp = num(summary.flows_passed);
  if (ct > 0) return `${cp} / ${ct} critical flow${ct === 1 ? "" : "s"} passed`;
  if (ft > 0) return `${fp} / ${ft} flow${ft === 1 ? "" : "s"} passed`;
  return "No flows recorded for this run yet";
}

function flowTone(state: string): Tone {
  if (state === "passed") return { label: "Passed", ...TONE_GREEN };
  if (state === "failed") return { label: "Failed", ...TONE_RED };
  if (state === "blocked") return { label: "Blocked", ...TONE_RED };
  if (state === "running") return { label: "Running", ...TONE_AMBER };
  if (state === "skipped") return { label: "Skipped", ...TONE_MUTED };
  const label = state ? state.charAt(0).toUpperCase() + state.slice(1) : "Pending";
  return { label, ...TONE_MUTED };
}

const SEV_COLOR: Record<string, string> = { critical: "var(--err)", high: "#c2831a", medium: "var(--fg-3)", low: "var(--fg-4)" };
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

const cardStyle = { padding: "clamp(18px, 2.4vw, 24px)" } as const;
const cardTitle = { fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16.5, color: "var(--fg-1)", margin: 0 } as const;
const sectionLabel = { fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", margin: "0 0 12px" } as const;

function Pill({ tone, size = 10.5 }: { tone: Tone; size?: number }) {
  return <span className="pill" style={{ fontSize: size, color: tone.color, background: tone.bg, borderColor: tone.border, flex: "none" }}>{tone.label}</span>;
}

// One launch blocker (a critical/high issue). Evidence is deterministic; POSSIBLE CAUSE is clearly marked as
// interpretation and only shown when the worker attached one.
function BlockerCard({ issue }: { issue: RunIssue }) {
  const ev = (issue.evidence && typeof issue.evidence === "object" ? issue.evidence : {}) as Record<string, unknown>;
  const consoleErrors = Array.isArray(ev.console_errors) ? (ev.console_errors as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const networkFailures = Array.isArray(ev.network_failures) ? (ev.network_failures as { method?: string; path?: string; status?: number }[]) : [];
  const requirementRefs = Array.isArray(ev.requirement_refs) ? (ev.requirement_refs as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const repro = Array.isArray(issue.repro) ? (issue.repro as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const sevColor = SEV_COLOR[issue.severity] ?? "var(--fg-3)";

  return (
    <div className="card" style={{ padding: "clamp(16px, 2.2vw, 22px)", borderLeft: `3px solid ${sevColor}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15.5, color: "var(--fg-1)", lineHeight: 1.4, flex: "1 1 260px", minWidth: 0 }}>{issue.title}</div>
        <div style={{ display: "flex", gap: 7, flex: "none" }}>
          <span className="pill" style={{ fontSize: 10.5, color: sevColor, borderColor: "var(--line-2)", background: "var(--bg-2)" }}>{SEV_LABEL[issue.severity] ?? issue.severity}</span>
          <span className="pill" style={{ fontSize: 10.5, color: "var(--fg-3)", borderColor: "var(--line-2)", background: "var(--bg-2)" }}>{catLabel(issue.category)}</span>
        </div>
      </div>

      {requirementRefs.length ? (
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)", margin: "10px 0 0" }}>
          Requirement: {requirementRefs.join(", ")}
        </p>
      ) : null}

      <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
        {issue.expected ? (
          <div>
            <div style={sectionLabel}>Expected</div>
            <p style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.5, margin: 0 }}>{issue.expected}</p>
          </div>
        ) : null}
        {issue.observed ? (
          <div>
            <div style={sectionLabel}>Observed</div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-2)", lineHeight: 1.5, margin: 0, wordBreak: "break-word" }}>{issue.observed}</p>
          </div>
        ) : null}
      </div>

      {repro.length ? (
        <div style={{ marginTop: 14 }}>
          <div style={sectionLabel}>Reproduce</div>
          <ol style={{ margin: 0, padding: "0 0 0 18px", display: "grid", gap: 4 }}>
            {repro.map((r, i) => <li key={i} style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5 }}>{r.replace(/^\d+\.\s*/, "")}</li>)}
          </ol>
        </div>
      ) : null}

      {consoleErrors.length || networkFailures.length ? (
        <div style={{ marginTop: 14, background: "var(--bg-2)", border: "1px solid var(--line-1)", borderRadius: "var(--r-sm)", padding: "11px 13px" }}>
          <div style={sectionLabel}>Console &amp; network</div>
          <div style={{ display: "grid", gap: 4 }}>
            {consoleErrors.slice(0, 5).map((c, i) => (
              <div key={`c${i}`} style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--err)", wordBreak: "break-all" }}>{c}</div>
            ))}
            {networkFailures.slice(0, 5).map((n, i) => (
              <div key={`n${i}`} style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-3)", wordBreak: "break-all" }}>
                {n.status ?? ""} {n.method ?? ""} {n.path ?? ""}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {issue.likely_cause ? (
        <div style={{ marginTop: 14, background: "rgba(194,131,26,0.06)", border: "1px dashed rgba(194,131,26,0.35)", borderRadius: "var(--r-sm)", padding: "11px 13px" }}>
          <div style={{ ...sectionLabel, color: "#c2831a", marginBottom: 6 }}>Possible cause (interpretation)</div>
          <p style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55, margin: 0 }}>{issue.likely_cause}</p>
          {typeof issue.suggested_areas === "string" && issue.suggested_areas ? (
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)", margin: "8px 0 0" }}>Look at: {issue.suggested_areas}</p>
          ) : null}
        </div>
      ) : null}

      {issue.repair_prompt ? (
        <div style={{ marginTop: 14 }}>
          <CopyButton text={issue.repair_prompt} />
        </div>
      ) : null}
    </div>
  );
}

// One flow's step timeline. Failed steps are highlighted; screenshots (if the worker attached any) load
// through the owner-checked artifacts route — never a storage path.
function FlowTimeline({ flow, displayName, screenshotIds, runId }: { flow: RunFlow; displayName: string; screenshotIds: string[]; runId: string }) {
  const tone = flowTone(flow.state);
  return (
    <div className="card" style={{ padding: "clamp(16px, 2.2vw, 22px)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)", margin: 0, minWidth: 0, wordBreak: "break-word" }}>{displayName}</h3>
        <Pill tone={tone} />
      </div>
      {flow.steps.length ? (
        <ol style={{ listStyle: "none", margin: "14px 0 0", padding: 0, display: "grid", gap: 6 }}>
          {flow.steps.map((s: RunStep, i) => {
            const ok = s.status === "ok";
            const failed = !ok && s.status != null && s.status !== "";
            return (
              <li key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px", borderRadius: "var(--r-sm)",
                background: failed ? "rgba(255,100,112,0.06)" : "var(--bg-2)",
                border: `1px solid ${failed ? "rgba(255,100,112,0.30)" : "var(--line-1)"}`,
              }}>
                <span aria-hidden style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-5)", flex: "none", marginTop: 2, width: 18, textAlign: "right" }}>{i + 1}</span>
                <span aria-hidden style={{ color: ok ? "var(--acc-deep)" : failed ? "var(--err)" : "var(--fg-4)", flex: "none", marginTop: 1, fontSize: 13 }}>{ok ? "✓" : failed ? "✕" : "•"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--fg-1)", lineHeight: 1.45, wordBreak: "break-word" }}>{stepText(s.action, s.target)}</div>
                  {failed && s.observed ? <div style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--err)", marginTop: 3, wordBreak: "break-all" }}>{s.observed}</div> : null}
                </div>
                <span style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-5)", flex: "none", marginTop: 2 }}>{s.ms != null ? `${s.ms} ms` : ""}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "12px 0 0" }}>No steps recorded for this flow.</p>
      )}

      {screenshotIds.length ? (
        <div style={{ marginTop: 14 }}>
          <div style={sectionLabel}>Screenshots</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {screenshotIds.map((sid) => (
              <a key={sid} href={`/api/preflight/runs/${runId}/artifacts/${sid}`} target="_blank" rel="noopener noreferrer" style={{ display: "block", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", overflow: "hidden", maxWidth: 240 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/preflight/runs/${runId}/artifacts/${sid}`} alt="Run screenshot" loading="lazy" style={{ display: "block", width: "100%", height: "auto" }} />
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Preflight RUN report (server component). Flag-gated + owner-scoped: getRun / getRunInternal are user-scoped,
// so a guessed run id 404s here. All data degrades to null/[] before the run tables exist, and nothing is
// fabricated — no numeric score, no fake progress, no invented metrics.
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
      <div className="wrap" style={{ maxWidth: 960, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
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
  const tone = decisionTone(run.decision);
  const terminal = run.decision != null || ["completed", "failed", "cancelled"].includes(run.state);
  const active = !terminal;
  // Header line: a terminal run shows the decision reason; an in-progress run shows real progress, never the
  // stale "No flows recorded" text once flows start landing.
  const headline = terminal
    ? reasonLine(run.summary)
    : flows.length === 0
      ? "Waiting for the first flow"
      : `${flows.length} flow${flows.length === 1 ? "" : "s"} completed, still running`;

  // Join per-flow display metadata (readable name + screenshots) onto getRun's id-less flows by raw name.
  const metaByRaw = new Map<string, FlowRunMeta>();
  for (const m of meta) if (!metaByRaw.has(m.rawName)) metaByRaw.set(m.rawName, m);
  const nameFor = (f: RunFlow) => metaByRaw.get(f.name)?.displayName || f.name;
  const shotsFor = (f: RunFlow) => metaByRaw.get(f.name)?.screenshotIds ?? [];

  const blockers = issues.filter((i) => i.severity === "critical" || i.severity === "high");
  const otherIssues = issues.filter((i) => i.severity !== "critical" && i.severity !== "high");
  const problemFlows = flows.filter((f) => f.state !== "passed");
  const passedFlows = flows.filter((f) => f.state === "passed");
  const hasFailures = problemFlows.some((f) => f.state === "failed" || f.state === "blocked") || blockers.length > 0;
  const completedIso = run.completed_at || run.created_at;

  return (
    <div className="wrap" style={{ maxWidth: 960, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, marginBottom: 16 }}>
        <Link href="/app/apps" style={{ color: "var(--fg-4)", textDecoration: "none" }}>Applications</Link>
        <span aria-hidden style={{ color: "var(--fg-5)" }}>/</span>
        <Link href={`/app/apps/${id}`} style={{ color: "var(--fg-4)", textDecoration: "none", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app?.name ?? "Application"}</Link>
        <span aria-hidden style={{ color: "var(--fg-5)" }}>/</span>
        <span style={{ color: "var(--fg-2)", fontWeight: 600 }}>Preflight run</span>
      </nav>

      <div style={{ display: "grid", gap: 14, marginTop: 10 }}>

        {/* (1) LAUNCH DECISION */}
        <div className="card" style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13, letterSpacing: "0.08em", color: tone.color, background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 999, padding: "9px 18px" }}>
              {tone.label}
            </span>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17, color: "var(--fg-1)" }}>{headline}</div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", marginTop: 14, fontSize: 12.5, color: "var(--fg-4)" }}>
            {run.deployment_url ? (
              <span>
                Target:{" "}
                <a href={run.deployment_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)", textDecoration: "none", wordBreak: "break-all" }}>{run.deployment_url}</a>
              </span>
            ) : null}
            {run.commit_sha ? <span style={{ fontFamily: "var(--font-mono)" }}>commit {run.commit_sha.slice(0, 10)}</span> : null}
            <span title={when(completedIso)}>{terminal ? `Completed ${ago(completedIso)}` : `Started ${ago(run.created_at)}`}</span>
          </div>

          {active ? (
            <p style={{ fontSize: 13, color: "var(--fg-3)", margin: "16px 0 0", lineHeight: 1.55 }}>
              This run is still in progress. Results appear here as each flow finishes.
            </p>
          ) : (
            <div style={{ marginTop: 18 }}>
              {/* (2) primary action */}
              <RerunButton appId={id} runId={runId} scope={hasFailures ? "failed" : "all"} label={hasFailures ? "Rerun failed flows" : "Run again"} />
            </div>
          )}
        </div>

        {/* (3) LAUNCH BLOCKERS */}
        {blockers.length ? (
          <div style={{ display: "grid", gap: 12 }}>
            <h2 style={{ ...cardTitle, marginTop: 6 }}>Launch blockers</h2>
            {blockers.map((iss) => <BlockerCard key={iss.id} issue={iss} />)}
          </div>
        ) : terminal && run.decision === "ready" ? (
          <div className="card" style={{ ...cardStyle, borderLeft: "3px solid var(--acc-line)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15.5, color: "var(--fg-1)", marginBottom: 4 }}>No launch blockers.</div>
            <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.55, margin: 0 }}>Every critical flow passed against this deployment.</p>
          </div>
        ) : null}

        {/* Other, lower-severity findings (kept, never hidden) */}
        {otherIssues.length ? (
          <div className="card" style={cardStyle}>
            <h2 style={cardTitle}>Other findings</h2>
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {otherIssues.map((iss) => (
                <div key={iss.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "var(--fg-2)", lineHeight: 1.45 }}>
                  <span className="pill" style={{ fontSize: 10, color: SEV_COLOR[iss.severity] ?? "var(--fg-4)", borderColor: "var(--line-2)", background: "var(--bg-2)", flex: "none" }}>{SEV_LABEL[iss.severity] ?? iss.severity}</span>
                  <span style={{ minWidth: 0, wordBreak: "break-word" }}>{iss.title}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* (4) TIMELINE: problem flows in full */}
        {problemFlows.length ? (
          <div style={{ display: "grid", gap: 12 }}>
            <h2 style={{ ...cardTitle, marginTop: 6 }}>Flow timeline</h2>
            {problemFlows.map((f, i) => <FlowTimeline key={`${f.name}-${i}`} flow={f} displayName={nameFor(f)} screenshotIds={shotsFor(f)} runId={runId} />)}
          </div>
        ) : null}

        {/* (5) PASSED flows: compact */}
        {passedFlows.length ? (
          <div className="card" style={cardStyle}>
            <h2 style={cardTitle}>Passed flows</h2>
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {passedFlows.map((f, i) => (
                <div key={`${f.name}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", border: "1px solid var(--line-1)", borderRadius: "var(--r-sm)", background: "var(--bg-1)" }}>
                  <span aria-hidden style={{ color: "var(--acc-deep)", flex: "none" }}>✓</span>
                  <span style={{ fontSize: 13, color: "var(--fg-2)", flex: 1, minWidth: 0, wordBreak: "break-word" }}>{nameFor(f)}</span>
                  <span style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-5)", flex: "none" }}>{f.steps.length} step{f.steps.length === 1 ? "" : "s"}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Empty body for an in-progress run with nothing yet */}
        {!blockers.length && !otherIssues.length && !flows.length ? (
          <div className="card" style={cardStyle}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <span className="pulse" aria-hidden style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--money)", flex: "none", marginTop: 4 }} />
              <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.55, margin: 0 }}>
                {active ? "Waiting for the first flow to run. This page updates on its own." : "This run recorded no flows."}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {active ? <AutoRefresh /> : null}
    </div>
  );
}
