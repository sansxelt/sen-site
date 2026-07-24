"use client";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// PUBLIC-V8 — a scroll-directed Vraelis story. Five authored scenes that reinvent the page as you scroll.
//
//   1 CINEMATIC OPEN   near-black, full-bleed evidence field; the headline masks away, the evidence enlarges
//   2 FIXED REQUIREMENT the requirement holds while the agent claim, deployment, browser evidence, the
//                       expected/observed split, "Vraelis caught the mismatch", and a full-scale FAILED build
//   3 REPAIR           Failed recedes into preserved history; 8f21ad -> 72c98e; only changed rows mutate;
//                       VERIFIED resolves at scale; the lineage settles
//   4 FIELD OF PROOF   the dark evidence field opens into warm white; real proof artifacts distribute across
//                       the viewport around "The software changes. The requirement stays."
//   5 PRODUCT ASSEMBLES the artifacts converge into the durable Guarantee; closes on the product truth + NEXT
//
// Motion is native only: a single rAF-throttled scroll handler sets a per-scene progress custom property
// (--p, 0..1) on each pinned scene; CSS scrubs transform/opacity/clip-path off it. No scroll-hijack, no
// dependency. Reduced motion unpins every scene and resolves all content to its readable static state, so the
// complete narrative is shown with nothing hidden behind animation. Real production lineage (8f21ad Failed,
// 72c98e Verified), no fabricated customer, no "Illustrative". "·" separators are rendered as layout.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Ic, I } from "@/app/rank/_components/icons";
import type { CSSProperties } from "react";

// reveal window helper: fade + rise between scroll progress `s` and `s+d`
const rev = (s: number, d: number): CSSProperties => ({ "--s": s, "--ir": +(1 / d).toFixed(3) } as CSSProperties);

const FAILED_ROWS = [
  { k: "checkout.payment", v: "completed", ok: true },
  { k: "account.plan", v: "Free", ok: false },
  { k: "entitlement.pro", v: "inactive", ok: false },
  { k: "session", v: "restored", ok: true },
];
const VERIFIED_ROWS = [
  { k: "checkout.payment", v: "completed", ok: true, changed: false },
  { k: "account.plan", v: "Pro", ok: true, changed: true },
  { k: "entitlement.pro", v: "active", ok: true, changed: true },
  { k: "session", v: "restored", ok: true, changed: false },
];

function Rows({ rows, changedKeys }: { rows: { k: string; v: string; ok: boolean }[]; changedKeys?: string[] }) {
  return (
    <div className="v8-rows">
      {rows.map((r) => (
        <div key={r.k} className={`v8-row ${r.ok ? "is-ok" : "is-bad"} ${changedKeys?.includes(r.k) ? "is-changed" : ""}`}>
          <span className="v8-row__k v8-mono">{r.k}</span>
          <span className="v8-row__v v8-mono">{r.v}</span>
          <span className="v8-row__mk" aria-hidden><Ic d={r.ok ? I.check : I.x} size={12} sw={2.7} /></span>
        </div>
      ))}
    </div>
  );
}

export function ScrollStory() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) root.setAttribute("data-reduced", "on");
    const scenes = Array.from(root.querySelectorAll<HTMLElement>("[data-scene]"));
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      if (!reduce) {
        for (const s of scenes) {
          const rect = s.getBoundingClientRect();
          const total = s.offsetHeight - vh;
          let p: number;
          if (total > 0) p = Math.min(1, Math.max(0, -rect.top / total));
          else p = rect.top <= 0 ? 1 : 0;
          s.style.setProperty("--p", p.toFixed(4));
        }
      }
      // nav theme flips when the field washes to warm white (scenes 4 and 5 are light)
      const s4 = scenes[3];
      const lightStart = s4 ? s4.offsetTop + Math.min(s4.offsetHeight - vh, vh * 0.42) : Infinity;
      root.setAttribute("data-navtheme", window.scrollY >= lightStart ? "light" : "dark");
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div className="v8" ref={rootRef}>
      {/* quiet, fixed navigation that shifts surface with the story */}
      <nav className="v8-nav" aria-label="Primary">
        <Link href="#v8-top" className="v8-nav__brand">Vraelis</Link>
        <div className="v8-nav__right">
          <Link href="/signin?callbackUrl=%2Fapp" className="v8-nav__signin">Sign in</Link>
          <Link href="/signin?callbackUrl=%2Fapp" className="v8-cta v8-cta--sm">Verify an application</Link>
        </div>
      </nav>

      {/* ══ SCENE 1 — CINEMATIC OPEN ══ */}
      <section className="v8-scene v8-s1" data-scene id="v8-top" style={{ height: "150vh" }}>
        <div className="v8-pin v8-s1__pin">
          <div className="v8-s1__atmos" aria-hidden />
          <div className="v8-s1__copy">
            <p className="v8-kick v8-mono">Independent proof for AI-built software</p>
            <h1 className="v8-s1__h1">
              <span className="v8-mask"><span className="v8-mask__in">AI can build the software.</span></span>
              <span className="v8-mask"><span className="v8-mask__in v8-dim">It cannot prove itself.</span></span>
            </h1>
            <div className="v8-s1__cta">
              <Link href="/signin?callbackUrl=%2Fapp" className="v8-cta">Verify an application</Link>
              <span className="v8-s1__brand v8-mono">AI builds. Vraelis proves.</span>
            </div>
          </div>
          <div className="v8-s1__evidence" aria-hidden>
            <div className="v8-s1__ev-head"><span className="v8-mono v8-ok">Observed in a real browser</span><span className="v8-mono v8-s1__dep">8f21ad</span></div>
            <Rows rows={FAILED_ROWS} />
          </div>
          <div className="v8-scrollcue" aria-hidden><span className="v8-mono">Scroll</span><span className="v8-scrollcue__ln" /></div>
        </div>
      </section>

      {/* ══ SCENE 2 — THE FIXED REQUIREMENT ══ */}
      <section className="v8-scene v8-s2" data-scene style={{ height: "230vh" }}>
        <div className="v8-pin v8-s2__pin">
          <div className="v8-req">
            <div className="v8-req__lbl v8-mono">The business requires</div>
            <p className="v8-req__t">A paid customer receives Pro access and retains it after signing back in.</p>
            <div className="v8-req__hold v8-mono">held outside the code</div>
          </div>

          <div className="v8-s2__flow">
            <div className="v8-beat v8-rev" style={rev(0.06, 0.1)}>
              <span className="v8-beat__lbl v8-mono">The agent reported</span>
              <span className="v8-beat__say">Checkout complete</span>
              <span className="v8-beat__dep v8-mono">deployment 8f21ad</span>
            </div>
            <div className="v8-ev v8-rev" style={rev(0.2, 0.12)}>
              <div className="v8-ev__head"><span className="v8-mono v8-ok">Observed in a real browser</span><span className="v8-mono">8f21ad</span></div>
              <Rows rows={FAILED_ROWS} />
            </div>
            <div className="v8-split v8-rev" style={rev(0.42, 0.12)}>
              <span className="v8-split__x v8-mono">expected</span>
              <span className="v8-split__a">Pro access is retained after signing back in.</span>
              <span className="v8-split__o v8-mono">observed</span>
              <span className="v8-split__b">The account returned to Free.</span>
            </div>
            <div className="v8-caught v8-rev" style={rev(0.6, 0.08)}><span className="v8-caught__rule" />Vraelis caught the mismatch</div>
            <div className="v8-verdict v8-verdict--fail v8-rev" style={rev(0.68, 0.14)}>
              <span className="v8-verdict__word">Failed</span>
            </div>
          </div>
        </div>
      </section>

      {/* ══ SCENE 3 — REPAIR AND REVERIFICATION ══ */}
      <section className="v8-scene v8-s3" data-scene style={{ height: "230vh" }}>
        <div className="v8-pin v8-s3__pin">
          {/* the Failed record recedes into preserved history */}
          <div className="v8-s3__past">
            <span className="v8-verdict__word v8-verdict__word--fail">Failed</span>
            <span className="v8-s3__past-meta v8-mono">8f21ad<span className="v8-s3__past-st">preserved</span></span>
          </div>

          <div className="v8-s3__now">
            <div className="v8-beat v8-rev" style={rev(0.12, 0.1)}>
              <span className="v8-beat__lbl v8-mono">Repair, reverified</span>
              <span className="v8-beat__say">Access restored</span>
              <span className="v8-beat__dep v8-mono">deployment 72c98e</span>
            </div>
            <div className="v8-ev v8-rev" style={rev(0.24, 0.12)}>
              <div className="v8-ev__head"><span className="v8-mono v8-ok">Observed in a real browser</span><span className="v8-mono">72c98e</span></div>
              <Rows rows={VERIFIED_ROWS} changedKeys={["account.plan", "entitlement.pro"]} />
              <div className="v8-ev__note v8-mono">two facts changed, two held</div>
            </div>
            <div className="v8-verdict v8-verdict--ok v8-rev" style={rev(0.5, 0.16)}>
              <span className="v8-verdict__word">Verified</span>
            </div>
          </div>

          <div className="v8-lineage v8-rev" style={rev(0.74, 0.14)}>
            <span className="v8-lineage__lbl v8-mono">Vraelis production proof</span>
            <span className="v8-lineage__rec v8-lineage__rec--fail"><span className="v8-lineage__dot" />Failed <b className="v8-mono">8f21ad</b> <span className="v8-mono v8-lineage__st">preserved</span></span>
            <span className="v8-lineage__rec v8-lineage__rec--ok"><span className="v8-lineage__dot" />Verified <b className="v8-mono">72c98e</b> <span className="v8-mono v8-lineage__st">current</span></span>
          </div>
        </div>
      </section>

      {/* ══ SCENE 4 — FIELD OF PROOF (dark opens into warm white) ══ */}
      <section className="v8-scene v8-s4" data-scene style={{ height: "220vh" }}>
        <div className="v8-pin v8-s4__pin">
          <div className="v8-s4__wash" aria-hidden />
          <h2 className="v8-s4__statement">
            <span>The software changes.</span>
            <span className="v8-s4__hold">The requirement stays.</span>
          </h2>
          {/* real proof artifacts distributed across the viewport at different scales */}
          <div className="v8-art v8-art--req v8-rev" style={rev(0.1, 0.2)}><span className="v8-art__lbl v8-mono">requirement</span><p>A paid customer keeps Pro access after signing back in.</p></div>
          <div className="v8-art v8-art--plan v8-rev" style={rev(0.16, 0.2)}><span className="v8-art__lbl v8-mono">reviewed proof plan</span><ol><li>Buy Pro at checkout</li><li>Sign out, sign back in</li><li>Confirm Pro access is retained</li></ol></div>
          <div className="v8-art v8-art--appr v8-rev" style={rev(0.22, 0.2)}><span className="v8-art__lbl v8-mono">approved by</span><p className="v8-mono">a person, once<br />plan v1, locked</p></div>
          <div className="v8-art v8-art--dep v8-rev" style={rev(0.14, 0.2)}><span className="v8-art__lbl v8-mono">deployment</span><p className="v8-mono">production<br />72c98e</p></div>
          <div className="v8-art v8-art--ev v8-rev" style={rev(0.26, 0.2)}><span className="v8-art__lbl v8-mono">browser evidence</span><p className="v8-mono">account.plan <b className="v8-ok">Pro</b><br />entitlement.pro <b className="v8-ok">active</b></p></div>
          <div className="v8-art v8-art--fail v8-rev" style={rev(0.3, 0.2)}><span className="v8-verdict__word v8-verdict__word--fail v8-art__verd">Failed</span><span className="v8-art__lbl v8-mono">8f21ad, preserved</span></div>
          <div className="v8-art v8-art--ok v8-rev" style={rev(0.34, 0.2)}><span className="v8-verdict__word v8-verdict__word--ok v8-art__verd">Verified</span><span className="v8-art__lbl v8-mono">72c98e, current</span></div>
          <div className="v8-art v8-art--hist v8-rev" style={rev(0.2, 0.2)}><span className="v8-art__lbl v8-mono">every record kept</span><p>A later pass never overwrites an earlier one.</p></div>
        </div>
      </section>

      {/* ══ SCENE 5 — THE PRODUCT ASSEMBLES ══ */}
      <section className="v8-scene v8-s5" data-scene style={{ height: "220vh" }}>
        <div className="v8-pin v8-s5__pin">
          <div className="v8-guar">
            <div className="v8-guar__head">
              <span className="v8-guar__lbl v8-mono">Standing guarantee, production application</span>
              <span className="v8-guar__status v8-rev" style={rev(0.62, 0.1)}><span className="v8-guar__dot" />Verified</span>
            </div>
            <p className="v8-guar__req">A paid customer receives Pro access and retains it after signing back in.</p>

            <div className="v8-guar__grid">
              <div className="v8-guar__cell v8-rev" style={rev(0.12, 0.12)}>
                <span className="v8-guar__k v8-mono">Proof obligations</span>
                <ul><li>Payment completes at checkout</li><li>Pro applies to the account</li><li>Access survives a fresh sign-in</li></ul>
              </div>
              <div className="v8-guar__cell v8-rev" style={rev(0.22, 0.12)}>
                <span className="v8-guar__k v8-mono">Reviewed plan, approved once</span>
                <p>The exact plan a person approved. The building agent cannot change it.</p>
              </div>
              <div className="v8-guar__cell v8-rev" style={rev(0.32, 0.12)}>
                <span className="v8-guar__k v8-mono">Verification records</span>
                <div className="v8-guar__recs">
                  <span className="v8-lineage__rec v8-lineage__rec--fail"><span className="v8-lineage__dot" />Failed <b className="v8-mono">8f21ad</b></span>
                  <span className="v8-lineage__rec v8-lineage__rec--ok"><span className="v8-lineage__dot" />Verified <b className="v8-mono">72c98e</b></span>
                </div>
              </div>
              <div className="v8-guar__cell v8-guar__cell--next v8-rev" style={rev(0.42, 0.12)}>
                <span className="v8-guar__k v8-mono v8-guar__k--next">Next</span>
                <ul><li>Reverify on every new deployment</li><li>Agent-facing release decisions</li></ul>
              </div>
            </div>
          </div>

          <div className="v8-close v8-rev" style={rev(0.7, 0.16)}>
            <h2 className="v8-close__h">State what must stay true.<br />Approve the proof once.<br />Vraelis keeps every result.</h2>
            <Link href="/signin?callbackUrl=%2Fapp" className="v8-cta v8-cta--lg">Verify an application</Link>
          </div>
        </div>
      </section>

      <ScrollStoryStyles />
    </div>
  );
}

function ScrollStoryStyles() {
  return (
    <style>{`
      .v8 {
        --v8-bg: #0B0E15; --v8-fg: #ECEFF4; --v8-fg2: #AEB6C4; --v8-fg3: #8791A3;
        --v8-line: rgba(255,255,255,0.10); --v8-line2: rgba(255,255,255,0.16);
        --v8-fail: #F0714F; --v8-fail-soft: rgba(240,113,79,0.13); --v8-fail-line: rgba(240,113,79,0.34);
        --v8-ok: #35D6A0; --v8-ok-soft: rgba(53,214,160,0.12); --v8-ok-line: rgba(53,214,160,0.32);
        --v8-mono: var(--font-geist-mono), ui-monospace, "SF Mono", Menlo, Consolas, monospace;
        --paper: #FAF8F4; --ink: #1B1A16; --ink2: #35322B; --ink3: #565249; --ink-line: rgba(28,27,24,0.13);
        background: var(--v8-bg); color: var(--v8-fg);
      }
      .v8-mono { font-family: var(--v8-mono); letter-spacing: 0; }
      .v8-ok { color: var(--v8-ok); }
      .v8-dim { color: var(--v8-fg2); }
      .v8-scene { position: relative; }
      .v8-pin { position: sticky; top: 0; height: 100svh; overflow: hidden; display: grid; }

      /* reveal primitive scrubbed by scene progress --p */
      .v8-rev {
        --o: clamp(0, calc((var(--p, 0) - var(--s, 0)) * var(--ir, 1)), 1);
        opacity: var(--o);
        transform: translateY(calc((1 - var(--o)) * 20px));
      }

      /* nav */
      .v8-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 60; display: flex; align-items: center; height: 60px; padding: 0 clamp(20px,4vw,56px); }
      .v8-nav__brand { font-family: var(--font-display); font-weight: 600; font-size: 18px; letter-spacing: -0.02em; color: var(--v8-fg); text-decoration: none; transition: color .3s var(--ease); }
      .v8-nav__right { margin-left: auto; display: flex; align-items: center; gap: 16px; }
      .v8-nav__signin { font-size: 14px; color: var(--v8-fg2); text-decoration: none; transition: color .3s var(--ease); }
      /* nav flips to ink on the light scenes */
      .v8[data-navtheme="light"] .v8-nav__brand { color: var(--ink); }
      .v8[data-navtheme="light"] .v8-nav__signin { color: var(--ink3); }
      .v8[data-navtheme="light"] .v8-cta { background: var(--ink); color: #fff; border-color: var(--ink); }
      .v8[data-navtheme="light"] .v8-cta:hover { background: #000; }
      .v8-cta { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; box-sizing: border-box; background: var(--v8-fg); color: #0B0E15; font-family: var(--font-display); font-weight: 600; font-size: 15px; padding: 11px 22px; border-radius: 5px; text-decoration: none; border: 1px solid var(--v8-fg); white-space: nowrap; transition: transform var(--dur-fast) var(--ease-out), background .2s var(--ease); }
      .v8-cta:hover { background: #fff; } .v8-cta:active { transform: scale(0.98); }
      .v8-cta:focus-visible { outline: 2px solid var(--v8-ok); outline-offset: 3px; }
      .v8-cta--sm { min-height: 36px; padding: 8px 15px; font-size: 13.5px; }
      .v8-cta--lg { min-height: 50px; padding: 15px 30px; font-size: 16px; }
      .v8-kick { font-size: 12.5px; letter-spacing: 0.05em; color: var(--v8-ok); }

      /* ── SCENE 1 ── */
      .v8-s1__pin { display: block; background: radial-gradient(120% 90% at 80% 4%, rgba(53,214,160,0.06), transparent 55%), var(--v8-bg); }
      /* atmospheric depth, not a grid: a soft pool of light where the evidence card sits, deepening to a
         vignette at the edges, receding as the scene scrolls away */
      .v8-s1__atmos { position: absolute; inset: 0; pointer-events: none; opacity: calc(1 - var(--p,0) * 0.45);
        background:
          radial-gradient(58% 42% at 50% 90%, rgba(120,146,182,0.12), transparent 72%),
          radial-gradient(120% 90% at 50% -8%, transparent 58%, rgba(5,7,11,0.72)); }
      /* the evidence field: starts small/quiet behind the headline, enlarges as you scroll */
      /* the evidence is a quiet field behind the headline at rest, and enlarges to become the focus as the
         headline masks away on scroll */
      .v8-s1__evidence { position: absolute; left: 50%; bottom: 10vh; z-index: 2; width: min(600px, 86vw); border: 1px solid var(--v8-line); border-radius: 10px; background: rgba(255,255,255,0.03); overflow: hidden; transform: translate(-50%, calc(var(--p,0) * -22vh)) scale(calc(1 + var(--p,0) * 0.5)); opacity: calc(0.72 + var(--p,0) * 0.28); transform-origin: center bottom; box-shadow: 0 40px 120px -40px #000; }
      .v8-s1__ev-head { display: flex; justify-content: space-between; padding: 11px 16px; border-bottom: 1px solid var(--v8-line); font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; }
      .v8-s1__dep { color: var(--v8-fg2); }
      .v8-s1__copy { position: absolute; top: 14%; left: 50%; z-index: 3; text-align: center; width: min(1000px, 92vw); padding: 0 20px; transform: translate(-50%, calc(var(--p,0) * -14vh)); }
      .v8-s1__copy .v8-kick { display: block; margin-bottom: 22px; opacity: calc(1 - var(--p,0) * 2); }
      .v8-s1__h1 { font-family: var(--font-display); font-weight: 600; letter-spacing: -0.035em; line-height: 0.98; margin: 0; font-size: clamp(2.6rem, 7vw, 6.2rem); color: var(--v8-fg); text-shadow: 0 2px 40px rgba(11,14,21,0.9); }
      .v8-mask { display: block; overflow: hidden; padding-bottom: 0.08em; margin-bottom: -0.04em; }
      .v8-mask__in { display: block; transform: translateY(calc(var(--p,0) * -140%)); }
      .v8-s1__h1 .v8-mask:nth-child(2) .v8-mask__in { transform: translateY(calc(var(--p,0) * -170%)); }
      .v8-s1__cta { margin-top: clamp(26px,4vh,40px); display: flex; flex-direction: column; align-items: center; gap: 16px; opacity: calc(1 - var(--p,0) * 2.4); }
      .v8-s1__brand { font-size: 13.5px; color: var(--v8-fg3); }
      .v8-scrollcue { position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column-reverse; align-items: center; gap: 7px; opacity: calc(1 - var(--p,0) * 3); }
      .v8-scrollcue span { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--v8-fg3); }
      .v8-scrollcue__ln { width: 1px; height: 20px; background: linear-gradient(transparent, var(--v8-fg3)); }

      /* shared evidence readout */
      .v8-rows { display: flex; flex-direction: column; }
      .v8-row { display: grid; grid-template-columns: minmax(0,1fr) auto 20px; align-items: center; gap: 12px; padding: 9px 16px; border-top: 1px solid var(--v8-line); }
      .v8-row:first-child { border-top: none; }
      .v8-row__k { font-size: 12.5px; color: var(--v8-fg2); }
      .v8-row__v { font-size: 12.5px; font-weight: 600; text-align: right; }
      .v8-row.is-ok .v8-row__v { color: var(--v8-fg); }
      .v8-row.is-bad .v8-row__v { color: var(--v8-fail); }
      .v8-row.is-bad { background: var(--v8-fail-soft); }
      .v8-row.is-changed { box-shadow: inset 2px 0 0 var(--v8-ok-line); }
      .v8-row__mk { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 999px; }
      .v8-row.is-ok .v8-row__mk { background: var(--v8-ok-soft); color: var(--v8-ok); border: 1px solid var(--v8-ok-line); }
      .v8-row.is-bad .v8-row__mk { background: var(--v8-fail-soft); color: var(--v8-fail); border: 1px solid var(--v8-fail-line); }

      /* verdict word (shared) */
      .v8-verdict__word { font-family: var(--font-display); font-weight: 600; letter-spacing: -0.045em; line-height: 0.82; }
      .v8-verdict--fail .v8-verdict__word, .v8-verdict__word--fail { color: var(--v8-fail); }
      .v8-verdict--ok .v8-verdict__word, .v8-verdict__word--ok { color: var(--v8-ok); }

      /* ── SCENE 2 ── */
      .v8-s2__pin { grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.2fr); align-items: center; gap: clamp(30px,5vw,80px); padding: 0 clamp(20px,5vw,72px); max-width: 1500px; margin: 0 auto; }
      .v8-req { align-self: center; }
      .v8-req__lbl { font-size: 11px; letter-spacing: 0.13em; text-transform: uppercase; color: var(--v8-fg3); margin-bottom: 12px; }
      .v8-req__t { font-family: var(--font-display); font-weight: 500; color: var(--v8-fg); font-size: clamp(1.6rem,2.7vw,2.6rem); line-height: 1.14; letter-spacing: -0.02em; margin: 0 0 20px; max-width: 20ch; }
      .v8-req__hold { display: inline-block; font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--v8-ok); border: 1px solid var(--v8-ok-line); border-radius: 2px; padding: 4px 9px; }
      .v8-s2__flow { position: relative; display: flex; flex-direction: column; gap: clamp(14px,2vh,22px); }
      .v8-beat { display: flex; align-items: baseline; gap: 10px 16px; flex-wrap: wrap; }
      .v8-beat__lbl { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--v8-fg3); }
      .v8-beat__say { font-family: var(--font-display); font-weight: 500; font-size: clamp(1.1rem,1.6vw,1.45rem); }
      .v8-beat__dep { font-size: 12px; color: var(--v8-fg2); }
      .v8-ev { border: 1px solid var(--v8-line); border-radius: 8px; background: rgba(255,255,255,0.02); overflow: hidden; }
      .v8-ev__head { display: flex; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid var(--v8-line); font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--v8-fg2); }
      .v8-ev__note { padding: 9px 16px; border-top: 1px solid var(--v8-line); font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--v8-fg3); }
      .v8-split { display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; align-items: baseline; }
      .v8-split__x, .v8-split__o { font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; }
      .v8-split__x { color: var(--v8-fg3); } .v8-split__o { color: var(--v8-fail); }
      .v8-split__a { color: var(--v8-fg2); font-size: 15px; } .v8-split__b { color: var(--v8-fg); font-size: 15px; }
      .v8-caught { display: flex; align-items: center; gap: 10px; font-family: var(--v8-mono); font-size: 13px; font-weight: 600; letter-spacing: 0.09em; text-transform: uppercase; color: var(--v8-ok); }
      .v8-caught__rule { width: 22px; height: 2px; background: var(--v8-ok); border-radius: 2px; }
      .v8-s2__flow .v8-verdict--fail .v8-verdict__word { font-size: clamp(3.4rem, 8vw, 6.5rem); }

      /* ── SCENE 3 ── */
      .v8-s3__pin { place-items: center; padding: 0 clamp(20px,5vw,72px); }
      .v8-s3__past { position: absolute; top: 12vh; left: clamp(20px,5vw,72px); display: flex; align-items: baseline; gap: 14px; transform: translateY(calc(var(--p,0) * -4vh)) scale(calc(1 - var(--p,0) * 0.12)); opacity: calc(0.34 + var(--p,0) * 0.14); transform-origin: left top; }
      .v8-s3__past .v8-verdict__word { font-size: clamp(2rem, 4vw, 3.2rem); }
      .v8-s3__past-meta { font-size: 12px; color: var(--v8-fg3); display: inline-flex; gap: 8px; }
      .v8-s3__past-st { color: var(--v8-fg3); text-transform: uppercase; letter-spacing: 0.08em; }
      .v8-s3__now { width: min(620px, 92vw); display: flex; flex-direction: column; gap: clamp(16px,2.4vh,26px); }
      .v8-s3__now .v8-verdict--ok .v8-verdict__word { font-size: clamp(3.6rem, 8.5vw, 7rem); }
      .v8-lineage { position: absolute; bottom: 8vh; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 14px 26px; flex-wrap: wrap; justify-content: center; padding-top: 15px; border-top: 1px solid var(--v8-line); width: min(760px, 92vw); }
      .v8-lineage__lbl { font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--v8-fg3); margin-right: auto; }
      .v8-lineage__rec { display: inline-flex; align-items: baseline; gap: 9px; font-family: var(--font-display); font-weight: 600; font-size: 14px; }
      .v8-lineage__rec--fail { color: var(--v8-fail); } .v8-lineage__rec--ok { color: var(--v8-ok); }
      .v8-lineage__dot { width: 7px; height: 7px; border-radius: 999px; background: currentColor; align-self: center; }
      .v8-lineage__st { font-size: 10px; font-weight: 400; letter-spacing: 0.08em; text-transform: uppercase; color: var(--v8-fg3); }

      /* ── SCENE 4 — dark opens into warm white ── */
      .v8-s4__pin { place-items: center; background: var(--paper); color: var(--ink); }
      .v8-s4__wash { position: absolute; inset: 0; background: var(--v8-bg); opacity: calc(1 - clamp(0, calc(var(--p,0) * 3.2), 1)); }
      .v8-s4__statement { position: relative; z-index: 2; text-align: center; font-family: var(--font-display); font-weight: 600; letter-spacing: -0.03em; line-height: 1.04; font-size: clamp(2rem, 4.6vw, 3.8rem); margin: 0; color: var(--ink); }
      .v8-s4__statement span { display: block; }
      .v8-s4__hold { color: var(--v8-ok); }
      /* start washed-in white only after the field opens */
      .v8-s4__statement, .v8-s4 .v8-art { opacity: calc(clamp(0, calc((var(--p,0) - 0.06) * 3), 1)); }
      .v8-art { position: absolute; z-index: 1; padding: 14px 16px; border: 1px solid var(--ink-line); border-radius: 8px; background: #fff; box-shadow: var(--shadow-md); max-width: 260px; }
      .v8-art__lbl { display: block; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--fg-4); margin-bottom: 7px; }
      .v8-art p, .v8-art li { font-size: 13px; line-height: 1.45; color: var(--ink2); margin: 0; }
      .v8-art ol, .v8-art ul { margin: 0; padding-left: 16px; display: flex; flex-direction: column; gap: 3px; }
      .v8-art .v8-ok { color: var(--acc-deep); }
      .v8-art__verd { display: block; font-size: clamp(1.6rem,3vw,2.4rem); line-height: 0.9; margin-bottom: 4px; }
      .v8-art--fail .v8-verdict__word--fail { color: #A8452A; } .v8-art--ok .v8-verdict__word--ok { color: var(--acc-deep); }
      /* distribute the artifacts; each slides in from beyond the viewport toward its resting spot as --p grows */
      .v8-art--req  { top: 12%;  left: 6%;   transform: translate(calc((1 - var(--p,0)) * -40px), 0); }
      .v8-art--plan { top: 8%;   right: 7%;  transform: translate(calc((1 - var(--p,0)) * 46px), 0); max-width: 240px; }
      .v8-art--appr { bottom: 14%; left: 9%; transform: translate(0, calc((1 - var(--p,0)) * 40px)); max-width: 180px; }
      .v8-art--dep  { top: 30%;  right: 5%;  transform: translate(calc((1 - var(--p,0)) * 50px), 0); max-width: 190px; }
      .v8-art--ev   { bottom: 12%; right: 8%; transform: translate(calc((1 - var(--p,0)) * 44px), 0); max-width: 210px; }
      .v8-art--fail { top: 20%;  left: 14%;  transform: translate(0, calc((1 - var(--p,0)) * -34px)); border: none; box-shadow: none; background: transparent; }
      .v8-art--ok   { bottom: 24%; right: 20%; transform: translate(0, calc((1 - var(--p,0)) * 34px)); border: none; box-shadow: none; background: transparent; }
      .v8-art--hist { bottom: 9%; left: 34%;  transform: translate(0, calc((1 - var(--p,0)) * 40px)); max-width: 230px; }

      /* ── SCENE 5 — product assembles (light) ── */
      .v8-s5__pin { place-items: center; background: var(--paper); color: var(--ink); padding: 0 clamp(20px,5vw,64px); }
      .v8-guar { width: min(1080px, 94vw); border: 1px solid var(--ink-line); border-radius: 16px; background: #fff; box-shadow: var(--shadow-lg); overflow: hidden; transform: scale(calc(0.94 + clamp(0, calc(var(--p,0)*4),1) * 0.06)); }
      .v8-guar__head { display: flex; align-items: center; justify-content: space-between; padding: 16px clamp(20px,2.4vw,30px); border-bottom: 1px solid var(--ink-line); background: var(--bg-2); }
      .v8-guar__lbl { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-4); }
      .v8-guar__status { display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-display); font-weight: 600; font-size: 15px; color: var(--acc-deep); }
      .v8-guar__dot { width: 9px; height: 9px; border-radius: 999px; background: var(--acc-deep); }
      .v8-guar__req { font-family: var(--font-display); font-weight: 600; letter-spacing: -0.02em; font-size: clamp(1.35rem,2.2vw,2rem); line-height: 1.16; color: var(--ink); margin: 0; padding: clamp(22px,2.6vw,32px) clamp(20px,2.4vw,30px) clamp(16px,2vw,22px); max-width: 30ch; }
      .v8-guar__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--ink-line); border-top: 1px solid var(--ink-line); }
      .v8-guar__cell { background: #fff; padding: clamp(18px,2.2vw,26px); }
      .v8-guar__k { display: block; font-size: 11px; letter-spacing: 0.07em; text-transform: uppercase; color: var(--acc-deep); margin-bottom: 12px; }
      .v8-guar__k--next { color: var(--fg-4); }
      .v8-guar__cell ul { margin: 0; padding-left: 16px; display: flex; flex-direction: column; gap: 6px; }
      .v8-guar__cell li, .v8-guar__cell p { font-size: 14px; line-height: 1.5; color: var(--ink3); margin: 0; }
      .v8-guar__cell--next { background: var(--bg-2); }
      .v8-guar__recs { display: flex; flex-direction: column; gap: 9px; }
      .v8-guar__recs .v8-lineage__rec--fail { color: #A8452A; } .v8-guar__recs .v8-lineage__rec--ok { color: var(--acc-deep); }
      .v8-guar__recs .v8-lineage__rec b { font-size: 13px; }
      .v8-close { position: absolute; bottom: 6vh; left: 50%; transform: translateX(-50%); text-align: center; width: min(760px, 92vw); }
      .v8-close__h { font-family: var(--font-display); font-weight: 600; letter-spacing: -0.02em; line-height: 1.1; font-size: clamp(1.4rem,2.6vw,2.2rem); color: var(--ink); margin: 0 0 22px; }

      /* ── RESPONSIVE: recompose the story for mobile (vertical, stacked, no perspective) ── */
      @media (max-width: 900px) {
        .v8-pin { height: auto; min-height: 100svh; }
        .v8-scene { height: auto !important; }
        .v8-s1__pin { min-height: 100svh; display: flex; flex-direction: column; justify-content: center; gap: 28px; padding: 92px clamp(18px,5vw,28px) 44px; }
        .v8-s1__copy { position: static; transform: none; left: auto; width: 100%; text-align: left; }
        .v8-s1__evidence { position: static; transform: none !important; left: auto; bottom: auto; width: 100%; opacity: 1 !important; }
        .v8-s1__atmos { opacity: 0.85; }
        .v8-mask__in { transform: none !important; }
        .v8-s1__copy .v8-kick, .v8-s1__cta { opacity: 1 !important; }
        .v8-s1__cta { align-items: flex-start; }
        .v8-scrollcue { display: none; }
        .v8-s2__pin { grid-template-columns: 1fr; gap: 24px; padding: 100px clamp(18px,5vw,28px) 60px; align-content: start; }
        .v8-req { position: sticky; top: 60px; z-index: 4; background: var(--v8-bg); padding: 12px 0; }
        .v8-s2__flow .v8-rev, .v8-s3 .v8-rev, .v8-s4 .v8-art, .v8-s5 .v8-rev { opacity: 1 !important; transform: none !important; }
        .v8-s3__pin { min-height: auto; padding: 90px clamp(18px,5vw,28px) 60px; }
        .v8-s3__past { position: relative; top: auto; left: auto; transform: none; opacity: 0.6; margin-bottom: 20px; }
        .v8-s3__now { width: 100%; }
        .v8-lineage { position: relative; bottom: auto; left: auto; transform: none; width: 100%; margin-top: 26px; flex-direction: column; align-items: flex-start; }
        .v8-lineage__lbl { margin-right: 0; }
        .v8-s4__pin { min-height: auto; padding: 80px clamp(18px,5vw,28px) 60px; display: block; }
        .v8-s4__wash { display: none; }
        .v8-s4__statement { position: relative; margin-bottom: 32px; text-align: left; }
        .v8-art { position: relative; inset: auto; max-width: none !important; margin-bottom: 14px; transform: none !important; }
        .v8-art--fail, .v8-art--ok { display: inline-block; margin-right: 20px; }
        .v8-s5__pin { min-height: auto; padding: 80px clamp(18px,5vw,28px) 70px; display: block; }
        .v8-guar { width: 100%; transform: none; }
        .v8-guar__grid { grid-template-columns: 1fr; }
        .v8-close { position: relative; bottom: auto; left: auto; transform: none; width: 100%; margin-top: 40px; text-align: left; }
      }
      @media (max-width: 480px) { .v8-nav__signin { display: none; } }

      /* ── REDUCED MOTION: unpin everything, resolve all content, nothing hidden ── */
      .v8[data-reduced="on"] .v8-pin { position: static; height: auto; min-height: 0; overflow: visible; display: block; padding: 90px clamp(20px,5vw,56px) 70px; }
      .v8[data-reduced="on"] .v8-scene { height: auto !important; }
      .v8[data-reduced="on"] .v8-rev, .v8[data-reduced="on"] .v8-art, .v8[data-reduced="on"] .v8-mask__in,
      .v8[data-reduced="on"] .v8-s1__copy .v8-kick, .v8[data-reduced="on"] .v8-s1__cta, .v8[data-reduced="on"] .v8-s1__evidence { opacity: 1 !important; transform: none !important; }
      .v8[data-reduced="on"] .v8-s4__wash { display: none; }
      .v8[data-reduced="on"] .v8-art, .v8[data-reduced="on"] .v8-s3__past, .v8[data-reduced="on"] .v8-lineage, .v8[data-reduced="on"] .v8-close,
      .v8[data-reduced="on"] .v8-s1__copy, .v8[data-reduced="on"] .v8-s1__evidence { position: relative; inset: auto; top: auto; left: auto; bottom: auto; transform: none !important; }
      .v8[data-reduced="on"] .v8-art { display: block; max-width: none; margin-bottom: 14px; }
      .v8[data-reduced="on"] .v8-s2__pin, .v8[data-reduced="on"] .v8-s5__pin { display: block; }
      /* scene 1 resolves to a centered static column (its copy and evidence are absolute at rest) */
      .v8[data-reduced="on"] .v8-s1__pin { display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 30px; }
      .v8[data-reduced="on"] .v8-s1__evidence { width: min(600px, 100%); }
      .v8[data-reduced="on"] .v8-scrollcue { display: none; }
      @media (prefers-reduced-motion: reduce) {
        .v8-mask__in, .v8-s1__evidence, .v8-rev, .v8-art, .v8-s3__past, .v8-s4__wash { transition: none !important; }
      }
    `}</style>
  );
}
