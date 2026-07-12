import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightOwner } from "@/lib/v-preflight-guard";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { SetupRequired } from "../apps/setup-required";
import { listAllRuns, type PassRow } from "@/lib/preflight/overview-db";

export const metadata: Metadata = { title: "Deployments" };

// Relative "3m ago / 4h ago / Jul 2" for the latest-pass line. Server component, rendered once per
// request, so a wall-clock relative time carries no hydration-mismatch risk.
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

// Latest-run decision -> pill label + colours. The label always accompanies the colour, so status is
// never conveyed by colour alone. A run is "in progress" while it moves through the pre-decision states.
const ACTIVE_RUN_STATES = new Set(["queued", "discovering", "running", "analyzing"]);

function decisionStyle(run: PassRow): { label: string; color: string; bg: string; border: string } {
  switch (run.decision) {
    case "ready": return { label: "Ready", color: "var(--acc-deep)", bg: "var(--acc-soft)", border: "var(--acc-line)" };
    case "needs_review": return { label: "Needs review", color: "#B45309", bg: "#FEF6E7", border: "#F3DFB0" };
    case "blocked": return { label: "Blocked", color: "#C0392B", bg: "#FBEBEA", border: "#F0C7C2" };
    default:
      if (ACTIVE_RUN_STATES.has(run.state)) return { label: "In progress", color: "var(--fg-4)", bg: "var(--bg-2)", border: "var(--line-2)" };
      return { label: "No verdict", color: "var(--fg-4)", bg: "var(--bg-2)", border: "var(--line-2)" };
  }
}

type DeploymentGroup = { url: string; runs: PassRow[] };

// Group passes by the deployment URL they tested. listAllRuns returns newest first, so first-seen
// insertion order gives groups sorted by most recent activity, and each group keeps newest-first runs.
function groupByDeployment(passes: PassRow[]): DeploymentGroup[] {
  const groups = new Map<string, PassRow[]>();
  for (const p of passes) {
    if (!p.deploymentUrl) continue;
    const existing = groups.get(p.deploymentUrl);
    if (existing) existing.push(p);
    else groups.set(p.deploymentUrl, [p]);
  }
  return Array.from(groups, ([url, runs]) => ({ url, runs }));
}

function DeploymentCard({ group }: { group: DeploymentGroup }) {
  const latest = group.runs[0];
  const st = decisionStyle(latest);
  const last = timeAgo(latest.completedAt ?? latest.createdAt);
  const countText = group.runs.length === 1 ? "1 pass" : `${group.runs.length} passes`;
  const metaParts = [latest.applicationName || null, countText, last ? `Latest ${last}` : null].filter(Boolean);
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-1)", lineHeight: 1.5, wordBreak: "break-all", minWidth: 0 }}>
          {group.url}
        </div>
        <span className="pill" style={{ fontSize: 10, color: st.color, background: st.bg, borderColor: st.border, flex: "none" }}>{st.label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, color: "var(--fg-4)" }}>{metaParts.join(", ")}</span>
        <Link
          href={`/app/apps/${latest.applicationId}/runs/${latest.id}`}
          style={{ fontSize: 13, fontWeight: 600, color: "var(--acc-deep)", display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none", flex: "none" }}
        >
          View latest pass <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}

// Deployment history for Vraelis Preflight. Every Production Pass records the exact deployment URL it
// tested; this page is that history grouped by URL. Deployment guards (verify-on-deploy, deploy blocking)
// are not built yet, so the only controls here are links to real passes. Honest roadmap card, no toggles.
export default async function DeploymentsPage() {
  const owner = await requirePreflightOwner("/app/deployments");
  if (!(await preflightDbReady())) return <SetupRequired />;
  const passes = await listAllRuns(owner, 60);
  const groups = groupByDeployment(passes);

  return (
    <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      {/* header */}
      <div style={{ marginBottom: 24 }}>
        <p className="eyebrow">Vraelis Preflight</p>
        <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", margin: "6px 0 10px" }}>Deployments</h1>
        <p style={{ fontSize: 14.5, color: "var(--fg-3)", lineHeight: 1.6, margin: 0, maxWidth: 560 }}>
          The deployments your Production Passes have tested, with the latest verdict for each.
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="empty">
          <div className="empty__icon" aria-hidden>⬡</div>
          <h3>No deployments tested yet</h3>
          <p>Run a Production Pass and the deployment it tests appears here with its verdict.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {groups.map((g) => <DeploymentCard key={g.url} group={g} />)}
        </div>
      )}

      {/* honest roadmap: guards are not built yet, and there is nothing here pretending otherwise */}
      <div className="card" style={{ background: "var(--bg-2)", display: "flex", flexDirection: "column", gap: 10, padding: 18, marginTop: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--fg-1)", margin: 0 }}>Deployment guards are coming</h2>
          <span className="pill" style={{ fontSize: 10, color: "var(--fg-4)", background: "var(--bg-2)", borderColor: "var(--line-2)", flex: "none" }}>Planned</span>
        </div>
        <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.6, margin: 0, maxWidth: 640 }}>
          Automated verify-on-deploy and deploy blocking are not active yet. Today, every Production Pass
          records the exact deployment it tested, which is the history you see on this page. Guards will
          build on that record to verify each new deploy and hold a launch when a pass comes back blocked.
        </p>
      </div>
    </div>
  );
}
