import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { v6meta } from "../_system/meta";
import { PageHero, Reveal, SectionHead, CTA, EditorialLink, Signal, Kicker } from "../_system/ui";
import { LIVE, DIRECTION, type DirectionItem } from "../_content/scope";
import { SURFACES, COVERAGE_THESIS, COVERAGE_RULE } from "../_content/coverage";
import { V6_BASE } from "@/lib/v6-routes";

// Platform overview (design 06). Framing: Vraelis is oversight for AI software agents, from assigned
// responsibility to trusted completion. The verification engine (real browser, requirement held outside the
// code, preserved history, repair + reverify) is ONE current capability, shown deeper, never as the whole
// company. The signature is a single durable responsibility record that accumulates context, plan, activity,
// findings, decisions, repairs, evidence, completion, and history. LIGHT = framing; GRAPHITE = live work.

export const metadata: Metadata = v6meta({
  title: "Platform",
  description:
    "One system that follows every responsibility you hand an AI software agent: the durable record, run activity, human review, findings, repair, verified completion, and memory.",
  path: "/platform",
  ogTitle: "The Vraelis platform",
  ogDescription:
    "Responsibility, run activity, review, findings, repair, verified completion, and memory, on one durable record per piece of agent work.",
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

const RECORD_FACTS: [string, string][] = [
  ["Systems affected", "Stripe / billing / dashboard"],
  ["Reviewed standard", "Existing customers are never overcharged"],
  ["Evidence", "Real browser run, API trace, screenshots"],
  ["History", "Every state preserved, nothing overwritten"],
];

const RECORD_STATES: { t: string; d: string; sig?: Sig; tag?: string }[] = [
  { t: "Context captured", d: "The business requirement and its scope are recorded before any work is judged.", sig: "go", tag: "Recorded" },
  { t: "Standard reviewed", d: "A person approves what must remain true. It is held outside the code, where the agent cannot move it." },
  // THE SAME TWO CLAIMS THE MOCK FEED BELOW WAS REMOVED FOR. These read "Plan observed: 6 steps, touching
  // Stripe and the billing service" and "Activity tracked: 7 files changed. One Stripe price and one usage
  // meter created through the API." Both describe ingesting an agent's plan and its code and API effects,
  // which this product does not do and which the Direction column on this same page says it does not do.
  // Removing the feed and leaving these would have moved the false claim rather than retired it.
  // What is here instead is the step that genuinely exists between the standard and the run: a dry run
  // mints a plan, a person approves that exact plan, and the paid execution consumes it unchanged.
  { t: "Plan approved", d: "A dry run derives the checks and the browser flow. A person approves that exact plan, and the paid run consumes it unchanged." },
  { t: "Run recorded", d: "A real browser drives the live deployment. Each step is recorded as it happens, with the evidence it produced." },
  { t: "Assumption challenged", d: "“Existing customers keep their current price” is contested until it is proven.", sig: "wait", tag: "Needs proof" },
  { t: "Finding raised", d: "The usage meter is not enforced on the free plan. Recorded against the requirement.", sig: "stop", tag: "Finding" },
  { t: "Decision required", d: "The new pricing cannot ship until a person approves the change.", sig: "wait", tag: "Review" },
  { t: "Repair re-checked", d: "The fix is re-run against the same standard in a real browser, as its own record." },
  { t: "Completion accepted", d: "The requirement now holds, checked independently. Earlier records stay intact.", sig: "go", tag: "Verified" },
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
            The shape of one responsibility record
          </span>
        }
        right={<Signal state="go">Verified</Signal>}
      />
      <p style={{ margin: 0, color: "var(--g-fg)", fontSize: "clamp(1.15rem,1.7vw,1.4rem)", fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.25 }}>
        Add usage-based billing to the customer dashboard.
      </p>
      <p style={{ margin: "8px 0 0", color: "var(--g-fg-2)", fontSize: 14.5, lineHeight: 1.5 }}>
        Everything Vraelis learns about this work accumulates here, in one place, in order.
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
            <div className="v6-mono" style={{ fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--g-fg-3)" }}>{k}</div>
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

const WORK: { t: string; sys: string; state: Sig; label: string }[] = [
  { t: "Add usage-based billing to the dashboard", sys: "Stripe / billing", state: "wait", label: "In review" },
  { t: "Migrate the auth service to sessions", sys: "auth / api", state: "go", label: "Verified" },
  { t: "Bulk-export customer data on request", sys: "api / storage", state: "stop", label: "Blocked" },
  { t: "Ship the new onboarding flow", sys: "web / analytics", state: "go", label: "Verified" },
];

// WHAT A RUN IS ACTUALLY GIVEN, and every line is a gate that exists in the product today rather than a
// description of one. The address is resolved before admission (above the credit hold, so a typo costs
// nothing), the guarantee is a sentence a person wrote and approved, and the plan is minted by a dry run
// and consumed unchanged by the paid execution.
const RUN_INPUTS: { t: string; d: string }[] = [
  { t: "A deployment it can reach", d: "The hostname is resolved before the run is admitted, above the credit hold, so a mistyped address costs nothing rather than buying a report that the address was wrong." },
  { t: "A guarantee, in one sentence", d: "Written by a person and held outside the code, so the standard a change is judged against cannot be edited by the work being judged." },
  { t: "A plan that was approved", d: "Minted by a dry run, reviewed, then consumed exactly as approved. Vraelis declines to charge when it cannot build a check that would prove the claim." },
];

// THE STATES A RUN REALLY MOVES THROUGH. These are the run states in lib/preflight, not an illustration of
// them: queued, running, and then one terminal state, which lib/preflight/public-decision.ts maps to the
// three words the API, the CI gate and the webhooks all return.
const RUN_STATES: { t: string; d: string; sig?: Sig; tag?: string }[] = [
  { t: "Queued", d: "Admitted, and waiting for a worker to lease it." },
  { t: "Running", d: "A real browser is driving the live deployment, one approved step at a time." },
  { t: "Verified", d: "The guarantee held, and the evidence behind that decision is kept with the record.", sig: "go", tag: "Verified" },
  { t: "Failed", d: "The guarantee did not hold. The evidence and a repair prompt are written onto the issue.", sig: "stop", tag: "Failed" },
  { t: "Blocked", d: "No verdict could be reached, so none is reported. Nothing is recorded as proven.", sig: "wait", tag: "Blocked" },
];

const FINDINGS: { claim: string; reality: string; sig: Sig; tag: string }[] = [
  { claim: "“Usage billing is complete.”", reality: "The usage meter is not enforced on the free plan.", sig: "stop", tag: "Contradiction" },
  { claim: "“Existing customers keep their price.”", reality: "No evidence was produced. The assumption is unproven.", sig: "wait", tag: "Missing evidence" },
  { claim: "“Checkout works end to end.”", reality: "Access was not granted after a successful payment.", sig: "stop", tag: "Failed check" },
];

// DIRECTION, NOT LIVE. Same overclaim as agents/page.tsx's SENSITIVE section: a plan is approved or refused
// as a whole today, and nothing inside it is singled out for its own hold. These three stay as concrete
// examples of what that would look like, not as live queue items.
const REVIEW: { t: string; who: string }[] = [
  { t: "Approve the new pricing before it ships to existing customers", who: "Billing owner" },
  { t: "Confirm the data export is allowed for this account", who: "Security" },
  { t: "Accept the irreversible migration on the auth service", who: "Engineering lead" },
];

const MEMORY = [
  "Company requirements",
  "Architecture boundaries",
  "Recurring failures",
  "Approved decisions",
  "Repair history",
  "Agent behavior",
  "Trusted completion standards",
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
              <span className="v6-mono" style={{ marginLeft: 8, fontSize: 10.5, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--ink-4)", whiteSpace: "nowrap" }}>{tier}</span>
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
        title="One system that follows every responsibility you hand an agent."
        lead="Vraelis stays with a piece of agent work from the moment it is assigned to the moment it can be trusted: the durable record, run activity, human review, findings, repair, verified completion, and everything the company learns along the way."
        cta={
          <>
            <CTA brand lg>Open Vraelis</CTA>
            <EditorialLink href={`${BASE}/agents`}>How agents are handled</EditorialLink>
          </>
        }
      />

      {/* 1 ── Signature: the durable record everything happens on ── */}
      <section className="v6-sec" style={{ paddingTop: "clamp(12px,2vw,28px)" }}>
        <div className="v6-wrap v6-wrap--wide">
          <Reveal>
            <SectionHead
              eyebrow="One record per responsibility"
              title="Everything Vraelis knows lives on one object."
              lead="Not eight disconnected tools. A single durable record per piece of agent work accumulates the context, the plan, the activity, the findings, the decisions, the repairs, the evidence, the completion, and the full history."
            />
          </Reveal>
          <Reveal media style={{ marginTop: "clamp(28px,3.4vw,44px)" }}>
            <RecordObject />
          </Reveal>
        </div>
      </section>

      {/* 2 ── Responsibility ── */}
      <section className="v6-sec v6-sec--sunk">
        <div className="v6-wrap">
          <div style={wrapRow}>
            <Reveal style={{ flex: "1 1 340px", minWidth: 0 }}>
              <SectionHead
                eyebrow="Responsibility"
                title="Start from the outcome, not the code."
                lead="A company does not care which files changed. It cares whether something it depends on still holds. Every record begins with a plainly stated responsibility and the standard it must meet, approved by a person and kept outside the agent."
              />
            </Reveal>
            <Reveal style={{ flex: "1 1 320px", minWidth: 0 }} i={1}>
              <div className="v6-card">
                <Kicker>What must remain true</Kicker>
                <p style={{ margin: "12px 0 0", color: "var(--ink)", fontSize: "1.15rem", fontWeight: 600, lineHeight: 1.35, letterSpacing: "-0.015em" }}>
                  Existing customers are never overcharged when usage billing ships.
                </p>
                <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)", display: "grid", gap: 10 }}>
                  {[["Requirement", "Stated as an outcome"], ["Approval", "Reviewed by a person"], ["Location", "Held outside the code"]].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14 }}>
                      <span className="v6-mono" style={{ color: "var(--ink-4)", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase" }}>{k}</span>
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
              eyebrow="Work"
              title="Every responsibility, and where each one stands."
              lead="The work surface is the portfolio view: what agents are responsible for right now, and the current state of each, in one decision vocabulary."
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
                    <div className="v6-mono" style={{ marginTop: 4, color: "var(--ink-4)", fontSize: 12, letterSpacing: "0.05em" }}>{w.sys}</div>
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
              title="What Vraelis observes is the run, not the agent."
              lead="A check begins at the point work is claimed complete. From there a real browser drives the live deployment and each step is recorded as it happens, with its evidence attached. Plans, code changes and tool calls are not ingested while an agent is working."
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
                        <span className="v6-mono" style={{ color: "var(--g-fg-3)", fontSize: 12 }}>in flight</span>
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
              Verified, Failed and Blocked are the only three answers a run can end on, and they are the same
              three the API, the CI gate and the webhooks return. Blocked means no verdict could be reached,
              which is the answer that keeps the other two worth having.{" "}
              <Link href={`${BASE}/docs/run-activity`} className="v6-plink">How a run is recorded</Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* 5 ── Review ── */}
      <section className="v6-sec v6-sec--sunk">
        <div className="v6-wrap">
          <div style={wrapRow}>
            <Reveal style={{ flex: "1 1 320px", minWidth: 0 }}>
              <SectionHead
                eyebrow="Direction"
                title="Human judgment at the boundary."
                lead="This is not built yet. Most oversight can be mechanical; some of it cannot. Today a plan is approved or refused as a whole, with nothing inside it singled out on its own — the direction is to raise exactly the sensitive and irreversible moments to a person, deliberately and rarely, instead of holding the whole plan or none of it."
              />
            </Reveal>
            <Reveal style={{ flex: "1 1 360px", minWidth: 0 }} i={1}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {REVIEW.map((r) => (
                  <div key={r.t} className="v6-card" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", padding: "clamp(16px,1.8vw,20px)", borderStyle: "dashed", borderColor: "var(--line-2)" }}>
                    <div style={{ minWidth: 0, flex: "1 1 240px" }}>
                      <div style={{ color: "var(--ink)", fontWeight: 600, fontSize: 15.5, lineHeight: 1.35 }}>{r.t}</div>
                      <div className="v6-mono" style={{ marginTop: 5, color: "var(--ink-4)", fontSize: 12, letterSpacing: "0.05em", textTransform: "uppercase" }}>Decides: {r.who}</div>
                    </div>
                    <Signal state="wait">Direction</Signal>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 6 ── Findings (GRAPHITE) ── */}
      <section className="v6-sec v6-dark" data-nav-dark>
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Findings"
              title="Where a claim and the evidence disagree."
              lead="A finding is what remains when an agent's confidence meets what the software actually does. Contradictions, missing evidence, and unsafe assumptions are recorded against the responsibility, not buried in a log."
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
                eyebrow="Repair, live today"
                title="A fix is finished when the requirement holds, checked independently."
                lead="This is the verification engine, one part of oversight. It holds the requirement outside the code and proves the running software against it in a real browser. A repair is not done because the agent changed something. It is done when the standard passes, as its own record, without overwriting the earlier ones."
              />
              <div style={{ marginTop: 24 }}>
                <EditorialLink href={`${BASE}/agents`}>How Vraelis challenges an agent&rsquo;s claim</EditorialLink>
              </div>
            </Reveal>
            <Reveal media style={{ flex: "1 1 340px", minWidth: 0 }} i={1}>
              <GPanel style={{ boxShadow: "var(--sh-md)" }}>
                <GBar left={<span className="v6-kicker" style={{ color: "var(--g-fg-3)" }}>Requirement, held outside the code</span>} />
                <p style={{ margin: 0, color: "var(--g-fg)", fontSize: "1.1rem", fontWeight: 600, lineHeight: 1.35 }}>
                  A paid customer keeps Pro access after signing back in.
                </p>
                <div style={{ marginTop: 18, display: "flex", flexDirection: "column" }}>
                  {[
                    ["The agent claimed", "checkout complete", "none"],
                    ["Payment", "succeeded", "none"],
                    ["Access", "not granted", "stop"],
                    ["First repair", "did not survive sign-in", "stop"],
                    ["Later repair", "independently Verified", "go"],
                  ].map(([k, v, tone], i) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "11px 0", borderTop: i === 0 ? "none" : "1px solid var(--g-line)" }}>
                      <span style={{ color: "var(--g-fg-2)", fontSize: 14 }}>{k}</span>
                      <span style={{ color: tone === "stop" ? "var(--stop-dk)" : tone === "go" ? "var(--go-dk)" : "var(--g-fg)", fontSize: 14, fontWeight: 600, textAlign: "right" }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--g-line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <Signal state="go">Verified / 72c98e</Signal>
                  <span className="v6-mono" style={{ color: "var(--g-fg-3)", fontSize: 12 }}>earlier records preserved</span>
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
              title="Completion is a decision, not a claim."
              lead="When an agent says it is done, Vraelis returns one of three states. The agent that produced the work does not get to certify it."
            />
          </Reveal>
          <div className="v6-grid3" style={{ marginTop: "clamp(28px,3vw,40px)" }}>
            {[
              { s: "go" as Sig, t: "Verified", d: "The responsibility holds, checked independently against the reviewed standard." },
              { s: "stop" as Sig, t: "Failed", d: "The software does not meet the requirement. The gap is recorded as evidence." },
              { s: "stop" as Sig, t: "Blocked", d: "No verdict could be reached, so none is reported. Nothing is recorded as proven." },
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

      {/* 9 ── Memory ── */}
      <section className="v6-sec">
        <div className="v6-wrap">
          <div style={wrapRow}>
            <Reveal style={{ flex: "1 1 320px", minWidth: 0 }}>
              <SectionHead
                eyebrow="Memory"
                title="Every task teaches Vraelis how your software and agents fail."
                lead="Oversight compounds. What Vraelis learns on one responsibility makes the next one faster to judge and harder to fool. The value is the accumulated, company-specific understanding, not any single verdict."
              />
            </Reveal>
            <Reveal media style={{ flex: "1 1 320px", minWidth: 0 }} i={1}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {MEMORY.map((m, i) => (
                  <div key={m} style={{ display: "flex", gap: 16, alignItems: "center", padding: "14px 2px", borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
                    <span className="v6-mono" style={{ color: "var(--brand-ink)", fontSize: 12.5 }}>{String(i + 1).padStart(2, "0")}</span>
                    <span style={{ color: "var(--ink)", fontSize: "1.05rem", fontWeight: 500, letterSpacing: "-0.01em" }}>{m}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

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
          <div className="v6-grid3">
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
          The site described one surface, a web application in a browser, and never said whether that was the
          thesis or the beachhead. Every line comes from _content/coverage.ts, which carries the rule that
          governs them: a surface is Live only after a real failing case ran end to end on it. */}
      <section className="v6-sec v6-sec--sunk" id="coverage">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="What it can reach"
              title="The browser is where this started, not where it stops."
              lead={COVERAGE_THESIS}
            />
          </Reveal>
          <ul style={{ listStyle: "none", margin: "clamp(28px,3vw,40px) 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 0 }}>
            {SURFACES.map((s, i) => (
              <Reveal key={s.name} i={Math.min(i, 3)}>
                <li style={{ display: "grid", gap: 10, paddingBlock: "clamp(20px,2.2vw,26px)", borderTop: "1px solid var(--line-2)" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                    <h3 className="v6-dm" style={{ margin: 0 }}>{s.name}</h3>
                    <Signal state={s.tier === "Live" ? "go" : "wait"}>{s.tier}</Signal>
                  </div>
                  <p className="v6-body" style={{ maxWidth: "70ch" }}>{s.reach}</p>
                  {/* The half a reader can check, and on a Direction row the half that says it is not built. */}
                  <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "var(--ink-4)", maxWidth: "70ch" }}>{s.today}</p>
                </li>
              </Reveal>
            ))}
          </ul>
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
              lead="The verification engine is real and in use. Everything under Direction is a plan, and each line says what actually happens today instead. Next, Later and Horizon say how much of a line already stands, not when it lands. Nothing there is a delivery date, and nothing under Live today is coming soon."
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
        </div>
      </section>

      {/* 12 ── Close ── */}
      <hr className="v6-rule" />
      <section className="v6-sec v6-sec--tight">
        <div className="v6-wrap" style={{ textAlign: "center", maxWidth: 760 }}>
          <Reveal>
            <h2 className="v6-dl" style={{ marginInline: "auto" }}>Give agents more responsibility without giving up control.</h2>
            <p className="v6-lead" style={{ margin: "20px auto 30px", textAlign: "center" }}>
              One durable record follows the work from the moment it is assigned to the moment it can be trusted.
            </p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <CTA brand lg>Open Vraelis</CTA>
              <CTA href={`${BASE}/agents`} ghost lg>How agents are handled</CTA>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
