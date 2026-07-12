import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightOwner } from "@/lib/v-preflight-guard";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { SetupRequired } from "../applications/setup-required";
import { listAllRuns, type PassRow } from "@/lib/preflight/overview-db";

export const metadata: Metadata = { title: "Production Passes" };

// Relative "3m ago / 4h ago / Jul 2". Server component, rendered once per request, so a wall-clock
// relative time carries no hydration-mismatch risk.
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

// A pass is "running" while it moves through the execution states and no decision exists yet.
const ACTIVE_STATES = new Set(["queued", "discovering", "running", "analyzing"]);
const isRunning = (p: PassRow): boolean => !p.decision && ACTIVE_STATES.has(p.state);

const RUNNING_LABELS: Record<string, string> = {
  queued: "Queued", discovering: "Discovering", running: "Running", analyzing: "Analyzing",
};

// Decision/state -> pill label + tones. The label always accompanies the colour, so status is never
// conveyed by colour alone.
function passStyle(p: PassRow): { label: string; color: string; bg: string; border: string } {
  switch (p.decision) {
    case "ready": return { label: "Ready", color: "var(--acc-deep)", bg: "var(--acc-soft)", border: "var(--acc-line)" };
    case "repair_verified": return { label: "Repair verified", color: "var(--acc-deep)", bg: "var(--acc-soft)", border: "var(--acc-line)" };
    case "needs_review": return { label: "Needs review", color: "#B45309", bg: "#FEF6E7", border: "#F3DFB0" };
    case "blocked": return { label: "Blocked", color: "#C0392B", bg: "#FBEBEA", border: "#F0C7C2" };
    default:
      return { label: RUNNING_LABELS[p.state] ?? "In progress", color: "var(--fg-4)", bg: "var(--bg-2)", border: "var(--line-2)" };
  }
}

function StatChip({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "11px 16px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", minWidth: 92 }}>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, lineHeight: 1, color: color ?? "var(--fg-1)" }}>{value}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-4)" }}>{label}</span>
    </div>
  );
}

function PassLine({ pass }: { pass: PassRow }) {
  const st = passStyle(pass);
  const when = timeAgo(pass.completedAt ?? pass.createdAt);
  return (
    <Link
      href={`/applications/${pass.applicationId}/passes/${pass.id}`}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", textDecoration: "none", color: "inherit" }}
    >
      <span className="pill" style={{ fontSize: 10, color: st.color, background: st.bg, borderColor: st.border, flex: "none" }}>{st.label}</span>
      <span style={{ fontWeight: 600, fontSize: 14, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "0 1 auto", minWidth: 0 }}>
        {pass.applicationName || "Untitled application"}
      </span>
      {pass.parentRunId && (
        <span className="pill" style={{ fontSize: 10, color: "var(--fg-4)", background: "var(--bg-2)", borderColor: "var(--line-2)", flex: "none" }}>rerun</span>
      )}
      {pass.flowsTotal > 0 && (
        <span style={{ fontFamily: "var(--font-code)", fontSize: 12, color: "var(--fg-3)", flex: "none", whiteSpace: "nowrap" }}>
          {pass.flowsPassed}/{pass.flowsTotal} flows
        </span>
      )}
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)", flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>
        {pass.deploymentUrl ?? ""}
      </span>
      <span style={{ fontSize: 12, color: "var(--fg-4)", flex: "none", whiteSpace: "nowrap" }}>{when}</span>
    </Link>
  );
}

function PassSection({ label, rows }: { label: string; rows: PassRow[] }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", margin: "0 0 8px 2px" }}>
        {label} ({rows.length})
      </h2>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {rows.map((p, i) => (
          <div key={p.id} style={i > 0 ? { borderTop: "1px solid var(--line-2)" } : undefined}>
            <PassLine pass={p} />
          </div>
        ))}
      </div>
    </section>
  );
}

// Owner-wide Production Pass history. Server component behind the preflight owner gate; reads only
// through the overview data layer, which degrades to [] when the tables are unmigrated or a read fails.
export default async function PassesPage() {
  const owner = await requirePreflightOwner("/passes");
  if (!(await preflightDbReady())) return <SetupRequired />;
  const passes = await listAllRuns(owner, 60);

  const running = passes.filter(isRunning);
  const blocked = passes.filter((p) => p.decision === "blocked");
  const needsReview = passes.filter((p) => p.decision === "needs_review");
  const ready = passes.filter((p) => p.decision === "ready");

  const sections = [
    { label: "Running", rows: running },
    { label: "Blocked", rows: blocked },
    { label: "Needs review", rows: needsReview },
    { label: "Ready", rows: ready },
  ].filter((s) => s.rows.length > 0);

  return (
    <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <div>
          <p className="eyebrow">Vraelis Preflight</p>
          <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", margin: "6px 0 10px" }}>Production Passes</h1>
          <p style={{ fontSize: 14.5, color: "var(--fg-3)", lineHeight: 1.6, margin: 0, maxWidth: 560 }}>
            Every preflight run across your applications, newest first, grouped by the launch decision it produced.
          </p>
        </div>
        <Link href="/applications/new" className="btn" style={{ flex: "none" }}>+ Connect app</Link>
      </div>

      {passes.length === 0 ? (
        <div className="empty">
          <div className="empty__icon" aria-hidden>◇</div>
          <h3>No Production Passes yet</h3>
          <p>Connect an application and run its critical flows in a real browser to get a launch decision.</p>
          <Link href="/applications/new" className="btn">Connect an app</Link>
        </div>
      ) : (
        <>
          {/* counts */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
            <StatChip label="Running" value={running.length} />
            <StatChip label="Blocked" value={blocked.length} color={blocked.length ? "#C0392B" : undefined} />
            <StatChip label="Needs review" value={needsReview.length} color={needsReview.length ? "#B45309" : undefined} />
            <StatChip label="Ready" value={ready.length} color={ready.length ? "var(--acc-deep)" : undefined} />
          </div>

          {sections.map((s) => <PassSection key={s.label} label={s.label} rows={s.rows} />)}
        </>
      )}
    </div>
  );
}
