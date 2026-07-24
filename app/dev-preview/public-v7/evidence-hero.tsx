"use client";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// PUBLIC-V7 — EVIDENCE IS THE HERO. (closure revision)
//
// The first viewport is the production proof itself: one near-black evidence environment. The business
// requirement is held on the right; the real observed browser state is shown as an editorial machine-readable
// readout (a deterministic reconstruction of the exact production facts, not fake chrome); a full-scale FAILED
// is the conclusion, now explicitly owned ("Vraelis caught the mismatch") so a fast visitor cannot misread it
// as Vraelis failing; the preserved Failed / Verified lineage sits on the bottom edge.
//
// On scroll the field pins and the software is REPAIRED as a factual, per-row mutation: the unchanged facts
// stay steady while account.plan flips Free -> Pro and entitlement.pro flips inactive -> active, the deployment
// changes 8f21ad -> 72c98e, and the verdict resolves to VERIFIED. The requirement never changes; the Failed
// record stays preserved.
//
// DESKTOP + normal motion: a single live readout mutates in place. MOBILE or reduced motion: both factual
// states are shown stacked (the failed deployment and the repaired one), so the complete lineage is visible
// without depending on any transition. Native only (CSS sticky + a passive rAF scroll listener). Real
// production lineage, no fabricated customer, no "Illustrative". "·" separators are rendered as layout.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Ic, I } from "@/app/rank/_components/icons";

// The live readout rows. `changed` rows mutate on repair; the others stay steady. `d` is the flip stagger.
const LIVE_ROWS = [
  { k: "checkout.payment", f: "completed", v: "completed", changed: false, d: 0 },
  { k: "account.plan", f: "Free", v: "Pro", changed: true, d: 0 },
  { k: "entitlement.pro", f: "inactive", v: "active", changed: true, d: 80 },
  { k: "session", f: "restored", v: "restored", changed: false, d: 0 },
];
const FAILED_ROWS = [
  { k: "checkout.payment", v: "completed", ok: true },
  { k: "account.plan", v: "Free", ok: false },
  { k: "entitlement.pro", v: "inactive", ok: false },
  { k: "session", v: "restored", ok: true },
];
const VERIFIED_ROWS = [
  { k: "checkout.payment", v: "completed", ok: true },
  { k: "account.plan", v: "Pro", ok: true },
  { k: "entitlement.pro", v: "active", ok: true },
  { k: "session", v: "restored", ok: true },
];

function StaticReadout({ deploy, rows }: { deploy: string; rows: { k: string; v: string; ok: boolean }[] }) {
  return (
    <div className="v7-readout">
      <div className="v7-readout__head">
        <span className="v7-readout__lbl">Observed in a real browser</span>
        <span className="v7-readout__dep v7-mono">{deploy}</span>
      </div>
      <div className="v7-readout__rows">
        {rows.map((row) => (
          <div key={row.k} className="v7-row">
            <span className="v7-row__k v7-mono">{row.k}</span>
            <span className={`v7-vg ${row.ok ? "v7-vg--ok" : "v7-vg--bad"}`}>
              <span className="v7-row__v v7-mono">{row.v}</span>
              <span className="v7-row__mk" aria-hidden><Ic d={row.ok ? I.check : I.x} size={13} sw={2.7} /></span>
            </span>
            <span className="sr-only">{row.ok ? "passed" : "failed"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EvidenceHero() {
  const heroRef = useRef<HTMLElement>(null);
  const histRef = useRef<HTMLDivElement>(null);
  const [lit, setLit] = useState(false);
  const [state, setState] = useState<"failed" | "verified">("failed");

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setLit(true), reduce ? 0 : 90);
    const hero = heroRef.current;
    let raf = 0;
    const onScroll = () => {
      if (raf || !hero) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const rect = hero.getBoundingClientRect();
        const pinRange = hero.offsetHeight - window.innerHeight;
        const p = pinRange > 0 ? Math.min(1, Math.max(0, -rect.top / pinRange)) : 0;
        // hysteresis: flip to verified past 0.55, back to failed below 0.45, so parking at the threshold
        // never thrashes the mutation
        setState((prev) => (prev === "failed" ? (p > 0.55 ? "verified" : "failed") : (p < 0.45 ? "failed" : "verified")));
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => { clearTimeout(t); window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  // See production proof: advance through the pinned sequence to the resolved lineage (never skip to the
  // light product grid). Focus lands on the preserved-lineage summary so keyboard users arrive meaningfully.
  const seeProof = (e: React.MouseEvent) => {
    e.preventDefault();
    const hero = heroRef.current;
    if (!hero) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const pinRange = hero.offsetHeight - window.innerHeight;
    if (pinRange > 0) {
      window.scrollTo({ top: hero.offsetTop + pinRange * 0.82, behavior: reduce ? "auto" : "smooth" });
    } else {
      (hero.querySelector(".v7-ev--failed") ?? hero).scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
    histRef.current?.focus({ preventScroll: true });
  };

  return (
    <section className="v7-hero" ref={heroRef} data-state={state} data-lit={lit ? "on" : "off"} id="top">
      <div className="v7-stage">
        <nav className="v7-nav" aria-label="Primary">
          <Link href="#top" className="v7-nav__brand">Vraelis</Link>
          <div className="v7-nav__links">
            <a href="#product" className="v7-nav__link">Product</a>
            <a href="#product" className="v7-nav__link">Research</a>
            <a href="#product" className="v7-nav__link">Developers</a>
            <a href="#top" className="v7-nav__link">Company</a>
          </div>
          <div className="v7-nav__right">
            <Link href="/signin?callbackUrl=%2Fapp" className="v7-nav__signin">Sign in</Link>
            <Link href="/signin?callbackUrl=%2Fapp" className="v7-cta v7-cta--sm">Verify an application</Link>
          </div>
        </nav>

        <div className="v7-thesis">
          <div className="v7-kick r" data-r="1">Independent proof for AI-built software</div>
          <h1 className="v7-h1">
            <span className="v7-h1__mask" data-r="2"><span className="v7-h1__in">AI can build the software.</span></span>
            <span className="v7-h1__mask" data-r="3"><span className="v7-h1__in v7-h1__in--em">It cannot prove itself.</span></span>
          </h1>
          <p className="v7-lead r" data-r="5">Vraelis keeps the requirements your company depends on outside the code, then independently proves the live software against them.</p>
          <div className="v7-cta-row r" data-r="6">
            <Link href="/signin?callbackUrl=%2Fapp" className="v7-cta">Verify an application</Link>
            <a href="#top" onClick={seeProof} className="v7-textlink">See production proof <span aria-hidden>&darr;</span></a>
          </div>
          <div className="v7-brand r" data-r="7">AI builds. Vraelis proves.</div>
        </div>

        <div className="v7-right">
          <div className="v7-req r" data-r="2">
            <div className="v7-req__lbl">The business requires</div>
            <p className="v7-req__t">A paid customer receives Pro access and retains it after signing back in.</p>
          </div>

          <div className="v7-evstack">
            {/* LIVE (desktop + normal motion): one readout that mutates in place */}
            <div className="v7-ev v7-ev--live">
              <div className="v7-claim r" data-r="3">
                <span className="v7-claim__swap" key={state}>
                  {state === "failed" ? (
                    <><span className="v7-claim__lbl">The agent reported</span><span className="v7-claim__say">Checkout complete</span></>
                  ) : (
                    <><span className="v7-claim__lbl">Repair, reverified</span><span className="v7-claim__say">Access restored</span></>
                  )}
                  <span className="v7-claim__dep"><span className="v7-dep-k">deployment</span> <span className="v7-mono">{state === "failed" ? "8f21ad" : "72c98e"}</span></span>
                </span>
              </div>

              <div className="r" data-r="4">
                <div className="v7-readout">
                  <div className="v7-readout__head">
                    <span className="v7-readout__lbl">Observed in a real browser</span>
                    <span className="v7-readout__dep v7-mono"><span className="v7-claim__swap" key={"d" + state}>{state === "failed" ? "8f21ad" : "72c98e"}</span></span>
                  </div>
                  <div className="v7-readout__rows">
                    {LIVE_ROWS.map((row) => row.changed ? (
                      <div key={row.k} className="v7-row v7-row--flip" style={{ "--fd": row.d + "ms" } as React.CSSProperties}>
                        <span className="v7-row__k v7-mono">{row.k}</span>
                        <span className="v7-flip"><span className="v7-flip__inner">
                          <span className="v7-vg v7-vg--bad"><span className="v7-row__v v7-mono">{row.f}</span><span className="v7-row__mk" aria-hidden><Ic d={I.x} size={13} sw={2.7} /></span></span>
                          <span className="v7-vg v7-vg--ok"><span className="v7-row__v v7-mono">{row.v}</span><span className="v7-row__mk" aria-hidden><Ic d={I.check} size={13} sw={2.7} /></span></span>
                        </span></span>
                        <span className="sr-only">{state === "failed" ? "failed" : "passed"}</span>
                      </div>
                    ) : (
                      <div key={row.k} className="v7-row">
                        <span className="v7-row__k v7-mono">{row.k}</span>
                        <span className="v7-vg v7-vg--ok"><span className="v7-row__v v7-mono">{row.f}</span><span className="v7-row__mk" aria-hidden><Ic d={I.check} size={13} sw={2.7} /></span></span>
                        <span className="sr-only">passed</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="v7-verdict r" data-r="5" data-tone={state}>
                <div className="v7-verdict__block" key={state}>
                  <div className="v7-verdict__own">{state === "failed" ? "Vraelis caught the mismatch" : ""}</div>
                  <div className="v7-verdict__main">
                    <div className="v7-verdict__word">{state === "failed" ? "Failed" : "Verified"}</div>
                    <p className="v7-verdict__say">{state === "failed"
                      ? "Expected and observed behavior diverged. The failure, its evidence, and a repair prompt go back to the agent."
                      : "The live software met the requirement, across a fresh sign-in."}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* STATIC PAIR (mobile OR reduced motion): both factual states, stacked */}
            <div className="v7-ev v7-ev--failed">
              <div className="v7-claim">
                <span className="v7-claim__lbl">The agent reported</span>
                <span className="v7-claim__say">Checkout complete</span>
                <span className="v7-claim__dep"><span className="v7-dep-k">deployment</span> <span className="v7-mono">8f21ad</span></span>
              </div>
              <StaticReadout deploy="8f21ad" rows={FAILED_ROWS} />
              <div className="v7-verdict" data-tone="failed">
                <div className="v7-verdict__block">
                  <div className="v7-verdict__own">Vraelis caught the mismatch</div>
                  <div className="v7-verdict__main">
                    <div className="v7-verdict__word">Failed</div>
                    <p className="v7-verdict__say">Expected and observed behavior diverged. The failure, its evidence, and a repair prompt go back to the agent.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="v7-ev v7-ev--verified">
              <div className="v7-claim">
                <span className="v7-claim__lbl">Repair, reverified</span>
                <span className="v7-claim__say">Access restored</span>
                <span className="v7-claim__dep"><span className="v7-dep-k">deployment</span> <span className="v7-mono">72c98e</span></span>
              </div>
              <StaticReadout deploy="72c98e" rows={VERIFIED_ROWS} />
              <div className="v7-verdict" data-tone="verified">
                <div className="v7-verdict__block">
                  <div className="v7-verdict__main">
                    <div className="v7-verdict__word">Verified</div>
                    <p className="v7-verdict__say">The live software met the requirement, across a fresh sign-in.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="v7-hist r" data-r="6" ref={histRef} tabIndex={-1} aria-label="Vraelis production proof: Failed on 8f21ad, preserved; Verified on 72c98e, current">
          <span className="v7-hist__lbl">Vraelis production proof</span>
          <div className="v7-hist__rec v7-hist__rec--fail">
            <span className="v7-hist__dot" /><span className="v7-hist__v">Failed</span><span className="v7-mono v7-hist__id">8f21ad</span><span className="v7-hist__st">preserved</span>
          </div>
          <div className="v7-hist__rec v7-hist__rec--ok">
            <span className="v7-hist__dot" /><span className="v7-hist__v">Verified</span><span className="v7-mono v7-hist__id">72c98e</span><span className="v7-hist__st v7-hist__st--now">current</span>
          </div>
        </div>
      </div>

      <div className="v7-scrollroom" aria-hidden />
      <EvidenceHeroStyles />
    </section>
  );
}

function EvidenceHeroStyles() {
  return (
    <style>{`
      .v7-hero {
        position: relative; height: 190svh;
        --v7-bg: #0B0E15; --v7-fg: #ECEFF4; --v7-fg2: #AEB6C4; --v7-fg3: #8791A3;
        --v7-line: rgba(255,255,255,0.10); --v7-line2: rgba(255,255,255,0.16);
        --v7-fail: #F0714F; --v7-fail-soft: rgba(240,113,79,0.13); --v7-fail-line: rgba(240,113,79,0.34);
        --v7-ok: #35D6A0; --v7-ok-soft: rgba(53,214,160,0.12); --v7-ok-line: rgba(53,214,160,0.32);
        --v7-mono: var(--font-geist-mono), ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      }
      .v7-scrollroom { height: 90svh; }
      .v7-mono { font-family: var(--v7-mono); letter-spacing: 0; }

      .v7-stage {
        position: sticky; top: 0; height: 100svh; min-height: 600px; overflow: hidden;
        background:
          radial-gradient(115% 85% at 84% 0%, rgba(53,214,160,0.06), transparent 58%),
          radial-gradient(90% 70% at 6% 2%, rgba(255,255,255,0.035), transparent 52%),
          var(--v7-bg);
        color: var(--v7-fg);
        display: grid;
        grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.3fr);
        grid-template-rows: auto minmax(0,1fr) auto;
        grid-template-areas: "nav nav" "thesis evidence" "hist hist";
        column-gap: clamp(30px, 5vw, 92px);
        padding: 0 clamp(20px, 4vw, 64px);
        max-width: 1540px; margin: 0 auto;
      }

      .v7-hero .r { transition: opacity .62s var(--ease-out), transform .62s var(--ease-out); }
      .v7-hero[data-lit="off"] .r { opacity: 0; transform: translateY(14px); }
      .v7-hero .r[data-r="1"]{transition-delay:.04s}.v7-hero .r[data-r="2"]{transition-delay:.14s}
      .v7-hero .r[data-r="3"]{transition-delay:.26s}.v7-hero .r[data-r="4"]{transition-delay:.36s}
      .v7-hero .r[data-r="5"]{transition-delay:.46s}.v7-hero .r[data-r="6"]{transition-delay:.56s}
      .v7-hero .r[data-r="7"]{transition-delay:.64s}

      .v7-nav { grid-area: nav; display: flex; align-items: center; gap: 26px; height: 62px; }
      .v7-nav__brand { font-family: var(--font-display); font-weight: 600; font-size: 18px; letter-spacing: -0.02em; color: var(--v7-fg); text-decoration: none; }
      .v7-nav__links { display: flex; gap: 24px; margin-left: 10px; }
      .v7-nav__link { font-size: 14.5px; color: var(--v7-fg2); text-decoration: none; transition: color .2s var(--ease); }
      .v7-nav__link:hover { color: var(--v7-fg); }
      .v7-nav__right { margin-left: auto; display: flex; align-items: center; gap: 18px; }
      .v7-nav__signin { font-size: 14.5px; color: var(--v7-fg2); text-decoration: none; }
      .v7-nav__signin:hover { color: var(--v7-fg); }

      .v7-cta { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; box-sizing: border-box;
        background: var(--v7-fg); color: #0B0E15; font-family: var(--font-display); font-weight: 600; font-size: 15px; letter-spacing: -0.005em;
        padding: 11px 22px; border-radius: 5px; text-decoration: none; border: 1px solid var(--v7-fg); white-space: nowrap;
        transition: transform var(--dur-fast) var(--ease-out), background .2s var(--ease); }
      .v7-cta:hover { background: #fff; } .v7-cta:active { transform: scale(0.98); }
      .v7-cta:focus-visible { outline: 2px solid var(--v7-ok); outline-offset: 3px; }
      .v7-cta--sm { min-height: 38px; padding: 8px 15px; font-size: 14px; }
      .v7-textlink { display: inline-flex; align-items: center; gap: 7px; font-size: 15px; font-weight: 500; color: var(--v7-fg); text-decoration: none; border-bottom: 1px solid var(--v7-line2); padding: 6px 0; cursor: pointer; transition: color .2s var(--ease), border-color .2s var(--ease); }
      .v7-textlink:hover { color: var(--v7-ok); border-color: var(--v7-ok); }

      .v7-thesis { grid-area: thesis; display: flex; flex-direction: column; justify-content: center; padding: clamp(18px,3vh,38px) 0; }
      .v7-kick { font-family: var(--v7-mono); font-size: 12.5px; letter-spacing: 0.05em; color: var(--v7-ok); margin-bottom: clamp(18px,2.6vh,28px); }
      .v7-h1 { font-family: var(--font-display); font-weight: 600; letter-spacing: -0.035em; line-height: 0.99; margin: 0 0 clamp(20px,3vh,30px); }
      .v7-h1__mask { display: block; overflow: hidden; padding-bottom: 0.07em; margin-bottom: -0.03em; }
      .v7-h1__in { display: block; font-size: clamp(2.2rem, 4.3vw, 4rem); color: var(--v7-fg2); transition: transform .78s var(--ease-out); }
      .v7-h1__in--em { color: var(--v7-fg); }
      .v7-hero[data-lit="off"] .v7-h1__in { transform: translateY(104%); }
      .v7-hero .v7-h1__mask[data-r="2"] .v7-h1__in { transition-delay: .14s; }
      .v7-hero .v7-h1__mask[data-r="3"] .v7-h1__in { transition-delay: .24s; }
      .v7-lead { font-size: clamp(1rem,1.25vw,1.18rem); line-height: 1.55; color: var(--v7-fg2); max-width: 42ch; margin: 0 0 clamp(22px,3.5vh,32px); }
      .v7-cta-row { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; margin-bottom: clamp(18px,2.6vh,28px); }
      .v7-brand { font-family: var(--font-display); font-weight: 500; font-size: 15px; color: var(--v7-fg3); letter-spacing: -0.01em; }

      .v7-right { grid-area: evidence; display: flex; flex-direction: column; justify-content: center; min-width: 0; padding: clamp(18px,3vh,38px) 0; }
      .v7-req { padding-bottom: clamp(16px,2.4vh,24px); margin-bottom: clamp(18px,2.6vh,26px); border-bottom: 1px solid var(--v7-line); }
      .v7-req__lbl { font-family: var(--v7-mono); font-size: 11px; letter-spacing: 0.13em; text-transform: uppercase; color: var(--v7-fg3); margin-bottom: 11px; }
      .v7-req__t { font-family: var(--font-display); font-weight: 500; color: var(--v7-fg); font-size: clamp(1.4rem,2.2vw,2.1rem); line-height: 1.16; letter-spacing: -0.02em; margin: 0; max-width: 26ch; }

      .v7-evstack { display: flex; flex-direction: column; min-width: 0; }
      .v7-ev { min-width: 0; display: flex; flex-direction: column; gap: clamp(15px,2.2vh,24px); }
      /* default (desktop + normal motion): live shown, static pair hidden */
      .v7-ev--failed, .v7-ev--verified { display: none; }

      /* claim + verdict crossfade on repair */
      @keyframes v7fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      .v7-claim__swap { display: inline-flex; align-items: baseline; gap: 10px 16px; flex-wrap: wrap; animation: v7fade .32s var(--ease-out) both; }
      .v7-verdict__block { animation: v7fade .34s var(--ease-out) both; }

      .v7-claim { display: flex; align-items: baseline; gap: 10px 16px; flex-wrap: wrap; }
      .v7-claim__lbl { font-family: var(--v7-mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--v7-fg3); }
      .v7-claim__say { font-family: var(--font-display); font-weight: 500; font-size: clamp(1.1rem,1.6vw,1.45rem); color: var(--v7-fg); letter-spacing: -0.015em; }
      .v7-claim__dep { font-size: 13px; color: var(--v7-fg2); }
      .v7-dep-k { font-family: var(--v7-mono); font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--v7-fg3); }
      .v7-claim .v7-mono { color: var(--v7-fg); font-weight: 600; font-size: 13px; }

      .v7-readout { border: 1px solid var(--v7-line); border-radius: 8px; background: rgba(255,255,255,0.018); overflow: hidden; }
      .v7-readout__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 16px; border-bottom: 1px solid var(--v7-line); }
      .v7-readout__lbl { font-family: var(--v7-mono); font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--v7-ok); }
      .v7-readout__dep { font-size: 12px; color: var(--v7-fg2); }
      .v7-row { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 14px; padding: 10px 16px; border-top: 1px solid var(--v7-line); transition: background .28s var(--ease-out); }
      .v7-row:first-child { border-top: none; }
      .v7-row__k { font-size: 13px; color: var(--v7-fg2); }
      .v7-vg { display: inline-flex; align-items: center; justify-content: flex-end; gap: 12px; height: 20px; }
      .v7-row__v { font-size: 13px; font-weight: 600; }
      .v7-vg--ok .v7-row__v { color: var(--v7-fg); }
      .v7-vg--bad .v7-row__v { color: var(--v7-fail); }
      .v7-row__mk { display: grid; place-items: center; width: 19px; height: 19px; border-radius: 999px; flex: none; }
      .v7-vg--ok .v7-row__mk { background: var(--v7-ok-soft); color: var(--v7-ok); border: 1px solid var(--v7-ok-line); }
      .v7-vg--bad .v7-row__mk { background: var(--v7-fail-soft); color: var(--v7-fail); border: 1px solid var(--v7-fail-line); }

      /* per-row mutation: the changed value flips (old lifts out, new rises in); unchanged rows never move.
         the two repaired rows stay marked after resolving (clay tint while failed, a quiet emerald edge once
         verified) so a visitor who lands on the resolved state can still see which facts the repair changed */
      .v7-hero[data-state="failed"] .v7-row--flip { background: var(--v7-fail-soft); }
      .v7-hero[data-state="verified"] .v7-row--flip { box-shadow: inset 2px 0 0 var(--v7-ok-line); }
      .v7-flip { display: block; overflow: hidden; height: 20px; }
      .v7-flip__inner { display: flex; flex-direction: column; transition: transform .24s var(--ease-out); transition-delay: var(--fd, 0ms); }
      .v7-hero[data-state="verified"] .v7-flip__inner { transform: translateY(-20px); }

      .v7-verdict { display: flex; }
      /* ownership cue: read as attribution, sized up with a leading emerald rule; its space is reserved in
         both states so the verdict word stays baseline-anchored across the repair */
      .v7-verdict__own { display: flex; align-items: center; gap: 10px; min-height: 15px; font-family: var(--v7-mono); font-size: 13px; font-weight: 600; letter-spacing: 0.09em; text-transform: uppercase; color: var(--v7-ok); margin-bottom: 14px; }
      .v7-verdict__own::before { content: ""; width: 20px; height: 2px; background: var(--v7-ok); border-radius: 2px; flex: none; }
      .v7-verdict[data-tone="verified"] .v7-verdict__own::before { display: none; }
      .v7-verdict__main { display: flex; align-items: baseline; gap: 18px 26px; flex-wrap: wrap; }
      .v7-verdict__word { font-family: var(--font-display); font-weight: 600; letter-spacing: -0.045em; line-height: 0.84; font-size: clamp(2.9rem,6vw,5.4rem); }
      .v7-verdict[data-tone="failed"] .v7-verdict__word { color: var(--v7-fail); }
      .v7-verdict[data-tone="verified"] .v7-verdict__word { color: var(--v7-ok); }
      .v7-verdict__say { font-size: clamp(0.92rem,1.1vw,1.05rem); line-height: 1.5; color: var(--v7-fg2); max-width: 34ch; margin: 0; align-self: center; }

      .v7-hist { grid-area: hist; display: flex; align-items: center; gap: 14px 26px; flex-wrap: wrap; padding: 15px 0 clamp(14px,2.4vh,22px); border-top: 1px solid var(--v7-line); outline: none; }
      .v7-hist:focus-visible { outline: 2px solid var(--v7-ok); outline-offset: 4px; border-radius: 3px; }
      .v7-hist__lbl { font-family: var(--v7-mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--v7-fg3); margin-right: auto; }
      .v7-hist__rec { display: flex; align-items: baseline; gap: 11px; }
      .v7-hist__dot { width: 8px; height: 8px; border-radius: 999px; align-self: center; }
      .v7-hist__rec--fail .v7-hist__dot { background: var(--v7-fail); } .v7-hist__rec--ok .v7-hist__dot { background: var(--v7-ok); }
      .v7-hist__v { font-family: var(--font-display); font-weight: 600; font-size: 15px; }
      .v7-hist__rec--fail .v7-hist__v { color: var(--v7-fail); } .v7-hist__rec--ok .v7-hist__v { color: var(--v7-ok); }
      .v7-hist__id { font-size: 13px; color: var(--v7-fg2); }
      .v7-hist__st { font-family: var(--v7-mono); font-size: 10.5px; letter-spacing: 0.09em; text-transform: uppercase; color: var(--v7-fg3); }
      .v7-hist__st--now { color: var(--v7-ok); }

      /* ── MOBILE OR REDUCED MOTION: hide the live field, show both factual states stacked ── */
      @media (max-width: 900px), (prefers-reduced-motion: reduce) {
        .v7-ev--live { display: none; }
        .v7-ev--failed, .v7-ev--verified { display: flex; }
      }
      @media (max-width: 900px) {
        .v7-hero { height: auto; }
        .v7-scrollroom { display: none; }
        .v7-stage {
          position: static; height: auto; min-height: 0; overflow: visible;
          grid-template-columns: 1fr; grid-template-rows: none;
          grid-template-areas: "nav" "thesis" "evidence" "hist"; row-gap: 0; padding-bottom: 36px;
        }
        .v7-nav__links { display: none; }
        .v7-thesis { padding: 26px 0 6px; }
        .v7-h1__in { font-size: clamp(1.9rem, 8vw, 2.6rem); }
        .v7-right { padding: 22px 0 0; }
        .v7-req { position: sticky; top: 0; z-index: 5; background: var(--v7-bg); padding-top: 14px; box-shadow: 0 10px 22px -14px rgba(0,0,0,0.9); }
        .v7-req__t { font-size: clamp(1.35rem, 5.6vw, 1.85rem); max-width: none; }
        .v7-evstack { gap: 34px; }
        .v7-ev--verified { padding-top: 30px; border-top: 1px solid var(--v7-line); }
        .v7-verdict__word { font-size: clamp(3rem, 19vw, 4.6rem); }
        .v7-hist { flex-direction: column; align-items: flex-start; gap: 12px; margin-top: 8px; }
        .v7-hist__lbl { margin-right: 0; }
      }
      @media (max-width: 480px) { .v7-nav__signin { display: none; } .v7-nav { gap: 12px; } .v7-nav__right { gap: 12px; } }
      @media (max-width: 380px) { .v7-verdict__word { font-size: clamp(2.7rem, 17vw, 3.8rem); } }

      @media (prefers-reduced-motion: reduce) {
        .v7-hero .r, .v7-h1__in { transition: none !important; opacity: 1 !important; transform: none !important; }
        .v7-claim__swap, .v7-verdict__block { animation: none !important; }
        .v7-flip__inner { transition: none !important; }
        /* unpin so both stacked factual states flow (the pinned stage clips overflow); the composition
           stays but the hero scrolls normally and shows the complete lineage without any transition */
        .v7-hero { height: auto; }
        .v7-scrollroom { display: none; }
        .v7-stage { position: static; height: auto; min-height: 0; overflow: visible; }
        .v7-evstack { gap: 30px; }
        .v7-ev--verified { padding-top: 28px; border-top: 1px solid var(--v7-line); }
      }
    `}</style>
  );
}
