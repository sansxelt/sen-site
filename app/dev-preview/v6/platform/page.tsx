import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { PlatformAside } from "../_system/hero-asides";
import { v6meta } from "../_system/meta";
import { PageHero, Reveal, SectionHead, CTA, EditorialLink, Signal, Kicker } from "../_system/ui";
import "../_system/coverage.css";
import { LIVE, DIRECTION, type DirectionItem } from "../_content/scope";
import { SURFACES, COVERAGE_THESIS, COVERAGE_RULE } from "../_content/coverage";
import { V6_BASE } from "@/lib/v6-routes";

// Platform overview (design 06). This is the MECHANISM page, and since the homepage's primary call to action
// lands here it has to deliver the loop in the opening rather than a slogan: one sentence about a deployed
// web app, a plan derived from it and approved by a person, a real hosted browser on the live app, and one
// of three words, with the evidence. LIGHT = framing; GRAPHITE = live work.
//
// 2026-09-28: THE CLAIM IS THE OBJECT NOW, NOT THE GUARANTEE. The public story was locked on one function,
// described narrowly, for a wide audience. A guarantee still exists in the console (a claim saved so it can
// be checked again) and is mentioned once as that. HTTP APIs left the headline, the coverage ladder lost
// everything past the browser, and the two expanded Direction blocks (sensitive steps held for a person,
// memory across guarantees) left #current, because both described a much larger product than the one a
// reader can use today.
//
// THE PAGE USED TO SELL AN OBJECT THE PRODUCT DOES NOT HAVE. Every heading, the metadata and the signature
// panel were built on "responsibility", a noun with no table, no column and no type anywhere in this
// repository. The durable object is a guarantee (sql/vraelis-preflight-19-guarantees.sql, read through
// lib/preflight, listed by the console at /guarantees), which meant the site sold one thing and the account
// a reader signed into contained another. The vocabulary here is now the product's own.

export const metadata: Metadata = v6meta({
  title: "Platform",
  description:
    "How Vraelis checks a deployed web app, or a connected device through its web control panel: one sentence about what should work, one plan a person approves, one real browser run on the live app, and one decision with the evidence.",
  path: "/platform",
  ogTitle: "The Vraelis platform",
  ogDescription:
    "One sentence, one approved plan, one real run on the live app, and everything it saw.",
});

const BASE = V6_BASE;
type Sig = "go" | "wait" | "stop";
const DOT: Record<string, string> = {
  go: "var(--go-dk)",
  wait: "var(--wait-dk)",
  stop: "var(--stop-dk)",
  none: "var(--g-fg-3)",
};

const wrapRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "clamp(20px,2.8vw,44px)",
  alignItems: "stretch",
};

// A raised panel INSIDE an already-graphite section. GPanel below is the other half of this pair, for a
// graphite panel sitting on a light section; this one does not need the .v6-dark class because the section
// it lives in already carries it.
const DARK_PANEL: CSSProperties = {
  background: "var(--graphite-2)",
  border: "1px solid var(--g-line)",
  borderRadius: 16,
  padding: "clamp(18px,2.2vw,26px)",
  height: "100%",
};

/* ---------- small building blocks (server, no state) ---------- */

function GPanel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  // Graphite panel usable inside a LIGHT section. v6-dark makes signal + heading colors resolve correctly;
  // the inline background overrides v6-dark's default so the panel reads as a raised surface.
  return (
    <div
      className="v6-dark"
      data-nav-dark
      style={{
        background: "var(--graphite-2)",
        border: "1px solid var(--g-line)",
        borderRadius: 16,
        padding: "clamp(20px,2.4vw,30px)",
        boxShadow: "var(--sh-lg)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function GBar({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        paddingBottom: 16,
        marginBottom: 18,
        borderBottom: "1px solid var(--g-line)",
      }}
    >
      {left}
      {right}
    </div>
  );
}

/* ============================ the signature: one durable record ============================ */

// "API trace" was the third of these and it named a file that does not exist. The ArtifactSink a run writes
// through (worker/preflight/types.ts:149) has exactly one method, saveScreenshot, and what a run keeps
// besides those is the per step row of url, status, expected against observed and timing, plus console
// errors and failed network requests. No Playwright trace is written, nothing offers one for download, and
// "trace" is the kind of word a reader arrives expecting to be able to open. The line now lists the four
// things that are genuinely captured.
const RECORD_FACTS: [string, string][] = [
  ["Deployment", "https://app.example.com"],
  ["Asked from", "The console, the CLI, CI, or an AI assistant"],
  ["Evidence", "Screenshots, step record, console and network errors"],
  ["History", "Every run preserved, nothing overwritten"],
];

// THE LIFE OF ONE CHECK, in the states it really passes through. Rewritten 2026-09-28: the previous list
// followed a usage-billing guarantee and included "Assumption challenged" and "Decision required", which
// were the sensitive-step hold that /platform#current itself listed as not built. Every row below is a
// thing the product does today, in the order it does it, for an ordinary claim anyone could write.
const RECORD_STATES: { t: string; d: string; sig?: Sig; tag?: string }[] = [
  { t: "Claim written", d: "One sentence about what the app should do, from you, a teammate, a CI job, or an AI assistant.", sig: "go", tag: "Recorded" },
  { t: "Plan written", d: "Vraelis turns the sentence into requirements and the browser steps that would prove them. A claim no check could prove is refused, and nothing is charged." },
  { t: "Plan approved", d: "A person approves that exact plan with one click. An API key cannot approve it, so no script or agent signs off on its own check." },
  { t: "Run recorded", d: "A real browser drives the deployed app. Each step records what it expected and what it observed, with screenshots." },
  { t: "Failed", d: "After cancelling, Billing still showed Active. Expected Cancelled, observed Active.", sig: "stop", tag: "Failed" },
  { t: "Repair prompt", d: "What should have happened, what happened instead, and how to reproduce it, written for whoever fixes it: a person or a coding agent.", sig: "wait", tag: "Handed back" },
  { t: "Re-checked", d: "Once the fix is deployed, the same approved plan runs again as its own record, with no new approval inside 24 hours." },
  { t: "Verified", d: "The claim held on the live app. The earlier Failed run is kept, not overwritten.", sig: "go", tag: "Verified" },
];

function RecordObject() {
  return (
    <GPanel>
      {/* This read "Responsibility record / GR-4471". There is no GR- identifier anywhere in this product,
          which made it an invented reference number dressing a diagram up as a screenshot of a specific
          record. The panel is an illustration of the record's SHAPE, so it says that instead. The vrf_ ids
          elsewhere on the site are different and stay: those are example payloads in API documentation,
          where an example id is what the reader needs. */}
      <GBar
        left={
          <span className="v6-kicker" style={{ color: "var(--g-fg-3)" }}>
            The shape of one check
          </span>
        }
        right={<Signal state="go">Verified</Signal>}
      />
      {/* THE HEADLINE OF THIS PANEL IS THE CLAIM, the one sentence a person writes and the thing the record
          hangs off. It is an ordinary product behaviour on purpose, not an agent task. */}
      <p style={{ margin: 0, color: "var(--g-fg)", fontSize: "clamp(1.15rem,1.7vw,1.4rem)", fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.25 }}>
        A signed-in user can cancel their plan from Billing and then sees Cancelled.
      </p>
      <p style={{ margin: "8px 0 0", color: "var(--g-fg-2)", fontSize: 14.5, lineHeight: 1.5 }}>
        Every run of this check lands on one record, in order.
      </p>

      {/* accumulated context */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "20px 0 6px" }}>
        {RECORD_FACTS.map(([k, v]) => (
          <div
            key={k}
            style={{
              flex: "1 1 220px",
              minWidth: 0,
              background: "var(--graphite-3)",
              border: "1px solid var(--g-line)",
              borderRadius: 11,
              padding: "12px 14px",
            }}
          >
            <div className="v6-mono" style={{ fontSize: 11.5, color: "var(--g-fg-3)" }}>{k}</div>
            <div style={{ marginTop: 5, color: "var(--g-fg)", fontSize: 13.5, lineHeight: 1.4 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* the life of the record */}
      <ol style={{ listStyle: "none", margin: "22px 0 0", padding: "4px 0 0", position: "relative" }}>
        <span aria-hidden style={{ position: "absolute", left: 6, top: 14, bottom: 18, width: 1, background: "var(--g-line)" }} />
        {RECORD_STATES.map((s) => (
          <li key={s.t} style={{ display: "grid", gridTemplateColumns: "16px minmax(0,1fr)", gap: 14, padding: "11px 0", alignItems: "start" }}>
            <span
              aria-hidden
              style={{
                marginTop: 4,
                width: 13,
                height: 13,
                borderRadius: 999,
                background: "var(--graphite-2)",
                border: `2px solid ${DOT[s.sig ?? "none"]}`,
                boxShadow: "0 0 0 3px var(--graphite-2)",
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <span style={{ color: "var(--g-fg)", fontWeight: 600, fontSize: 15 }}>{s.t}</span>
                {s.sig ? <Signal state={s.sig}>{s.tag}</Signal> : null}
              </div>
              <p style={{ margin: "4px 0 0", color: "var(--g-fg-2)", fontSize: 14, lineHeight: 1.5 }}>{s.d}</p>
            </div>
          </li>
        ))}
      </ol>
    </GPanel>
  );
}

/* ============================ section-scoped data ============================ */

// EXAMPLE CLAIMS, ACROSS ORDINARY PRODUCT BEHAVIOUR. Each line is one sentence that is either true of the
// running app or is not, which is the only kind of line a check can hold. They were guarantees about billing
// and tenant exports; they now span what anyone responsible for a web app writes down: sign-up, sign-in,
// checkout, an invite with the right role, a form that saves, one customer not seeing another's data, and a
// connected device checked through its control panel.
// In review is a plan waiting on a person, which /docs/systems is careful to say is not a verdict.
const WORK: { t: string; sys: string; state: Sig; label: string }[] = [
  { t: "A new visitor can sign up and reach the dashboard", sys: "Sign-up and onboarding", state: "go", label: "Verified" },
  { t: "A paid customer keeps Pro access after signing back in", sys: "Checkout and sign-in", state: "go", label: "Verified" },
  { t: "An invited teammate joins with the Editor role, not Admin", sys: "Team and roles", state: "wait", label: "In review" },
  { t: "The contact form saves and shows a confirmation", sys: "Forms", state: "stop", label: "Failed" },
  { t: "One customer never sees another customer's invoices", sys: "Billing and accounts", state: "wait", label: "Blocked" },
  { t: "After an operator presses Return home, the drone shows Landed, and still does after a reload", sys: "Fleet control panel", state: "wait", label: "In review" },
];

// WHAT A RUN IS ACTUALLY GIVEN, and every line is a gate that exists in the product today rather than a
// description of one. The address is resolved before admission (above the credit hold, so a typo costs
// nothing), the guarantee is a sentence a person wrote and approved, and the plan is minted by a dry run
// and consumed unchanged by the paid execution.
const RUN_INPUTS: { t: string; d: string }[] = [
  { t: "A deployment it can reach", d: "The hostname is resolved before the run is admitted, above the credit hold, so a mistyped address costs nothing rather than buying a report that the address was wrong." },
  { t: "A claim, in one sentence", d: "What a user can do and what should be true afterwards. It is held outside the code, so the standard the change is judged against cannot be edited by the work being judged." },
  { t: "A plan a person approved", d: "Derived from the claim, reviewed, then run exactly as approved. Vraelis declines to charge when it cannot build a check that would prove the claim." },
];

// THE STATES A RUN REALLY MOVES THROUGH. These are the run states in lib/preflight, not an illustration of
// them: queued, running, and then one terminal state, which lib/preflight/public-decision.ts maps to the
// three words the API, the CI gate and the webhooks all return.
const RUN_STATES: { t: string; d: string; sig?: Sig; tag?: string }[] = [
  { t: "Queued", d: "Admitted, and waiting for a worker to lease it." },
  { t: "Running", d: "A real browser is driving the live deployment, one approved step at a time." },
  { t: "Verified", d: "The claim held, and the evidence behind that decision is kept with the record.", sig: "go", tag: "Verified" },
  { t: "Failed", d: "The claim did not hold. The evidence and a repair prompt go back to whoever asked.", sig: "stop", tag: "Failed" },
  { t: "Blocked", d: "No verdict could be reached, so none is reported. Nothing is recorded as proven.", sig: "wait", tag: "Blocked" },
];

const FINDINGS: { claim: string; reality: string; sig: Sig; tag: string }[] = [
  { claim: "“Users can cancel their plan from Billing.”", reality: "After cancelling, Billing still showed Active.", sig: "stop", tag: "Failed" },
  { claim: "“Invited teammates join as Editors.”", reality: "The invite was accepted and the teammate was given Admin.", sig: "stop", tag: "Failed" },
  { claim: "“Checkout grants Pro access.”", reality: "The test account could not sign in, so no answer was given.", sig: "wait", tag: "Blocked" },
];

const KNOWLEDGE: [string, string, string][] = [
  ["Documentation", "Use and administer Vraelis", `${BASE}/docs`],
  ["Vraelis Method", "The worldview behind the product", `${BASE}/method`],
  ["README", "Why Vraelis exists", `${BASE}/readme`],
  ["Changelog", "What shipped, dated", `${BASE}/changelog`],
  ["Research", "The methodology and open questions", `${BASE}/research`],
];

/* LIVE and DIRECTION MOVED TO _content/scope.ts, because /company was rendering a second, older copy of both
   and the two had already drifted apart. The reasoning that produced the [destination, present tense] shape
   travelled with the data and now lives above it there, including why there is no /roadmap route. This page
   is still where the section lives; it is no longer where the list is authored. */

/* The Direction column's own renderer. Same dot and the same rhythm as Led, so the two cards still read as
   one comparison, with a second line underneath each item carrying the present tense. Quieter than the
   destination above it in weight but not in colour: this is the sentence that has to survive being skimmed.
   The tier sits on the destination line as a mono label. It is deliberately the smallest thing in the card:
   it orders the column by how much of each item already stands, and it is not a date, because the paragraph
   under both columns promises there are none. */
function Planned({ items }: { items: DirectionItem[] }) {
  return (
    <ul style={{ listStyle: "none", margin: "18px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 18 }}>
      {items.map(([t, now, tier]) => (
        <li key={t} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
          <span aria-hidden style={{ marginTop: 7, width: 7, height: 7, borderRadius: 999, background: "var(--wait)", flex: "none" }} />
          <span>
            <span style={{ display: "block", fontSize: 15, lineHeight: 1.5, color: "var(--ink-2)" }}>
              {t}
              <span className="v6-mono" style={{ marginLeft: 8, fontSize: 11.5, color: "var(--ink-4)", whiteSpace: "nowrap" }}>{tier}</span>
            </span>
            <span style={{ display: "block", fontSize: 13.5, lineHeight: 1.55, color: "var(--ink-4)", marginTop: 4 }}>{now}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Led({ items, tone }: { items: string[]; tone: Sig }) {
  return (
    <ul style={{ listStyle: "none", margin: "18px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((t) => (
        <li key={t} style={{ display: "flex", gap: 11, alignItems: "flex-start", fontSize: 15, lineHeight: 1.5, color: "var(--ink-2)" }}>
          <span aria-hidden style={{ marginTop: 7, width: 7, height: 7, borderRadius: 999, background: tone === "go" ? "var(--go)" : "var(--wait)", flex: "none" }} />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

/* ================================= page ================================= */

export default function Platform() {
  return (
    <>
      <PageHero
        kicker="The platform"
        // THE OPENING IS THE LOOP, in the order it happens, in the product's own words. Three short sentences
        // rather than one long clause: a reader scanning it gets the whole loop from the line breaks alone.
        title="One sentence. One approved plan. One answer from the live app."
        lead="Write what your deployed web app, or a device it controls, should do. Vraelis turns it into a plan, a person approves it, a real browser tries it on the live app, and you see exactly what happened, with the evidence. Start it from the console, the CLI, CI, or an AI assistant."
        aside={<PlatformAside />}
        cta={
          <>
            <CTA brand lg>Open Vraelis</CTA>
            <EditorialLink href={`${BASE}/integrations`}>Ways to use it</EditorialLink>
          </>
        }
      />

      {/* 1 ── Signature: the durable record everything happens on ── */}
      <section className="v6-sec" style={{ paddingTop: "clamp(12px,2vw,28px)" }}>
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="One record per check"
              title="Everything about a check lives on one record."
              lead="The claim, the plan a person approved, each run in a real browser, what broke, the repair prompt, the re-check, and the decision, kept in order. A later run never overwrites an earlier one."
            />
          </Reveal>
          <Reveal media style={{ marginTop: "clamp(28px,3.4vw,44px)" }}>
            <RecordObject />
          </Reveal>
        </div>
      </section>

      {/* 2 ── Guarantee ── */}
      <section className="v6-sec v6-sec--sunk">
        <div className="v6-wrap">
          <div style={wrapRow}>
            <Reveal style={{ flex: "1 1 340px", minWidth: 0 }}>
              <SectionHead
                eyebrow="The claim"
                title="Start from what should work, not from the code."
                lead="Vraelis does not read your code. It starts from one plain sentence about what a user can do and what should be true afterwards, and checks that on the running app. Save a claim as a guarantee in the console and it can be checked again later."
              />
            </Reveal>
            <Reveal style={{ flex: "1 1 320px", minWidth: 0 }} i={1}>
              <div className="v6-card">
                <Kicker>What should work</Kicker>
                <p style={{ margin: "12px 0 0", color: "var(--ink)", fontSize: "1.15rem", fontWeight: 600, lineHeight: 1.35, letterSpacing: "-0.015em" }}>
                  An invited teammate can join the workspace and gets the Editor role, not Admin.
                </p>
                <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)", display: "grid", gap: 10 }}>
                  {[["Claim", "One sentence, an outcome"], ["Approval", "A person, once"], ["Target", "A public https deployment"]].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14 }}>
                      <span className="v6-mono" style={{ color: "var(--ink-4)", fontSize: 12 }}>{k}</span>
                      <span style={{ color: "var(--ink-2)", textAlign: "right" }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 3 ── Work ── */}
      <section className="v6-sec">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Checks"
              title="Every claim, and where each one stands."
              lead="The console lists every claim you have checked on an app and how its latest run decided, in one decision vocabulary. The rows below are examples."
            />
          </Reveal>
          <Reveal media style={{ marginTop: "clamp(28px,3vw,40px)" }}>
            <div className="v6-card" style={{ padding: 0, overflow: "hidden" }}>
              {WORK.map((w, i) => (
                <div
                  key={w.t}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 14,
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "clamp(16px,2vw,22px) clamp(18px,2.2vw,26px)",
                    borderTop: i === 0 ? "none" : "1px solid var(--line)",
                  }}
                >
                  <div style={{ minWidth: 0, flex: "1 1 260px" }}>
                    <div style={{ color: "var(--ink)", fontWeight: 600, fontSize: "1.02rem", letterSpacing: "-0.01em" }}>{w.t}</div>
                    <div style={{ marginTop: 4, color: "var(--ink-4)", fontSize: 13 }}>{w.sys}</div>
                  </div>
                  <Signal state={w.state}>{w.label}</Signal>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* 4 ── Run activity (GRAPHITE) ──
          THIS SECTION USED TO SHOW A FEED THIS PRODUCT CANNOT PRODUCE.
          It was a timestamped live feed reading "Plan submitted", "7 files changed", "Stripe API called",
          under a lead saying Vraelis follows submitted plans, code changes and tool effects. None of that is
          ingested, by this product, today. The Direction column further down said so, and the boundary note
          sitting directly under the feed said so, which meant one section contradicted itself twice over and
          the illustration was the loudest part.
          A mock is not a neutral placeholder on a site whose entire claim is that a record must not drift
          from the thing it records. What replaces it is the run lifecycle that actually exists in
          lib/preflight: what a run is given before it is admitted, the states it really moves through, and
          the three words it can end on. Nothing here is invented, and nothing here needs a caveat. */}
      <section className="v6-sec v6-dark" data-nav-dark>
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Run activity"
              title="What Vraelis observes is the running app, not the builder."
              lead="A check begins when someone says the work is done. From there a real browser drives the live deployment and each step is recorded as it happens, with its evidence attached. Vraelis does not read code, diffs or tool calls, and it does not watch anyone while they work."
            />
          </Reveal>

          <div style={{ ...wrapRow, marginTop: "clamp(28px,3vw,40px)" }}>
            <Reveal media style={{ flex: "1 1 300px", minWidth: 0 }}>
              <div style={DARK_PANEL}>
                <GBar left={<Kicker>What a run is given</Kicker>} />
                <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
                  {RUN_INPUTS.map((r, i) => (
                    <li key={r.t} style={{ padding: "13px 0", borderTop: i === 0 ? "none" : "1px solid var(--g-line)" }}>
                      <p style={{ margin: 0, color: "var(--g-fg)", fontWeight: 600, fontSize: 14.5 }}>{r.t}</p>
                      <p style={{ margin: "5px 0 0", color: "var(--g-fg-2)", fontSize: 14, lineHeight: 1.55 }}>{r.d}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </Reveal>

            <Reveal media i={1} style={{ flex: "1 1 300px", minWidth: 0 }}>
              <div style={DARK_PANEL}>
                <GBar left={<Kicker>The states a run moves through</Kicker>} />
                <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
                  {RUN_STATES.map((s, i) => (
                    <li
                      key={s.t}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0,1fr) auto",
                        gap: "clamp(10px,1.6vw,18px)",
                        alignItems: "baseline",
                        padding: "13px 0",
                        borderTop: i === 0 ? "none" : "1px solid var(--g-line)",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, color: "var(--g-fg)", fontWeight: 600, fontSize: 14.5 }}>{s.t}</p>
                        <p style={{ margin: "5px 0 0", color: "var(--g-fg-2)", fontSize: 14, lineHeight: 1.55 }}>{s.d}</p>
                      </div>
                      {s.sig ? <Signal state={s.sig}>{s.tag}</Signal> : (
                        <span className="v6-mono" style={{ color: "var(--g-fg-3)", fontSize: 12 }}>In flight</span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            </Reveal>
          </div>

          {/* The three terminal words are the product's own external contract, not a presentation choice:
              lib/preflight/public-decision.ts is what the API, the CI gate and the outbound webhooks all
              translate through, so a reader here and a machine reading the API are told the same thing. */}
          <Reveal style={{ marginTop: 22 }}>
            <p style={{ color: "var(--g-fg-2)", fontSize: 14.5, maxWidth: "72ch", margin: 0 }}>
              Every run ends in a plain answer with the evidence behind it, and the console, the CLI, the API,
              the MCP tools and the webhooks all return the same one. When no answer can be reached, the run says
              so instead of guessing, which is what keeps the other answers worth having.{" "}
              <Link href={`${BASE}/docs/run-activity`} className="v6-plink">How a run is recorded</Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* A DIRECTION SECTION USED TO SIT HERE, in the selling flow between the run and the findings. It moved
          into #current and was then removed from the page entirely on 2026-09-28 with the rest of the
          larger-product story. Run activity and findings are two graphite sections back to back on purpose:
          one dark run covering the execution and what it surfaced. */}

      {/* 6 ── Findings (GRAPHITE) ── */}
      <section className="v6-sec v6-dark" data-nav-dark>
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Findings"
              title="Where a claim and the live app disagree."
              lead="When the app does not do what the sentence says, the run records what was expected, what was observed, and how to reproduce it. When the run cannot decide, it says Blocked and gives the reason, rather than guessing."
            />
          </Reveal>
          <div style={{ marginTop: "clamp(28px,3vw,40px)", display: "flex", flexDirection: "column", gap: 14 }}>
            {FINDINGS.map((f, i) => (
              <Reveal key={f.claim} i={i}>
                <div style={{ background: "var(--graphite-2)", border: "1px solid var(--g-line)", borderRadius: 14, padding: "clamp(18px,2vw,24px)" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--g-fg-2)", fontSize: 15.5, fontStyle: "italic" }}>{f.claim}</span>
                    <Signal state={f.sig}>{f.tag}</Signal>
                  </div>
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--g-line)", display: "flex", gap: 11, alignItems: "flex-start" }}>
                    <span aria-hidden style={{ marginTop: 6, width: 7, height: 7, borderRadius: 999, background: DOT[f.sig], flex: "none" }} />
                    <span style={{ color: "var(--g-fg)", fontSize: 15, lineHeight: 1.5 }}>{f.reality}</span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 7 ── Repair (real engine, deeper) ── */}
      <section className="v6-sec v6-sec--sunk">
        <div className="v6-wrap">
          <div style={wrapRow}>
            <Reveal style={{ flex: "1 1 340px", minWidth: 0 }}>
              <SectionHead
                eyebrow="Fix and re-check, live today"
                title="A fix is finished when the check passes again."
                lead="On Failed, Vraelis writes a repair prompt for whoever fixes it, a person or a coding agent. Deploy the fix and re-check: the same approved plan runs again with no new approval, within 24 hours of the approval and up to 10 times, on the same site. It passes as its own record, and the earlier Failed stays."
              />
              <div style={{ marginTop: 24 }}>
                <EditorialLink href={`${BASE}/docs/recheck`}>How a re-check works</EditorialLink>
              </div>
            </Reveal>
            <Reveal media style={{ flex: "1 1 340px", minWidth: 0 }} i={1}>
              <GPanel style={{ boxShadow: "var(--sh-md)" }}>
                <GBar left={<span className="v6-kicker" style={{ color: "var(--g-fg-3)" }}>The claim, held outside the code</span>} />
                <p style={{ margin: 0, color: "var(--g-fg)", fontSize: "1.1rem", fontWeight: 600, lineHeight: 1.35 }}>
                  A paid customer keeps Pro access after signing back in.
                </p>
                <div style={{ marginTop: 18, display: "flex", flexDirection: "column" }}>
                  {[
                    ["The work claimed", "checkout complete", "none"],
                    ["Payment", "succeeded", "none"],
                    ["Access", "not granted", "stop"],
                    ["First fix, re-checked", "did not survive sign-in", "stop"],
                    ["Second fix, re-checked", "Verified", "go"],
                  ].map(([k, v, tone], i) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "11px 0", borderTop: i === 0 ? "none" : "1px solid var(--g-line)" }}>
                      <span style={{ color: "var(--g-fg-2)", fontSize: 14 }}>{k}</span>
                      <span style={{ color: tone === "stop" ? "var(--stop-dk)" : tone === "go" ? "var(--go-dk)" : "var(--g-fg)", fontSize: 14, fontWeight: 600, textAlign: "right" }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--g-line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <Signal state="go">Verified / 72c98e</Signal>
                  <span className="v6-mono" style={{ color: "var(--g-fg-3)", fontSize: 12 }}>Earlier records preserved</span>
                </div>
              </GPanel>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 8 ── Completion (GRAPHITE) ── */}
      <section className="v6-sec v6-dark" data-nav-dark>
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Completion"
              title="Done is something the live app shows."
              lead="When someone says it works, Vraelis checks and shows what happened. Whoever produced the work does not get to mark it done."
            />
          </Reveal>
          <div className="v6-grid3" style={{ marginTop: "clamp(28px,3vw,40px)" }}>
            {[
              { s: "go" as Sig, t: "It works", d: "The sentence holds on the live app, checked against the plan a person approved." },
              { s: "stop" as Sig, t: "It does not", d: "The app does not do what the sentence says. The gap is recorded as evidence, with a repair prompt." },
              // Blocked is amber everywhere else in the product: it is the honest third answer, not a failure.
              { s: "wait" as Sig, t: "It could not tell", d: "No answer could be reached, so none is reported. Nothing is recorded as proven." },
            ].map((c, i) => (
              <Reveal key={c.t} i={i}>
                <div style={{ background: "var(--graphite-2)", border: "1px solid var(--g-line)", borderRadius: 14, padding: "clamp(20px,2.2vw,26px)", height: "100%" }}>
                  <Signal state={c.s}>{c.t}</Signal>
                  <p style={{ margin: "14px 0 0", color: "var(--g-fg-2)", fontSize: 15, lineHeight: 1.55 }}>{c.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* A MEMORY SECTION USED TO SIT HERE, arguing in the present tense for accumulated understanding the
          product does not have. It moved into #current and was removed on 2026-09-28. What is true today,
          that every run is preserved and nothing is overwritten, is said by Completion and by the History
          fact on the record panel. */}

      {/* 10 ── Knowledge ── */}
      <section className="v6-sec v6-sec--sunk">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Knowledge"
              title="A real body of work behind the product."
              lead="Not footer links. Authored surfaces that explain how Vraelis thinks, how it works, and what it has shipped."
            />
          </Reveal>
          <div className="v6-grid3 v6-grid5">
            {KNOWLEDGE.map(([t, d, href], i) => (
              <Reveal key={t} i={i % 3}>
                <Link href={href} className="v6-gcard" style={{ display: "block", textDecoration: "none", height: "100%" }}>
                  <h3>{t}</h3>
                  <p>{d}</p>
                  <span className="v6-elink" style={{ marginTop: 14, color: "var(--ink)" }}><span className="v6-elink__t">Open</span><span className="v6-arw" aria-hidden>&rarr;</span></span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 10b ── What Vraelis can reach ──
          Two surfaces are live, both through a real browser: deployed web apps, and connected devices through
          the web control panel that runs them. Device-level checks and native apps are Next, not built, and
          say so. Every line comes from _content/coverage.ts, which carries the rule that governs them: a
          surface is Live only after a real failing case ran end to end on it. */}
      <section className="v6-sec v6-sec--sunk" id="coverage">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="What it can reach"
              title="Web apps, and the devices they control."
              lead={COVERAGE_THESIS}
            />
          </Reveal>
          <div role="list" style={{ listStyle: "none", margin: "clamp(28px,3vw,40px) 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 0 }}>
            {SURFACES.map((s, i) => (
              <Reveal key={s.name} i={Math.min(i, 3)}>
                <div role="listitem" style={{ display: "grid", gap: 10, paddingBlock: "clamp(20px,2.2vw,26px)", borderTop: "1px solid var(--line-2)" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                    <h3 className="v6-dm" style={{ margin: 0 }}>{s.name}</h3>
                    {/* A roadmap tier is not a result, so it does not wear a result colour (same chip as the homepage). */}
                    <span className="v6-tier" data-tier={s.tier === "Live" ? "live" : s.tier === "Next" ? "next" : "out"}>{s.tier === "Next" ? "Not built yet" : s.tier}</span>
                  </div>
                  <p className="v6-body" style={{ maxWidth: "70ch" }}>{s.reach}</p>
                  {/* The half a reader can check, and on a Next or Not covered row what happens instead. */}
                  <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "var(--ink-4)", maxWidth: "70ch" }}>{s.today}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <p className="v6-body" style={{ marginTop: "clamp(22px,2.4vw,32px)", maxWidth: "72ch", paddingTop: "clamp(20px,2.2vw,26px)", borderTop: "1px solid var(--line-2)" }}>
              {COVERAGE_RULE}
            </p>
          </Reveal>
        </div>
      </section>

      {/* 11 ── Current vs Direction ── */}
      <section className="v6-sec" id="current">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Honest about what is live"
              title="What Vraelis does today, and what it does not."
              // NOT "on the left" and "on the right". The two cards sit side by side on a desktop and stack
              // on a phone, so the directions named a layout half the readers do not have. The cards carry
              // their own labels, Live today and Direction, and those are true in both arrangements.
              lead="The check is real and in use. Everything under Direction is a gap in that same check, and each line says what actually happens today instead. Next and Later say how much of a line already stands, not when it lands. Nothing there is a delivery date, and nothing under Live today is coming soon."
            />
          </Reveal>
          <div style={{ ...wrapRow, marginTop: "clamp(28px,3vw,40px)" }}>
            <Reveal style={{ flex: "1 1 320px", minWidth: 0 }}>
              <div className="v6-card" style={{ height: "100%" }}>
                <Signal state="go">Live today</Signal>
                <Led items={LIVE} tone="go" />
              </div>
            </Reveal>
            <Reveal style={{ flex: "1 1 320px", minWidth: 0 }} i={1}>
              <div className="v6-card" style={{ height: "100%" }}>
                <Signal state="wait">Direction</Signal>
                <Planned items={DIRECTION} />
              </div>
            </Reveal>
          </div>
          {/* The standing rule under both columns. It exists because the two lists will drift as work lands,
              and the thing that has to survive that drift is the promise about how they are kept, not the
              contents on any given day. */}
          <Reveal i={2}>
            <p className="v6-body" style={{ marginTop: "clamp(22px,2.4vw,32px)", maxWidth: "72ch" }}>
              A line moves from the right column to the left when it works in the product, and the{" "}
              <Link href={`${BASE}/changelog`} className="v6-plink">changelog</Link> records the date it did.
              Nothing moves because it is nearly done.
            </p>
          </Reveal>

          {/* THE TWO EXPANDED DIRECTION BLOCKS THAT SAT HERE ARE GONE (2026-09-28). One held sensitive steps
              inside an approved plan for a person; the other read the history of one guarantee into the
              next. Both were marked Not built and both described a larger product than the one on this page. */}
        </div>
      </section>

      {/* 12 ── Close ── */}
      <hr className="v6-rule" />
      <section className="v6-sec v6-sec--tight">
        <div className="v6-wrap" style={{ textAlign: "center", maxWidth: 760 }}>
          <Reveal>
            <h2 className="v6-dl" style={{ marginInline: "auto" }}>Say what should work. Let the live app answer.</h2>
            <p className="v6-lead" style={{ margin: "20px auto 30px", textAlign: "center" }}>
              One sentence, one plan you approved, one real browser run on your live deployment, and one decision with the evidence kept.
            </p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <CTA brand lg>Open Vraelis</CTA>
              <CTA href={`${BASE}/integrations`} ghost lg>Ways to use it</CTA>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
