import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightOwner } from "@/lib/v-preflight-guard";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { SetupRequired } from "../systems/setup-required";
import { listAllRuns, type PassRow } from "@/lib/preflight/overview-db";
import { I, EmptyIcon } from "@/app/rank/_components/icons";
import { Verdict } from "@/app/rank/_components/verdict";
import { Page, PageHeader } from "@/app/rank/_components/page-header";
import { runVerdict } from "@/lib/preflight/home-verdict";

// The tab said "Verification" while the heading said "Verifications", and /verifications, which re-exports
// this exact page, set "Verifications" of its own. So the same rendered page carried two different browser
// tab titles depending on which URL you arrived by. The heading is the name the sidebar sends you here
// under, so the tab follows the heading.
export const metadata: Metadata = { title: "Verifications" };

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
// This file used to hold a SECOND decision translator, switching on p.decision alone. It got two things
// wrong, and both produced the one error this company exists to prevent:
//
//   1. repair_verified rendered as a green "Verified". The canonical translator maps repair_verified to
//      BLOCKED, because a targeted repair passing is not the same as the system being proven. So the same
//      run read Verified here and Blocked on the Overview.
//   2. It ignored run state entirely. A run that FAILED or was CANCELLED while carrying decision='ready'
//      rendered as a pass, when toPublicDecision refuses any non-completed state outright.
//
// That was fixed by routing the local translator through runVerdict, which left this page holding a colour
// table and a size for a badge eight other surfaces also drew. The colours agreed by luck rather than by
// construction, and the badge rendered at 10px here against 10.5, 11 and 12.5 elsewhere. The pill is now
// <Verdict>, so the label, the tone, the mark and the size all arrive from one place.
//
// runVerdict is still imported, and still called below, because this page does something the pill cannot:
// it GROUPS rows by their public verdict. The heading a row sits under and the pill it wears must come from
// the same answer, which is why both go through the shared translator rather than one asking the component.

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
  const when = timeAgo(pass.completedAt ?? pass.createdAt);
  return (
    <Link
      href={`/systems/${pass.applicationId}/passes/${pass.id}`}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", textDecoration: "none", color: "inherit" }}
    >
      <Verdict state={pass.state} decision={pass.decision} style={{ flex: "none" }} />
      <span style={{ fontWeight: 600, fontSize: 14, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "0 1 auto", minWidth: 0 }}>
        {pass.applicationName || "Untitled system"}
      </span>
      {/* Lineage, not a verdict. "rerun" says how this run came to exist; it makes no claim about what it
          found, so it keeps the plain .pill and stays out of the signal vocabulary. */}
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
    <Page>
      <PageHeader
        title="Verifications"
        lead="Every verification run across your systems, newest first, grouped by the decision it produced."
        actions={<Link href="/systems/new" className="btn">+ Connect app</Link>}
      />

      {/* <Page> owns the measure and the shell overrides only padding-TOP, so the tail room this page has
          always had is kept here, on the content. Every sibling page carries the same 80px; without it the
          last row sat flush against the bottom of the window on this page alone. */}
      <div style={{ paddingBottom: 80 }}>

        {passes.length === 0 ? (
          <div className="empty">
            <EmptyIcon d={I.shield} />
            <h3>Nothing verified yet</h3>
            <p>Connect a system and run a verification in a real browser to get a decision.</p>
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
    </Page>
  );
}
