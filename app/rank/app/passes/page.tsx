import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightOwner } from "@/lib/v-preflight-guard";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { SetupRequired } from "../systems/setup-required";
import { listAllRuns, type PassRow } from "@/lib/preflight/overview-db";
import { I, EmptyIcon, DecisionMark } from "@/app/rank/_components/icons";
import { runVerdict } from "@/lib/preflight/home-verdict";

export const metadata: Metadata = { title: "Verification" };

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

// A FALSE VERIFIED LIVED HERE.
//
// This function used to be a SECOND decision translator, switching on p.decision alone. It got two things
// wrong, and both produced the one error this company exists to prevent:
//
//   1. repair_verified rendered as a green "Verified". The canonical translator maps repair_verified to
//      BLOCKED, because a targeted repair passing is not the same as the system being proven. So the same
//      run read Verified here and Blocked on the Overview.
//   2. It ignored run state entirely. A run that FAILED or was CANCELLED while carrying decision='ready'
//      rendered as a pass, when toPublicDecision refuses any non-completed state outright.
//
// There is now one translator. runVerdict delegates to toPublicDecision, so this page cannot disagree with
// the Overview, the system page, or the API about what happened.
const TONE: Record<string, { color: string; bg: string; border: string }> = {
  verified: { color: "var(--go-ink)", bg: "var(--go-wash)", border: "var(--go-line)" },
  failed: { color: "var(--stop-ink)", bg: "var(--stop-wash)", border: "var(--stop-line)" },
  blocked: { color: "var(--wait-ink)", bg: "var(--wait-wash)", border: "var(--wait-line)" },
  progress: { color: "var(--fg-4)", bg: "var(--bg-2)", border: "var(--line-2)" },
  unproven: { color: "var(--fg-4)", bg: "var(--bg-2)", border: "var(--line-2)" },
};

function passStyle(p: PassRow): { label: string; color: string; bg: string; border: string; tone: string } {
  const v = runVerdict(p.state, p.decision);
  return { label: v.label, tone: v.tone, ...TONE[v.tone] };
}

// The ink a count wears, keyed by the section it summarises. Only the three public verdicts get a colour;
// Running and Not yet verified are states, not conclusions, so they stay neutral.
const CHIP_INK: Record<string, string | undefined> = {
  Failed: "var(--stop-ink)", Blocked: "var(--wait-ink)", Verified: "var(--go-ink)",
};

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
      href={`/systems/${pass.applicationId}/passes/${pass.id}`}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", textDecoration: "none", color: "inherit" }}
    >
      {/* The mark is driven by the PUBLIC tone, not the raw decision: a repair_verified row reads Blocked,
          so it must not carry the verified-repair wrench beside that word. */}
      <span className="pill" style={{ fontSize: 10, color: st.color, background: st.bg, borderColor: st.border, flex: "none" }}><DecisionMark decision={st.tone} />{st.label}</span>
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

  // GROUPED BY THE PUBLIC VERDICT, not by the internal decision string. The sections used to filter on raw
  // decisions, which is how "Verified (targeted rerun)" came to exist as a green heading for runs the rest
  // of the product calls Blocked. Now the heading a row sits under and the pill it wears are computed from
  // the same call, so they cannot drift apart.
  // A run invalidated by a verifier defect is not a result ABOUT the customer's software, so it cannot sit
  // under Failed or Blocked next to real ones. It keeps its verdict and its evidence and moves to its own
  // section, out of every count. Separated before the verdict grouping rather than filtered afterwards, so
  // there is no ordering in which it could still be counted.
  const invalidated = passes.filter((p) => !!p.invalidatedAt);
  const live = passes.filter((p) => !p.invalidatedAt);
  const running = live.filter(isRunning);
  const terminal = live.filter((p) => !isRunning(p));
  const publicOf = (p: PassRow) => runVerdict(p.state, p.decision).tone;

  const sections = [
    { label: "Running", rows: running },
    { label: "Failed", rows: terminal.filter((p) => publicOf(p) === "failed") },
    { label: "Blocked", rows: terminal.filter((p) => publicOf(p) === "blocked") },
    { label: "Verified", rows: terminal.filter((p) => publicOf(p) === "verified") },
    { label: "Not yet verified", rows: terminal.filter((p) => publicOf(p) === "unproven" || publicOf(p) === "progress") },
    { label: "Invalidated (verifier defect)", rows: invalidated },
  ].filter((s) => s.rows.length > 0);

  return (
    <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <div>
          <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", margin: "0 0 10px" }}>Verifications</h1>
          <p style={{ fontSize: 14.5, color: "var(--fg-3)", lineHeight: 1.6, margin: 0, maxWidth: 560 }}>
            Every verification run across your applications, newest first, grouped by the decision it produced.
          </p>
        </div>
        <Link href="/systems/new" className="btn" style={{ flex: "none" }}>+ Connect app</Link>
      </div>

      {passes.length === 0 ? (
        <div className="empty">
          <EmptyIcon d={I.shield} />
          <h3>Nothing verified yet</h3>
          <p>Connect an application and run a verification in a real browser to get a decision.</p>
          <Link href="/systems/new" className="btn">Connect an app</Link>
        </div>
      ) : (
        <>
          {/* Counts read from the SAME sections rendered below, so a chip can never disagree with the list
              under it. They used to be six independent filters on raw decision strings, which is how a
              "Verified (targeted rerun)" chip came to count runs the rest of the product calls Blocked. */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
            {sections.map((s) => (
              <StatChip key={s.label} label={s.label} value={s.rows.length} color={CHIP_INK[s.label]} />
            ))}
          </div>

          {sections.map((s) => <PassSection key={s.label} label={s.label} rows={s.rows} />)}
        </>
      )}
    </div>
  );
}
