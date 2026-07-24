import type { Metadata } from "next";
import Link from "next/link";
import { ProofSequence } from "./proof-sequence";

// Not indexable: a category-first art-direction prototype for the Design 05 public site (public-v6). The live
// homepage is untouched; nothing here is merged. Direction: institutional and editorial, category then proof
// then product, with the business requirement held visually fixed while the software beneath it moves. No
// dashboard in the first viewport, no fabricated customer, no "Illustrative" framing: the proof is the real
// production paid-access lineage (Failed 8f21ad, Verified 72c98e, Failed preserved).
export const metadata: Metadata = { title: "Vraelis, public-v6 prototype", robots: { index: false, follow: false } };

const NAV = ["Product", "Research", "Developers", "Company"];

export default function PublicV6() {
  return (
    <div className="v6-root">
      {/* ── Quiet, institutional navigation ── */}
      <nav className="v6-nav" aria-label="Primary">
        <div className="v6-nav__wrap">
          <Link href="#top" className="v6-nav__brand">Vraelis</Link>
          <div className="v6-nav__links">
            {NAV.map((n) => (
              <a key={n} href={n === "Product" ? "#product" : "#"} className="v6-nav__link">{n}</a>
            ))}
          </div>
          <div className="v6-nav__right">
            <Link href="/signin?callbackUrl=%2Fapp" className="v6-nav__signin">Sign in</Link>
            <Link href="/signin?callbackUrl=%2Fapp" className="v6-cta v6-cta--sm">Verify an application</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO: the category, at institutional scale. No dashboard. ── */}
      <header className="v6-hero" id="top">
        <div className="wrap v6-hero__wrap">
          <p className="v6-hero__kick">Independent proof for AI-built software</p>
          <h1 className="v6-hero__h1">
            <span className="v6-hero__line"><span className="v6-hero__lineIn v6-hero__h1a" style={{ animationDelay: "0.12s" }}>AI builds.</span></span>
            <span className="v6-hero__line"><span className="v6-hero__lineIn v6-hero__h1b" style={{ animationDelay: "0.22s" }}>Vraelis proves.</span></span>
          </h1>
          <p className="v6-hero__lead">
            Vraelis keeps the requirements your company depends on outside the code, then independently proves the live software against them.
          </p>
          <div className="v6-hero__cta">
            <Link href="/signin?callbackUrl=%2Fapp" className="v6-cta">Verify an application</Link>
            <a href="#proof" className="v6-textlink">See production proof <span aria-hidden>&darr;</span></a>
          </div>
        </div>
      </header>

      {/* ── THE PROOF: category made concrete. The requirement holds; the software moves. ── */}
      <section className="v6-section v6-section--proof" id="proof" aria-labelledby="proof-h">
        <div className="wrap">
          <h2 id="proof-h" className="sr-only">A real production verification: one requirement, proven across two deployments</h2>
          <div className="v6-eyebrow-row">
            <span className="v6-eyebrow-mono">A real production verification</span>
            <span className="v6-eyebrow-say">One requirement. Two deployments. Both records kept.</span>
          </div>
          <ProofSequence />
          <div className="v6-proof-cta" data-reveal-cta>
            <p className="v6-proof-cta__say">This is one verification, on a real deployment. Run it on your own application.</p>
            <Link href="/signin?callbackUrl=%2Fapp" className="v6-cta v6-cta--lg">Verify an application</Link>
          </div>
        </div>
      </section>

      {/* ── THE PRODUCT: the Guarantee, begun. Reuses the real model, no fabricated system. ── */}
      <section className="v6-section v6-section--product" id="product">
        <div className="wrap">
          <div className="v6-sec-head">
            <p className="v6-kick">The product</p>
            <h2 className="v6-h2">State what must stay true. Approve the proof once. Vraelis keeps it proven.</h2>
            <p className="v6-sec-lead">
              Everything above is a single verification. A Guarantee makes it durable: a named requirement Vraelis proves again on every deployment, preserving each result as its own record.
            </p>
          </div>
          <ol className="v6-steps">
            <li className="v6-step">
              <span className="v6-step__n">01</span>
              <div>
                <h3 className="v6-step__t">Name the requirement</h3>
                <p className="v6-step__d">One sentence about what your product must always do for the business, stated as an outcome, not a test.</p>
              </div>
            </li>
            <li className="v6-step">
              <span className="v6-step__n">02</span>
              <div>
                <h3 className="v6-step__t">Review the proof plan</h3>
                <p className="v6-step__d">Vraelis derives the proof obligations the requirement implies and the exact reviewed plan that checks them, in plain terms.</p>
              </div>
            </li>
            <li className="v6-step">
              <span className="v6-step__n">03</span>
              <div>
                <h3 className="v6-step__t">Approve it once</h3>
                <p className="v6-step__d">A person approves the reviewed plan. The building agent cannot approve its own work, and it cannot change the plan it did not write.</p>
              </div>
            </li>
            <li className="v6-step">
              <span className="v6-step__n">04</span>
              <div>
                <h3 className="v6-step__t">Vraelis proves it, and keeps the record</h3>
                <p className="v6-step__d">Real browser, expected against observed, evidence, and a decision of Verified, Failed, or Blocked, preserved on every deployment so a later pass never overwrites an earlier one.</p>
              </div>
            </li>
          </ol>
          <p className="v6-next-note">Reverifying automatically on each new deployment, and an API loop the coding agent can build and repair against, are next. They are marked as direction, never shown as shipping.</p>
        </div>
      </section>

      {/* ── CLOSE ── */}
      <section className="v6-section v6-close">
        <div className="wrap v6-close__wrap">
          <h2 className="v6-close__h">Hold the line the agent cannot cross.</h2>
          <p className="v6-close__p">Keep your critical requirements outside the code, and let Vraelis prove the live software against them, verification after verification.</p>
          <Link href="/signin?callbackUrl=%2Fapp" className="v6-cta v6-cta--lg">Verify an application</Link>
        </div>
      </section>

      <V6Styles />
    </div>
  );
}

function V6Styles() {
  return (
    <style>{`
      .v6-root { background: var(--bg-0); color: var(--fg-2); }
      .v6-section { position: relative; }
      .v6-h2 { font-family: var(--font-display); font-weight: 600; color: var(--fg-1); letter-spacing: -0.025em; line-height: 1.08; font-size: clamp(1.7rem, 3.4vw, 2.7rem); text-wrap: balance; }
      .v6-kick { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--fg-4); margin: 0 0 16px; font-family: var(--font-geist-mono), ui-monospace, monospace; }

      /* ── NAV ── */
      .v6-nav { position: sticky; top: 0; z-index: 40; background: color-mix(in srgb, var(--bg-0) 86%, transparent); backdrop-filter: saturate(1.1) blur(10px); border-bottom: 1px solid var(--line-1); }
      .v6-nav__wrap { max-width: var(--max-content); margin: 0 auto; padding: 0 clamp(20px, 4vw, 64px); height: 64px; display: flex; align-items: center; gap: 28px; }
      .v6-nav__brand { font-family: var(--font-display); font-weight: 600; font-size: 18px; letter-spacing: -0.02em; color: var(--fg-1); text-decoration: none; }
      .v6-nav__links { display: flex; align-items: center; gap: 26px; margin-left: 12px; }
      .v6-nav__link { font-size: 14.5px; color: var(--fg-3); text-decoration: none; transition: color var(--dur) var(--ease); }
      .v6-nav__link:hover { color: var(--fg-1); }
      .v6-nav__right { margin-left: auto; display: flex; align-items: center; gap: 20px; }
      .v6-nav__signin { font-size: 14.5px; color: var(--fg-2); text-decoration: none; }
      .v6-nav__signin:hover { color: var(--fg-1); }

      /* ── CTA: one authoritative near-black action; never two boxed buttons ── */
      .v6-cta {
        display: inline-flex; align-items: center; justify-content: center; gap: 9px; background: var(--fg-1); color: var(--bg-1);
        font-family: var(--font-display); font-weight: 500; font-size: 15px; letter-spacing: -0.005em;
        padding: 12px 22px; min-height: 44px; box-sizing: border-box; border-radius: 5px; text-decoration: none; border: 1px solid var(--fg-1);
        transition: background var(--dur) var(--ease), transform var(--dur-fast) var(--ease-out);
      }
      .v6-cta:hover { background: #000; color: #fff; }
      .v6-cta:active { transform: scale(0.98); }
      .v6-cta:focus-visible { outline: 2px solid var(--acc-deep); outline-offset: 3px; }
      .v6-cta--sm { padding: 9px 16px; font-size: 14px; }
      .v6-cta--lg { padding: 15px 30px; font-size: 16px; }
      .v6-textlink { display: inline-flex; align-items: center; gap: 7px; font-size: 15px; font-weight: 500; color: var(--fg-1); text-decoration: none; border-bottom: 1px solid var(--line-3); padding-bottom: 3px; transition: border-color var(--dur) var(--ease), color var(--dur) var(--ease); }
      .v6-textlink:hover { color: var(--acc-deep); border-color: var(--acc-deep); }

      /* ── HERO ── */
      .v6-hero { padding: clamp(38px, 6.5vh, 78px) 0 clamp(18px, 3vh, 34px); }
      .v6-hero__wrap { max-width: var(--max-content); }
      .v6-hero__kick { font-family: var(--font-geist-mono), ui-monospace, monospace; font-size: 13px; letter-spacing: 0.06em; color: var(--acc-deep); margin: 0 0 clamp(18px, 2.6vh, 30px); }
      .v6-hero__h1 { font-family: var(--font-display); font-weight: 600; letter-spacing: -0.035em; line-height: 0.96; margin: 0; display: flex; flex-direction: column; }
      .v6-hero__line { display: block; overflow: hidden; padding-bottom: 0.06em; margin-bottom: -0.06em; }
      .v6-hero__lineIn { display: block; font-size: clamp(2.7rem, 7.1vw, 6rem); }
      .v6-hero__h1a { color: var(--fg-4); }
      .v6-hero__h1b { color: var(--fg-1); }
      .v6-hero__lead { font-size: clamp(1.1rem, 1.5vw, 1.42rem); line-height: 1.5; color: var(--fg-2); max-width: 36ch; margin: clamp(20px, 2.8vh, 30px) 0 clamp(22px, 3vh, 32px); }
      .v6-hero__cta { display: flex; align-items: center; gap: 26px; flex-wrap: wrap; }

      /* ── Hero entrance: masked headline reveal on load, then supporting copy settles ── */
      @keyframes v6mask { from { transform: translateY(102%); } to { transform: translateY(0); } }
      @keyframes v6rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
      .v6-hero__lineIn { animation: v6mask 0.82s var(--ease-out) both; }
      .v6-hero__kick { animation: v6rise 0.6s var(--ease-out) both; }
      .v6-hero__lead { animation: v6rise 0.62s var(--ease-out) 0.42s both; }
      .v6-hero__cta { animation: v6rise 0.62s var(--ease-out) 0.54s both; }
      @media (prefers-reduced-motion: reduce) {
        .v6-hero__lineIn, .v6-hero__kick, .v6-hero__lead, .v6-hero__cta { animation: none !important; opacity: 1 !important; transform: none !important; }
      }

      /* ── PROOF SECTION frame ── */
      .v6-section--proof { padding: clamp(24px, 3.2vw, 44px) 0 clamp(56px, 9vh, 110px); border-top: 1px solid var(--line-2); background: var(--bg-1); }
      .v6-eyebrow-row { display: flex; align-items: baseline; gap: 16px 24px; flex-wrap: wrap; margin-bottom: clamp(22px, 3.2vw, 40px); }
      .v6-eyebrow-mono { font-family: var(--font-geist-mono), ui-monospace, monospace; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--acc-deep); }
      .v6-eyebrow-say { font-family: var(--font-display); font-weight: 500; font-size: clamp(1.05rem, 1.5vw, 1.35rem); color: var(--fg-2); letter-spacing: -0.015em; }
      .v6-proof-cta { margin-top: clamp(40px, 7vh, 88px); padding-top: clamp(28px, 4vh, 44px); border-top: 1px solid var(--line-2); display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
      .v6-proof-cta__say { font-family: var(--font-display); font-weight: 500; font-size: clamp(1.15rem, 1.8vw, 1.6rem); letter-spacing: -0.02em; color: var(--fg-1); max-width: 24ch; margin: 0; }

      /* ── PRODUCT SECTION ── */
      .v6-section--product { padding: clamp(64px, 11vh, 130px) 0; border-top: 1px solid var(--line-2); }
      .v6-sec-head { max-width: 720px; margin-bottom: clamp(40px, 6vh, 68px); }
      .v6-sec-lead { font-size: clamp(1.05rem, 1.3vw, 1.2rem); line-height: 1.55; color: var(--fg-2); margin-top: 18px; max-width: 60ch; }
      .v6-steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--line-2); border: 1px solid var(--line-2); }
      .v6-step { background: var(--bg-1); padding: clamp(24px, 3vw, 38px); display: flex; gap: 20px; align-items: flex-start; }
      .v6-step__n { font-family: var(--font-geist-mono), ui-monospace, monospace; font-size: 13px; color: var(--acc-deep); padding-top: 4px; flex: none; letter-spacing: 0.02em; }
      .v6-step__t { font-family: var(--font-display); font-weight: 600; font-size: clamp(1.15rem, 1.6vw, 1.4rem); color: var(--fg-1); letter-spacing: -0.015em; margin: 0 0 9px; }
      .v6-step__d { font-size: 15px; line-height: 1.6; color: var(--fg-3); margin: 0; }
      .v6-next-note { font-size: 14px; line-height: 1.6; color: var(--fg-4); margin-top: 26px; max-width: 64ch; }

      /* ── CLOSE ── */
      .v6-close { padding: clamp(72px, 13vh, 150px) 0; border-top: 1px solid var(--line-2); background: var(--bg-1); }
      .v6-close__wrap { max-width: 760px; }
      .v6-close__h { font-family: var(--font-display); font-weight: 600; color: var(--fg-1); letter-spacing: -0.03em; line-height: 1.02; font-size: clamp(2.2rem, 5vw, 4rem); margin: 0; text-wrap: balance; }
      .v6-close__p { font-size: clamp(1.05rem, 1.4vw, 1.28rem); line-height: 1.55; color: var(--fg-2); margin: 24px 0 34px; max-width: 52ch; }

      /* ── RESPONSIVE ── */
      @media (max-width: 939px) {
        .v6-nav__links { display: none; }
        .v6-hero__lead { max-width: 40ch; }
        .v6-steps { grid-template-columns: 1fr; }
      }
      @media (max-width: 560px) {
        .v6-nav__wrap { gap: 14px; }
        .v6-nav__signin { display: none; }
        .v6-hero__cta { gap: 18px; }
      }
    `}</style>
  );
}
