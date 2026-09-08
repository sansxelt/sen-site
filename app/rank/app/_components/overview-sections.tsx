// The Overview's operational sections.
//
// The page this replaced led with a form. That made the product look like a URL box with a prompt in it:
// the first and largest thing on screen was an empty input, and the records underneath — the systems, the
// failures, the decisions — were a footnote to it. For an account with nothing in it that is the right
// hierarchy. For an account with records it is the wrong one, because the question a person opens the
// console to answer is not "what shall I verify" but "what is currently not true".
//
// EVERY FIELD HERE IS BACKED BY A ROW. The founder asked for several that are not: which guarantee owns a
// failure, who owns it, and which journeys it affects. Those are omitted rather than approximated, because
// zero verifications currently carry a guarantee id, no issue carries an assignee, and no journey name is
// stored on an issue. The omissions are listed in the commit message, not papered over here.
import Link from "next/link";
import type { CSSProperties } from "react";
import type { PassRow, IssueRow, RepairRow } from "@/lib/preflight/overview-db";
import type { PendingReviewRow } from "@/lib/preflight/reviewed-plan-db";
import { Ic, I } from "@/app/rank/_components/icons";
import { runVerdict, systemProof, timeAgo, type Verdict } from "@/lib/preflight/home-verdict";
import { Verdict as VerdictBadge } from "@/app/rank/_components/verdict";
import { PageHeader } from "@/app/rank/_components/page-header";
import { DeploymentReference } from "./home-records";

const label: CSSProperties = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", margin: 0 };
const SEV_COLOR: Record<string, string> = { critical: "var(--stop-ink)", high: "var(--wait-ink)", medium: "var(--fg-3)", low: "var(--fg-4)" };

function SectionHead({ text, count, href, hrefLabel, note }: { text: string; count?: number; href?: string; hrefLabel?: string; note?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <h2 style={label}>{text}{typeof count === "number" ? ` (${count})` : ""}</h2>
        {href && hrefLabel ? <Link href={href} style={{ fontSize: 13, color: "var(--acc-deep)", flex: "none", textDecoration: "none" }}>{hrefLabel} <span aria-hidden>→</span></Link> : null}
      </div>
      {note ? <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--fg-4)" }}>{note}</p> : null}
    </div>
  );
}

// THE NINTH COPY OF THE PILL, DELETED.
//
// This file used to carry its own `Pill` with its own tone table, and it was the smallest of the nine: 10px,
// weight 700, uppercase, against .pill's own var(--fs-micro) that it overrode. Two of the three tables it
// agreed with and one it did not, because `unproven` was inked --fg-4 here and --fg-3 in home-records, so a
// system nobody had checked was a shade quieter on the Overview than on the same row rendered elsewhere.
//
// Nothing about that was a decision anyone made. It is what nine hand-rolled copies of one badge converge
// to. <Verdict> is now the only place the ink, the wash, the mark and the size are chosen, so this file can
// no longer disagree with the rest of the product about what Blocked looks like. The rows here hold an
// already-derived Verdict (systemProof / runVerdict), so they pass it straight through rather than handing
// the component a state and a decision to re-derive.
//
// flex:"none" is kept at every call site: each badge sits in a flex row beside a name that is allowed to
// grow, and without it the badge is the thing that shrinks and wraps its own label.
//
// The component is imported under an alias only because `Verdict` is already the NAME OF THE TYPE this
// module's exported row shapes are declared with (AttentionItem.systemVerdict, SystemRow.verdict). Renaming
// those would change this module's public surface for no gain.

// ── 0. Operational state ──────────────────────────────────────────────────────────────────────────────
//
// The greeting is gone. "Welcome back" is a fact about the door, not about the business, and it occupied the
// one line a reader looks at first. The sentences below are ASSEMBLED FROM COUNTS, never written ahead of
// time: a clause only appears when its number is above zero, so the paragraph cannot claim a state the rows
// do not support, and an account in good standing gets a short sentence rather than a padded one.

export function OperationalState({ criticals, systemsAffected, pendingReviews, running }: { criticals: number; systemsAffected: number; pendingReviews: number; running: number }) {
  const parts: string[] = [];
  if (criticals > 0) parts.push(`${criticals} critical issue${criticals === 1 ? "" : "s"} across ${systemsAffected} system${systemsAffected === 1 ? "" : "s"}.`);
  if (pendingReviews > 0) parts.push(`${pendingReviews} proof plan${pendingReviews === 1 ? " is" : "s are"} awaiting review.`);
  if (running > 0) parts.push(`${running} verification${running === 1 ? " is" : "s are"} running.`);
  const clear = parts.length === 0;
  // THE OVERVIEW'S h1 WAS ITS OWN SIZE, AND IT WAS THE SMALLEST IN THE CONSOLE. This rendered at
  // clamp(1.5rem, 2.5vw, 1.95rem) with letter-spacing -0.028em, which resolves to 31.2px: the sixth distinct
  // h1 size in the app and the only one below 32. The first page a signed-in customer sees therefore had a
  // quieter title than every page they could click to from it, which is backwards. <PageHeader> owns the
  // size, the weight and the tracking now, and the wording is untouched.
  //
  // The lead keeps its one conditional: --fg-2 when something is actually wrong, --fg-3 when nothing is.
  // PageHeader's lead paragraph is --fg-3 by default, so the emphasised case carries its own colour on an
  // inner span rather than being flattened. That contrast IS the signal on a page whose whole job is to say
  // whether anything needs you, and dropping it to save a span would have quietly removed it.
  return (
    <PageHeader
      title="Operational state"
      lead={
        <span style={clear ? undefined : { color: "var(--fg-2)" }}>
          {clear ? "Nothing is failing and nothing is waiting on you." : parts.join(" ")}
        </span>
      }
    />
  );
}

// ── 1. Needs attention ────────────────────────────────────────────────────────────────────────────────
//
// The old rows were four identical red bars carrying a title and nothing else, which told a reader that
// something was wrong and refused to say anything more. An issue row in this table is already the DEDUPED
// record of a recurring failure (v_issues keeps first_seen_run and last_seen_run), so "seen again" is a fact
// we hold rather than a grouping we invent, and it is the single most useful thing to say: a failure that
// keeps coming back is a different problem from one that happened once.

export type AttentionItem = {
  issue: IssueRow;
  repair: RepairRow | null;
  lastProven: string | null;      // ISO of this system's most recent VERIFIED run, within the loaded window
  systemVerdict: Verdict | null;  // the system's latest public decision
};

// repair-lifecycle tracking is not wired yet — v_repairs has no writer anywhere in the codebase (see
// CURRENT_VRAELIS_CONTEXT.md), so `repair` is always null for every account and a status here could only
// ever read "Repair not started". A label that can never change is not a status, so it's not shown.

export function NeedsAttention({ items }: { items: AttentionItem[] }) {
  if (!items.length) return null;
  return (
    <section aria-label="Needs attention" style={{ marginBottom: 30 }}>
      <SectionHead text="Needs attention" count={items.length} href="/verifications" hrefLabel="All failures" />
      <div style={{ display: "grid", gap: 8 }}>
        {items.map(({ issue, lastProven, systemVerdict }) => {
          const recurring = Boolean(issue.firstSeenRun && issue.lastSeenRun && issue.firstSeenRun !== issue.lastSeenRun);
          const href = issue.applicationId ? `/systems/${issue.applicationId}/issues` : "/verifications";
          return (
            <Link key={issue.id} href={href}
              style={{ display: "block", padding: "13px 16px", border: "1px solid var(--line-2)", borderLeft: `3px solid ${SEV_COLOR[issue.severity] ?? "var(--fg-4)"}`, borderRadius: "var(--r-sm, 8px)", background: "var(--bg-1)", color: "inherit", textDecoration: "none" }}
              aria-label={`${issue.severity} issue on ${issue.applicationName || "a system"}: ${issue.title}`}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 5, flexWrap: "wrap" }}>
                <span className="pill" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: SEV_COLOR[issue.severity] ?? "var(--fg-4)", background: "var(--bg-2)", borderColor: "var(--line-2)", flex: "none" }}>{issue.severity}</span>
                <span style={{ fontSize: 13, color: "var(--fg-2)", fontWeight: 500 }}>{issue.applicationName || "System"}</span>
                {systemVerdict ? <VerdictBadge verdict={systemVerdict} size="sm" style={{ flex: "none" }} /> : null}
              </div>
              <div style={{ fontSize: 14.5, color: "var(--fg-1)", fontWeight: 500, lineHeight: 1.4 }}>{issue.title || "A blocking issue needs attention"}</div>
              <div style={{ display: "flex", gap: 14, marginTop: 7, flexWrap: "wrap", fontSize: 12, color: "var(--fg-4)" }}>
                <span>Found {timeAgo(issue.createdAt)}</span>
                {/* Absent means "no verified run inside the window this page loaded", which is NOT the same
                    claim as "never verified". Say the weaker, true thing. */}
                {lastProven ? <span>Last proven {timeAgo(lastProven)}</span> : <span>No verified run in recent history</span>}
                {recurring ? <span style={{ color: "var(--wait-ink)" }}>Seen again after an earlier run</span> : null}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ── 2. Systems ────────────────────────────────────────────────────────────────────────────────────────

export type SystemRow = {
  id: string; name: string;
  guarantees: number;
  verdict: Verdict;
  criticals: number;
  lastProven: string | null;
  deploymentUrl: string | null;
};

export function SystemsTable({ rows }: { rows: SystemRow[] }) {
  if (!rows.length) return null;
  return (
    <section aria-label="Systems" style={{ marginBottom: 30 }}>
      <SectionHead text="Systems" count={rows.length} href="/systems" hrefLabel="Open Systems"
        note="Latest verification, not full system coverage." />
      <div className="card vra-tbl" style={{ padding: 0, overflow: "hidden", background: "var(--bg-1)" }}>
        <div className="vra-tbl__head" role="presentation">
          <span>System</span><span>Guarantees</span><span>Latest result</span><span>Critical issues</span><span>Last proven</span>
        </div>
        {rows.map((s) => (
          <Link key={s.id} href={`/systems/${s.id}`} className="vra-tbl__row" aria-label={`${s.name}, latest verification ${s.verdict.label}`}>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 500, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name || "System"}</span>
              {s.deploymentUrl ? <DeploymentReference url={s.deploymentUrl} /> : null}
            </span>
            {/* data-l carries the column name so the narrow layout can print it before the value. Without it
                a phone showed a column of bare em dashes with nothing saying what was missing. */}
            <span data-l="Guarantees" style={{ fontVariantNumeric: "tabular-nums", color: s.guarantees ? "var(--fg-2)" : "var(--fg-5)" }}>{s.guarantees || "n/a"}</span>
            <span data-l="Latest"><VerdictBadge verdict={s.verdict} size="sm" style={{ flex: "none" }} /></span>
            <span data-l="Critical" style={{ fontVariantNumeric: "tabular-nums", color: s.criticals ? "var(--stop-ink)" : "var(--fg-5)" }}>{s.criticals || "n/a"}</span>
            <span data-l="Last proven" style={{ color: "var(--fg-4)" }}>{s.lastProven ? timeAgo(s.lastProven) : "n/a"}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── 3. Pending review ─────────────────────────────────────────────────────────────────────────────────
// No approve button. Approving happens on the plan's own page, against the text being approved.

export function PendingReview({ rows }: { rows: PendingReviewRow[] }) {
  if (!rows.length) return null;
  return (
    <section aria-label="Pending review" style={{ marginBottom: 30 }}>
      <SectionHead text="Pending review" count={rows.length} href="/review" hrefLabel="Open Review" />
      <div style={{ display: "grid", gap: 8 }}>
        {rows.map((p) => (
          <Link key={p.id} href={`/review/${p.id}`}
            style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 14, padding: "13px 16px", border: "1px solid var(--wait-line)", borderRadius: "var(--r-sm, 8px)", background: "var(--bg-1)", color: "inherit", textDecoration: "none" }}>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 500, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.claim || "Untitled claim"}</span>
              <span style={{ display: "flex", gap: 10, marginTop: 3, flexWrap: "wrap", fontSize: 12, color: "var(--fg-4)", alignItems: "center" }}>
                <DeploymentReference url={p.deploymentUrl} />
                <span>Created {timeAgo(p.createdAt)}</span>
                <span>{p.requirements} requirement{p.requirements === 1 ? "" : "s"}</span>
                <span>{p.flows} journey{p.flows === 1 ? "" : "s"}</span>
              </span>
            </span>
            <span style={{ fontSize: 13, color: "var(--wait-ink)", fontWeight: 600, flex: "none" }}>Review plan <span aria-hidden>→</span></span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── 4. Recent verifications ───────────────────────────────────────────────────────────────────────────
// parentRunId is the only repair relationship the model actually stores, so it is the only one shown.

export function RecentVerificationsTable({ rows }: { rows: PassRow[] }) {
  if (!rows.length) return null;
  return (
    <section aria-label="Recent verifications" style={{ marginBottom: 30 }}>
      <SectionHead text="Recent verifications" href="/verifications" hrefLabel="View all" />
      <div className="card vra-tbl vra-tbl--runs" style={{ padding: 0, overflow: "hidden", background: "var(--bg-1)" }}>
        <div className="vra-tbl__head" role="presentation">
          <span>Result</span><span>System</span><span>Journeys</span><span>When</span>
        </div>
        {rows.map((r) => {
          const v = runVerdict(r.state, r.decision);
          const href = r.applicationId ? `/systems/${r.applicationId}/passes/${r.id}` : "/verifications";
          return (
            <Link key={r.id} href={href} className="vra-tbl__row" aria-label={`${v.label}, ${r.applicationName || "verification"}`}>
              <span><VerdictBadge verdict={v} size="sm" style={{ flex: "none" }} /></span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13.5, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.applicationName || "Verification"}</span>
                {r.parentRunId ? <span style={{ fontSize: 11.5, color: "var(--fg-4)" }}>Reverification of an earlier run</span> : null}
              </span>
              <span data-l="Journeys" style={{ fontVariantNumeric: "tabular-nums", color: "var(--fg-3)" }}>{r.flowsTotal > 0 ? `${r.flowsPassed}/${r.flowsTotal}` : "n/a"}</span>
              <span data-l="When" style={{ color: "var(--fg-4)" }}>{timeAgo(r.completedAt ?? r.createdAt)}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// Dense-row CSS. One grid definition per table, restated at narrow widths as stacked rows so a phone gets a
// readable list instead of five crushed columns. Column headers are presentation-only: each row is a single
// link with its own aria-label, so a screen reader is not asked to navigate a table that is really a menu.
export const OVERVIEW_CSS = `
.vra-tbl__head{display:grid;gap:14px;padding:9px 16px;border-bottom:1px solid var(--line-2);background:var(--bg-2);
  font-family:var(--font-code);font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:var(--fg-5)}
.vra-tbl__row{display:grid;gap:14px;align-items:center;padding:11px 16px;color:inherit;text-decoration:none;font-size:13px;
  border-top:1px solid var(--line-1);transition:background 120ms ease}
.vra-tbl__row:first-of-type{border-top:none}
.vra-tbl__row:hover{background:var(--bg-2)}
.vra-tbl .vra-tbl__head,.vra-tbl .vra-tbl__row{grid-template-columns:minmax(0,2.4fr) 82px 118px 96px 104px}
.vra-tbl--runs .vra-tbl__head,.vra-tbl--runs .vra-tbl__row{grid-template-columns:104px minmax(0,2.6fr) 86px 92px}
/* Narrow: the header row cannot survive, so each cell prints its own column name from data-l and the row
   becomes a labelled stack. The name cell keeps the full width and drops its label, because it is the
   subject of the row rather than one of its fields. */
@media (max-width:760px){
  .vra-tbl__head{display:none}
  .vra-tbl .vra-tbl__row,.vra-tbl--runs .vra-tbl__row{grid-template-columns:1fr;gap:7px;padding:14px 16px}
  .vra-tbl__row>[data-l]{display:flex;align-items:center;justify-content:space-between;gap:14px}
  .vra-tbl__row>[data-l]::before{content:attr(data-l);font-family:var(--font-code);font-size:10px;
    letter-spacing:.07em;text-transform:uppercase;color:var(--fg-5)}
}
`;

// ── 5. Empty account ──────────────────────────────────────────────────────────────────────────────────

const STEPS = [
  { icon: I.layers, t: "Connect a system", d: "Point Vraelis at the public URL of something you shipped." },
  { icon: I.list, t: "State what must be true", d: "Describe the outcome a real user should be able to reach." },
  { icon: I.eye, t: "Review the proof plan", d: "Vraelis writes the requirements and journeys. You approve them. Free." },
  { icon: I.vote, t: "Get a decision", d: "A real browser run, evidence, and a repair prompt if it fails." },
];

export function EmptyOverview() {
  return (
    <section aria-label="Getting started" style={{ border: "1px dashed var(--line-3)", borderRadius: "var(--r-lg, 14px)", background: "var(--bg-2)", padding: "clamp(18px, 2.4vw, 26px)" }}>
      <h2 style={{ ...label, marginBottom: 6 }}>How this works</h2>
      <p style={{ margin: "0 0 18px", fontSize: 14, color: "var(--fg-3)", maxWidth: "56ch", lineHeight: 1.55 }}>
        Nothing has been verified yet, so there is no operational state to report. Name a deployment and the
        outcome it must keep true above.
      </p>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2 }}>
        {STEPS.map((s, i) => (
          <li key={i} style={{ display: "grid", gridTemplateColumns: "auto auto 1fr", gap: 12, alignItems: "start", padding: "10px 0", borderTop: i ? "1px solid var(--line-2)" : "none" }}>
            <span style={{ fontFamily: "var(--font-code)", fontSize: 12, color: "var(--fg-5)", fontWeight: 600, marginTop: 2 }}>{i + 1}</span>
            <span style={{ color: "var(--fg-3)", marginTop: 1 }}><Ic d={s.icon} size={16} /></span>
            <span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-1)" }}>{s.t}</span>
              <span style={{ display: "block", fontSize: 13, color: "var(--fg-4)", marginTop: 1, lineHeight: 1.5 }}>{s.d}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export { systemProof };
