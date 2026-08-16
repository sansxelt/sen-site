import type { CSSProperties } from "react";
import { v6meta } from "../_system/meta";
import Link from "next/link";
import { publishedArticles, formatDate, readingMinutes } from "@/app/rank/research/_articles";
import { PageHero, Reveal, SectionHead, Signal, Prose, EditorialLink, Kicker, CTA } from "../_system/ui";
import { V6_BASE } from "@/lib/v6-routes";

export const metadata = v6meta({
  title: "Research",
  description:
    "The methodology behind trusting agent work: why builders cannot remain their only judges, responsibility versus implementation, evidence versus confidence, human judgment at boundaries, repair verification, preserved failure history, and earned autonomy.",
  path: "/research",
  type: "website",
});

const BASE = V6_BASE;
// Empty on purpose. html { scroll-padding-top: var(--nav-h) } in app/globals.css already reserves the bar,
// and scroll-padding on the scrollport ADDS to scroll-margin on the target rather than overriding it, so the
// 88px that used to be here doubled the offset instead of setting it. Every question anchor landed about
// 153px down under a 67px bar. See the longer note on the same constant in ../company/page.tsx.
const ANCHOR: CSSProperties = {};

/* ---- the two evidence exhibits (conceptual, not measured) ---- */
function ExpectedObserved() {
  const rows: [string, string, string][] = [
    ["go", "Expected", "Access remains after the customer signs back in."],
    ["stop", "Observed", "Access is lost after the customer signs back in."],
  ];
  return (
    <div style={{ background: "var(--graphite-2)", border: "1px solid var(--g-line)", borderRadius: 14, padding: "clamp(20px,2.2vw,26px)" }}>
      <p className="v6-kicker" style={{ color: "var(--g-fg-3)" }}>Expected vs observed</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
        {rows.map(([sig, label, text]) => (
          <div key={label} style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: sig === "go" ? "var(--go-dk)" : "var(--stop-dk)", flex: "none", alignSelf: "center" }} />
            <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--g-fg-3)", minWidth: 68 }}>{label}</span>
            <span style={{ flex: "1 1 170px", minWidth: 0, fontSize: 14, lineHeight: 1.45, color: sig === "go" ? "var(--g-fg)" : "var(--stop-dk)" }}>{text}</span>
          </div>
        ))}
      </div>
      <p style={{ margin: "16px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--g-fg-3)" }}>Illustration. A claim of done that the running software contradicts.</p>
    </div>
  );
}

function CoverageSplit() {
  return (
    <div style={{ background: "var(--graphite-2)", border: "1px solid var(--g-line)", borderRadius: 14, padding: "clamp(20px,2.2vw,26px)" }}>
      <p className="v6-kicker" style={{ color: "var(--g-fg-3)" }}>Coverage of a completion claim</p>
      <div style={{ marginTop: 16, display: "flex", height: 16, borderRadius: 8, overflow: "hidden", border: "1px solid var(--g-line)" }} aria-hidden>
        <div style={{ flex: "3 1 0", background: "var(--go-dk)" }} />
        <div style={{ flex: "2 1 0", background: "rgba(240,113,79,0.5)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--go-dk)" }}>Proven by evidence</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--stop-dk)" }}>Asserted, not proven</span>
      </div>
      <p style={{ margin: "16px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--g-fg-3)" }}>Illustration. Oversight measures how much of a claim is backed, and treats the rest as unproven rather than safe.</p>
    </div>
  );
}

/* ---- the research directions ---- */
type Dir = { id: string; n: string; title: string; blurb: string; body: string[]; now: string[]; open: string[] };

const DIRECTIONS: Dir[] = [
  {
    id: "independent-judgment",
    n: "01",
    title: "Independent judgment",
    blurb: "Why the party doing the work cannot certify it.",
    body: [
      "The same agent that designs a change, writes it, and repairs it is not a neutral witness to whether it worked. Its report that the work is finished is a claim, produced by the party with the strongest reason to believe it. Oversight starts by refusing to treat that claim as proof.",
      "Independence does not mean distrusting agents. It means the standard for done is set outside the agent and checked against the running system, so that trust is the result of the check rather than a precondition for it.",
    ],
    now: [
      "A requirement is stated and held outside the code the agent controls.",
      "The running software is exercised and judged against that requirement.",
      "The decision is computed from evidence, not accepted on assertion.",
    ],
    open: [
      "How much of a system can be judged this way as responsibilities get broader and fuzzier.",
      "How to keep the standard independent when agents help write the standard itself.",
    ],
  },
  {
    id: "responsibility-vs-implementation",
    n: "02",
    title: "Responsibility vs implementation",
    blurb: "A task and a promise are different objects.",
    body: [
      "A task and a responsibility are not the same thing. Add usage based billing is an implementation. Existing customers are never overcharged is a responsibility. Agents are handed implementations and graded on implementations, which is why passing tests can sit right next to a broken promise.",
      "Vraelis tries to keep the responsibility primary and durable, held apart from whatever code happens to satisfy it at a given moment. The implementation is allowed to change. What must remain true should not quietly change with it.",
    ],
    now: [
      "A responsibility is recorded as a durable object, distinct from any one change.",
      "Evidence is gathered against the responsibility, not only against the diff.",
    ],
    open: [
      "How to elicit the real responsibility when a person states only a task.",
      "How responsibilities compose, and conflict, across a large system.",
    ],
  },
  {
    id: "evidence-vs-confidence",
    n: "03",
    title: "Evidence vs confidence",
    blurb: "The unit we trust is the observation.",
    body: [
      "Confidence is cheap. A model can report high certainty about an outcome it never observed. Evidence is a record of the software actually doing the thing, captured in a way a person can inspect later.",
      "The unit Vraelis trusts is the observation, not the assurance. A green result should reduce to what was exercised, what was seen, and where the boundary of the check sat. The exhibit above is that reduction in miniature: what a claim asserted, set beside what the running software showed.",
    ],
    now: [
      "Decisions are backed by execution against the live software, captured as inspectable evidence.",
      "The engine runs pinned, on a fixed model and fixed settings, so a result can be re-run under the same conditions.",
    ],
    open: [
      "How to represent the edge of a check, so absence of evidence is never read as evidence of safety.",
    ],
  },
  {
    id: "judgment-at-boundaries",
    n: "04",
    title: "Judgment at the boundaries",
    blurb: "The small set of moments that need a person.",
    body: [
      "Most of a task can be checked mechanically. A few points cannot, and they tend to be the ones that matter: an irreversible action, a pricing change, a decision that trades one risk for another. These are boundaries where a person should decide, not because the machine failed, but because the choice was never the machine's to make.",
      "The design problem is not raising everything to a person, which no one can sustain, nor raising nothing, which is how bad decisions ship quietly. It is finding the small set of moments that genuinely need judgment and presenting each with enough context to decide well.",
    ],
    now: [
      "Sensitive and uncertain decisions are surfaced for human review instead of auto-approved.",
      "Each raised decision carries the context needed to make it.",
    ],
    open: [
      "How to identify the moments that truly need a person without flooding the queue.",
      "How review load should scale as one person oversees many agents.",
    ],
  },
  {
    id: "repair-verification",
    n: "05",
    title: "Repair, then verify",
    blurb: "Fixed has to mean proven again.",
    body: [
      "A failure is not the end of a task; it is the middle. The useful question is whether the fix actually holds, and a fix proposed by the same agent that failed is not self certifying. A repair has to be rechecked independently, against the original responsibility, before it counts.",
      "Vraelis treats repair as a structured handoff back to the agent followed by a fresh, independent recheck, so that fixed means proven again rather than asserted again.",
    ],
    now: [
      "A failure becomes a structured handoff, not a bug to triage by hand.",
      "The repair is re-verified independently against the original requirement.",
    ],
    open: [
      "How many repair cycles are healthy before a responsibility should be escalated instead of retried.",
    ],
  },
  {
    id: "failure-history",
    n: "06",
    title: "Preserved failure history",
    blurb: "The failures are the most useful record.",
    body: [
      "When a fix lands, the temptation is to erase what came before. But the earlier failures are the most informative record a system has: they show how this software breaks, which repairs did not survive, and what an agent tends to get wrong.",
      "Vraelis preserves that history rather than overwriting it. A trusted completion is more credible when you can see the failed attempts it replaced, and the record compounds into knowledge about both the system and the agents working on it.",
    ],
    now: [
      "Requirements, failures, repairs, and decisions are retained, not overwritten by the latest pass.",
      "A completion keeps the trail of what it replaced.",
    ],
    open: [
      "How to turn preserved history into prediction of where the next failure will land.",
    ],
  },
  {
    id: "judging-the-judge",
    n: "07",
    title: "Judging the judge",
    blurb: "Evaluator failure is not application failure.",
    body: [
      "An oversight system can fail in two very different ways. The application under test can be broken, or the evaluator itself can be wrong: a check that passes something it should have caught, or flags something correct. Treating those as the same failure is how an overseer quietly loses its authority.",
      "The evaluator has to be held to a higher standard than the software it judges, and its mistakes have to be findable and separable from the application's. An overseer that cannot be audited is just another opinion.",
    ],
    now: [
      "The decision is computed and fail-closed, so an uncertain check does not pass by default.",
      "Evaluator behavior is inspectable, kept separate from the application result.",
    ],
    open: [
      "How to systematically detect evaluator error, distinct from application error, at scale.",
    ],
  },
  {
    id: "earned-autonomy",
    n: "08",
    title: "Autonomy is earned",
    blurb: "Independence should be a conclusion, not a setting.",
    body: [
      "The endpoint people imagine is agents acting with less supervision. That is reasonable, but autonomy should be a conclusion, not a setting. An agent earns room to act by accumulating a record of responsibilities met and failures handled honestly, on a given kind of work.",
      "The direction Vraelis is working toward is oversight that measures reliability over time and lets autonomy expand where it is warranted and contract where it is not, per agent and per domain, rather than granted once and forgotten.",
    ],
    now: [
      "Completion is accepted only when the responsibility is met, on every task.",
    ],
    open: [
      "How to measure earned reliability well enough to justify expanding an agent's autonomy.",
      "How autonomy should degrade automatically when an agent's record slips.",
    ],
  },
];

// THE ANCHOR TARGET IS THE OUTER DIV, AND IT IS DELIBERATELY NOT INSIDE THE REVEAL.
//
// The id used to sit on the <article>, inside the Reveal, and the divider plus its 44 to 68px of leading
// space sat on the Reveal itself. The browser resolves a fragment from getBoundingClientRect(), which
// includes ancestor transforms, and .v6-reveal is translateY(14px) until it intersects (v6.css:416-417). So
// a cold arrival at /research#earned-autonomy measured a box 14px lower than its laid-out position, scrolled
// there, and then the reveal finished and moved the section out from under the reader. It also landed past
// the divider, since that space belonged to an element the id was not on.
//
// The wrapper carries the id, the divider and the space, and is never transformed. The Reveal keeps the
// animation and nothing else, so what the browser measures is what the page settles at.
function Direction({ d, first }: { d: Dir; first: boolean }) {
  return (
    <div id={d.id} style={first ? ANCHOR : { ...ANCHOR, borderTop: "1px solid var(--line)", paddingTop: "clamp(44px,5vw,68px)" }}>
      <Reveal>
        <article style={{ maxWidth: 840 }}>
          <Kicker>Direction {d.n}</Kicker>
          <h2 className="v6-dl" style={{ marginTop: 12 }}>{d.title}</h2>
          <Prose className="" >
            {d.body.map((p) => <p key={p}>{p}</p>)}
          </Prose>
          <div className="v6-cn" style={{ marginTop: "clamp(22px,2.4vw,30px)" }}>
            <div className="v6-cn__col">
              <p className="v6-cn__h"><Signal state="go">Current methodology</Signal></p>
              <ul>{d.now.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
            <div className="v6-cn__col v6-cn__col--next">
              <p className="v6-cn__h"><Signal state="wait">Open question</Signal></p>
              <ul>{d.open.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          </div>
        </article>
      </Reveal>
    </div>
  );
}

export default function ResearchPage() {
  return (
    <>
      <PageHero
        kicker="Research"
        title="The methods behind trusting agent work."
        lead="Vraelis is building the practice of independent oversight for software agents. This page describes the methodology we use today and the questions we are still working through. It does not claim results we have not earned."
        cta={<><CTA brand>Open Vraelis</CTA><EditorialLink href={`${BASE}/method`}>Read the Method</EditorialLink></>}
      />

      {/* Stance + index of directions */}
      <section className="v6-sec v6-sec--sunk">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Our stance"
              title="A builder cannot remain the only judge of its own work."
              lead="An agent that plans, writes, and repairs a system will also report that it is finished. Someone independent has to decide whether that claim holds. The directions below are how we approach that decision, and where our thinking is still open."
            />
          </Reveal>
          <div className="v6-know">
            {DIRECTIONS.map((d, i) => (
              <Reveal key={d.id} i={i % 4}>
                <a className="v6-know__card" href={`#${d.id}`}>
                  <span className="v6-mono" style={{ fontSize: 12, color: "var(--brand-ink)" }}>{d.n}</span>
                  <h3 className="v6-know__t" style={{ marginTop: 8 }}>{d.title}</h3>
                  <p className="v6-know__d">{d.blurb}</p>
                  <span className="v6-know__go v6-arw" aria-hidden>&darr;</span>
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Evidence exhibit (graphite: technical content) */}
      <section className="v6-sec v6-dark" data-nav-dark>
        <div className="v6-wrap v6-wrap--wide">
          <Reveal>
            <SectionHead
              eyebrow="How we read a claim"
              title="A completion claim is not evidence."
              lead="Before Vraelis accepts that work is done, it separates what an agent asserts from what the running software actually shows."
            />
          </Reveal>
          <Reveal media className="v6-grid3">
            <ExpectedObserved />
            <CoverageSplit />
          </Reveal>
        </div>
      </section>

      {/* The directions */}
      <section className="v6-sec">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Research directions"
              title="Current methodology, and the open questions."
              lead="Each direction is stated as what we do today and what we have not solved. The open questions are real. We would rather show them than pretend they are closed."
            />
          </Reveal>
          <div style={{ display: "flex", flexDirection: "column", marginTop: "clamp(36px,4vw,56px)" }}>
            {DIRECTIONS.map((d, i) => <Direction key={d.id} d={d} first={i === 0} />)}
          </div>
        </div>
      </section>

      {/* THE WRITING ITSELF.
          This page argues the thesis; the articles are where it is worked out at length. Until now nothing
          on the new site linked to them, so five published pieces were reachable only from a search result,
          which is the wrong way round: they are the most considered thing here. */}
      <hr className="v6-rule" />
      <section className="v6-sec v6-sec--tight">
        <div className="v6-wrap v6-wrap--read">
          <Reveal>
            <SectionHead
              eyebrow="Notes"
              title="Written at length."
              lead="Each note takes one part of the argument and works it through, with the limits stated where they apply."
            />
          </Reveal>
          <Reveal>
            <div style={{ display: "grid", gap: 2, marginTop: 26 }}>
              {publishedArticles().map((a) => (
                <Link key={a.slug} href={`${BASE}/research/${a.slug}`} className="v6-elink"
                  style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 20, padding: "18px 0", borderBottom: "1px solid var(--line)" }}>
                  <span style={{ minWidth: 0 }}>
                    <span className="v6-elink__t" style={{ display: "block", fontSize: "1.08rem", fontWeight: 600 }}>{a.title}</span>
                    <span style={{ display: "block", marginTop: 5, fontSize: 14, lineHeight: 1.55, color: "var(--ink-3)" }}>{a.summary}</span>
                  </span>
                  <span style={{ flex: "none", fontSize: 12.5, color: "var(--ink-4)", whiteSpace: "nowrap" }}>
                    {formatDate(a.date)} / {readingMinutes(a)} min
                  </span>
                </Link>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Close */}
      <hr className="v6-rule" />
      <section className="v6-sec v6-sec--tight">
        <div className="v6-wrap v6-wrap--read">
          <Reveal>
            <SectionHead
              eyebrow="Where this goes"
              title="Oversight is a practice, not a finished science."
              lead="The methodology here is what we apply now. As agents take on more, the standard has to move with them. That work is ongoing, and it is written down elsewhere too."
            />
            <div style={{ marginTop: 26, display: "flex", gap: 22, flexWrap: "wrap" }}>
              <EditorialLink href={`${BASE}/method`}>Read the Vraelis Method</EditorialLink>
              <EditorialLink href={`${BASE}/readme`}>Why Vraelis exists</EditorialLink>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
