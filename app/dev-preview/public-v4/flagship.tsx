"use client";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// PUBLIC-V4 FLAGSHIP — the Guarantee console.
//
// DIRECTION CONTRACT
// THESIS: the hero is not copy about a product, it IS the product's central object doing its job. A company's
//   critical business requirement, held as a durable Guarantee outside the code, is structured into proof,
//   approved once by a human, and set to be proven. Refuses the headline-beside-dashboard split, the browser
//   mockup, the fake terminal, and the miniature-product hero.
// OWN-WORLD: inherited Vraelis light identity, warm paper + emerald + Geist, the real verdict tones, soft
//   offset-shadow depth. The console is the surface; the requirement is the typographic anchor.
// STORY: in ten seconds, the visitor understands Vraelis holds a company's critical requirements as durable
//   Guarantees, outside the code, and independently proves each one, verification after verification.
// FORM: a controllable, stepped "birth of a Guarantee" sequence. The stage fills the width in three rows:
//   requirement + verdict/approval on top, the derived obligations and the reviewed plan side by side, then the
//   preserved verification record full width. Auto-plays once; pause / replay / step; the three Guarantees are
//   selectable; reduced-motion resolves to the finished state; keyboard operable; never loops.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { Ic, I } from "@/app/rank/_components/icons";
import { GUARANTEES, SYSTEM_NAME, type GStatus, type Verdict } from "./fixtures";

const TONE: Record<GStatus, { fg: string; bg: string; line: string; label: string; mark: string }> = {
  verified: { fg: "var(--acc-deep)", bg: "var(--acc-soft)", line: "var(--acc-line)", label: "Verified", mark: I.check },
  failed: { fg: "#A8452A", bg: "#F6ECE7", line: "#E7CFC5", label: "Failed", mark: I.x },
  blocked: { fg: "#7E6F43", bg: "#F2ECDD", line: "#E4D9BE", label: "Blocked", mark: I.dash },
  plan_review_required: { fg: "#B45309", bg: "#FEF6E7", line: "#F3DFB0", label: "Plan review required", mark: I.eye },
  unproven: { fg: "var(--fg-4)", bg: "var(--bg-2)", line: "var(--line-2)", label: "Unproven", mark: I.dash },
};
const VTONE: Record<Verdict, string> = { verified: "var(--acc-deep)", failed: "#A8452A", blocked: "#7E6F43" };
const VLABEL: Record<Verdict, string> = { verified: "Verified", failed: "Failed", blocked: "Blocked" };

// Reveal levels for the selected Guarantee. 0 = frame only; 5 = fully resolved.
const REQUIREMENT = 1, OBLIGATIONS = 2, PLAN = 3, APPROVAL = 4, STATUS = 5, MAX = 5;
const STEP_MS = [420, 950, 1100, 720, 650]; // per-beat dwell; uneven on purpose

function StatusPill({ status, size = 11 }: { status: GStatus; size?: number }) {
  const t = TONE[status];
  return (
    <span className="pill" style={{ fontSize: size, color: t.fg, background: t.bg, borderColor: t.line, flex: "none", whiteSpace: "nowrap" }}>
      <span aria-hidden style={{ display: "inline-flex", marginRight: 4 }}><Ic d={t.mark} size={11} sw={2.4} /></span>{t.label}
    </span>
  );
}

function Reveal({ at, step, children, style, className }: { at: number; step: number; children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  const shown = step >= at;
  return (
    <div className={`v4-reveal${className ? " " + className : ""}`} data-shown={shown ? "1" : "0"} style={style} aria-hidden={!shown}>
      {children}
    </div>
  );
}

function statusMeaning(status: GStatus, observed?: string): string {
  if (status === "unproven") return "Approved and ready. Not verified against a deployment yet.";
  if (status === "verified") return "Proven on the tested deployment, with evidence.";
  if (status === "failed") return observed ?? "The claim did not hold on the tested deployment.";
  if (status === "blocked") return "No verdict was reached on the tested deployment.";
  return "The plan changed since approval and needs review.";
}

export function Flagship() {
  const [selectedId, setSelectedId] = useState(GUARANTEES[0].id);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const started = useRef(false);
  const g = GUARANTEES.find((x) => x.id === selectedId) ?? GUARANTEES[0];

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setStep(MAX); setPlaying(false); } else { setStep(0); setPlaying(true); }
  }, []);

  useEffect(() => {
    if (!playing || step >= MAX) { if (step >= MAX && playing) setPlaying(false); return; }
    const t = setTimeout(() => setStep((s) => Math.min(MAX, s + 1)), STEP_MS[step] ?? 700);
    return () => clearTimeout(t);
  }, [playing, step]);

  const select = useCallback((id: string) => { setSelectedId(id); setStep(MAX); setPlaying(false); }, []);
  const togglePlay = useCallback(() => { if (step >= MAX) { setStep(0); setPlaying(true); } else setPlaying((p) => !p); }, [step]);
  const stepBack = useCallback(() => { setPlaying(false); setStep((s) => Math.max(0, s - 1)); }, []);
  const stepFwd = useCallback(() => { setPlaying(false); setStep((s) => Math.min(MAX, s + 1)); }, []);
  const done = step >= MAX;

  return (
    <div className="v4-console" role="group" aria-label="Vraelis Guarantee console, illustrative">
      <div className="v4-head">
        <div className="v4-head__brand">
          <span className="v4-thesis">AI builds. <span className="em">Vraelis proves.</span></span>
          <span className="v4-sys"><Ic d={I.layers} size={13} sw={1.9} /> {SYSTEM_NAME}<span className="v4-sys__crit">3 critical guarantees</span></span>
        </div>
        <div className="v4-controls" role="group" aria-label="Sequence controls">
          <button className="v4-ctl" onClick={togglePlay} aria-label={playing ? "Pause" : done ? "Replay" : "Play"}>
            <Ic d={playing ? "M8 5v14M16 5v14" : done ? I.retry : "M7 5v14l11-7z"} size={15} sw={1.9} />
            <span>{playing ? "Pause" : done ? "Replay" : "Play"}</span>
          </button>
          <button className="v4-ctl v4-ctl--icon" onClick={stepBack} aria-label="Step back" disabled={step <= 0}><Ic d="M15 6l-6 6 6 6" size={15} sw={2} /></button>
          <span className="v4-step" aria-hidden>{Math.min(step, MAX)} / {MAX}</span>
          <button className="v4-ctl v4-ctl--icon" onClick={stepFwd} aria-label="Step forward" disabled={done}><Ic d="M9 6l6 6-6 6" size={15} sw={2} /></button>
        </div>
      </div>

      <div className="v4-body">
        <nav className="v4-rail" aria-label="Guarantees">
          <div className="v4-rail__lbl">Guarantees</div>
          {GUARANTEES.map((x) => {
            const sel = x.id === selectedId;
            return (
              <button key={x.id} className={`v4-grow${sel ? " on" : ""}`} aria-pressed={sel} onClick={() => select(x.id)}>
                <span className="v4-grow__t">{x.short}</span>
                <StatusPill status={x.status} size={10} />
              </button>
            );
          })}
          <p className="v4-rail__note">What Northwind depends on, held outside the code.</p>
        </nav>

        <section className="v4-stage" aria-live="polite">
          {/* Top: the requirement (anchor), and its verdict + who approved it. */}
          <div className="v4-stage__top">
            <div className="v4-narr">
              <div className="v4-stage__eyebrow">Guarantee</div>
              <Reveal at={REQUIREMENT} step={step}><h2 className="v4-req">{g.requirement}</h2></Reveal>
            </div>
            <div className="v4-verdict">
              <Reveal at={STATUS} step={step}>
                <div className="v4-status"><StatusPill status={g.status} size={12} /></div>
                <p className="v4-status__txt">{statusMeaning(g.status, g.observed)}</p>
              </Reveal>
              <Reveal at={APPROVAL} step={step} style={{ marginTop: 14 }}>
                <div className="v4-approve"><span aria-hidden className="v4-approve__mark"><Ic d={I.check} size={12} sw={2.6} /></span>Human approval recorded<br />{g.approvedBy}, {g.approvedWhen}</div>
              </Reveal>
            </div>
          </div>

          {/* Middle: the derivation, side by side, filling the width. */}
          <div className="v4-stage__mid">
            <Reveal at={OBLIGATIONS} step={step}>
              <div className="v4-sec__lbl">Vraelis derives the proof</div>
              <ul className="v4-oblig">
                {g.obligations.map((o, i) => (
                  <li key={i} style={{ transitionDelay: `${done ? 0 : i * 90}ms` }}><span aria-hidden className="v4-oblig__dot" />{o}</li>
                ))}
              </ul>
            </Reveal>
            <Reveal at={PLAN} step={step}>
              <div className="v4-sec__lbl">Reviewed proof plan</div>
              <ol className="v4-plan">
                {g.plan.map((p, i) => <li key={i}><span aria-hidden className="v4-plan__n">{i + 1}</span>{p}</li>)}
              </ol>
            </Reveal>
          </div>

          {/* Bottom: the preserved verification record, full width. */}
          <div className="v4-stage__rec">
            <div className="v4-sec__lbl">Verification history, each record preserved</div>
            {g.history.length === 0 ? (
              <div className="v4-pending">
                <div className="v4-slot v4-slot--pending">
                  <span aria-hidden className="v4-slot__ring" />
                  <div><div className="v4-slot__t">First verification, pending</div><div className="v4-slot__d">No deployment tested yet.</div></div>
                </div>
                <p className="v4-record__note">Every verification becomes a separate record here, kept beside the ones before it. A later pass never overwrites an earlier one.</p>
              </div>
            ) : (
              <div className="v4-hist">
                {g.history.map((h, i) => (
                  <div key={i} className="v4-hrec">
                    <div className="v4-hrec__top"><span aria-hidden className="v4-hrec__dot" style={{ background: VTONE[h.verdict] }} /><span style={{ color: VTONE[h.verdict], fontWeight: 700 }}>{VLABEL[h.verdict]}</span> on <span className="v4-mono">{h.deployment}</span></div>
                    <div className="v4-hrec__when">{h.when}</div>
                    <div className="v4-hrec__note">{h.note}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="v4-next"><span className="v4-next__chip">Next</span> Reverify automatically on every new deployment</div>
          </div>
        </section>
      </div>

      <div className="v4-foot">Illustrative product, deterministic anonymized data. Public conclusions are Verified, Failed, or Blocked.</div>

      <FlagshipStyles />
    </div>
  );
}

function FlagshipStyles() {
  return (
    <style>{`
      .v4-console { border: 1px solid var(--line-2); border-radius: var(--r-xl); background: var(--bg-1); box-shadow: var(--shadow-lg); overflow: hidden; display: flex; flex-direction: column; }
      .v4-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: clamp(14px,1.8vw,20px) clamp(16px,2.2vw,26px); border-bottom: 1px solid var(--line-2); background: var(--bg-0); flex-wrap: wrap; }
      .v4-head__brand { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
      .v4-thesis { font-family: var(--font-display); font-weight: 600; font-size: clamp(1rem, 1.5vw, 1.28rem); letter-spacing: -0.02em; color: var(--fg-1); }
      .v4-sys { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--fg-3); }
      .v4-sys__crit { font-family: var(--font-code); font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fg-4); border-left: 1px solid var(--line-2); padding-left: 8px; margin-left: 2px; }
      .v4-controls { display: inline-flex; align-items: center; gap: 6px; flex: none; }
      .v4-ctl { display: inline-flex; align-items: center; gap: 7px; padding: 7px 12px; border-radius: 999px; border: 1px solid var(--line-2); background: var(--bg-1); color: var(--fg-2); font-family: var(--font-display); font-size: 12.5px; font-weight: 500; cursor: pointer; transition: border-color .15s ease, color .15s ease; }
      .v4-ctl:hover { border-color: var(--line-3); color: var(--fg-1); }
      .v4-ctl--icon { padding: 7px 8px; }
      .v4-ctl:disabled { opacity: .4; cursor: default; }
      .v4-step { font-family: var(--font-code); font-size: 11.5px; color: var(--fg-4); font-variant-numeric: tabular-nums; min-width: 32px; text-align: center; }

      .v4-body { display: grid; grid-template-columns: 258px minmax(0,1fr); align-items: stretch; min-height: clamp(420px, 58vh, 560px); }
      .v4-rail { border-right: 1px solid var(--line-2); background: var(--bg-0); padding: clamp(14px,1.8vw,20px); display: flex; flex-direction: column; gap: 8px; }
      .v4-rail__lbl { font-family: var(--font-code); font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-4); margin-bottom: 4px; }
      .v4-grow { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 13px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--bg-1); cursor: pointer; text-align: left; transition: border-color .15s ease, background .15s ease, transform .15s ease; }
      .v4-grow:hover { border-color: var(--line-3); transform: translateY(-1px); }
      .v4-grow.on { border-color: var(--acc-line); background: var(--acc-soft); box-shadow: inset 0 0 0 1px var(--acc-line); }
      .v4-grow__t { font-size: 13px; font-weight: 600; color: var(--fg-1); line-height: 1.3; }
      .v4-rail__note { font-size: 11.5px; color: var(--fg-4); line-height: 1.5; margin: 8px 2px 0; }

      .v4-stage { padding: clamp(20px,2.8vw,34px) clamp(20px,2.8vw,38px); min-width: 0; display: flex; flex-direction: column; }
      .v4-stage__top { display: grid; grid-template-columns: minmax(0,1.25fr) minmax(0,0.85fr); gap: clamp(20px,3vw,44px); align-items: start; }
      .v4-narr { min-width: 0; }
      .v4-stage__eyebrow { font-family: var(--font-code); font-size: 10.5px; letter-spacing: 0.09em; text-transform: uppercase; color: var(--acc-deep); margin-bottom: 12px; }
      .v4-req { font-family: var(--font-display); font-weight: 600; font-size: clamp(1.55rem, 3vw, 2.7rem); line-height: 1.08; letter-spacing: -0.022em; color: var(--fg-1); margin: 0; max-width: 15ch; text-wrap: balance; }
      .v4-verdict { min-width: 0; }
      .v4-status { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .v4-status__txt { font-size: 13px; color: var(--fg-3); line-height: 1.5; margin: 8px 0 0; }
      .v4-approve { display: inline-flex; align-items: center; gap: 10px; font-size: 12.5px; color: var(--fg-2); font-weight: 500; line-height: 1.45; padding: 11px 13px; border: 1px solid var(--acc-line); background: var(--acc-soft); border-radius: 12px; }
      .v4-approve__mark { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 999px; background: var(--acc-deep); color: #fff; flex: none; }

      .v4-stage__mid { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: clamp(20px,2.6vw,40px); margin-top: clamp(22px,2.8vw,32px); }
      .v4-sec__lbl { font-family: var(--font-code); font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-4); margin-bottom: 10px; }
      .v4-oblig { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
      .v4-oblig li { display: flex; gap: 10px; align-items: flex-start; font-size: 14px; color: var(--fg-2); line-height: 1.5; }
      .v4-oblig__dot { width: 5px; height: 5px; border-radius: 999px; background: var(--acc-deep); flex: none; margin-top: 8px; }
      .v4-plan { list-style: none; margin: 0; padding: 0; display: grid; gap: 7px; }
      .v4-plan li { display: flex; gap: 11px; align-items: flex-start; font-size: 13.5px; color: var(--fg-2); line-height: 1.45; padding: 9px 12px; border: 1px solid var(--line-2); border-radius: 10px; background: var(--bg-0); }
      .v4-plan__n { font-family: var(--font-code); font-size: 11px; color: var(--fg-5); flex: none; margin-top: 1px; width: 12px; }

      .v4-stage__rec { margin-top: clamp(22px,2.8vw,32px); padding-top: clamp(18px,2.2vw,24px); border-top: 1px solid var(--line-2); }
      .v4-pending { display: grid; gap: 10px; }
      .v4-slot { display: flex; gap: 11px; align-items: center; padding: 12px 14px; border-radius: 10px; }
      .v4-slot--pending { border: 1px dashed var(--line-3); background: var(--bg-0); max-width: 420px; }
      .v4-slot__ring { width: 10px; height: 10px; border-radius: 999px; border: 1.5px solid var(--fg-4); flex: none; }
      .v4-slot__t { font-size: 13px; color: var(--fg-2); font-weight: 600; line-height: 1.3; }
      .v4-slot__d { font-size: 12px; color: var(--fg-4); margin-top: 1px; }
      .v4-record__note { font-size: 12.5px; color: var(--fg-4); line-height: 1.55; margin: 0; max-width: 62ch; }
      .v4-hist { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 10px; }
      .v4-hrec { padding: 12px 14px; border: 1px solid var(--line-2); border-radius: 12px; background: var(--bg-0); }
      .v4-hrec__top { display: flex; align-items: center; gap: 7px; font-size: 13px; color: var(--fg-2); }
      .v4-hrec__dot { width: 9px; height: 9px; border-radius: 999px; flex: none; }
      .v4-hrec__when { font-family: var(--font-code); font-size: 11px; color: var(--fg-4); margin-top: 4px; }
      .v4-hrec__note { font-size: 12.5px; color: var(--fg-4); line-height: 1.5; margin-top: 6px; }
      .v4-mono { font-family: var(--font-code); font-size: 12px; }
      .v4-next { display: flex; align-items: center; gap: 9px; margin-top: 14px; font-size: 12.5px; color: var(--fg-4); }
      .v4-next__chip { font-family: var(--font-code); font-size: 10px; letter-spacing: 0.07em; text-transform: uppercase; color: var(--acc-deep); background: var(--acc-soft); border: 1px solid var(--acc-line); border-radius: 999px; padding: 3px 9px; flex: none; }
      .v4-foot { padding: 12px clamp(16px,2.2vw,26px); border-top: 1px solid var(--line-2); background: var(--bg-0); font-family: var(--font-code); font-size: 10.5px; color: var(--fg-4); letter-spacing: 0.02em; }

      .v4-reveal { transition: opacity .5s var(--ease-out), transform .5s var(--ease-out); }
      .v4-reveal[data-shown="0"] { opacity: 0; transform: translateY(8px); pointer-events: none; }
      .v4-reveal[data-shown="1"] { opacity: 1; transform: none; }
      .v4-oblig li { transition: opacity .45s var(--ease-out), transform .45s var(--ease-out); }
      .v4-reveal[data-shown="0"] .v4-oblig li { opacity: 0; transform: translateY(4px); }

      @media (max-width: 960px) { .v4-stage__top, .v4-stage__mid { grid-template-columns: 1fr; gap: 22px; } .v4-req { max-width: 24ch; } .v4-slot--pending { max-width: none; } }
      @media (max-width: 860px) {
        .v4-body { grid-template-columns: 1fr; min-height: 0; }
        .v4-rail { border-right: none; border-bottom: 1px solid var(--line-2); flex-direction: row; flex-wrap: wrap; align-items: center; gap: 8px; }
        .v4-rail__lbl { width: 100%; }
        .v4-grow { flex: 1 1 180px; min-width: 0; }
        .v4-rail__note { display: none; }
      }
      @media (max-width: 520px) {
        .v4-head { gap: 12px; }
        .v4-grow { flex-basis: 100%; }
        .v4-req { font-size: clamp(1.45rem, 7.5vw, 1.85rem); max-width: none; }
      }
      @media (prefers-reduced-motion: reduce) {
        .v4-reveal, .v4-oblig li { transition: none !important; }
        .v4-grow { transition: none !important; }
      }
    `}</style>
  );
}
