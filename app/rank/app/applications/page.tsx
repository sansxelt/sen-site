import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightOwner } from "@/lib/v-preflight-guard";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { SetupRequired } from "./setup-required";
import { listApplicationsForMember, latestRunByAppForApps, type Application, type RunSummary } from "@/lib/v-applications";
import { activateInvitesForEmail } from "@/lib/v-workspace";
import { I, EmptyIcon, DecisionMark } from "@/app/rank/_components/icons";

export const metadata: Metadata = { title: "Applications" };

// Relative "3m ago / 4h ago / Jul 2" for the last-run line. This is a server component, rendered once per
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

// Latest-run decision -> pill label + colours. The .pill class uppercases the label; the text always
// accompanies the colour, so status is never conveyed by colour alone.
// A run is "in progress" while it moves through the queue/execution states before a decision exists.
const ACTIVE_RUN_STATES = new Set(["queued", "discovering", "running", "analyzing"]);
const isActiveRun = (run: RunSummary | null | undefined): boolean => !!run && !run.decision && ACTIVE_RUN_STATES.has(run.state);

function decisionStyle(run: RunSummary | null | undefined): { label: string; color: string; bg: string; border: string } {
  switch (run?.decision) {
    case "ready": return { label: "Verified", color: "var(--acc-deep)", bg: "var(--acc-soft)", border: "var(--acc-line)" };
    // Positive but provisional (not launch-cleared) — visibly distinct from the solid Verified green.
    case "repair_verified": return { label: "Verified", color: "#0A7B54", bg: "var(--accent-dim, #E8FBF6)", border: "var(--accent-border, #B7EFE4)" };
    case "needs_review": return { label: "Blocked", color: "#c2831a", bg: "rgba(194,131,26,0.09)", border: "rgba(194,131,26,0.3)" };
    case "blocked": return { label: "Failed", color: "var(--err)", bg: "rgba(194,84,12,0.08)", border: "rgba(194,84,12,0.28)" };
    default:
      if (isActiveRun(run)) return { label: "In progress", color: "var(--acc-deep)", bg: "var(--acc-soft)", border: "var(--acc-line)" };
      return { label: "Not tested", color: "var(--fg-4)", bg: "var(--bg-2)", border: "var(--line-2)" };
  }
}

// summary is a loose JSON blob; read the critical-flow counters defensively and only when both are present.
function criticalFlows(summary: Record<string, unknown> | null | undefined): string | null {
  if (!summary) return null;
  const passed = summary.critical_passed, total = summary.critical_total;
  if (typeof passed === "number" && typeof total === "number" && total > 0) return `${passed} / ${total} critical flows`;
  return null;
}

function StatChip({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "11px 16px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", minWidth: 92 }}>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, lineHeight: 1, color: color ?? "var(--fg-1)" }}>{value}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-4)" }}>{label}</span>
    </div>
  );
}

function AppCard({ app, run }: { app: Application; run: RunSummary | undefined }) {
  const st = decisionStyle(run);
  const last = timeAgo(run?.completed_at ?? run?.created_at);
  const crit = criticalFlows(run?.summary);
  const metaParts = [crit, last ? `Last run ${last}` : null].filter(Boolean);
  const metaText = metaParts.length ? metaParts.join(", ") : "No preflight yet";
  return (
    <Link href={`/applications/${app.id}`} className="card card--hover" style={{ display: "flex", flexDirection: "column", gap: 14, textDecoration: "none", color: "inherit", padding: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--fg-1)", lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.name}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.app_url}</div>
        </div>
        <span className="pill" style={{ fontSize: 10, color: st.color, background: st.bg, borderColor: st.border, flex: "none" }}><DecisionMark decision={run?.decision} />{st.label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: "auto" }}>
        <span style={{ fontSize: 12, color: "var(--fg-4)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{metaText}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--acc-deep)", display: "inline-flex", alignItems: "center", gap: 5, flex: "none" }}>Open <span aria-hidden>→</span></span>
      </div>
    </Link>
  );
}

// Applications dashboard for Vraelis Preflight. Server component behind the preflight owner gate; every read
// degrades to an empty state when the data layer has nothing (or the tables aren't migrated yet). No browser
// execution or discovery lives here — a run is a later phase.
export default async function ApplicationsPage() {
  const caller = await requirePreflightOwner("/applications");
  // A token-less (email-match) invite activates on first Preflight visit so a newly-invited teammate sees
  // their shared apps here immediately. Idempotent + best-effort.
  await activateInvitesForEmail(caller);
  if (!(await preflightDbReady())) return <SetupRequired />;
  // TEAM: the caller's OWN apps + any shared into workspaces they belong to. For a solo user this is exactly
  // their own apps (identical to before). Runs are resolved per-owner so no cross-member metering leak.
  const apps = await listApplicationsForMember(caller);
  const latest = await latestRunByAppForApps(apps);

  const readyCount = apps.filter((a) => latest[a.id]?.decision === "ready").length;
  const blockedCount = apps.filter((a) => latest[a.id]?.decision === "blocked").length;
  const untestedCount = apps.filter((a) => !latest[a.id]?.decision && !isActiveRun(latest[a.id])).length;

  return (
    <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <div>
          <p className="eyebrow">Vraelis Preflight</p>
          <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", margin: "6px 0 10px" }}>Applications</h1>
          <p style={{ fontSize: 14.5, color: "var(--fg-3)", lineHeight: 1.6, margin: 0, maxWidth: 560 }}>
            Connect an AI-built app and Vraelis looks for failures in the flows you approve, before your users hit them.
          </p>
        </div>
        <Link href="/applications/new" className="btn" style={{ flex: "none" }}>Connect an app <span aria-hidden>→</span></Link>
      </div>

      {apps.length === 0 ? (
        <div className="empty">
          <EmptyIcon d={I.layers} />
          <h3>No applications yet</h3>
          <p>A preflight walks your live app the way a user would, then reports which of your approved critical flows broke. Connect your first app to begin.</p>
          <Link href="/applications/new" className="btn">Connect an app</Link>
        </div>
      ) : (
        <>
          {/* overview */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
            <StatChip label="Applications" value={apps.length} />
            <StatChip label="Verified" value={readyCount} color={readyCount ? "var(--acc-deep)" : undefined} />
            <StatChip label="Failed" value={blockedCount} color={blockedCount ? "var(--err)" : undefined} />
            <StatChip label="Untested" value={untestedCount} />
          </div>

          {/* app cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(288px, 1fr))", gap: 12 }}>
            {apps.map((a) => <AppCard key={a.id} app={a} run={latest[a.id]} />)}
          </div>
        </>
      )}
    </div>
  );
}
