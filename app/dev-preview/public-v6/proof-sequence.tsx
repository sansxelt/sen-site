"use client";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// PUBLIC-V6 — the Vraelis production proof sequence. Scroll-led, institutional, editorial.
//
// The business requirement is the PERMANENT object: it stays visually fixed (sticky) while the software
// beneath it moves through the real production lineage. The agent can change the code; it cannot change what
// the business requires Vraelis to prove.
//
// Motion is native only: CSS sticky positions the requirement; an IntersectionObserver reveals each beat once
// as it enters. No scroll-hijack library, no GSAP, no Lenis (the live scale.com audit confirmed native
// scrolling; the sequence needs nothing more). Reduced motion resolves the whole sequence immediately:
// fixed requirement, Failed record, repaired Verified record, both preserved.
//
// Real lineage, not illustrative: deployment 8f21ad failed the paid-access requirement (payment succeeded,
// access lost after re-sign-in); the repair on 72c98e was independently Verified; the Failed record is kept.
// Separators written as "·" in the brief are rendered as spacing, never as a middot glyph.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";
import { Ic, I } from "@/app/rank/_components/icons";

export function ProofSequence() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const beats = el.querySelectorAll<HTMLElement>("[data-reveal]");
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { beats.forEach((b) => b.classList.add("in")); return; }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
        }
      },
      { threshold: 0.3, rootMargin: "0px 0px -12% 0px" },
    );
    beats.forEach((b) => io.observe(b));
    return () => io.disconnect();
  }, []);

  return (
    <div className="v6-proof" ref={root} role="region" aria-label="A real Vraelis production verification, from a failed deployment to an independently verified repair">
      {/* THE PERMANENT OBJECT: the business requirement, held fixed while the software changes. */}
      <div className="v6-anchor">
        <div className="v6-anchor__inner">
          <div className="v6-kick v6-kick--mono">The business requires</div>
          <p className="v6-req">A paid customer receives Pro access and retains it after signing back in.</p>
          <div className="v6-anchor__note">
            <span className="v6-anchor__hold">Held outside the code</span>
            This requirement does not change when the software does. The building agent cannot reach it, rewrite it, or mark it satisfied. Vraelis proves the live deployment against it.
          </div>
        </div>
      </div>

      {/* THE MUTABLE SOFTWARE: the beats that pass beneath the fixed requirement. */}
      <div className="v6-flow">
        <section className="v6-beat v6-beat--claim" data-reveal data-m="1">
          <div className="v6-lbl v6-lbl--mut">The agent reported</div>
          <p className="v6-beat__lead">Checkout complete.</p>
          <div className="v6-meta">
            <span className="v6-meta__k">Deployment</span>
            <span className="v6-mono">8f21ad</span>
            <span className="v6-meta__s">It wrote the code, the tests, and the claim.</span>
          </div>
        </section>

        <section className="v6-beat v6-beat--obs" data-reveal data-m="2">
          <div className="v6-lbl v6-lbl--acc">Vraelis observed, in a real browser</div>
          <div className="v6-obs">
            <div className="v6-obs__row v6-obs__row--ok"><span className="v6-obs__mk v6-obs__mk--ok"><Ic d={I.check} size={13} sw={2.6} /></span>Payment completed.</div>
            <div className="v6-obs__row v6-obs__row--bad"><span className="v6-obs__mk v6-obs__mk--bad"><Ic d={I.x} size={13} sw={2.6} /></span>The account returned to Free after signing back in.</div>
          </div>
        </section>

        <section className="v6-beat v6-beat--verdict v6-beat--failed" data-reveal data-m="3">
          <div className="v6-verdict-word v6-verdict-word--fail">Failed</div>
          <p className="v6-verdict-say">Expected and observed behavior diverged. The failure, its evidence, and a repair prompt go back to the agent.</p>
        </section>

        <section className="v6-beat v6-beat--repair" data-reveal data-m="4">
          <div className="v6-lbl v6-lbl--mut">Repair</div>
          <div className="v6-meta v6-meta--repair">
            <span className="v6-meta__k">Deployment</span>
            <span className="v6-mono">72c98e</span>
          </div>
          <div className="v6-repair-lines">
            <span>Payment completed.</span>
            <span>Access granted.</span>
            <span>Session restored.</span>
            <span>Entitlement retained.</span>
          </div>
        </section>

        <section className="v6-beat v6-beat--verdict v6-beat--verified" data-reveal data-m="5">
          <div className="v6-verdict-word v6-verdict-word--ok">Verified</div>
          <p className="v6-verdict-say">Vraelis proved the live software against the requirement and it held, across a fresh sign-in.</p>
        </section>

        <section className="v6-beat v6-beat--history" data-reveal data-m="6">
          <div className="v6-lbl v6-lbl--mono">Vraelis production proof</div>
          <div className="v6-hist">
            <div className="v6-hist__row v6-hist__row--fail">
              <span className="v6-hist__dot" />
              <span className="v6-hist__verdict">Failed</span>
              <span className="v6-mono v6-hist__id">8f21ad</span>
              <span className="v6-hist__state">preserved</span>
            </div>
            <div className="v6-hist__row v6-hist__row--ok">
              <span className="v6-hist__dot" />
              <span className="v6-hist__verdict">Verified</span>
              <span className="v6-mono v6-hist__id">72c98e</span>
              <span className="v6-hist__state v6-hist__state--now">current</span>
            </div>
          </div>
          <p className="v6-hist__note">The later Verified result never erases the earlier Failed one. Every verification is kept as its own record.</p>
        </section>
      </div>

      <ProofStyles />
    </div>
  );
}

function ProofStyles() {
  return (
    <style>{`
      .v6-proof { position: relative; }

      /* shared editorial primitives */
      .v6-mono { font-family: var(--font-geist-mono), ui-monospace, "SF Mono", Menlo, Consolas, monospace; letter-spacing: 0; }
      .v6-kick { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--fg-4); }
      .v6-kick--mono { font-family: var(--font-geist-mono), ui-monospace, monospace; letter-spacing: 0.12em; }
      .v6-lbl { font-size: 12px; letter-spacing: 0.13em; text-transform: uppercase; color: var(--fg-4); margin-bottom: 18px; }
      .v6-lbl--mono { font-family: var(--font-geist-mono), ui-monospace, monospace; letter-spacing: 0.1em; }
      .v6-lbl--acc { color: var(--acc-deep); }
      .v6-lbl--mut { color: var(--fg-4); }

      /* ── The fixed requirement ── */
      .v6-anchor__inner { padding-right: clamp(0px, 2vw, 32px); }
      .v6-req {
        font-family: var(--font-display); font-weight: 500; color: var(--fg-1);
        font-size: clamp(1.7rem, 2.9vw, 2.7rem); line-height: 1.1; letter-spacing: -0.02em;
        margin: 16px 0 26px; text-wrap: balance;
      }
      .v6-anchor__note { font-size: 15px; line-height: 1.62; color: var(--fg-3); max-width: 40ch; }
      .v6-anchor__hold {
        display: inline-block; font-family: var(--font-geist-mono), monospace; font-size: 11px;
        letter-spacing: 0.08em; text-transform: uppercase; color: var(--acc-deep);
        border: 1px solid var(--acc-line); border-radius: 2px; padding: 3px 8px; margin: 0 10px 6px 0;
        vertical-align: 2px;
      }

      /* ── The moving software ── */
      .v6-flow { display: flex; flex-direction: column; }
      .v6-beat {
        min-height: 44vh; display: flex; flex-direction: column; justify-content: center;
        padding: clamp(24px, 5vh, 56px) 0; border-top: 1px solid var(--line-2);
      }
      .v6-flow > .v6-beat:first-child { border-top: none; }

      /* reveal: a soft vertical settle for the mutable-software beats */
      .v6-beat[data-reveal] { opacity: 0; transform: translateY(22px); transition: opacity .7s var(--ease-out), transform .7s var(--ease-out); }
      .v6-beat[data-reveal].in { opacity: 1; transform: none; }
      .v6-beat[data-reveal] > * { transition: opacity .7s var(--ease-out) .08s, transform .7s var(--ease-out) .08s; }
      /* the verdict resolves with consequence: the word wipes in left to right, decisive, no soft drift */
      .v6-beat--verdict[data-reveal] { transform: none; }
      .v6-beat--verdict[data-reveal] .v6-verdict-word { clip-path: inset(0 103% 0 0); transition: clip-path .44s var(--ease-out) .1s; }
      .v6-beat--verdict[data-reveal].in .v6-verdict-word { clip-path: inset(0 0 0 0); }

      .v6-beat__lead { font-family: var(--font-display); font-weight: 500; color: var(--fg-2); font-size: clamp(1.6rem, 3vw, 2.4rem); letter-spacing: -0.02em; line-height: 1.12; margin: 0 0 20px; }
      .v6-meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 15px; }
      .v6-meta__k { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--fg-4); font-family: var(--font-geist-mono), monospace; }
      .v6-meta .v6-mono { font-size: 15px; color: var(--fg-1); font-weight: 600; }
      .v6-meta__s { color: var(--fg-4); }
      .v6-meta--repair { margin-bottom: 22px; }

      .v6-obs { display: flex; flex-direction: column; gap: 16px; }
      .v6-obs__row { display: flex; align-items: flex-start; gap: 14px; font-family: var(--font-display); font-weight: 500; letter-spacing: -0.015em; font-size: clamp(1.35rem, 2.4vw, 2rem); line-height: 1.2; }
      .v6-obs__row--ok { color: var(--fg-3); }
      .v6-obs__row--bad { color: var(--fg-1); }
      .v6-obs__mk { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 999px; flex: none; margin-top: 6px; }
      .v6-obs__mk--ok { background: var(--acc-soft); color: var(--acc-deep); border: 1px solid var(--acc-line); }
      .v6-obs__mk--bad { background: #F6ECE7; color: #A8452A; border: 1px solid #E7CFC5; }

      /* verdicts: the largest visual events in the sequence */
      .v6-verdict-word { font-family: var(--font-display); font-weight: 600; letter-spacing: -0.045em; line-height: 0.9; font-size: clamp(4rem, 11vw, 9.5rem); }
      .v6-verdict-word--fail { color: #A8452A; }
      .v6-verdict-word--ok { color: var(--acc-deep); }
      .v6-verdict-say { font-size: clamp(1.05rem, 1.5vw, 1.35rem); line-height: 1.5; color: var(--fg-3); max-width: 30ch; margin: 22px 0 0; }
      .v6-beat--verdict { min-height: 60vh; }

      .v6-repair-lines { display: flex; flex-direction: column; gap: 10px; }
      .v6-repair-lines span { font-family: var(--font-display); font-weight: 500; letter-spacing: -0.015em; font-size: clamp(1.3rem, 2.2vw, 1.85rem); color: var(--fg-2); line-height: 1.15; }

      /* preserved history */
      .v6-hist { display: flex; flex-direction: column; gap: 14px; margin-bottom: 20px; }
      .v6-hist__row { display: flex; align-items: baseline; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--line-2); }
      .v6-hist__row:last-child { border-bottom: none; }
      .v6-hist__dot { width: 11px; height: 11px; border-radius: 999px; flex: none; align-self: center; }
      .v6-hist__row--fail .v6-hist__dot { background: #A8452A; }
      .v6-hist__row--ok .v6-hist__dot { background: var(--acc-deep); }
      .v6-hist__verdict { font-family: var(--font-display); font-weight: 600; font-size: clamp(1.4rem, 2.4vw, 2rem); letter-spacing: -0.02em; }
      .v6-hist__row--fail .v6-hist__verdict { color: #A8452A; }
      .v6-hist__row--ok .v6-hist__verdict { color: var(--acc-deep); }
      .v6-hist__id { font-size: 16px; color: var(--fg-2); font-weight: 600; margin-left: auto; }
      .v6-hist__state { font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--fg-4); font-family: var(--font-geist-mono), monospace; }
      .v6-hist__state--now { color: var(--acc-deep); }
      .v6-hist__note { font-size: 15px; line-height: 1.6; color: var(--fg-4); max-width: 46ch; }

      /* ── DESKTOP: fixed requirement beside the moving software ── */
      @media (min-width: 940px) {
        .v6-proof { display: grid; grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.35fr); column-gap: clamp(40px, 6vw, 104px); align-items: start; }
        .v6-anchor { position: sticky; top: 108px; align-self: start; }
      }

      /* ── MOBILE: independently composed. Requirement pinned at top; then Failed, evidence, Verified, history ── */
      @media (max-width: 939px) {
        /* mobile: requirement leads the sequence (independent mobile composition), not pinned, so it
           never eats the small viewport nor collides with the sticky nav */
        .v6-anchor { padding: 6px 0 20px; margin-bottom: 6px; border-bottom: 1px solid var(--line-2); }
        .v6-req { font-size: clamp(1.5rem, 6vw, 2rem); margin: 12px 0 14px; }
        .v6-anchor__note { font-size: 14px; max-width: none; }
        .v6-beat { min-height: 0; padding: 40px 0; justify-content: flex-start; }
        .v6-beat--verdict { min-height: 0; }
        /* founder mobile order: requirement (pinned), claim, Failed, observed evidence, repair, Verified, history */
        .v6-flow { display: flex; flex-direction: column; }
        .v6-beat--claim   { order: 1; }
        .v6-beat--failed  { order: 2; }
        .v6-beat--obs     { order: 3; }
        .v6-beat--repair  { order: 4; }
        .v6-beat--verified{ order: 5; }
        .v6-beat--history { order: 6; }
        .v6-verdict-word { font-size: clamp(3.4rem, 20vw, 5rem); }
      }
      @media (max-width: 360px) {
        .v6-verdict-word { font-size: clamp(3rem, 19vw, 4rem); }
        .v6-hist__row { flex-wrap: wrap; gap: 8px 12px; }
        .v6-hist__id { margin-left: 0; }
      }

      @media (prefers-reduced-motion: reduce) {
        .v6-beat[data-reveal], .v6-beat[data-reveal] > * { transition: none !important; opacity: 1 !important; transform: none !important; }
        .v6-verdict-word { clip-path: none !important; }
      }
    `}</style>
  );
}
