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

// A SECTION HAS A HEADING, NOT A LABEL. These were 10.5px tracked capitals in the meta grey, so after the h1
// the page had no second level at all, only micro-caps. Real sentence-case headings, with the count as a
// quiet number beside them rather than in brackets.
const heading: CSSProperties = { fontSize: 15.5, fontWeight: 600, letterSpacing: "-0.005em", color: "var(--fg-1)", margin: 0 };
// Severity is a word, not a second colour. The verdict badge beside it already carries the state, so
// painting severity too put three warm marks on one row. Only critical keeps the failure ink, because
// critical is the one severity that means "this is failing now".
const SEV_INK: Record<string, string> = { critical: "var(--stop-ink)", high: "var(--fg-1)", medium: "var(--fg-3)", low: "var(--fg-4)" };
const SEV_WORD: Record<string, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };

function SectionHead({ text, count, href, hrefLabel, note }: { text: string; count?: number; href?: string; hrefLabel?: string; note?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <h2 style={heading}>
          {text}
          {typeof count === "number" ? <span style={{ marginLeft: 8, fontWeight: 500, color: "var(--fg-4)", fontVariantNumeric: "tabular-nums" }}>{count}</span> : null}
        </h2>
        {href && hrefLabel ? <Link href={href} style={{ fontSize: 13.5, fontWeight: 500, color: "var(--acc-deep)", flex: "none", textDecoration: "none" }}>{hrefLabel} <span aria-hidden>→</span></Link> : null}
      </div>
      {note ? <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--fg-4)" }}>{note}</p> : null}
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
    // "Operational state" was the title here, which is an operator's phrase for what this page is. It is the
    // Overview in the sidebar, so it is the Overview on the page.
    <PageHeader
      title="Overview"
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
    <section aria-label="Needs attention" style={{ marginBottom: 36 }}>
      <SectionHead text="Needs attention" count={items.length} href="/verifications" hrefLabel="All verifications" />
      {/* ONE CARD, DIVIDED ROWS. Each issue used to be its own card with a 3px coloured bar down its left
          edge, and four of them stacked read as a column of warning stripes. The founder called them "weird
          bars on the left". A list of problems is a list: one surface, hairlines between rows, and the
          single colour on each row is the verdict badge. */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {items.map(({ issue, lastProven, systemVerdict }, i) => {
          const recurring = Boolean(issue.firstSeenRun && issue.lastSeenRun && issue.firstSeenRun !== issue.lastSeenRun);
          const href = issue.applicationId ? `/systems/${issue.applicationId}/issues` : "/verifications";
          return (
            <Link key={issue.id} href={href} className="vra-attn"
              style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 16, alignItems: "center", padding: "14px 18px", borderTop: i ? "1px solid var(--line-1)" : "none", color: "inherit", textDecoration: "none" }}
              aria-label={`${issue.severity} issue on ${issue.applicationName || "a system"}: ${issue.title}`}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14.5, color: "var(--fg-1)", fontWeight: 500, lineHeight: 1.4 }}>{issue.title || "A blocking issue needs attention"}</span>
                <span style={{ display: "flex", gap: 8, marginTop: 5, flexWrap: "wrap", fontSize: 13, color: "var(--fg-4)", alignItems: "center" }}>
                  <span style={{ color: SEV_INK[issue.severity] ?? "var(--fg-3)", fontWeight: 600 }}>{SEV_WORD[issue.severity] ?? issue.severity}</span>
                  <span aria-hidden>·</span>
                  <span style={{ color: "var(--fg-2)" }}>{issue.applicationName || "System"}</span>
                  <span aria-hidden>·</span>
                  <span>Found {timeAgo(issue.createdAt)}</span>
                  {/* Absent means "no verified run inside the window this page loaded", which is NOT the same
                      claim as "never verified". Say the weaker, true thing. */}
                  <span aria-hidden>·</span>
                  {lastProven ? <span>Last verified {timeAgo(lastProven)}</span> : <span>No verified run in recent history</span>}
                  {recurring ? <><span aria-hidden>·</span><span style={{ color: "var(--fg-2)", fontWeight: 500 }}>Came back after an earlier run</span></> : null}
                </span>
              </span>
              {systemVerdict ? <VerdictBadge verdict={systemVerdict} size="sm" style={{ flex: "none" }} /> : null}
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
    <section aria-label="Systems" style={{ marginBottom: 36 }}>
      <SectionHead text="Systems" count={rows.length} href="/systems" hrefLabel="All systems"
        note="Each row shows the latest verification of that system, not everything it does." />
      <div className="card vra-tbl" style={{ padding: 0, overflow: "hidden", background: "var(--bg-1)" }}>
        <div className="vra-tbl__head" role="presentation">
          <span>System</span><span>Guarantees</span><span>Latest result</span><span>Critical issues</span><span>Last verified</span>
        </div>
        {rows.map((s) => (
          <Link key={s.id} href={`/systems/${s.id}`} className="vra-tbl__row" aria-label={`${s.name}, latest verification ${s.verdict.label}`}>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 500, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name || "System"}</span>
              {s.deploymentUrl ? <DeploymentReference url={s.deploymentUrl} /> : null}
            </span>
            {/* data-l carries the column name so the narrow layout can print it before the value. Without it
                a phone showed a column of bare em dashes with nothing saying what was missing. */}
            {/* A count of zero is 0. "n/a" said the number did not apply, when it was simply nothing. */}
            <span data-l="Guarantees" style={{ fontVariantNumeric: "tabular-nums", color: s.guarantees ? "var(--fg-2)" : "var(--fg-4)" }}>{s.guarantees}</span>
            <span data-l="Latest"><VerdictBadge verdict={s.verdict} size="sm" style={{ flex: "none" }} /></span>
            <span data-l="Critical" style={{ fontVariantNumeric: "tabular-nums", color: s.criticals ? "var(--stop-ink)" : "var(--fg-4)", fontWeight: s.criticals ? 600 : 400 }}>{s.criticals}</span>
            <span data-l="Last verified" style={{ color: "var(--fg-4)" }}>{s.lastProven ? timeAgo(s.lastProven) : "Not yet"}</span>
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
    <section aria-label="Plans waiting for approval" style={{ marginBottom: 36 }}>
      <SectionHead text="Plans waiting for you" count={rows.length} href="/review" hrefLabel="All plans" />
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {rows.map((p, i) => (
          <Link key={p.id} href={`/review/${p.id}`} className="vra-attn"
            style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 14, padding: "14px 18px", borderTop: i ? "1px solid var(--line-1)" : "none", color: "inherit", textDecoration: "none" }}>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 500, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.claim || "Untitled claim"}</span>
              <span style={{ display: "flex", gap: 10, marginTop: 3, flexWrap: "wrap", fontSize: 12, color: "var(--fg-4)", alignItems: "center" }}>
                <DeploymentReference url={p.deploymentUrl} />
                <span>Created {timeAgo(p.createdAt)}</span>
                <span>{p.requirements} requirement{p.requirements === 1 ? "" : "s"}</span>
                <span>{p.flows} journey{p.flows === 1 ? "" : "s"}</span>
              </span>
            </span>
            <span style={{ fontSize: 13.5, color: "var(--acc-deep)", fontWeight: 600, flex: "none" }}>Review plan <span aria-hidden>→</span></span>
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
    <section aria-label="Recent verifications" style={{ marginBottom: 36 }}>
      <SectionHead text="Recent verifications" href="/verifications" hrefLabel="View all" />
      <div className="card vra-tbl vra-tbl--runs" style={{ padding: 0, overflow: "hidden", background: "var(--bg-1)" }}>
        <div className="vra-tbl__head" role="presentation">
          <span>Result</span><span>What was checked</span><span>Journeys</span><span>When</span>
        </div>
        {rows.map((r) => {
          const v = runVerdict(r.state, r.decision);
          const href = r.applicationId ? `/systems/${r.applicationId}/passes/${r.id}` : "/verifications";
          // The sentence leads (audit P1-4); the system and the re-check relationship sit under it.
          const sub = [r.claim ? r.applicationName : "", r.parentRunId ? "Re-check of an earlier run" : ""].filter(Boolean);
          return (
            <Link key={r.id} href={href} className="vra-tbl__row" aria-label={`${v.label}, ${r.claim || r.applicationName || "verification"}`}>
              <span><VerdictBadge verdict={v} size="sm" style={{ flex: "none" }} /></span>
              <span style={{ minWidth: 0 }}>
                <span className="vra-claim">{r.claim || r.applicationName || "Verification"}</span>
                {sub.length ? <span style={{ display: "block", marginTop: 2, fontSize: 12.5, color: "var(--fg-4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub.join(" · ")}</span> : null}
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
.vra-tbl__head{display:grid;gap:14px;padding:10px 18px;border-bottom:1px solid var(--line-2);background:var(--bg-2);
  font-size:12.5px;font-weight:500;color:var(--fg-4)}
.vra-tbl__row{display:grid;gap:14px;align-items:center;padding:12px 18px;color:inherit;text-decoration:none;font-size:14px;
  border-top:1px solid var(--line-1);transition:background 120ms ease}
.vra-tbl__row:first-of-type{border-top:none}
.vra-claim{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-size:14px;line-height:1.4;color:var(--fg-1);font-weight:500}
.vra-tbl__row:hover,.vra-attn:hover{background:var(--bg-2)}
.vra-attn{transition:background 120ms ease}
.vra-tbl .vra-tbl__head,.vra-tbl .vra-tbl__row{grid-template-columns:minmax(0,2.4fr) 96px 124px 112px 112px}
.vra-tbl--runs .vra-tbl__head,.vra-tbl--runs .vra-tbl__row{grid-template-columns:112px minmax(0,2.6fr) 90px 96px}
/* Narrow: the header row cannot survive, so each cell prints its own column name from data-l and the row
   becomes a labelled stack. The name cell keeps the full width and drops its label, because it is the
   subject of the row rather than one of its fields. */
@media (max-width:760px){
  .vra-tbl__head{display:none}
  .vra-tbl .vra-tbl__row,.vra-tbl--runs .vra-tbl__row{grid-template-columns:1fr;gap:7px;padding:14px 16px}
  .vra-tbl__row>[data-l]{display:flex;align-items:center;justify-content:space-between;gap:14px}
  .vra-tbl__row>[data-l]::before{content:attr(data-l);font-size:12.5px;color:var(--fg-4)}
}
`;

// ── 5. Empty account ──────────────────────────────────────────────────────────────────────────────────

// The four steps as the composer above actually runs them. Step 1 used to be "Connect a system", which the
// form above never asks for, so the first instruction a new account read disagreed with the form in front
// of it.
const STEPS = [
  { icon: I.list, t: "Say what should work", d: "The live URL, and one sentence about what a real user should be able to do there." },
  { icon: I.eye, t: "Approve the plan", d: "Vraelis writes the steps that would prove it. You read them and approve. Writing a plan is free." },
  { icon: I.layers, t: "It runs on the live app", d: "A real browser follows the plan and records every step, a screenshot, console errors and failed requests." },
  { icon: I.vote, t: "Fix and check again", d: "If something broke you get what was expected, what happened, and a repair prompt. Re-check without a new approval." },
];

export function EmptyOverview() {
  return (
    <section aria-label="How it works" className="card" style={{ padding: "clamp(18px, 2.4vw, 26px)" }}>
      <h2 style={{ ...heading, marginBottom: 6 }}>How it works</h2>
      <p style={{ margin: "0 0 18px", fontSize: 14, color: "var(--fg-3)", maxWidth: "60ch", lineHeight: 1.55 }}>
        Nothing has been checked yet. Start with the form above: a live URL and one sentence about what should work.
      </p>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2 }}>
        {STEPS.map((s, i) => (
          <li key={i} style={{ display: "grid", gridTemplateColumns: "auto auto 1fr", gap: 12, alignItems: "start", padding: "10px 0", borderTop: i ? "1px solid var(--line-2)" : "none" }}>
            <span style={{ fontSize: 13, color: "var(--fg-4)", fontWeight: 600, marginTop: 1, fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
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
