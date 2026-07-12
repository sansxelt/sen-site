import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightOwner } from "@/lib/v-preflight-guard";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { SetupRequired } from "../../setup-required";
import { getApplication, type RunSummary } from "@/lib/v-applications";
import { listRunsForApp } from "@/lib/preflight/runs-db";
import { AppTabs } from "../app-tabs";

export const metadata: Metadata = { title: "Deployments" };

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
    <Link href={`/app/apps/${appId}/runs/${g.latest.id}`}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", background: "var(--bg-1)", textDecoration: "none" }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-1)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {g.url}
        </div>
        <div style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 3 }}>
          {g.passCount} pass{g.passCount === 1 ? "" : "es"}, latest {timeAgo(g.latest.created_at)}
        </div>
      </div>
      <span className="pill" style={{ fontSize: 10.5, color: p.color, background: p.bg, borderColor: p.border, flex: "none" }}>{p.label}</span>
      <span aria-hidden style={{ color: "var(--fg-5)", flex: "none", fontSize: 13 }}>→</span>
    </Link>
  );
}

// Deployments seen by this app's Production Passes, one row per URL with its latest verdict. Owner-gated
// server component; every read degrades to an empty state, so nothing here is ever fabricated.
export default async function AppDeploymentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requirePreflightOwner("/app/apps/" + id);
  if (!(await preflightDbReady())) return <SetupRequired />;

  const app = await getApplication(owner, id);
  if (!app) {
    return (
      <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
        <div className="empty">
          <div className="empty__icon">∅</div>
          <h3>Application not found</h3>
          <p>This application doesn&apos;t exist, or it belongs to another account.</p>
          <Link href="/app/apps" className="btn">Back to applications</Link>
        </div>
      </div>
    );
  }

  const runs = await listRunsForApp(owner, id, 50);
  const groups = groupByDeployment(runs);

  return (
    <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, marginBottom: 14 }}>
        <Link href="/app/apps" style={{ color: "var(--fg-4)", textDecoration: "none" }}>Applications</Link>
        <span aria-hidden style={{ color: "var(--fg-5)" }}>/</span>
        <span style={{ color: "var(--fg-2)", fontWeight: 600, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.name}</span>
      </nav>

      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", margin: "6px 0 10px" }}>{app.name}</h1>
      <a href={app.app_url} target="_blank" rel="noopener noreferrer"
        style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-4)", textDecoration: "none", wordBreak: "break-all" }}>
        {app.app_url}
      </a>

      <AppTabs appId={id} active="deployments" />

      {groups.length ? (
        <div style={{ display: "grid", gap: 8 }}>
          {groups.map((g) => <DeploymentRow key={g.url} appId={id} g={g} />)}
        </div>
      ) : (
        <div className="empty">
          <div className="empty__icon" aria-hidden>∅</div>
          <h3>No deployments recorded</h3>
          <p>Every Production Pass records the deployment URL it ran against. Once passes have run, each deployment and its latest verdict show here.</p>
          <Link href={`/app/apps/${id}`} className="btn">Back to overview</Link>
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
