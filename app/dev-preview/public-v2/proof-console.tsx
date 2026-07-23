"use client";

// The flagship, Phase 0B. Same state model as before (revealed count, playing, record selection, reduced-motion,
// keyboard, live region, pause-when-hidden/off-screen) — redesigned presentation: a dark verification instrument
// where the agent's claim enters as a signal, Vraelis's proof trace holds then BREAKS at the failing obligation,
// and the composition fractures into Expected vs Observed. Layer 1 (the business story) reads immediately; the
// full obligation list and metadata are progressive disclosure. All data is deterministic fixture data.

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { RECORDS, OBLIGATIONS, CLAIM, AGENT_CLAIM, type VerificationRecord, type StepState } from "./fixtures";

const STEP_MS = 780;
const FIRST_MS = 420;
const HOLD_MS = 2900;
const N = OBLIGATIONS.length;
const xPct = (i: number) => 5 + (i * 88) / (N - 1); // pip x position, %

function terminalStep(rec: VerificationRecord): number {
  if (!rec.failsAt) return N;
  return OBLIGATIONS.findIndex((o) => o.id === rec.failsAt) + 1;
}
function failIndex(rec: VerificationRecord): number {
  return rec.failsAt ? OBLIGATIONS.findIndex((o) => o.id === rec.failsAt) : -1;
}

export function ProofConsole() {
  const [recIdx, setRecIdx] = useState(0);
  const rec = RECORDS[recIdx];
  const term = terminalStep(rec);
  const fail = failIndex(rec);
  const [revealed, setRevealed] = useState(term); // SSR/no-JS/reduced-motion default = resolved
  const [playing, setPlaying] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedRef = useRef(false);
  const liveId = useId();
  const [announce, setAnnounce] = useState("");

  const concluded = revealed >= term;
  const conclusion = !concluded ? "running" : rec.conclusion;

  const load = useCallback((i: number, autoplay: boolean) => {
    const r = RECORDS[i];
    setRecIdx(i);
    setRevealed(autoplay && !reducedRef.current ? 0 : terminalStep(r));
    setPlaying(autoplay && !reducedRef.current);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    if (!mq.matches) { setRevealed(0); setPlaying(true); }
    const onC = (e: MediaQueryListEvent) => { reducedRef.current = e.matches; if (e.matches) setPlaying(false); };
    mq.addEventListener?.("change", onC);
    return () => mq.removeEventListener?.("change", onC);
  }, []);

  useEffect(() => {
    if (!playing || concluded) return;
    const t = window.setTimeout(() => setRevealed((r) => Math.min(r + 1, term)), revealed === 0 ? FIRST_MS : STEP_MS);
    return () => window.clearTimeout(t);
  }, [playing, revealed, concluded, term]);

  useEffect(() => {
    if (!playing || !concluded) return;
    const t = window.setTimeout(() => load((recIdx + 1) % RECORDS.length, true), HOLD_MS);
    return () => window.clearTimeout(t);
  }, [playing, concluded, recIdx, load]);

  useEffect(() => {
    const onVis = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener("visibilitychange", onVis);
    const el = rootRef.current;
    let io: IntersectionObserver | undefined;
    if (el && "IntersectionObserver" in window) {
      io = new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting) setPlaying(false); }), { threshold: 0.2 });
      io.observe(el);
    }
    return () => { document.removeEventListener("visibilitychange", onVis); io?.disconnect(); };
  }, []);

  useEffect(() => {
    if (concluded) setAnnounce(`${rec.label}. Conclusion: ${rec.conclusion === "verified" ? "Verified" : "Failed"}. ${rec.outcome}`);
    else if (revealed > 0) setAnnounce(`Checking: ${OBLIGATIONS[Math.min(revealed - 1, N - 1)].short.toLowerCase()}.`);
  }, [revealed, concluded, rec]);

  const stepTo = (n: number) => { setPlaying(false); setRevealed(Math.max(0, Math.min(n, term))); };
  const verified = rec.conclusion === "verified";
  const activeIdx = Math.max(0, revealed - 1);

  return (
    <div ref={rootRef} aria-label="Vraelis verification, replayable demonstration">
      {/* instrument status bar */}
      <div className="pv-bar">
        <span>Verification</span>
        <span style={{ color: "var(--fg-3)" }}>{rec.id}</span>
        <span>deploy {rec.commit}</span>
        <span className="sep" />
        <span className={`live${!concluded ? " on" : ""}`}>{concluded ? (verified ? "verified" : "failed") : "running"}</span>
      </div>

      {/* head: thesis + live verdict */}
      <div className="pv-flag-head">
        <div>
          <span className="pv-eyebrow pv-eyebrow-row"><span className="d" />The agent said it was done</span>
          <h1 className="pv-h1">The agent reported done.<br /><span className="lo">Vraelis read the live product.</span></h1>
        </div>
        <div className="pv-verdict-head">
          <div className={`pv-verdict pv-verdict--${conclusion}`}>{concluded ? (verified ? "Verified" : "Failed") : "Verifying"}</div>
          <div className="pv-verdict-sub">{concluded ? (verified ? "on the checked workflow" : "the claim did not hold") : `${revealed} of ${N} obligations`}</div>
        </div>
      </div>

      {/* the submitted claim (input) beside the proof trace */}
      <div className="pv-trace-wrap">
        <div className="pv-pkt pv-claim-input">
          <div className="pv-pkt-h"><span className="who">coding agent</span><span className="stamp">DONE</span></div>
          <div className="pv-pkt-b">{AGENT_CLAIM}</div>
        </div>
        <div className="pv-trace-col">
          <div className="pv-trace-plot" style={{ position: "relative", height: 150 }}>
          {/* horizontal signal line via absolutely-positioned segments (crisp round pips as HTML) */}
          <div style={{ position: "absolute", left: 0, right: 0, top: 62, height: 2 }}>
            {OBLIGATIONS.slice(0, N - 1).map((o, i) => {
              const shown = i < revealed - 1;
              const held = shown && rec.steps[i].state === "pass" && (i + 1 !== fail);
              const toBreak = i + 1 === fail && i < revealed; // segment leading into the failing pip
              return (
                <div key={o.id} className="pv-seg" style={{
                  position: "absolute", left: `${xPct(i)}%`, width: `${xPct(i + 1) - xPct(i)}%`, height: 2,
                  background: held || toBreak ? "var(--held)" : "var(--hair-2)",
                  boxShadow: held || toBreak ? "0 0 6px var(--held-glow)" : "none",
                  opacity: shown || toBreak ? 1 : 0.5,
                }} />
              );
            })}
            {/* the break drop */}
            {fail >= 0 && revealed > fail ? (
              <>
                <div style={{ position: "absolute", left: `${xPct(fail)}%`, top: 0, width: 2, height: 44, background: "var(--broke)", boxShadow: "0 0 8px var(--broke-glow)" }} />
                <div style={{ position: "absolute", left: `${xPct(fail)}%`, right: 0, top: 44, height: 2, background: "repeating-linear-gradient(90deg, var(--broke) 0 4px, transparent 4px 9px)", opacity: 0.5 }} />
              </>
            ) : null}
          </div>
          {/* pips */}
          {OBLIGATIONS.map((o, i) => {
            const st: StepState | "pending" = i < revealed ? rec.steps[i].state : concluded ? "skipped" : "pending";
            const isFail = st === "fail";
            const isActive = i === activeIdx && !concluded;
            return (
              <button key={o.id} type="button" onClick={() => stepTo(i + 1)} aria-label={`${o.short}: ${i < revealed ? (rec.steps[i].state === "pass" ? "held" : rec.steps[i].state === "fail" ? "did not hold" : "not reached") : "pending"}`}
                style={{
                  position: "absolute", left: `${xPct(i)}%`, top: 62, transform: "translate(-50%,-50%)",
                  width: isFail ? 18 : 13, height: isFail ? 18 : 13, borderRadius: "50%", cursor: "pointer", padding: 0,
                  border: `2px solid ${st === "pass" ? "var(--held)" : isFail ? "var(--broke)" : "var(--hair-2)"}`,
                  background: st === "pass" ? "var(--held)" : isFail ? "var(--broke)" : "var(--ink-1)",
                  boxShadow: st === "pass" ? "0 0 8px var(--held-glow)" : isFail ? "0 0 12px var(--broke-glow)" : isActive ? "0 0 0 4px rgba(92,229,213,0.15)" : "none",
                  transition: "all 0.3s cubic-bezier(.4,0,.2,1)", zIndex: 2,
                }} />
            );
          })}
          </div>
          <div className="pv-trace-labels">
            {OBLIGATIONS.map((o, i) => (
              <span key={o.id} className={i === fail ? "brk" : i < revealed && rec.steps[i].state === "pass" ? "held" : ""} style={{ left: `${xPct(i)}%` }}>{o.tag}</span>
            ))}
          </div>
        </div>
      </div>

      {/* mobile vertical trace */}
      <div className="pv-vtrace" aria-hidden>
        {OBLIGATIONS.map((o, i) => {
          const st: StepState | "pending" = i < revealed ? rec.steps[i].state : concluded ? "skipped" : "pending";
          return (
            <div key={o.id} className={`pv-vnode pv-vnode--${st}`}>
              <span className="pv-vrail" />
              <span className="pv-vbead">{st === "pass" ? <Chk /> : st === "fail" ? <Ex /> : null}</span>
              <span className="pv-vtitle">{o.short}</span>
              <span className="pv-vstate">{st === "pass" ? "held" : st === "fail" ? "broke" : st === "skipped" ? "—" : ""}</span>
            </div>
          );
        })}
      </div>

      {/* the fracture: expected vs observed (contradiction) or confirmation */}
      {concluded ? (
        <div className="pv-fracture">
          <div className="pv-frac-grid">
            <div className="pv-frac pv-frac--exp">
              <span className="pv-frac-k">Expected · {rec.evidence.atObligation}</span>
              <p className="pv-frac-v">{rec.evidence.expected}</p>
            </div>
            <div className={`pv-frac pv-frac--obs${verified ? " ok" : ""}`}>
              <span className="pv-frac-k" style={{ color: verified ? "var(--held-b)" : "var(--broke)" }}>Observed</span>
              <p className="pv-frac-v">{rec.evidence.observed}</p>
              <p className="pv-frac-cap">{rec.evidence.caption}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="pv-fracture"><div className="pv-frac--wait">{revealed > 0 ? rec.steps[activeIdx].observed : "Compiling the claim into proof obligations…"}</div></div>
      )}

      {/* controls */}
      <div className="pv-controls">
        <div className="pv-cgroup">
          <button type="button" className="pv-btn" onClick={() => load(recIdx, true)}>Replay</button>
          <button type="button" className="pv-btn pv-btn--primary" aria-pressed={playing} onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : "Play"}</button>
        </div>
        <div className="pv-scrub">
          <button type="button" className="pv-step" onClick={() => stepTo(revealed - 1)} disabled={revealed <= 0} aria-label="Previous obligation">‹</button>
          <span className="pv-scrub-l">{concluded ? "concluded" : `obligation ${revealed} of ${N}`}</span>
          <button type="button" className="pv-step" onClick={() => stepTo(revealed + 1)} disabled={revealed >= term} aria-label="Next obligation">›</button>
        </div>
      </div>

      {/* progressive disclosure: the full plan */}
      <details className="pv-disclose">
        <summary>All {N} proof obligations, compiled from the claim</summary>
        <p className="pv-verdict-sub" style={{ margin: "4px 0 8px" }}>{CLAIM}</p>
        <div className="pv-oblist">
          {OBLIGATIONS.map((o, i) => {
            const st: StepState | "pending" = i < revealed ? rec.steps[i].state : concluded ? "skipped" : "pending";
            return (
              <div key={o.id} className="pv-obrow" data-s={st}>
                <span className="i">{String(i + 1).padStart(2, "0")}</span>
                <span className="t">{o.short}</span>
                <span className="s">{st === "pass" ? "held" : st === "fail" ? "did not hold" : st === "skipped" ? "not reached" : "pending"}</span>
              </div>
            );
          })}
        </div>
      </details>

      {/* record tabs */}
      <div role="tablist" aria-label="Verification records" style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
        {RECORDS.map((r, i) => (
          <button key={r.id} type="button" role="tab" aria-selected={i === recIdx} onClick={() => load(i, false)}
            className="pv-btn" style={i === recIdx ? { borderColor: "var(--fg-2)", color: "var(--fg-1)" } : { color: "var(--fg-3)" }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, marginRight: 7, color: "var(--fg-4)" }}>{r.index}</span>
            {r.label}
            <span style={{ marginLeft: 8, fontFamily: "var(--mono)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: r.conclusion === "verified" ? "var(--held-b)" : "var(--broke)" }}>{r.conclusion === "verified" ? "Verified" : "Failed"}</span>
          </button>
        ))}
      </div>

      <span id={liveId} role="status" aria-live="polite" className="sr-only">{announce}</span>
    </div>
  );
}

function Chk() { return <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function Ex() { return <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" /></svg>; }
