"use client";

// Homepage (design 06). Framing: oversight for AI software agents, from assigned responsibility to trusted
// completion. The hero is one coherent live-work environment (not eight cards). The verification engine
// appears deeper as one current capability, never as the whole company.
import { Reveal, SectionHead, CTA, EditorialLink, Signal, Kicker } from "./_system/ui";
import "./_system/home.css";
import { Hero } from "./_system/hero";
import { ClosingScene } from "./_system/close";

const BASE = "/dev-preview/v6";

/* ---- the lifecycle: one continuous object that changes state ---- */
const LIFECYCLE = [
  ["Assign", "A company hands an agent responsibility for real work.", "go"],
  ["Build", "The agent plans, changes code, and calls external systems.", null],
  ["Observe", "Vraelis follows the plan, the changes, and the effects.", null],
  ["Review", "Sensitive and uncertain decisions are raised to a person.", "wait"],
  ["Challenge", "Unsupported claims and assumptions are contested with evidence.", null],
  ["Repair", "Failures become a structured handoff and an independent recheck.", "stop"],
  ["Complete", "Completion is accepted only when the responsibility is met.", "go"],
  ["Remember", "Requirements, failures, and trusted decisions accumulate.", null],
] as const;

/* ---- the control center surfaces ---- */
const SURFACES = [
  ["Work", "Responsibilities assigned to agents, and where each one stands."],
  ["Live", "Plans, changes, tools, assumptions, and evidence as they happen."],
  ["Review", "Human decisions and sensitive approvals, in one queue."],
  ["Findings", "Contradictions, missing evidence, and unsafe assumptions."],
  ["Repair", "A structured handoff back to the agent, and an independent recheck."],
  ["Memory", "Requirements, failures, repairs, and trusted decisions over time."],
  ["Knowledge", "The docs, method, and guidance connected to active work."],
];

export default function Home() {
  return (
    <>
      {/* ── 1. Responsibility in motion: one immersive environment (replaces the rejected split hero) ── */}
      <Hero />

      {/* ── 2. The problem ── */}
      <section className="v6-sec v6-sec--sunk" id="how">
        <div className="v6-wrap">
          <Reveal><SectionHead eyebrow="The problem" title="The agent building the system cannot remain its only judge." lead="An agent that plans, writes, and repairs the work will also tell you it is finished. Someone independent has to decide whether that claim is true." /></Reveal>
          <div className="v6-versus">
            <Reveal className="v6-versus__col v6-versus__col--claim" i={0}>
              <Kicker>The agent&rsquo;s claim</Kicker>
              <p className="v6-versus__claim">&ldquo;I finished the work.&rdquo;</p>
              <p className="v6-versus__note">One sentence. No evidence, no boundaries, no record of what it assumed.</p>
            </Reveal>
            <Reveal className="v6-versus__col v6-versus__col--under" i={1}>
              <Kicker>What Vraelis understands</Kicker>
              <ul className="v6-versus__list">
                {[["Requested responsibility", "go"], ["Systems affected", null], ["Evidence collected", "go"], ["Uncertainty remaining", "wait"], ["Human decisions required", "wait"], ["Final completion state", "stop"]].map(([k, s]) => (
                  <li key={k as string}><span className={`v6-versus__dot ${s ? `is-${s}` : ""}`} aria-hidden />{k}</li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 3. Lifecycle (signature) ── */}
      <section className="v6-sec v6-dark" data-nav-dark>
        <div className="v6-wrap v6-wrap--wide">
          <Reveal><SectionHead eyebrow="From responsibility to completion" title="One responsibility, followed the whole way." lead="Not a report at the end. Vraelis stays involved through every state a piece of agent work passes through." /></Reveal>
          <div className="v6-life">
            <div className="v6-life__spine" aria-hidden />
            {LIFECYCLE.map(([t, d, sig], i) => (
              <Reveal key={t} i={i} className="v6-life__node">
                <span className={`v6-life__dot ${sig ? `is-${sig}` : ""}`} aria-hidden />
                <span className="v6-life__n v6-mono">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="v6-life__t">{t}</h3>
                <p className="v6-life__d">{d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. The control center ── */}
      <section className="v6-sec">
        <div className="v6-wrap">
          <Reveal><SectionHead eyebrow="The control center" title="One place to see everything an agent is responsible for." lead="app.vraelis.com is where a company watches the work, makes the decisions only a person should make, and keeps what it learns." /></Reveal>
          <div className="v6-surfaces">
            {SURFACES.map(([t, d], i) => (
              <Reveal key={t} i={i % 4} className="v6-surface">
                <span className="v6-surface__k v6-mono">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="v6-surface__t">{t}</h3>
                <p className="v6-surface__d">{d}</p>
              </Reveal>
            ))}
            {/* eighth cell: the 4-column grid holds 7 surfaces, so without this the last slot rendered empty */}
            <Reveal i={3} className="v6-surface v6-surface--cta">
              <h3 className="v6-surface__t">See it on your own system.</h3>
              <CTA brand>Open Vraelis</CTA>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 5. Verification engine (one current capability, deeper) ── */}
      <section className="v6-sec v6-sec--sunk">
        <div className="v6-wrap">
          <div className="v6-verify">
            <div className="v6-verify__copy">
              <Reveal>
                <SectionHead eyebrow="One capability, live today" title="When an agent claims it is done, Vraelis checks the live software." lead="The verification engine is one part of oversight: it holds a requirement outside the code and proves the running software against it, in a real browser." />
                <div style={{ marginTop: 26 }}><EditorialLink href={`${BASE}/platform`}>See the full platform</EditorialLink></div>
              </Reveal>
            </div>
            <Reveal media className="v6-verify__proof">
              <div className="v6-proof" data-nav-dark>
                <div className="v6-proof__bar"><span className="v6-kicker" style={{ color: "var(--g-fg-3)" }}>Requirement, held outside the code</span></div>
                <p className="v6-proof__req">A paid customer keeps Pro access after signing back in.</p>
                <div className="v6-proof__rows">
                  <div className="v6-proof__row"><span>The agent claimed</span><span className="v6-proof__v">checkout complete</span></div>
                  <div className="v6-proof__row"><span>Payment</span><span className="v6-proof__v">succeeded</span></div>
                  <div className="v6-proof__row is-bad"><span>Access</span><span className="v6-proof__v v6-proof__v--stop">not granted</span></div>
                  <div className="v6-proof__row is-bad"><span>First repair</span><span className="v6-proof__v v6-proof__v--stop">did not survive sign-in</span></div>
                  <div className="v6-proof__row is-ok"><span>Later repair</span><span className="v6-proof__v v6-proof__v--go">independently Verified</span></div>
                </div>
                <div className="v6-proof__foot"><Signal state="go">Verified, 72c98e</Signal><span className="v6-mono" style={{ color: "var(--g-fg-3)", fontSize: 12 }}>earlier records preserved</span></div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 6. Distribution ── */}
      <section className="v6-sec">
        <div className="v6-wrap">
          <Reveal><SectionHead eyebrow="Available where work happens" title="One continuous system, following the work." lead="Oversight should not live in one tab. Vraelis meets the work where it already happens, and is extending to the surfaces agents run in next." /></Reveal>
          <div className="v6-dist">
            <Reveal className="v6-dist__col">
              <p className="v6-dist__h"><Signal state="go">Live today</Signal></p>
              <div className="v6-dist__chips">{["Vraelis web app", "API", "CLI", "GitHub", "Vercel", "Slack", "Webhooks"].map((c) => <span key={c} className="v6-chip">{c}</span>)}</div>
            </Reveal>
            <Reveal className="v6-dist__col" i={1}>
              <p className="v6-dist__h"><Signal state="wait">Direction</Signal></p>
              <div className="v6-dist__chips">{["Cursor / VS Code", "Desktop", "Browser companion", "Mobile approvals", "MCP + agent tools"].map((c) => <span key={c} className="v6-chip v6-chip--soon">{c}</span>)}</div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 7. Memory ── */}
      <section className="v6-sec v6-dark" data-nav-dark>
        <div className="v6-wrap">
          <div className="v6-memory">
            <Reveal className="v6-memory__copy"><SectionHead eyebrow="Memory" title="Every task teaches Vraelis how your software and agents fail." lead="Oversight compounds. What Vraelis learns on one responsibility makes the next one faster to judge and harder to fool." /></Reveal>
            <Reveal media className="v6-memory__list" i={1}>
              {["Company requirements", "Architecture boundaries", "Recurring failures", "Approved decisions", "Repair history", "Agent behavior", "Trusted completion standards"].map((m, i) => (
                <div key={m} className="v6-memory__item"><span className="v6-mono v6-memory__n">{String(i + 1).padStart(2, "0")}</span>{m}</div>
              ))}
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 8. Knowledge ── */}
      <section className="v6-sec v6-sec--sunk">
        <div className="v6-wrap">
          <Reveal><SectionHead eyebrow="Knowledge" title="A real body of work behind the product." lead="Not footer links. Authored surfaces that explain how Vraelis thinks, how it works, and what it has shipped." /></Reveal>
          <div className="v6-know">
            {[["Documentation", "Use and administer Vraelis", `${BASE}/docs`], ["Vraelis Method", "The worldview behind the product", `${BASE}/method`], ["README", "Why Vraelis exists", `${BASE}/readme`], ["Changelog", "What shipped, dated", `${BASE}/changelog`], ["Research", "The methodology and open questions", `${BASE}/research`]].map(([t, d, href], i) => (
                <Reveal key={t} i={i % 3}><a className="v6-know__card" href={href}><h3 className="v6-know__t">{t}</h3><p className="v6-know__d">{d}</p><span className="v6-know__go v6-arw" aria-hidden>→</span></a></Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 9. Current & direction ── */}
      <section className="v6-sec">
        <div className="v6-wrap">
          <Reveal><SectionHead eyebrow="Honest about what is live" title="What Vraelis does today, and where it is going." /></Reveal>
          <div className="v6-cn" style={{ marginTop: "clamp(28px,3vw,40px)" }}>
            <Reveal className="v6-cn__col">
              <p className="v6-cn__h"><Signal state="go">Live today</Signal></p>
              <ul>{["Responsibility records and reviewed standards", "Live execution and evidence in a real browser", "Human review, findings, and repair handoff", "Verified / Failed / Blocked, preserved history", "API, CLI, webhooks, and current integrations"].map((t) => <li key={t}>{t}</li>)}</ul>
            </Reveal>
            <Reveal className="v6-cn__col v6-cn__col--next" i={1}>
              <p className="v6-cn__h"><Signal state="wait">Direction</Signal></p>
              <ul>{["Continuous agent oversight and live activity ingestion", "IDE and desktop surfaces", "Agent reliability memory and autonomy decisions", "Automatic responsibility coverage"].map((t) => <li key={t}>{t}</li>)}</ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 10. Closing scene: full editorial ending that resolves the opening ── */}
      <ClosingScene />
    </>
  );
}
