"use client";

// PUBLIC-V5 SCENE 2 — the conflict. The sharpest reason Vraelis exists: the agent that builds the software can
// also write its tests and declare its own work complete. Vraelis judges from outside that boundary. Shown as a
// contrast: what the agent CLAIMS versus what Vraelis OBSERVED, resolving to Failed, then a repaired Verified
// with the Failed record preserved. Not evil AI, structural independence. Mount-timed reveal so captures resolve.

import { useEffect, useRef, useState } from "react";
import { Ic, I } from "@/app/rank/_components/icons";

export function Conflict() {
  const [lit, setLit] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return; started.current = true;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setLit(true); return; }
    const t = setTimeout(() => setLit(true), 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`cf${lit ? " on" : ""}`}>
      <div className="cf-panel" aria-label="What the agent claims versus what Vraelis observed, illustrative">
        <div className="cf-side cf-side--claim">
          <div className="cf-side__lbl">The agent reports</div>
          <div className="cf-claim">&ldquo;Checkout is complete.&rdquo;</div>
          <div className="cf-side__foot">It wrote the code, the tests, and the claim.</div>
        </div>

        <div className="cf-vs" aria-hidden><span>vs</span></div>

        <div className="cf-side cf-side--obs">
          <div className="cf-side__lbl cf-side__lbl--acc">Vraelis observed, in a real browser</div>
          <div className="cf-obs">
            <div className="cf-obs__row"><span className="cf-obs__mk cf-obs__mk--ok"><Ic d={I.check} size={12} sw={2.6} /></span>Payment succeeded</div>
            <div className="cf-obs__row cf-obs__row--bad"><span className="cf-obs__mk cf-obs__mk--bad"><Ic d={I.x} size={12} sw={2.6} /></span>Pro access was never granted</div>
          </div>
          <div className="cf-side__foot">Held to the outcome the business requires, not the agent&rsquo;s word.</div>
        </div>
      </div>

      <div className="cf-verdict">
        <span className="pill cf-verdict__pill"><Ic d={I.x} size={11} sw={2.6} />Failed</span>
        <span className="cf-verdict__txt">Expected and observed behavior diverged. The failure, its evidence, and a repair prompt go back to the agent.</span>
      </div>

      <div className="cf-line">
        <div className="cf-rec cf-rec--fail"><span className="cf-rec__dot" /><div><b>Failed</b> on 8f21ad<div className="cf-rec__d">Entitlement never applied</div></div></div>
        <span aria-hidden className="cf-arrow"><Ic d={I.retry} size={14} sw={1.9} />repair</span>
        <div className="cf-rec cf-rec--ok"><span className="cf-rec__dot" /><div><b>Verified</b> on 72c98e<div className="cf-rec__d">Access granted and retained</div></div></div>
        <span className="cf-keep">The Failed record is kept, never overwritten.</span>
      </div>

      <ConflictStyles />
    </div>
  );
}

function ConflictStyles() {
  return (
    <style>{`
      .cf { display: grid; gap: clamp(16px,2.2vw,22px); }
      .cf-panel { display: grid; grid-template-columns: minmax(0,1fr) 64px minmax(0,1fr); align-items: stretch; border: 1px solid var(--line-2); border-radius: var(--r-xl); background: var(--bg-1); box-shadow: var(--shadow-md); overflow: hidden; }
      .cf-side { padding: clamp(20px,2.6vw,32px); display: flex; flex-direction: column; gap: 14px; }
      .cf-side--claim { background: var(--bg-2); }
      .cf-side__lbl { font-family: var(--font-code); font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-4); }
      .cf-side__lbl--acc { color: var(--acc-deep); }
      .cf-claim { font-family: var(--font-display); font-weight: 600; font-size: clamp(1.35rem,2.4vw,1.95rem); letter-spacing: -0.02em; line-height: 1.2; color: var(--fg-3); }
      .cf-side__foot { font-size: 12.5px; color: var(--fg-4); line-height: 1.5; margin-top: auto; }
      .cf-obs { display: grid; gap: 10px; }
      .cf-obs__row { display: flex; align-items: center; gap: 11px; font-size: clamp(1rem,1.5vw,1.2rem); font-weight: 500; color: var(--fg-2); }
      .cf-obs__row--bad { color: var(--fg-1); font-weight: 600; }
      .cf-obs__mk { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 999px; flex: none; }
      .cf-obs__mk--ok { background: var(--acc-soft); color: var(--acc-deep); border: 1px solid var(--acc-line); }
      .cf-obs__mk--bad { background: #F6ECE7; color: #A8452A; border: 1px solid #E7CFC5; }
      .cf-vs { display: grid; place-items: center; background: linear-gradient(180deg, var(--bg-2), var(--bg-1)); }
      .cf-vs span { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 999px; border: 1px solid var(--line-3); background: var(--bg-1); font-family: var(--font-code); font-size: 11px; color: var(--fg-4); }

      .cf-verdict { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 14px 18px; border: 1px solid #E7CFC5; background: #FBF4F0; border-radius: 14px; }
      .cf-verdict__pill { color: #A8452A; background: #F6ECE7; border-color: #E7CFC5; font-size: 11.5px; gap: 5px; }
      .cf-verdict__txt { font-size: 13.5px; color: var(--fg-2); line-height: 1.5; }

      .cf-line { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .cf-rec { display: flex; align-items: center; gap: 10px; padding: 11px 14px; border: 1px solid var(--line-2); border-radius: 12px; background: var(--bg-1); }
      .cf-rec__dot { width: 9px; height: 9px; border-radius: 999px; flex: none; }
      .cf-rec--fail .cf-rec__dot { background: #A8452A; }
      .cf-rec--ok .cf-rec__dot { background: var(--acc-deep); }
      .cf-rec b { font-size: 13px; color: var(--fg-1); }
      .cf-rec__d { font-size: 11.5px; color: var(--fg-4); margin-top: 1px; }
      .cf-arrow { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-code); font-size: 11px; color: var(--fg-4); }
      .cf-keep { font-family: var(--font-code); font-size: 10.5px; color: var(--fg-4); }

      .cf-side, .cf-verdict, .cf-rec, .cf-arrow, .cf-keep { transition: opacity .6s var(--ease-out), transform .6s var(--ease-out); }
      .cf:not(.on) .cf-side--obs, .cf:not(.on) .cf-verdict, .cf:not(.on) .cf-rec, .cf:not(.on) .cf-arrow, .cf:not(.on) .cf-keep { opacity: 0; transform: translateY(8px); }

      @media (max-width: 760px) {
        .cf-panel { grid-template-columns: 1fr; }
        .cf-vs { padding: 8px 0; }
        .cf-line { gap: 10px; }
      }
      @media (prefers-reduced-motion: reduce) { .cf-side, .cf-verdict, .cf-rec, .cf-arrow, .cf-keep { transition: none !important; } }
    `}</style>
  );
}
