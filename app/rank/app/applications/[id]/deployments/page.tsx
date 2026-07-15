import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightAppAccess } from "@/lib/v-preflight-guard";
import { capabilities } from "@/lib/preflight/role-capabilities";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { SetupRequired } from "../../setup-required";
import { getApplication, type RunSummary } from "@/lib/v-applications";
import { listRunsForApp } from "@/lib/preflight/runs-db";
import { getSetupExtras, sourceConnectionsByApp, describeSource } from "@/lib/preflight/setup-read";
import {
  deploymentStoreReady, listDeployments, compareDeployments, runTestedDeployment,
  type Deployment,
} from "@/lib/preflight/deployments-db";
import { AppTabs } from "../app-tabs";
import { RecordDeploymentForm } from "./record-deployment";
import { I, Ic, EmptyIcon, DecisionMark } from "@/app/rank/_components/icons";

export const metadata: Metadata = { title: "Deployments" };

const ENV_LABELS: Record<string, string> = { preview: "Preview", staging: "Staging", production: "Production" };
const SOURCE_LABELS: Record<string, string> = { manual: "Recorded manually", github_webhook: "GitHub webhook", vercel_webhook: "Vercel webhook" };
const headLbl = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--fg-4)" };

// Stable UTC render (used as a hover title): "2026-07-02 14:31 UTC".
function when(iso: string | null | undefined): string {
  if (!iso) return "";
  try { return new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC"; } catch { return ""; }
}

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

type Pill = { label: string; color: string; bg: string; border: string };

// Decision AND text carry the status together (never colour alone).
function verdictPill(decision: string | null, state: string): Pill {
  if (decision === "ready") return { label: "Ready to ship", color: "var(--acc-deep)", bg: "var(--acc-soft)", border: "var(--acc-line)" };
  if (decision === "repair_verified") return { label: "Repair verified", color: "var(--acc-deep)", bg: "var(--acc-soft)", border: "var(--acc-line)" };
  if (decision === "needs_review") return { label: "Needs review", color: "#B45309", bg: "#FEF6E7", border: "#F3DFB0" };
  if (decision === "blocked") return { label: "Blocked", color: "#C0392B", bg: "#FBEBEA", border: "#F0C7C2" };
  const active = state === "queued" || state === "discovering" || state === "running" || state === "analyzing";
  return { label: active ? "In progress" : "No decision", color: "var(--fg-4)", bg: "var(--bg-2)", border: "var(--line-2)" };
}

type DeploymentGroup = { url: string; latest: RunSummary; passCount: number };

// Group runs by the deployment URL they ran against. Runs arrive newest-first, so the first run seen for
// a URL is its latest verdict.
function groupByDeployment(runs: RunSummary[]): DeploymentGroup[] {
  const groups = new Map<string, DeploymentGroup>();
  for (const r of runs) {
    if (!r.deployment_url) continue;
    const g = groups.get(r.deployment_url);
    if (g) g.passCount += 1;
    else groups.set(r.deployment_url, { url: r.deployment_url, latest: r, passCount: 1 });
  }
  return Array.from(groups.values());
}

function DeploymentRow({ appId, g }: { appId: string; g: DeploymentGroup }) {
  const p = verdictPill(g.latest.decision, g.latest.state);
  return (
    <Link href={`/applications/${appId}/passes/${g.latest.id}`}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", background: "var(--bg-1)", textDecoration: "none" }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-1)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {g.url}
        </div>
        <div style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 3 }}>
          {g.passCount} pass{g.passCount === 1 ? "" : "es"}, latest {timeAgo(g.latest.created_at)}
          {g.latest.commit_sha ? `, commit ${g.latest.commit_sha.slice(0, 10)}` : ""}
        </div>
      </div>
      <span className="pill" style={{ fontSize: 10.5, color: p.color, background: p.bg, borderColor: p.border, flex: "none" }}><DecisionMark decision={g.latest.decision} />{p.label}</span>
      <span aria-hidden style={{ color: "var(--fg-5)", flex: "none", fontSize: 13 }}>→</span>
    </Link>
  );
}

// Deployments seen by this app's Production Passes, one row per URL with its latest verdict. Owner-gated
// server component; every read degrades to an empty state, so nothing here is ever fabricated.
export default async function AppDeploymentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requirePreflightAppAccess(id, "/applications/" + id);
  const owner = access?.owner ?? "";
  const caps = capabilities(access?.role);
  if (!(await preflightDbReady())) return <SetupRequired />;

  const app = await getApplication(owner, id);
  if (!app) {
    return (
      <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
        <div className="empty">
          <EmptyIcon d={I.slash} />
          <h3>Application not found</h3>
          <p>This application doesn&apos;t exist, or it belongs to another account.</p>
          <Link href="/applications" className="btn">Back to applications</Link>
        </div>
      </div>
    );
  }

  // Runs + setup extras + the source connection line + recorded deployment identities (S4), all
  // owner-scoped and degrade-to-empty. deploymentStoreReady keeps "nothing recorded yet" and
  // "migration 8 not applied yet" honestly distinct states.
  const [runs, extras, sourceMap, deploymentsReady] = await Promise.all([
    listRunsForApp(owner, id, 50),
    getSetupExtras(owner, id),
    sourceConnectionsByApp(owner, [id]),
    deploymentStoreReady(owner),
  ]);
  const recorded: Deployment[] = deploymentsReady ? await listDeployments(owner, id, 20) : [];
  const groups = groupByDeployment(runs);
  const envLabel = extras.environment ? ENV_LABELS[extras.environment] : null;
  const sourceLine = describeSource(sourceMap.get(id));

  // The last verified deployment: the newest COMPLETED pass that recorded both a decision and the
  // deployment URL it tested. Real rows only; absent before the first completed pass.
  const lastVerified = runs.find((r) => r.state === "completed" && r.decision && r.deployment_url) ?? null;
  const lv = lastVerified ? verdictPill(lastVerified.decision, lastVerified.state) : null;

  // Verification status of a RECORDED deployment: the newest completed decided pass that tested this
  // identity (URL match; commits must agree only when both sides recorded one). Never invented.
  const verifyingRun = (d: Deployment): RunSummary | null =>
    runs.find((r) => r.state === "completed" && !!r.decision && runTestedDeployment(r, d)) ?? null;

  // Deployment comparison (S4): previous VERIFIED (the newest older row a decided pass actually
  // tested; honest fallback to the plain previous row) against the current (newest) recorded one.
  const current = recorded[0] ?? null;
  const previous = recorded.length >= 2
    ? (recorded.slice(1).find((d) => verifyingRun(d)) ?? recorded[1])
    : null;
  const currentRun = current ? verifyingRun(current) : null;
  const previousRun = previous ? verifyingRun(previous) : null;
  const comparisonLines = current && previous ? compareDeployments(previous, current) : [];

  return (
    <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, marginBottom: 14 }}>
        <Link href="/applications" style={{ color: "var(--fg-4)", textDecoration: "none" }}>Applications</Link>
        <span aria-hidden style={{ color: "var(--fg-5)" }}>/</span>
        <span style={{ color: "var(--fg-2)", fontWeight: 600, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.name}</span>
      </nav>

      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", margin: "6px 0 10px" }}>{app.name}</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <a href={app.app_url} target="_blank" rel="noopener noreferrer"
          style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-4)", textDecoration: "none", wordBreak: "break-all" }}>
          {app.app_url}
        </a>
        {envLabel ? <span className="pill" style={{ fontSize: 10.5 }}>{envLabel}</span> : null}
      </div>

      <AppTabs appId={id} active="deployments" />

      {/* ── Migration-8 notice: deployment identity not active yet (honest, one line, full width) ──── */}
      {!deploymentsReady ? (
        <div role="status" style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 16px", border: "1px solid var(--line-2)", borderLeft: "3px solid #F3DFB0", borderRadius: "var(--r-sm)", background: "var(--bg-1)", marginBottom: 20 }}>
          <span style={{ color: "#B45309", flex: "none", marginTop: 1 }}><Ic d={I.alert} size={17} sw={1.8} /></span>
          <p style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.6, margin: 0 }}>
            Deployment identity is not active yet: apply <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>sql/vraelis-preflight-8-deployments.sql</span> (migration 8).
            Nothing is lost; the pass history below still shows every URL your passes tested.
          </p>
        </div>
      ) : null}

      {lastVerified && lv ? (
        <div className="card" style={{ padding: "clamp(16px, 2.2vw, 22px)", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" }}>
              Last verified deployment
            </div>
            <span className="pill" style={{ fontSize: 10.5, color: lv.color, background: lv.bg, borderColor: lv.border, flex: "none" }}><DecisionMark decision={lastVerified.decision} />{lv.label}</span>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 13.5, fontWeight: 600, color: "var(--fg-1)", marginTop: 10, wordBreak: "break-all" }}>
            {lastVerified.deployment_url}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 6 }}>
            <span title={when(lastVerified.completed_at ?? lastVerified.created_at)}>Completed {timeAgo(lastVerified.completed_at ?? lastVerified.created_at)}</span>
            {lastVerified.commit_sha ? `, commit ${lastVerified.commit_sha.slice(0, 10)}` : ""}
            {envLabel ? `, ${envLabel.toLowerCase()} environment` : ""}
          </div>
          {sourceLine ? (
            <div style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 4 }}>
              Source: <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>{sourceLine}</span>
            </div>
          ) : null}
          <div style={{ marginTop: 12 }}>
            <Link href={`/applications/${id}/passes/${lastVerified.id}`}
              style={{ fontSize: 13, fontWeight: 600, color: "var(--acc-deep)", textDecoration: "none" }}>
              View pass report →
            </Link>
          </div>
        </div>
      ) : null}

      {/* ── Deployment comparison (S4): previous verified against the current recorded deployment ──── */}
      {current && previous ? (
        <div className="card" style={{ padding: "clamp(16px, 2.2vw, 22px)", marginBottom: 14 }}>
          <div style={headLbl}>Deployment comparison</div>
          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--fg-4)", flex: "none", width: 128 }}>{previousRun ? "Previous verified" : "Previous"}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-2)", minWidth: 0, wordBreak: "break-all", flex: "1 1 240px" }}>{previous.url}</span>
              {previousRun ? (() => { const p = verdictPill(previousRun.decision, previousRun.state); return (
                <span className="pill" style={{ fontSize: 10.5, color: p.color, background: p.bg, borderColor: p.border, flex: "none" }}><DecisionMark decision={previousRun.decision} />{p.label}</span>
              ); })() : (
                <span className="pill" style={{ fontSize: 10.5, color: "var(--fg-4)", background: "var(--bg-2)", borderColor: "var(--line-2)", flex: "none" }}>Not tested</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--fg-4)", flex: "none", width: 128 }}>Current</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 600, color: "var(--fg-1)", minWidth: 0, wordBreak: "break-all", flex: "1 1 240px" }}>{current.url}</span>
              {currentRun ? (() => { const p = verdictPill(currentRun.decision, currentRun.state); return (
                <span className="pill" style={{ fontSize: 10.5, color: p.color, background: p.bg, borderColor: p.border, flex: "none" }}><DecisionMark decision={currentRun.decision} />{p.label}</span>
              ); })() : (
                <span className="pill" style={{ fontSize: 10.5, color: "#B45309", background: "#FEF6E7", borderColor: "#F3DFB0", flex: "none" }}>Unverified</span>
              )}
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ ...headLbl, fontSize: 10 }}>What changed</div>
            {comparisonLines.length ? (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, display: "grid", gap: 4 }}>
                {comparisonLines.map((c) => <li key={c} style={{ fontSize: 12.5, color: "var(--fg-2)", lineHeight: 1.5, wordBreak: "break-word" }}>{c}</li>)}
              </ul>
            ) : (
              <p style={{ fontSize: 12.5, color: "var(--fg-3)", margin: "8px 0 0" }}>The recorded identity fields match; only the recording time differs.</p>
            )}
          </div>
        </div>
      ) : null}

      {/* ── Recorded deployments (S4): the v_deployments identity rows, newest first ────────────────── */}
      {deploymentsReady ? (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ ...headLbl, display: "flex", alignItems: "center", gap: 7 }}><Ic d={I.deploy} size={13} sw={2} />Recorded deployments ({recorded.length})</div>
            <RecordDeploymentForm appId={id} />
          </div>
          {recorded.length ? (
            <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", background: "var(--bg-1)", overflow: "hidden" }}>
              {recorded.map((d, i) => {
                const vr = verifyingRun(d);
                const p = vr ? verdictPill(vr.decision, vr.state) : null;
                return (
                  <div key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 14px", borderTop: i === 0 ? "none" : "1px solid var(--line-1)", flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0, flex: "1 1 280px" }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-1)", fontWeight: 600, wordBreak: "break-all" }}>{d.url}</div>
                      <div style={{ fontSize: 11.5, color: "var(--fg-4)", marginTop: 3 }}>
                        <span title={when(d.detected_at)}>{SOURCE_LABELS[d.source] ?? d.source} {timeAgo(d.detected_at)}</span>
                        {d.commit_sha ? `, commit ${d.commit_sha.slice(0, 10)}` : ""}
                        {d.branch ? `, ${d.branch}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 7, flex: "none", alignItems: "center" }}>
                      {d.environment && ENV_LABELS[d.environment] ? <span className="pill" style={{ fontSize: 10 }}>{ENV_LABELS[d.environment]}</span> : null}
                      {p && vr ? (
                        <span className="pill" style={{ fontSize: 10.5, color: p.color, background: p.bg, borderColor: p.border }}><DecisionMark decision={vr.decision} />{p.label}</span>
                      ) : (
                        <span className="pill" style={{ fontSize: 10.5, color: "#B45309", background: "#FEF6E7", borderColor: "#F3DFB0" }}>Unverified</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "var(--fg-3)", margin: 0 }}>
              No deployments recorded yet. Every new Production Pass records the deployment it tests
              automatically; you can also record one by hand when you ship.
            </p>
          )}
        </div>
      ) : null}

      {/* ── Pass history by deployment URL (pre-S4 view; every URL a pass has tested) ───────────────── */}
      <div style={{ ...headLbl, marginBottom: 12 }}>Pass history by deployment</div>
      {groups.length ? (
        <div style={{ display: "grid", gap: 8 }}>
          {groups.map((g) => <DeploymentRow key={g.url} appId={id} g={g} />)}
        </div>
      ) : (
        <div className="empty">
          <EmptyIcon d={I.deploy} />
          <h3>No deployments recorded</h3>
          <p>Every Production Pass records the deployment URL it ran against. Run one from the overview and that deployment appears here with its verdict.</p>
          <Link href={`/applications/${id}`} className="btn">Run a pass from the overview</Link>
        </div>
      )}

      <div className="card" style={{ marginTop: 20, padding: "clamp(16px, 2.2vw, 20px)", background: "var(--bg-2)" }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14.5, color: "var(--fg-1)", marginBottom: 6 }}>Deployment guards are planned</div>
        <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.55, margin: 0 }}>
          Automatic passes on every new deployment, with a hold on blocked verdicts, are planned but not built yet.
          For now, this page is a history of the deployments your passes have tested.
        </p>
      </div>
    </div>
  );
}
