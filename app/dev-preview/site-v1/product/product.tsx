"use client";

// Product page (site-v1). Explains Vraelis end to end through the life of one Guarantee. The signature is a
// sticky narrative: the Guarantee assembles on the left (requirement -> obligations -> reviewed plan ->
// approval -> execution -> evidence -> preserved records) as the eight stages scroll past on the right.
// Mobile and reduced motion show the fully-assembled object plus every stage, statically.
import { useEffect, useRef, useState } from "react";
import {
  Reveal, SectionHead, PrimaryCTA, EditorialLink, Pill, Verdict, CurrentNext,
} from "../_system/ui";

const STAGES: { n: string; k: string; t: string; d: string }[] = [
  { n: "01", k: "System", t: "Where it all lives", d: "A connected system holds your application, its Guarantees, and every verification record in one place." },
  { n: "02", k: "Guarantee", t: "The durable statement", d: "A Guarantee names one outcome the business depends on. It is held outside the code, so shipping cannot quietly drop it." },
  { n: "03", k: "Proof obligations", t: "What the requirement demands", d: "Vraelis derives what that requirement logically forces it to demonstrate, before a single check is written." },
  { n: "04", k: "Reviewed proof plan", t: "The exact standard", d: "The checks, the expected outcomes, the forbidden outcomes, and the evidence to collect, written in plain terms you can read." },
  { n: "05", k: "Human approval", t: "Approved once, by a person", d: "Someone approves the plan. The building agent cannot approve the standard used to judge its own work. That separation is the whole point." },
  { n: "06", k: "Execution", t: "Proven against the live software", d: "A pinned deployment, driven through a real browser from outside the code, with the evidence collected as it runs." },
  { n: "07", k: "Conclusion", t: "One honest decision", d: "Verified, Failed, or Blocked. Blocked is the answer most tools refuse to give, and the one that keeps the decision honest." },
  { n: "08", k: "Repair and reverification", t: "The record is kept", d: "A repair is verified as its own run. A later result never overwrites the earlier one, so the history stays intact." },
];

function Layer({ on, children }: { on: boolean; children: React.ReactNode }) {
  return <div className={`sv1-asm__layer ${on ? "on" : ""}`}><div className="sv1-asm__inner">{children}</div></div>;
}

/* The assembling Guarantee. `active` is the furthest stage reached (it accumulates, never disassembles). */
function AssemblingGuarantee() {
  const [active, setActive] = useState(0);
  const stageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const small = window.matchMedia?.("(max-width: 900px)").matches;
    if (reduce || small) {
      // Fully assemble the card without a synchronous setState in the effect body.
      const raf = requestAnimationFrame(() => setActive(STAGES.length - 1));
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          const idx = Number((e.target as HTMLElement).dataset.idx);
          setActive((cur) => (idx > cur ? idx : cur));
        }
      }
    }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });
    stageRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="sv1-narr">
      <div className="sv1-narr__aside">
        <div className="sv1-asm" aria-hidden>
          <div className="sv1-asm__head">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
              <span className="sv1-tlabel">System</span>
              <span className="sv1-mono" style={{ fontSize: 13, color: "var(--sv-ink)", fontWeight: 600 }}>checkout-web</span>
            </span>
            <Pill state="ok">Verified</Pill>
          </div>
          <div className="sv1-asm__body">
            <Layer on={active >= 1}>
              <p className="sv1-asm__req">A paid customer keeps Pro access after signing back in.</p>
            </Layer>
            <Layer on={active >= 2}>
              <p className="sv1-asm__k">Proof obligations</p>
              <ul className="sv1-asm__list">
                <li>The upgrade completes without an error</li>
                <li>The account reflects Pro immediately after</li>
                <li>Pro access survives a fresh sign-in</li>
              </ul>
            </Layer>
            <Layer on={active >= 3}>
              <p className="sv1-asm__k">Reviewed proof plan</p>
              <div className="sv1-asm__plan">
                <div><span className="sv1-tlabel" style={{ color: "var(--sv-ok)" }}>Expected</span><span>account.plan = Pro after checkout</span></div>
                <div><span className="sv1-tlabel" style={{ color: "var(--sv-fail)" }}>Forbidden</span><span>account.plan returns to Free</span></div>
                <div><span className="sv1-tlabel">Evidence</span><span>screenshots, network, step trace</span></div>
              </div>
            </Layer>
            <Layer on={active >= 4}>
              <div className="sv1-asm__appr">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
                <span>Approved once by a person, plan v1 locked. The building agent cannot change it.</span>
              </div>
            </Layer>
            <Layer on={active >= 5}>
              <div className="sv1-asm__exec">
                <div className="sv1-asm__execbar"><span className="sv1-ev__title">Execution, real browser</span><span className="sv1-ev__id">72c98e</span></div>
                <div className="sv1-asm__execrows">
                  <div><span>account.plan</span><span style={{ color: "var(--sv-dok)" }}>Pro</span></div>
                  <div><span>entitlement.pro</span><span style={{ color: "var(--sv-dok)" }}>active</span></div>
                </div>
              </div>
            </Layer>
            <Layer on={active >= 6}>
              <div className="sv1-asm__verd">
                <Verdict state="ok" style={{ fontSize: "2.2rem" }} />
                <span className="sv1-rec__id">72c98e, current</span>
              </div>
            </Layer>
            <Layer on={active >= 7}>
              <div className="sv1-asm__recs">
                <span className="sv1-rec sv1-rec--fail"><span className="sv1-rec__v">Failed</span><span className="sv1-rec__id">8f21ad</span><span className="sv1-rec__st">preserved</span></span>
                <span className="sv1-proof__arrow" aria-hidden style={{ color: "var(--sv-meta)" }}>→</span>
                <span className="sv1-rec sv1-rec--ok"><span className="sv1-rec__v">Verified</span><span className="sv1-rec__id">72c98e</span><span className="sv1-rec__st">current</span></span>
              </div>
            </Layer>
          </div>
        </div>
      </div>

      <ol className="sv1-narr__stages">
        {STAGES.map((s, i) => (
          <li
            key={s.n}
            ref={(el) => { stageRefs.current[i] = el; }}
            data-idx={i}
            className={`sv1-stage ${i <= active ? "on" : ""} ${i === active ? "now" : ""}`}
          >
            <div className="sv1-stage__head">
              <span className="sv1-stage__n sv1-mono">{s.n}</span>
              <span className="sv1-stage__k sv1-tlabel">{s.k}</span>
            </div>
            <h3 className="sv1-stage__t">{s.t}</h3>
            <p className="sv1-stage__d">{s.d}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function Product() {
  return (
    <>
      {/* hero (centered editorial — a different composition from the homepage) */}
      <section className="sv1-section sv1-phero">
        <div className="sv1-wrap" style={{ maxWidth: 880, textAlign: "center" }}>
          <p className="sv1-eyebrow sv1-fade" style={{ ["--d" as string]: 0, justifyContent: "center" }}>The product</p>
          <h1 className="sv1-display-xl sv1-fade" style={{ ["--d" as string]: 1, marginTop: 20 }}>
            One durable object holds what your software must never break.
          </h1>
          <p className="sv1-lead sv1-fade" style={{ ["--d" as string]: 2, margin: "22px auto 0", textAlign: "center" }}>
            A Guarantee is a named requirement, held on your system, that Vraelis proves against the live software and keeps a preserved record of, verification after verification.
          </p>
          <div className="sv1-fade" style={{ ["--d" as string]: 3, display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap", marginTop: 30 }}>
            <PrimaryCTA size="lg">Verify an application</PrimaryCTA>
            <EditorialLink href="#lifecycle">Follow one Guarantee</EditorialLink>
          </div>
        </div>
      </section>

      {/* the assembling signature */}
      <section id="lifecycle" className="sv1-section sv1-section--well sv1-section--tight">
        <div className="sv1-wrap sv1-wrap--wide">
          <Reveal>
            <SectionHead
              eyebrow="The life of a Guarantee"
              title="It assembles once, and then it holds."
              lead="Everything that makes a verification trustworthy is built before the software is ever run: the requirement, the obligations it implies, the exact plan, and a person's approval."
            />
          </Reveal>
          <AssemblingGuarantee />
        </div>
      </section>

      {/* separation of duties — the load-bearing claim, stated plainly */}
      <section className="sv1-section">
        <div className="sv1-wrap" style={{ maxWidth: 900 }}>
          <Reveal>
            <p className="sv1-eyebrow">Why it can be trusted</p>
            <h2 className="sv1-display-l" style={{ marginTop: 16 }}>
              The thing that writes the code does not get to certify its own work.
            </h2>
            <p className="sv1-lead" style={{ marginTop: 20 }}>
              A test written inside the system inherits the same assumptions the mistake came from. Vraelis proves the requirement from outside the code, against the deployment your customer actually receives, and a person, not the building agent, approves the standard it is judged by.
            </p>
          </Reveal>
        </div>
      </section>

      {/* current vs next */}
      <section className="sv1-section sv1-section--well">
        <div className="sv1-wrap">
          <Reveal>
            <SectionHead eyebrow="Honest about what is live" title="What a Guarantee does today, and where it is going." muted />
          </Reveal>
          <Reveal style={{ marginTop: "clamp(28px, 3vw, 40px)" }}>
            <CurrentNext
              today={[
                "A durable Guarantee on a connected system",
                "A reviewed proof plan, approved once by a person",
                "Independent verification against a deployment",
                "Verified, Failed, or Blocked, with the evidence",
                "Preserved records that a later run never overwrites",
              ]}
              next={[
                "Reproving a Guarantee automatically on each new deployment",
                "An agent-facing release decision over the API",
              ]}
            />
          </Reveal>
        </div>
      </section>

      {/* close */}
      <hr className="sv1-rule" />
      <section className="sv1-section sv1-section--tight">
        <div className="sv1-wrap" style={{ textAlign: "center", maxWidth: 760 }}>
          <Reveal>
            <h2 className="sv1-display-l" style={{ marginInline: "auto" }}>State it once. Keep it proven.</h2>
            <p className="sv1-lead" style={{ margin: "20px auto 30px", textAlign: "center" }}>
              Name the outcome your business depends on, approve the proof plan, and let Vraelis hold the line on every deployment.
            </p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <PrimaryCTA size="lg">Verify an application</PrimaryCTA>
              <PrimaryCTA href="/dev-preview/site-v1" size="lg" ghost>Back to overview</PrimaryCTA>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
