import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightOwner } from "@/lib/v-preflight-guard";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { SetupRequired } from "../../setup-required";
import { getApplication, type RunSummary } from "@/lib/v-applications";
import { listRunsForApp } from "@/lib/preflight/runs-db";
import { AppTabs } from "../app-tabs";

export const metadata: Metadata = { title: "Production Passes" };

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

// Decision AND text carry the status together (never colour alone). A run with no decision yet reflects
// its lifecycle state as in-progress or untested, muted.
function runPill(decision: string | null, state: string): Pill {
  if (decision === "ready") return { label: "Ready to ship", color: "var(--acc-deep)", bg: "var(--acc-soft)", border: "var(--acc-line)" };
  if (decision === "needs_review") return { label: "Needs review", color: "#B45309", bg: "#FEF6E7", border: "#F3DFB0" };
  if (decision === "blocked") return { label: "Blocked", color: "#C0392B", bg: "#FBEBEA", border: "#F0C7C2" };
  const active = state === "queued" || state === "discovering" || state === "running" || state === "analyzing";
  return { label: active ? "In progress" : "No decision", color: "var(--fg-4)", bg: "var(--bg-2)", border: "var(--line-2)" };
}

function RunRow({ appId, r }: { appId: string; r: RunSummary }) {
  const p = runPill(r.decision, r.state);
  return (
    <Link href={`/app/apps/${appId}/runs/${r.id}`}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", background: "var(--bg-1)", textDecoration: "none" }}>
      <span aria-hidden style={{ width: 9, height: 9, borderRadius: "50%", background: p.color, flex: "none" }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, color: "var(--fg-2)", fontWeight: 600 }}>{timeAgo(r.created_at) || "Pass"}</div>
        {r.deployment_url ? (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 3 }}>
            {r.deployment_url}
          </div>
        ) : null}
      </div>
      <span className="pill" style={{ fontSize: 10.5, color: p.color, background: p.bg, borderColor: p.border, flex: "none" }}>{p.label}</span>
      <span aria-hidden style={{ color: "var(--fg-5)", flex: "none", fontSize: 13 }}>→</span>
    </Link>
  );
}

// All Production Passes for one application. Owner-gated server component; every read degrades to an
// empty state, so nothing here is ever fabricated.
export default async function AppRunsPage({ params }: { params: Promise<{ id: string }> }) {
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

  const runs = await listRunsForApp(owner, id, 50);

  return (
    <div className="wrap" style={{ maxWidth: 960, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
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

      <AppTabs appId={id} active="runs" />

      {runs.length ? (
        <div style={{ display: "grid", gap: 8 }}>
          {runs.map((r) => <RunRow key={r.id} appId={id} r={r} />)}
        </div>
      ) : (
        <div className="empty">
          <div className="empty__icon" aria-hidden>∅</div>
          <h3>No passes yet</h3>
          <p>A Production Pass walks this app in a real browser against its contract and returns a launch decision with evidence. Once one runs, it shows here.</p>
          <Link href={`/app/apps/${id}`} className="btn">Back to overview</Link>
        </div>
      )}
    </div>
  );
}
