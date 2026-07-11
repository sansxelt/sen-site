import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightOwner } from "@/lib/v-preflight-guard";
import {
  getApplication, getContract, listRequirements, listFlows, listRuns,
  type ContractRequirement, type TestFlow, type RunSummary,
} from "@/lib/v-applications";

export const metadata: Metadata = { title: "Application" };

// Friendly labels for the builder the app was created with (raw key falls through).
const BUILDER_LABELS: Record<string, string> = {
  claude_code: "Claude Code", cursor: "Cursor", lovable: "Lovable",
  bolt: "Bolt", replit: "Replit", v0: "v0", other: "Other",
};

// Stable UTC render (no hydration mismatch): "2026-07-02 14:31 UTC".
function when(iso: string): string {
  try { return new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC"; } catch { return ""; }
}

type Pill = { label: string; color: string; bg: string; border: string };

// Contract lifecycle → pill. Draft is amber (needs review), Approved is the accent green.
function contractPill(status: string): Pill {
  return status === "approved"
    ? { label: "Approved", color: "var(--acc-deep)", bg: "var(--acc-soft)", border: "var(--acc-line)" }
    : { label: "Draft", color: "#c2831a", bg: "rgba(194,131,26,0.08)", border: "rgba(194,131,26,0.30)" };
}

// Run decision → pill. Colour AND text carry the status (never colour alone). A run with no
// decision yet reflects its state as in-progress or untested, muted.
function runPill(decision: string | null, state: string): Pill {
  if (decision === "ready") return { label: "Ready to ship", color: "var(--acc-deep)", bg: "var(--acc-soft)", border: "var(--acc-line)" };
  if (decision === "needs_review") return { label: "Needs review", color: "#c2831a", bg: "rgba(194,131,26,0.08)", border: "rgba(194,131,26,0.30)" };
  if (decision === "blocked") return { label: "Blocked", color: "var(--err)", bg: "rgba(255,100,112,0.08)", border: "rgba(255,100,112,0.30)" };
  // Intermediate lifecycle states (see v_preflight_runs.state) before a decision exists.
  const active = state === "queued" || state === "discovering" || state === "running" || state === "analyzing";
  return { label: active ? "In progress" : "Untested", color: "var(--fg-4)", bg: "var(--bg-2)", border: "var(--line-2)" };
}

const cardStyle = { padding: "clamp(18px, 2.4vw, 24px)" } as const;
const cardTitle = { fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16.5, color: "var(--fg-1)", margin: 0 } as const;

function BackLink() {
  return (
    <Link href="/app/apps" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, color: "var(--fg-3)", textDecoration: "none", marginBottom: 18 }}>
      ← Applications
    </Link>
  );
}

// One key/value row in the Details card. Missing values read "Not set" (muted), never a blank.
function KV({ k, v }: { k: string; v: string | null }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, fontSize: 13 }}>
      <span style={{ color: "var(--fg-4)", flex: "none" }}>{k}</span>
      <span style={{ color: v ? "var(--fg-1)" : "var(--fg-4)", fontFamily: "var(--font-mono)", fontWeight: v ? 600 : 400, textAlign: "right", wordBreak: "break-all", minWidth: 0 }}>
        {v || "Not set"}
      </span>
    </div>
  );
}

function RunRow({ r }: { r: RunSummary }) {
  const p = runPill(r.decision, r.state);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", background: "var(--bg-1)" }}>
      <span aria-hidden style={{ width: 9, height: 9, borderRadius: "50%", background: p.color, flex: "none" }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-4)" }}>{when(r.created_at)}</div>
        {r.deployment_url ? (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
            {r.deployment_url}
          </div>
        ) : null}
      </div>
      <span className="pill" style={{ fontSize: 10.5, color: p.color, background: p.bg, borderColor: p.border, flex: "none" }}>{p.label}</span>
    </div>
  );
}

// Application detail (server component). Preflight is flag-gated: the guard redirects a guessed URL to
// the normal dashboard. All data is owner-scoped and degrades to empty/null before the tables exist, so
// this renders clean empty states with no fake runs, scores, or discovered requirements.
export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requirePreflightOwner("/app/apps/" + id);

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

  const [contract, runs] = await Promise.all([getContract(owner, id), listRuns(owner, id)]);
  let reqs: ContractRequirement[] = [];
  let flows: TestFlow[] = [];
  if (contract) [reqs, flows] = await Promise.all([listRequirements(owner, contract.id), listFlows(owner, contract.id)]);

  const builderLabel = app.builder ? (BUILDER_LABELS[app.builder] ?? app.builder) : null;
  const cp = contract ? contractPill(contract.status) : null;
  const reqCount = reqs.length, flowCount = flows.length;

  return (
    <div className="wrap" style={{ maxWidth: 960, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <BackLink />

      {/* header */}
      <p className="eyebrow">Application</p>
      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", margin: "6px 0 10px" }}>{app.name}</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <a href={app.app_url} target="_blank" rel="noopener noreferrer"
          style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-4)", textDecoration: "none", wordBreak: "break-all" }}>
          {app.app_url}
        </a>
        {builderLabel ? <span className="pill" style={{ fontSize: 10.5 }}>{builderLabel}</span> : null}
      </div>

      <div style={{ display: "grid", gap: 14, marginTop: 28 }}>

        {/* Production Contract */}
        <div className="card" style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <h2 style={cardTitle}>Production Contract</h2>
            {cp ? <span className="pill" style={{ fontSize: 10.5, color: cp.color, background: cp.bg, borderColor: cp.border }}>{cp.label}</span> : null}
          </div>
          {contract ? (
            <>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-3)", margin: "12px 0 16px" }}>
                {reqCount} requirement{reqCount === 1 ? "" : "s"} · {flowCount} flow{flowCount === 1 ? "" : "s"}
              </p>
              <Link href={`/app/apps/${app.id}/contract`} className="btn">Review contract <span aria-hidden>→</span></Link>
            </>
          ) : (
            <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: "12px 0 0", lineHeight: 1.55 }}>
              Contract is being prepared. It will be ready to review shortly.
            </p>
          )}
        </div>

        {/* Preflight (no execution in this phase) */}
        <div className="card" style={cardStyle}>
          <h2 style={cardTitle}>Preflight</h2>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: "10px 0 16px", lineHeight: 1.55, maxWidth: 580 }}>
            Preflight runs your approved contract against the live deployment in a real browser, checks every
            requirement, and returns a ship, needs-review, or blocked decision with evidence.
          </p>
          <button type="button" className="btn" disabled
            style={{ opacity: 0.55, cursor: "not-allowed" }}>
            Run preflight
          </button>
          <p style={{ fontSize: 12, color: "var(--fg-4)", margin: "10px 0 0" }}>
            Real browser preflight arrives in the next release.
          </p>
        </div>

        {/* Runs */}
        <div className="card" style={cardStyle}>
          <h2 style={cardTitle}>Runs</h2>
          {runs.length ? (
            <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
              {runs.map((r) => <RunRow key={r.id} r={r} />)}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "22px 0 6px" }}>
              <div aria-hidden style={{ fontFamily: "var(--font-mono)", fontSize: 24, color: "var(--fg-5)", marginBottom: 8 }}>∅</div>
              <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: 0 }}>No preflight runs yet.</p>
              <p style={{ fontSize: 12, color: "var(--fg-4)", margin: "6px 0 0" }}>Runs will show here once browser preflight is available.</p>
            </div>
          )}
        </div>

        {/* Details (safe fields only) */}
        <div className="card" style={cardStyle}>
          <h2 style={cardTitle}>Details</h2>
          <div style={{ display: "grid", gap: 11, marginTop: 14 }}>
            <KV k="Framework" v={app.framework} />
            <KV k="Repository" v={app.repo} />
            <KV k="Deployment" v={app.deployment_provider} />
            <KV k="Ownership confirmed" v={app.ownership_confirmed ? "Yes" : "No"} />
            <KV k="Connected" v={when(app.created_at)} />
          </div>
        </div>

      </div>
    </div>
  );
}
