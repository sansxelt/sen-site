import type { Metadata } from "next";
import Link from "next/link";
import { EvidenceHero } from "./evidence-hero";

// Not indexable: an evidence-first art-direction prototype for the Design 05 public site (public-v7). The live
// homepage is untouched; nothing here is merged. Direction: evidence is the hero. The first viewport is a
// near-black production-proof environment (requirement held, real observed browser state, a full-scale FAILED,
// the preserved Failed/Verified lineage), which pins and resolves to VERIFIED on scroll, then hands off to the
// light Vraelis product world. Real production lineage (8f21ad Failed, 72c98e Verified), no fabricated
// customer, no "Illustrative".
export const metadata: Metadata = { title: "Vraelis, public-v7 prototype", robots: { index: false, follow: false } };

export default function PublicV7() {
  return (
    <div className="v7-root">
      <EvidenceHero />

      {/* ── Back into the light Vraelis product world ── */}
      <section className="v7-section v7-section--product" id="product">
        <div className="wrap">
          <div className="v7-sec-head">
            <p className="v7-p-kick">The product</p>
            <h2 className="v7-h2">State what must stay true. Approve the proof once. Vraelis keeps it proven.</h2>
            <p className="v7-sec-lead">
              What you just saw is a single verification. A Guarantee makes it durable: a named requirement Vraelis proves again on every deployment, preserving each result as its own record.
            </p>
          </div>
          <ol className="v7-steps">
            <li className="v7-step">
              <span className="v7-step__n">01</span>
              <div><h3 className="v7-step__t">Name the requirement</h3><p className="v7-step__d">One sentence about what your product must always do for the business, stated as an outcome, not a test.</p></div>
            </li>
            <li className="v7-step">
              <span className="v7-step__n">02</span>
              <div><h3 className="v7-step__t">Review the proof plan</h3><p className="v7-step__d">Vraelis derives the proof obligations the requirement implies and the exact reviewed plan that checks them, in plain terms.</p></div>
            </li>
            <li className="v7-step">
              <span className="v7-step__n">03</span>
              <div><h3 className="v7-step__t">Approve it once</h3><p className="v7-step__d">A person approves the reviewed plan. The building agent cannot approve its own work, and it cannot change the plan it did not write.</p></div>
            </li>
            <li className="v7-step">
              <span className="v7-step__n">04</span>
              <div><h3 className="v7-step__t">Vraelis proves it, and keeps the record</h3><p className="v7-step__d">Real browser, expected against observed, evidence, and a decision of Verified, Failed, or Blocked, preserved on every deployment so a later pass never overwrites an earlier one.</p></div>
            </li>
          </ol>
          <p className="v7-next-note">Reverifying automatically on each new deployment, and an API loop the coding agent can build and repair against, are next. They are marked as direction, never shown as shipping.</p>
        </div>
      </section>

      {/* ── Close ── */}
      <section className="v7-section v7-close">
        <div className="wrap v7-close__wrap">
          <h2 className="v7-close__h">Hold the line the agent cannot cross.</h2>
          <p className="v7-close__p">Keep your critical requirements outside the code, and let Vraelis prove the live software against them, verification after verification.</p>
          <Link href="/signin?callbackUrl=%2Fapp" className="v7-cta-dark">Verify an application</Link>
        </div>
      </section>

      <V7PageStyles />
    </div>
  );
}

function V7PageStyles() {
  return (
    <style>{`
      .v7-root { background: var(--bg-0); color: var(--fg-2); }
      .v7-section { position: relative; }
      .v7-h2 { font-family: var(--font-display); font-weight: 600; color: var(--fg-1); letter-spacing: -0.025em; line-height: 1.08; font-size: clamp(1.7rem, 3.4vw, 2.7rem); text-wrap: balance; }
      .v7-p-kick { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--fg-4); margin: 0 0 16px; font-family: var(--font-geist-mono), ui-monospace, monospace; }

      .v7-cta-dark { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; box-sizing: border-box;
        background: var(--fg-1); color: var(--bg-1); font-family: var(--font-display); font-weight: 600; font-size: 16px; letter-spacing: -0.005em;
        padding: 14px 28px; border-radius: 5px; text-decoration: none; border: 1px solid var(--fg-1);
        transition: transform var(--dur-fast) var(--ease-out), background .2s var(--ease); }
      .v7-cta-dark:hover { background: #000; } .v7-cta-dark:active { transform: scale(0.98); }
      .v7-cta-dark:focus-visible { outline: 2px solid var(--acc-deep); outline-offset: 3px; }

      .v7-section--product { padding: clamp(64px, 11vh, 130px) 0; }
      .v7-sec-head { max-width: 720px; margin-bottom: clamp(40px, 6vh, 68px); }
      .v7-sec-lead { font-size: clamp(1.05rem, 1.3vw, 1.2rem); line-height: 1.55; color: var(--fg-2); margin-top: 18px; max-width: 60ch; }
      .v7-steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--line-2); border: 1px solid var(--line-2); }
      .v7-step { background: var(--bg-1); padding: clamp(24px, 3vw, 38px); display: flex; gap: 20px; align-items: flex-start; }
      .v7-step__n { font-family: var(--font-geist-mono), ui-monospace, monospace; font-size: 13px; color: var(--acc-deep); padding-top: 4px; flex: none; }
      .v7-step__t { font-family: var(--font-display); font-weight: 600; font-size: clamp(1.15rem, 1.6vw, 1.4rem); color: var(--fg-1); letter-spacing: -0.015em; margin: 0 0 9px; }
      .v7-step__d { font-size: 15px; line-height: 1.6; color: var(--fg-3); margin: 0; }
      .v7-next-note { font-size: 14px; line-height: 1.6; color: var(--fg-4); margin-top: 26px; max-width: 64ch; }

      .v7-close { padding: clamp(72px, 13vh, 150px) 0; border-top: 1px solid var(--line-2); background: var(--bg-1); }
      .v7-close__wrap { max-width: 760px; }
      .v7-close__h { font-family: var(--font-display); font-weight: 600; color: var(--fg-1); letter-spacing: -0.03em; line-height: 1.02; font-size: clamp(2.2rem, 5vw, 4rem); margin: 0; text-wrap: balance; }
      .v7-close__p { font-size: clamp(1.05rem, 1.4vw, 1.28rem); line-height: 1.55; color: var(--fg-2); margin: 24px 0 34px; max-width: 52ch; }

      @media (max-width: 900px) { .v7-steps { grid-template-columns: 1fr; } }
    `}</style>
  );
}
