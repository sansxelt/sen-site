"use client";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// PUBLIC-V5 SCENE 1 — the category hero + the composed product WORLD.
//
// THESIS: not one Guarantee console, but the whole relationship in one authored environment. A boundary runs
// down the middle: on the BUILD side an AI agent ships a changed deployment; on the VRAELIS side the company's
// durable business requirements are held OUTSIDE the code, beyond the agent's reach, and Vraelis proves the
// live software against them, returning an independent conclusion with evidence and preserved history.
// The single idea the composition must land: "The agent can change the code. It cannot change what the business
// requires Vraelis to prove." Light-first, composed (not cards, not a flowchart, not a screenshot).
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { Ic, I } from "@/app/rank/_components/icons";

const GUARANTEES = [
  { short: "Paid customers retain access", tone: "verified" as const },
  { short: "Users stay inside their own workspace", tone: "verified" as const },
  { short: "Submitted records survive a reload", tone: "failed" as const },
];
const VTONE: Record<string, { fg: string; bg: string; line: string; label: string; mark: string }> = {
  verified: { fg: "var(--acc-deep)", bg: "var(--acc-soft)", line: "var(--acc-line)", label: "Verified", mark: I.check },
  failed: { fg: "#A8452A", bg: "#F6ECE7", line: "#E7CFC5", label: "Failed", mark: I.x },
};

export function HeroWorld() {
  const [lit, setLit] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return; started.current = true;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setLit(true); return; }
    const t = setTimeout(() => setLit(true), 240);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`w-world${lit ? " on" : ""}`} aria-label="How Vraelis relates to the code, the deployment, and the business requirements, illustrative">
      {/* BUILD SIDE: the agent ships a changed deployment. Mutable, subdued. */}
      <div className="w-build">
        <div className="w-zone-lbl">The build side</div>
        <div className="w-node w-agent"><span className="w-node__ic"><Ic d={I.code} size={15} sw={1.9} /></span><div><div className="w-node__t">AI coding agent</div><div className="w-node__d">writes and ships the change</div></div></div>
        <div className="w-drop" aria-hidden><Ic d={I.deploy} size={16} sw={1.8} /></div>
        <div className="w-node w-deploy"><span className="w-node__ic"><Ic d={I.deploy} size={15} sw={1.8} /></span><div><div className="w-node__t">Deployed application</div><div className="w-node__d w-mono">app.northwind.io, 8f21ad</div></div></div>
        <div className="w-build__note">The agent controls the code, the tests, and the claim that it is done.</div>
      </div>

      {/* THE BOUNDARY: requirements live outside the code. The agent cannot cross it. */}
      <div className="w-seam" aria-hidden>
        <div className="w-seam__line" />
        <div className="w-seam__tag">Outside the code</div>
        <div className="w-seam__line" />
      </div>

      {/* VRAELIS SIDE: durable Guarantees held by Vraelis, and the independent proof. */}
      <div className="w-vraelis">
        <div className="w-zone-lbl w-zone-lbl--acc">Held by Vraelis</div>
        <div className="w-guards">
          {GUARANTEES.map((g, i) => {
            const t = VTONE[g.tone];
            return (
              <div key={i} className="w-guard" style={{ transitionDelay: `${180 + i * 130}ms` }}>
                <span className="w-guard__anchor" aria-hidden><Ic d={I.lock} size={12} sw={1.9} /></span>
                <span className="w-guard__t">{g.short}</span>
                <span className="pill w-guard__pill" style={{ color: t.fg, background: t.bg, borderColor: t.line }}><Ic d={t.mark} size={10} sw={2.5} />{t.label}</span>
              </div>
            );
          })}
        </div>
        <div className="w-proof">
          <div className="w-proof__head"><span className="w-proof__ic"><Ic d={I.shield} size={14} sw={1.9} /></span>Vraelis proves the live software against them</div>
          <div className="w-proof__body">
            <div className="w-proof__line"><span className="w-dot" style={{ background: "#A8452A" }} /><b style={{ color: "#A8452A" }}>Failed</b> on 8f21ad, payment succeeded, access never granted</div>
            <div className="w-proof__line"><span className="w-dot" style={{ background: "var(--acc-deep)" }} /><b style={{ color: "var(--acc-deep)" }}>Verified</b> on 72c98e after the repair, access granted and retained</div>
            <div className="w-proof__hist">Every record preserved. A later pass never overwrites an earlier one.</div>
          </div>
        </div>
      </div>

      <HeroWorldStyles />
    </div>
  );
}

function HeroWorldStyles() {
  return (
    <style>{`
      .w-world { display: grid; grid-template-columns: minmax(0,0.82fr) 92px minmax(0,1.25fr); align-items: stretch; gap: 0; border: 1px solid var(--line-2); border-radius: var(--r-xl); background: var(--bg-1); box-shadow: var(--shadow-lg); overflow: hidden; }
      .w-zone-lbl { font-family: var(--font-code); font-size: 10px; letter-spacing: 0.09em; text-transform: uppercase; color: var(--fg-4); margin-bottom: 14px; }
      .w-zone-lbl--acc { color: var(--acc-deep); }

      .w-build { padding: clamp(20px,2.4vw,30px); background: var(--bg-2); display: flex; flex-direction: column; gap: 12px; position: relative; }
      .w-node { display: flex; align-items: center; gap: 11px; padding: 13px 14px; border: 1px solid var(--line-2); border-radius: 12px; background: var(--bg-1); }
      .w-node__ic { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; background: var(--bg-2); color: var(--fg-3); border: 1px solid var(--line-2); flex: none; }
      .w-node__t { font-size: 13.5px; font-weight: 600; color: var(--fg-1); }
      .w-node__d { font-size: 11.5px; color: var(--fg-4); margin-top: 1px; }
      .w-mono { font-family: var(--font-code); }
      .w-deploy { border-style: dashed; }
      .w-drop { display: grid; place-items: center; color: var(--fg-5); margin: -4px 0; }
      .w-build__note { font-size: 12px; color: var(--fg-4); line-height: 1.5; margin-top: 4px; }

      .w-seam { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; background: linear-gradient(var(--bg-2), var(--bg-1)); }
      .w-seam__line { width: 1px; flex: 1; background: repeating-linear-gradient(var(--line-3) 0 5px, transparent 5px 11px); }
      .w-seam__tag { writing-mode: vertical-rl; transform: rotate(180deg); font-family: var(--font-code); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--acc-deep); background: var(--acc-soft); border: 1px solid var(--acc-line); border-radius: 999px; padding: 10px 4px; }

      .w-vraelis { padding: clamp(20px,2.4vw,30px); display: flex; flex-direction: column; gap: 14px; }
      .w-guards { display: grid; gap: 8px; }
      .w-guard { display: flex; align-items: center; gap: 11px; padding: 12px 14px; border: 1px solid var(--line-2); border-radius: 12px; background: var(--bg-0); }
      .w-guard__anchor { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 999px; background: var(--acc-soft); color: var(--acc-deep); border: 1px solid var(--acc-line); flex: none; }
      .w-guard__t { flex: 1; min-width: 0; font-size: 13.5px; font-weight: 600; color: var(--fg-1); line-height: 1.3; }
      .w-guard__pill { flex: none; gap: 5px; }
      .w-proof { border: 1px solid var(--line-2); border-radius: 14px; background: var(--bg-0); padding: 15px 16px; }
      .w-proof__head { display: flex; align-items: center; gap: 9px; font-size: 12.5px; font-weight: 600; color: var(--fg-2); }
      .w-proof__ic { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; background: var(--acc-soft); color: var(--acc-deep); border: 1px solid var(--acc-line); flex: none; }
      .w-proof__body { margin-top: 11px; display: grid; gap: 8px; }
      .w-proof__line { display: flex; align-items: baseline; gap: 9px; font-size: 12.5px; color: var(--fg-3); line-height: 1.45; }
      .w-dot { width: 8px; height: 8px; border-radius: 999px; flex: none; transform: translateY(1px); }
      .w-proof__hist { font-family: var(--font-code); font-size: 10.5px; color: var(--fg-4); line-height: 1.5; margin-top: 4px; padding-top: 9px; border-top: 1px solid var(--line-2); }

      /* Reveal: the world settles in, guarantees anchoring one by one. */
      .w-build, .w-vraelis > .w-zone-lbl, .w-proof { transition: opacity .6s var(--ease-out), transform .6s var(--ease-out); }
      .w-guard { transition: opacity .55s var(--ease-out), transform .55s var(--ease-out); }
      .w-world:not(.on) .w-build, .w-world:not(.on) .w-proof { opacity: 0; transform: translateY(8px); }
      .w-world:not(.on) .w-guard { opacity: 0; transform: translateX(10px); }

      @media (max-width: 900px) {
        .w-world { grid-template-columns: 1fr; }
        .w-seam { flex-direction: row; padding: 10px 0; gap: 12px; }
        .w-seam__line { width: auto; height: 1px; flex: 1; background: repeating-linear-gradient(90deg, var(--line-3) 0 5px, transparent 5px 11px); }
        .w-seam__tag { writing-mode: horizontal-tb; transform: none; padding: 4px 10px; }
        .w-world:not(.on) .w-guard { transform: translateY(8px); }
      }
      @media (prefers-reduced-motion: reduce) {
        .w-build, .w-vraelis > .w-zone-lbl, .w-proof, .w-guard { transition: none !important; }
      }
    `}</style>
  );
}
