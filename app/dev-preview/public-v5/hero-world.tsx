"use client";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// PUBLIC-V5 SCENE 1 — the hero WORLD, rebuilt with the frontend-design skill.
//
// Not a systems diagram of zones and cards. One composed Vraelis surface caught at a real moment, read
// top-to-bottom as a single traceable event:
//
//   REQUIREMENT (warm, elevated, authoritative) — one standing guarantee, stated in full, with the live verdict
//   PROOF                                        — Expected vs Observed, the divergence that produced the verdict
//   RECORDS                                      — Failed 8f21ad -> Verified 72c98e, both preserved, both visible
//   [ held outside the code ]                    — the THRESHOLD: a real change of elevation and temperature
//   BUILD (cool, recessed, subdued)              — the deployment the agent shipped: the mutable input Vraelis judges
//
// The boundary is not a divider. The business's durable requirement sits ELEVATED and WARM; the machine's
// mutable code sits RECESSED and COOL beneath it. That contrast is the boundary, felt rather than labelled.
// The single idea the composition lands: the agent can change the code; it cannot change what the business
// requires Vraelis to prove.
//
// Interaction: a one-time reveal on mount (reduced motion resolves straight to the final state); Replay re-runs
// it; a two-state selector swaps between the Failed deployment and the repaired Verified one. No auto-loop.
// Illustrative: Northwind is a fictional example system. No real customers, logos, or metrics.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Ic, I } from "@/app/rank/_components/icons";

type Deploy = "failed" | "verified";

const RECORD: Record<Deploy, {
  commit: string; verdict: string; mark: string; matches: boolean; observed: string;
}> = {
  failed: {
    commit: "8f21ad",
    verdict: "Failed",
    mark: I.x,
    matches: false,
    observed: "Payment succeeded, but the account returned to Free after signing back in.",
  },
  verified: {
    commit: "72c98e",
    verdict: "Verified",
    mark: I.check,
    matches: true,
    observed: "Payment succeeded, and Pro access stayed active after signing back in.",
  },
};

const EXPECTED = "Pro access is still active after the customer signs out and back in.";

function d(ms: number): CSSProperties {
  return { "--rd": `${ms}ms` } as CSSProperties;
}

export function HeroWorld() {
  const [lit, setLit] = useState(false);
  const [run, setRun] = useState(0);
  const [deploy, setDeploy] = useState<Deploy>("failed");
  const rec = RECORD[deploy];

  // The reveal is scheduled asynchronously; reduced motion is resolved in CSS (elements stay visible), so the
  // effect never sets state synchronously. Replay resets the reveal from its own click handler, then bumps `run`.
  useEffect(() => {
    const t = setTimeout(() => setLit(true), run === 0 ? 160 : 40);
    return () => clearTimeout(t);
  }, [run]);

  const replay = () => { setLit(false); setRun((n) => n + 1); };

  return (
    <div className="hw" data-lit={lit ? "on" : "off"}>
      <p className="sr-only" aria-live="polite">
        {deploy === "failed"
          ? "Showing deployment 8f21ad. Conclusion: Failed. Payment succeeded, but Pro access was never granted."
          : "Showing deployment 72c98e, after the repair. Conclusion: Verified. Pro access was granted and retained."}
      </p>

      {/* ── The requirement stratum: warm, elevated, authoritative ── */}
      <div className="hw-req">
        <div className="hw-head r" style={d(0)}>
          <div className="hw-head__id">
            <span className="hw-head__sys">Northwind</span>
            <span className="hw-head__env">production</span>
          </div>
          <div className="hw-head__meta">
            <span className="hw-head__count">3 standing guarantees</span>
            <span className="hw-illus">Illustrative</span>
          </div>
        </div>

        <div className="hw-grid">
          <div className="hw-sel r" style={d(70)}>
            <div className="hw-kick">Standing guarantee</div>
            <h3 className="hw-claim">A customer who buys Pro keeps Pro access after signing out and back in.</h3>
          </div>

          <div className="hw-verdict r" data-state={deploy} style={d(150)} aria-hidden>
            <span className="hw-vin" key={deploy}>
              <span className="hw-vmark"><Ic d={rec.mark} size={15} sw={2.7} /></span>
              <span className="hw-vtext">
                <span className="hw-vword">{rec.verdict}</span>
                <span className="hw-vdep">on {rec.commit}</span>
              </span>
            </span>
          </div>

          <div className="hw-proof r" style={d(220)}>
            <div className="hw-eo">
              <div className="hw-eo__col">
                <div className="hw-eo__lbl">Expected</div>
                <p className="hw-eo__txt">{EXPECTED}</p>
              </div>
              <div className="hw-eo__col hw-eo__col--obs" data-state={deploy}>
                <div className="hw-eo__lbl">Observed, in a real browser</div>
                <div className="hw-oin" key={deploy}>
                  <p className="hw-eo__txt">{rec.observed}</p>
                  <span className="hw-eo__tag">{rec.matches ? "Matches what the business requires" : "Does not match what the business requires"}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="hw-ev r" style={d(290)}>
            <span className="hw-ev__ic"><Ic d={I.camera} size={15} sw={1.8} /></span>
            <span className="hw-ev__txt">Proven in a real browser. The recording and findings are kept with the record.</span>
          </div>

          <div className="hw-rec r" style={d(350)}>
            <div className="hw-rec__lbl">Preserved records</div>
            <div className="hw-rec__flow">
              <span className={`hw-rec__item hw-rec__item--fail${deploy === "failed" ? " is-sel" : ""}`}>
                <span className="hw-rec__dot" />
                <span className="hw-rec__k">Failed</span>
                <span className="hw-rec__c">8f21ad</span>
                <span className="hw-rec__d">entitlement never applied</span>
              </span>
              <span className="hw-rec__link" aria-hidden><Ic d={I.retry} size={13} sw={1.9} />repair</span>
              <span className={`hw-rec__item hw-rec__item--ok${deploy === "verified" ? " is-sel" : ""}`}>
                <span className="hw-rec__dot" />
                <span className="hw-rec__k">Verified</span>
                <span className="hw-rec__c">72c98e</span>
                <span className="hw-rec__d">access granted and retained</span>
              </span>
            </div>
            <div className="hw-rec__note">Every record is kept. A later pass never overwrites an earlier one.</div>
          </div>

          <div className="hw-others r" style={d(410)}>
            <div className="hw-others__lbl">Also held for Northwind</div>
            <div className="hw-others__list">
              <div className="hw-oth" data-tone="verified">
                <span className="hw-oth__mark"><Ic d={I.check} size={11} sw={2.6} /></span>
                <span className="hw-oth__t">Users stay inside their own workspace</span>
                <span className="hw-oth__s">Verified</span>
              </div>
              <div className="hw-oth" data-tone="failed">
                <span className="hw-oth__mark"><Ic d={I.x} size={11} sw={2.6} /></span>
                <span className="hw-oth__t">Submitted records survive a reload</span>
                <span className="hw-oth__s">Failed</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Controls: subordinate to the product. Between requirement and code on mobile; below both on desktop. ── */}
      <div className="hw-controls">
        <button type="button" className="hw-replay" onClick={replay}>
          <Ic d={I.retry} size={15} sw={2} />Replay the proof
        </button>
        <div className="hw-seg" role="group" aria-label="Choose a deployment record">
          <button type="button" className={`hw-seg__b${deploy === "failed" ? " on" : ""}`} aria-pressed={deploy === "failed"} onClick={() => setDeploy("failed")}>
            <span className="hw-seg__dot hw-seg__dot--fail" />Failed 8f21ad
          </button>
          <button type="button" className={`hw-seg__b${deploy === "verified" ? " on" : ""}`} aria-pressed={deploy === "verified"} onClick={() => setDeploy("verified")}>
            <span className="hw-seg__dot hw-seg__dot--ok" />Verified 72c98e
          </button>
        </div>
      </div>

      {/* ── The code stratum: cool, recessed, subdued. The threshold "held outside the code" is the seam. ── */}
      <div className="hw-code r" data-state={deploy} style={d(470)}>
        <div className="hw-thresh"><span>held outside the code</span></div>
        <div className="hw-code__body">
          <div className="hw-code__lbl">What the agent shipped</div>
          <div className="hw-code__row">
            <span className="hw-code__ic" aria-hidden><Ic d={I.deploy} size={15} sw={1.8} /></span>
            <span className="hw-code__url">app.northwind.io</span>
            <span className="hw-code__commit">deployment {rec.commit}</span>
            <span className="hw-code__by">shipped by the coding agent</span>
          </div>
          <div className="hw-code__note">The agent writes the code, its tests, and its own claim that the work is done.</div>
        </div>
      </div>

      <HeroWorldStyles />
    </div>
  );
}

function HeroWorldStyles() {
  return (
    <style>{`
      /* one composed object stacked in three strata; controls reorder around them */
      .hw { display: flex; flex-direction: column; position: relative; }

      /* reveal primitive: one-time entrance cascade (duration matched to the small 9px travel) */
      .hw .r { transition: opacity .42s var(--ease-out) var(--rd, 0ms), transform .42s var(--ease-out) var(--rd, 0ms); }
      .hw[data-lit="off"] .r { opacity: 0; transform: translateY(9px); }
      /* swap bridge: the verdict + observed re-resolve (never teleport) when the record is changed */
      @keyframes hwSwap { from { opacity: 0; } to { opacity: 1; } }
      .hw-oin { animation: hwSwap 180ms var(--ease-out) both; }

      /* ── REQUIREMENT stratum ────────────────────────────────────────── */
      .hw-req {
        position: relative;
        background: linear-gradient(180deg, #FFFFFF 0%, #FDFCF9 100%);
        border: 1px solid var(--line-2); border-radius: var(--r-xl);
        box-shadow: var(--shadow-lg); overflow: hidden;
      }
      .hw-head {
        display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;
        padding: 13px clamp(18px, 2.2vw, 28px); border-bottom: 1px solid var(--line-1);
        background: linear-gradient(180deg, var(--bg-2), rgba(241,238,231,0));
      }
      .hw-head__id { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
      .hw-head__sys { font-family: var(--font-display); font-weight: 600; font-size: 15px; color: var(--fg-1); letter-spacing: -0.01em; }
      .hw-head__env { font-size: 12.5px; color: var(--fg-4); }
      .hw-head__meta { display: flex; align-items: center; gap: 12px; }
      .hw-head__count { font-size: 12.5px; color: var(--fg-3); }
      .hw-illus {
        font-size: 10.5px; letter-spacing: 0.07em; text-transform: uppercase; color: var(--fg-4);
        border: 1px solid var(--line-2); border-radius: 999px; padding: 3px 9px; background: var(--bg-1);
      }

      .hw-grid {
        display: grid; align-items: start;
        grid-template-columns: minmax(0, 1fr) auto;
        grid-template-areas:
          "sel      verdict"
          "proof    proof"
          "ev       ev"
          "rec      rec"
          "others   others";
        padding: clamp(16px, 2vw, 24px) clamp(18px, 2.2vw, 28px) clamp(18px, 2.2vw, 26px);
        column-gap: clamp(18px, 2.4vw, 32px);
      }
      .hw-sel { grid-area: sel; max-width: 46ch; }
      .hw-kick { font-size: 11.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--acc-deep); margin-bottom: 9px; }
      .hw-claim {
        font-family: var(--font-display); font-weight: 600; letter-spacing: -0.02em;
        font-size: clamp(1.18rem, 1.7vw, 1.4rem); line-height: 1.25; color: var(--fg-1); margin: 0;
      }

      /* the one saturated focal object */
      .hw-verdict {
        grid-area: verdict; justify-self: end; align-self: start;
        display: inline-flex; align-items: center;
        padding: 11px 15px 11px 12px; border-radius: 13px;
        border: 1px solid var(--vln); background: var(--vbg); box-shadow: var(--shadow-sm);
      }
      .hw-verdict[data-state="failed"]   { --vt: #A8452A; --vbg: #F6ECE7; --vln: #E7CFC5; }
      .hw-verdict[data-state="verified"] { --vt: var(--acc-deep); --vbg: var(--acc-soft); --vln: var(--acc-line); }
      /* keyed inner content re-resolves on record swap; the tile itself keeps the entrance reveal */
      .hw-vin { display: inline-flex; align-items: center; gap: 9px; animation: hwSwap 180ms var(--ease-out) both; }
      .hw-vmark { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; background: var(--bg-1); color: var(--vt); border: 1px solid var(--vln); flex: none; }
      .hw-vtext { display: flex; flex-direction: column; gap: 2px; }
      .hw-vword { font-family: var(--font-display); font-weight: 600; font-size: 17px; color: var(--vt); letter-spacing: -0.01em; line-height: 1; }
      .hw-vdep { font-size: 12px; color: var(--fg-4); line-height: 1; }

      /* PROOF: two readings in one ruled band, never two cards */
      .hw-proof { grid-area: proof; margin-top: clamp(13px, 1.5vw, 18px); padding-top: clamp(13px, 1.5vw, 17px); border-top: 1px solid var(--line-1); }
      .hw-eo { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
      .hw-eo__col { padding: 2px clamp(16px, 2vw, 26px); }
      .hw-eo__col:first-child { padding-left: 0; border-right: 1px solid var(--line-1); }
      .hw-eo__col:last-child { padding-right: 0; }
      .hw-eo__lbl { font-size: 12.5px; font-weight: 600; color: var(--fg-4); margin-bottom: 7px; }
      .hw-eo__col--obs .hw-eo__lbl { color: var(--acc-deep); }
      .hw-eo__txt { font-size: clamp(1rem, 1.15vw, 1.06rem); line-height: 1.5; color: var(--fg-2); margin: 0; }
      .hw-eo__col--obs .hw-eo__txt { color: var(--fg-1); }
      .hw-eo__tag {
        display: inline-flex; align-items: center; margin-top: 10px; font-size: 12.5px; font-weight: 500;
        padding: 4px 10px; border-radius: 999px; border: 1px solid var(--tln); background: var(--tbg); color: var(--tt);
      }
      .hw-eo__col--obs[data-state="failed"]   { --tt: #A8452A; --tbg: #F6ECE7; --tln: #E7CFC5; }
      .hw-eo__col--obs[data-state="verified"] { --tt: var(--acc-deep); --tbg: var(--acc-soft); --tln: var(--acc-line); }

      .hw-ev { grid-area: ev; display: flex; align-items: center; gap: 10px; margin-top: clamp(11px, 1.3vw, 15px); padding-top: clamp(11px, 1.3vw, 14px); border-top: 1px solid var(--line-1); }
      .hw-ev__ic { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; background: var(--bg-2); color: var(--fg-3); border: 1px solid var(--line-2); flex: none; }
      .hw-ev__txt { font-size: 14px; color: var(--fg-3); line-height: 1.45; }

      .hw-rec { grid-area: rec; margin-top: clamp(11px, 1.3vw, 15px); padding-top: clamp(11px, 1.3vw, 14px); border-top: 1px solid var(--line-1); }
      .hw-rec__lbl { font-size: 11.5px; letter-spacing: 0.07em; text-transform: uppercase; color: var(--fg-4); margin-bottom: 9px; }
      .hw-rec__flow { display: flex; align-items: stretch; gap: 12px; flex-wrap: wrap; }
      .hw-rec__item {
        display: grid; grid-template-columns: auto auto auto; align-items: center; column-gap: 8px; row-gap: 2px;
        padding: 9px 13px; border-radius: 11px; border: 1px solid var(--line-2); background: var(--bg-1);
        transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease), background var(--dur) var(--ease);
      }
      .hw-rec__dot { grid-row: 1 / span 2; width: 9px; height: 9px; border-radius: 999px; align-self: center; }
      .hw-rec__item--fail .hw-rec__dot { background: #A8452A; }
      .hw-rec__item--ok .hw-rec__dot { background: var(--acc-deep); }
      .hw-rec__k { font-weight: 600; font-size: 14px; color: var(--fg-1); }
      .hw-rec__c { font-size: 13px; color: var(--fg-3); }
      .hw-rec__d { grid-column: 2 / span 2; font-size: 12px; color: var(--fg-4); line-height: 1.3; }
      .hw-rec__item.is-sel.hw-rec__item--fail { border-color: #E7CFC5; background: #FCF6F2; box-shadow: 0 0 0 1px #E7CFC5; }
      .hw-rec__item.is-sel.hw-rec__item--ok { border-color: var(--acc-line); background: var(--acc-soft); box-shadow: 0 0 0 1px var(--acc-line); }
      .hw-rec__link { display: inline-flex; align-items: center; gap: 5px; align-self: center; font-size: 12px; color: var(--fg-4); }
      .hw-rec__note { font-size: 12.5px; color: var(--fg-4); line-height: 1.5; margin-top: 11px; }

      .hw-others { grid-area: others; margin-top: clamp(11px, 1.3vw, 15px); padding-top: clamp(11px, 1.3vw, 14px); border-top: 1px solid var(--line-1); }
      .hw-others__lbl { font-size: 11.5px; letter-spacing: 0.07em; text-transform: uppercase; color: var(--fg-4); margin-bottom: 6px; }
      .hw-others__list { display: grid; }
      .hw-oth { display: flex; align-items: center; gap: 11px; padding: 9px 0; border-bottom: 1px solid var(--line-1); }
      .hw-oth:last-child { border-bottom: none; }
      .hw-oth__mark { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 999px; flex: none; }
      .hw-oth[data-tone="verified"] .hw-oth__mark { background: var(--acc-soft); color: var(--acc-deep); border: 1px solid var(--acc-line); }
      .hw-oth[data-tone="failed"] .hw-oth__mark { background: #F6ECE7; color: #A8452A; border: 1px solid #E7CFC5; }
      .hw-oth__t { flex: 1; min-width: 0; font-size: 14px; color: var(--fg-2); font-weight: 500; }
      .hw-oth__s { font-size: 12px; font-weight: 600; }
      .hw-oth[data-tone="verified"] .hw-oth__s { color: var(--acc-deep); }
      .hw-oth[data-tone="failed"] .hw-oth__s { color: #A8452A; }

      /* ── CONTROLS ─────────────────────────────────────────────────── */
      .hw-controls { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
      .hw-replay {
        display: inline-flex; align-items: center; gap: 8px; padding: 9px 15px; border-radius: 999px;
        border: 1px solid var(--line-3); background: var(--bg-1); color: var(--fg-2); cursor: pointer;
        font-family: var(--font-sans); font-size: 13.5px; font-weight: 500; box-shadow: var(--shadow-sm);
        transition: border-color var(--dur) var(--ease), color var(--dur) var(--ease), transform var(--dur-fast) var(--ease-out);
      }
      .hw-replay:hover { border-color: var(--fg-1); color: var(--fg-1); }
      .hw-replay:active { transform: scale(0.97); }
      .hw-seg { display: inline-flex; padding: 4px; gap: 3px; border-radius: 999px; border: 1px solid var(--line-2); background: var(--bg-2); margin-left: auto; }
      .hw-seg__b {
        display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border: none; border-radius: 999px;
        background: transparent; color: var(--fg-3); cursor: pointer; font-family: var(--font-sans);
        font-size: 13px; font-weight: 500; white-space: nowrap;
        transition: background var(--dur) var(--ease), color var(--dur) var(--ease), box-shadow var(--dur) var(--ease), transform var(--dur-fast) var(--ease-out);
      }
      .hw-seg__b.on { background: var(--bg-1); color: var(--fg-1); box-shadow: 0 0 0 1px rgba(28,27,24,0.05), 0 1px 3px rgba(28,27,24,0.10); }
      .hw-seg__b:active { transform: scale(0.97); }
      /* component-level focus ring so keyboard focus never depends solely on the global reset */
      .hw-replay:focus-visible, .hw-seg__b:focus-visible { outline: 2px solid var(--acc-deep); outline-offset: 2px; }
      .hw-seg__dot { width: 8px; height: 8px; border-radius: 999px; flex: none; }
      .hw-seg__dot--fail { background: #A8452A; }
      .hw-seg__dot--ok { background: var(--acc-deep); }

      /* ── CODE stratum: cool, recessed, subdued ──────────────────────── */
      .hw-code {
        position: relative; border-radius: 0 0 var(--r-xl) var(--r-xl);
        background: linear-gradient(180deg, #1C2530 0%, #161E28 100%);
        box-shadow: inset 0 3px 10px rgba(6,10,18,0.45);
        border: 1px solid rgba(255,255,255,0.05); border-top: none;
      }
      .hw-thresh { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 9px 0 4px; }
      .hw-thresh::before, .hw-thresh::after { content: ""; height: 1px; width: clamp(30px, 12vw, 120px); background: linear-gradient(90deg, transparent, rgba(146,161,176,0.4)); }
      .hw-thresh::after { background: linear-gradient(90deg, rgba(146,161,176,0.4), transparent); }
      .hw-thresh span { font-size: 11px; letter-spacing: 0.11em; text-transform: uppercase; color: #8FA0B2; }
      .hw-code__body { padding: 6px clamp(18px, 2.2vw, 28px) clamp(16px, 1.9vw, 22px); }
      .hw-code__lbl { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #8B99AB; margin-bottom: 10px; }
      .hw-code__row { display: flex; align-items: center; gap: 12px 14px; flex-wrap: wrap; }
      .hw-code__ic { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; background: rgba(255,255,255,0.05); color: #C4D0DC; border: 1px solid rgba(255,255,255,0.08); flex: none; }
      .hw-code__url { font-size: 15px; font-weight: 600; color: #E7ECF3; letter-spacing: -0.005em; }
      .hw-code__commit { font-size: 12.5px; color: #AFBECC; padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.09); }
      .hw-code__by { font-size: 13px; color: #8FA0B2; }
      .hw-code__note { font-size: 13px; color: #8493A4; line-height: 1.5; margin-top: 11px; max-width: 62ch; }

      /* ── RESPONSIVE ─────────────────────────────────────────────────── */
      @media (min-width: 900px) {
        /* desktop: requirement sits over the code as one object; controls drop below both (source order:
           req, controls, code -> visual order: req, code, controls) */
        .hw-req { order: 1; border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
        .hw-code { order: 2; margin-top: 0; }
        .hw-controls { order: 3; }
      }
      @media (max-width: 899px) {
        /* mobile: DOM order IS the founder's information order; each stratum is its own block */
        .hw-grid {
          grid-template-columns: 1fr;
          grid-template-areas: "sel" "verdict" "proof" "ev" "rec" "others";
          row-gap: 0;
        }
        .hw-verdict { justify-self: start; margin-top: 14px; }
        .hw-proof { margin-top: 16px; padding-top: 16px; }
        .hw-eo { grid-template-columns: 1fr; }
        .hw-eo__col { padding: 0; }
        .hw-eo__col:first-child { border-right: none; border-bottom: 1px solid var(--line-1); padding-bottom: 16px; margin-bottom: 16px; }
        .hw-code { border-radius: var(--r-xl); border-top: 1px solid rgba(255,255,255,0.05); margin-top: 16px; }
        .hw-claim { font-size: 1.2rem; }
        .hw-eo__txt { font-size: 1rem; }
      }
      @media (max-width: 420px) {
        .hw-head { padding: 13px 16px; }
        .hw-grid { padding: 16px; }
        .hw-code__body { padding: 6px 16px 16px; }
        .hw-seg { margin-left: 0; width: 100%; }
        .hw-seg__b { flex: 1; justify-content: center; min-height: 44px; }
        .hw-replay { min-height: 44px; }
        .hw-rec__flow { gap: 9px; }
        .hw-rec__link { width: 100%; }
      }

      @media (prefers-reduced-motion: reduce) {
        /* resolve straight to the final composed state: no reveal motion, no swap fade, nothing hidden */
        .hw .r { transition: none !important; opacity: 1 !important; transform: none !important; }
        .hw-verdict, .hw-oin { animation: none !important; }
        .hw-replay, .hw-seg__b, .hw-rec__item { transition: none !important; }
        .hw-replay:active, .hw-seg__b:active { transform: none !important; }
      }
    `}</style>
  );
}
