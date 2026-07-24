"use client";

// Homepage (site-v1). Narrative: category -> role -> real production proof (the Failed->Verified signature)
// -> product -> breadth -> current/next. White-first; the only dark surface is the production-proof panel,
// where technical evidence genuinely belongs. Every claim is true today or explicitly marked as direction.
import { useEffect, useRef, useState } from "react";
import {
  Reveal, SectionHead, PrimaryCTA, EditorialLink, Pill, Verdict,
  PreservedRecord, CurrentNext, type Row,
} from "./_system/ui";

const FAILED_ROWS: Row[] = [
  { k: "checkout.payment", v: "completed", ok: true },
  { k: "account.plan", v: "Free", ok: false },
  { k: "entitlement.pro", v: "inactive", ok: false },
  { k: "session", v: "restored", ok: true },
];
const VERIFIED_ROWS: Row[] = [
  { k: "checkout.payment", v: "completed", ok: true },
  { k: "account.plan", v: "Pro", ok: true },
  { k: "entitlement.pro", v: "active", ok: true },
  { k: "session", v: "restored", ok: true },
];
const CHANGED = new Set(["account.plan", "entitlement.pro"]);

/* ── Signature interaction: the requirement holds fixed while the software is repaired. On scroll into view
      it advances Failed -> Verified once; a segmented control lets you move between the two deployments. Only
      the two rows that actually changed mutate. Both records stay preserved in the lineage strip. ── */
function ProofSignature() {
  const [phase, setPhase] = useState<"failed" | "verified">("failed");
  const ref = useRef<HTMLDivElement>(null);
  const played = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return; // no auto-advance; the toggle + lineage still expose both outcomes
    let timer = 0;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting && !played.current) {
        played.current = true;
        timer = window.setTimeout(() => setPhase("verified"), 1500);
      }
    }, { threshold: 0.35 });
    io.observe(el);
    return () => { io.disconnect(); if (timer) window.clearTimeout(timer); };
  }, []);

  const verified = phase === "verified";
  const rows = verified ? VERIFIED_ROWS : FAILED_ROWS;
  const decoratedRows = rows.map((r) => ({ ...r, changed: verified && CHANGED.has(r.k) }));

  return (
    <div ref={ref} className="sv1-proof">
      <div className="sv1-proof__bar">
        <span className="sv1-tlabel" style={{ color: "var(--sv-dok)" }}>Production proof</span>
        <span className="sv1-tlabel">real paid run, one of our own applications</span>
      </div>

      <div className="sv1-proof__grid">
        {/* the requirement — fixed */}
        <div className="sv1-proof__req">
          <span className="sv1-tlabel">The requirement, held outside the code</span>
          <p className="sv1-proof__reqt">A paid customer keeps Pro access after signing back in.</p>
          <Pill state="block">Fixed point</Pill>
          <p className="sv1-proof__note">This never changes. The software is what changes.</p>

          <div className="sv1-seg" role="group" aria-label="Choose deployment" style={{ marginTop: 22 }}>
            <button type="button" className="sv1-seg__b" aria-pressed={!verified} onClick={() => setPhase("failed")}>First deployment</button>
            <button type="button" className="sv1-seg__b" aria-pressed={verified} onClick={() => setPhase("verified")}>After repair</button>
          </div>

          <div className="sv1-proof__verd">
            <Verdict state={verified ? "ok" : "fail"} style={{ fontSize: "clamp(2.6rem, 5vw, 3.6rem)" }} />
            <span className="sv1-rec__id">{verified ? "72c98e, current" : "8f21ad, preserved"}</span>
          </div>
        </div>

        {/* the evidence — mutates only where it changed */}
        <div className="sv1-proof__ev">
          <div className="sv1-ev">
            <div className="sv1-ev__bar">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                <span className="sv1-ev__dot" style={{ background: verified ? "var(--sv-dok)" : "var(--sv-dfail)" }} aria-hidden />
                <span className="sv1-ev__title">Observed in a real browser</span>
              </span>
              <span className="sv1-ev__id">{verified ? "72c98e" : "8f21ad"}</span>
            </div>
            <div className="sv1-rows">
              {decoratedRows.map((r) => (
                <div key={r.k} className={`sv1-row ${r.ok ? "is-ok" : "is-bad"} ${r.changed ? "is-changed" : ""}`}>
                  <span className="sv1-row__k">{r.k}</span>
                  <span className="sv1-row__v">{r.v}</span>
                  <span className="sv1-row__mk" aria-hidden>
                    {r.ok
                      ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                      : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="sv1-proof__concl">
            <span className="sv1-tlabel">Agent reported</span> <span style={{ color: "var(--sv-dfg)" }}>checkout complete.</span>{" "}
            <span style={{ color: "var(--sv-dfg2)" }}>{verified
              ? "Vraelis re-checked the live software and Pro access held."
              : "Vraelis observed payment succeed while the account returned to Free."}</span>
          </div>
        </div>
      </div>

      {/* both records preserved */}
      <div className="sv1-proof__foot">
        <span className="sv1-tlabel">Preserved record</span>
        <div className="sv1-proof__lineage">
          <span style={{ opacity: verified ? 0.55 : 1, transition: "opacity 300ms var(--sv-ease)" }}><PreservedRecord state="fail" id="8f21ad" status="preserved" /></span>
          <span aria-hidden className="sv1-proof__arrow">→</span>
          <span style={{ opacity: verified ? 1 : 0.55, transition: "opacity 300ms var(--sv-ease)" }}><PreservedRecord state="ok" id="72c98e" status="current" /></span>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  ["Define what must stay true", "One sentence about an outcome the business depends on, held as a durable requirement, not a test you maintain."],
  ["Review the exact proof plan", "Vraelis derives the checks the requirement implies and writes them out in plain terms: expected outcomes, forbidden outcomes, the evidence to collect."],
  ["Approve it once", "A person approves the plan. The building agent cannot approve the standard used to judge its own work."],
  ["Run independent verification", "A real browser, from outside the code. Expected against observed, with the evidence kept."],
  ["Inspect the evidence", "Verified, Failed, or Blocked, with the step trace, screenshots, and network detail behind the decision."],
];

const BREADTH = [
  { r: "Paid access persistence", ex: "A paid customer keeps the plan they bought.", tag: "Proven in production", state: "ok" as const },
  { r: "Tenant isolation", ex: "One workspace can never read another's data.", tag: "A requirement Vraelis is built to hold", state: "ex" as const },
  { r: "Persistent application state", ex: "Saved work is still there after a reload.", tag: "A requirement Vraelis is built to hold", state: "ex" as const },
  { r: "Agent approval boundaries", ex: "An automated actor cannot approve its own change.", tag: "A requirement Vraelis is built to hold", state: "ex" as const },
];

export default function Home() {
  return (
    <>
      {/* ── 1 + 2. Category + role ── */}
      <section className="sv1-section sv1-hero">
        <div className="sv1-wrap sv1-wrap--wide sv1-hero__grid">
          <div className="sv1-hero__copy">
            <p className="sv1-eyebrow sv1-fade" style={{ ["--d" as string]: 0 }}>Independent proof for AI-built software</p>
            <h1 className="sv1-display-xl sv1-fade" style={{ ["--d" as string]: 1, marginTop: 20 }}>
              AI can build the software.<br /><span style={{ color: "var(--sv-mut)" }}>It cannot prove itself.</span>
            </h1>
            <p className="sv1-lead sv1-fade" style={{ ["--d" as string]: 2, marginTop: 22 }}>
              Vraelis keeps the requirements your business depends on outside the code, and independently proves the live software against them, verification after verification.
            </p>
            <div className="sv1-fade sv1-hero__cta" style={{ ["--d" as string]: 3 }}>
              <PrimaryCTA size="lg">Verify an application</PrimaryCTA>
              <EditorialLink href="#proof">See a production proof</EditorialLink>
            </div>
            <p className="sv1-fade sv1-mono sv1-hero__honest" style={{ ["--d" as string]: 4 }}>Live today for deployed web applications.</p>
          </div>

          {/* the product object, up front: a standing Guarantee with real preserved records */}
          <div className="sv1-fade" style={{ ["--d" as string]: 3 }}>
            <div className="sv1-card sv1-hero__guar">
              <div className="sv1-hero__guarhead">
                <span className="sv1-tlabel">Standing guarantee</span>
                <Pill state="ok">Verified</Pill>
              </div>
              <p className="sv1-hero__guarreq">A paid customer keeps Pro access after signing back in.</p>
              <div className="sv1-hero__guarmeta">
                <span className="sv1-tlabel">Proven on deployment <span className="sv1-mono" style={{ color: "var(--sv-ink)" }}>72c98e</span></span>
              </div>
              <div className="sv1-hero__guarrec">
                <span className="sv1-tlabel">History, preserved</span>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
                  <PreservedRecord state="fail" id="8f21ad" status="preserved" />
                  <PreservedRecord state="ok" id="72c98e" status="current" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Real production proof (the signature) ── */}
      <section id="proof" className="sv1-section sv1-dark" data-nav-dark>
        <div className="sv1-wrap sv1-wrap--wide">
          <Reveal>
            <SectionHead
              eyebrow="Real production proof"
              title={<>The agent said checkout was complete. <span style={{ color: "var(--sv-dfg2)" }}>It was not.</span></>}
              lead="One requirement, two deployments, both records kept. This is a real paid run against an application we own, not an illustration."
            />
          </Reveal>
          <Reveal media style={{ marginTop: "clamp(34px, 4vw, 52px)" }}>
            <ProofSignature />
          </Reveal>
        </div>
      </section>

      {/* ── 4. The product ── */}
      <section className="sv1-section">
        <div className="sv1-wrap">
          <Reveal>
            <SectionHead
              eyebrow="How it works"
              title="State what must stay true. Approve the proof once. Vraelis keeps it proven."
              lead="A Guarantee turns a single verification into something durable: a named requirement Vraelis proves against the live software, preserving each result as its own record."
            />
          </Reveal>
          <div className="sv1-steps">
            {STEPS.map(([t, d], i) => (
              <Reveal key={t} i={i} className="sv1-step">
                <span className="sv1-step__n sv1-mono">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="sv1-step__t">{t}</h3>
                  <p className="sv1-step__d">{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Breadth ── */}
      <section className="sv1-section sv1-section--well">
        <div className="sv1-wrap">
          <Reveal>
            <SectionHead
              eyebrow="The shape of a requirement"
              title="The requirement stays. The software changes underneath it."
              lead="The same durable object holds very different promises. One is proven in production today. The others are the kind of requirement Vraelis is built to hold, shown as examples, not as claims."
            />
          </Reveal>
          <div className="sv1-breadth">
            {BREADTH.map((b, i) => (
              <Reveal key={b.r} i={i}>
                <div className="sv1-breadth__row">
                  <div className="sv1-breadth__main">
                    <h3 className="sv1-breadth__r">{b.r}</h3>
                    <p className="sv1-breadth__ex">{b.ex}</p>
                  </div>
                  {b.state === "ok"
                    ? <span className="sv1-pill sv1-pill--ok"><span className="sv1-pill__dot" aria-hidden />{b.tag}</span>
                    : <span className="sv1-breadth__tag sv1-tlabel">{b.tag}</span>}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. Current vs next ── */}
      <section className="sv1-section">
        <div className="sv1-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Honest about what is live"
              title="What Vraelis does today, and where it is going."
              muted
            />
          </Reveal>
          <Reveal style={{ marginTop: "clamp(28px, 3vw, 40px)" }}>
            <CurrentNext
              today={[
                "Durable Guarantees on a connected system",
                "A reviewed proof plan a person approves once",
                "Manual independent verification against a deployment",
                "Verified, Failed, or Blocked, with the evidence behind it",
                "Preserved historical records, never overwritten",
              ]}
              next={[
                "Repeating verification automatically across deployments",
                "An agent-facing release decision over the API",
              ]}
            />
          </Reveal>
        </div>
      </section>

      {/* ── close ── */}
      <hr className="sv1-rule" />
      <section className="sv1-section sv1-section--tight">
        <div className="sv1-wrap" style={{ textAlign: "center", maxWidth: 760 }}>
          <Reveal>
            <h2 className="sv1-display-l" style={{ marginInline: "auto" }}>Hold the line the agent cannot cross.</h2>
            <p className="sv1-lead" style={{ margin: "20px auto 30px", textAlign: "center" }}>
              Keep your critical requirements outside the code, and let Vraelis prove the live software against them.
            </p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <PrimaryCTA size="lg">Verify an application</PrimaryCTA>
              <PrimaryCTA href="/dev-preview/site-v1/product" size="lg" ghost>See the product</PrimaryCTA>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
