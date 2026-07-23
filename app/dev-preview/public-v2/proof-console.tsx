"use client";

// The flagship interaction. A claim compiles into proof obligations, Vraelis executes them against a pinned
// deployment, the evidence contradicts the agent at the failing obligation, and the gapped ring resolves to a
// conclusion. Three separate historical records (Failed, Failed, Verified) sit beneath and can be loaded in.
//
// Design principles honored here (from the reference study): the product artifact IS the artwork; motion only
// ever reflects a real state change (a step resolving pass/fail), never decorates; color is quarantined to the
// verdict. Accessibility: every control is a real button, the live phase is announced politely without moving
// focus, reduced-motion holds the resolved state instead of auto-playing, and the component SSRs a fully
// readable resolved frame so the story survives with JavaScript disabled. All data is deterministic fixture
// data - this never executes a live customer deployment.

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  RECORDS, OBLIGATIONS, CLAIM, CONCLUSION_META,
  type VerificationRecord, type StepState, type EvidenceFrame,
} from "./fixtures";

const STEP_MS = 880;      // steady, watchable cadence (not the real per-step ms, which vary 0.9-5.2s)
const FIRST_MS = 420;
const HOLD_MS = 2700;     // dwell on a conclusion before advancing to the next record

function terminalStep(rec: VerificationRecord): number {
  if (!rec.failsAt) return OBLIGATIONS.length;
  return OBLIGATIONS.findIndex((o) => o.id === rec.failsAt) + 1;
}

// ── tiny inline glyphs (no icon dependency; all aria-hidden, meaning carried by text) ──
function Glyph({ kind, size = 12 }: { kind: StepState | "ring"; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true as const };
  if (kind === "pass") return <svg {...common}><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (kind === "fail") return <svg {...common}><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" /></svg>;
  return <svg {...common}><circle cx="8" cy="8" r="2.4" fill="currentColor" /></svg>;
}

// ── the gapped ring: the brand mark, driven by verification state. The center is the claim being checked; the
// swept arc is independent verification. Completion = a near-closed ring with the signature gap (Verified);
// interruption = the arc stops and breaks at the point of contradiction (Failed). ──
function RingMark({ fraction, conclusion, concluded }: { fraction: number; conclusion: "verified" | "failed" | "running"; concluded: boolean }) {
  const R = 52, C = 2 * Math.PI * R;
  const meta = CONCLUSION_META[conclusion];
  // Verified rings close to the signature gap (0.9); a running/failed arc reflects real progress.
  const shown = conclusion === "verified" && concluded ? 0.9 : Math.min(fraction, 0.9);
  const dash = C * shown;
  return (
    <div className={`pv-ring pv-ring--${conclusion}`} data-concluded={concluded ? "y" : "n"}>
      <svg viewBox="0 0 128 128" width="100%" height="100%" aria-hidden>
        <circle cx="64" cy="64" r={R} className="pv-ring-track" fill="none" strokeWidth={3} />
        <circle
          cx="64" cy="64" r={R} fill="none" strokeWidth={4} strokeLinecap="round"
          className="pv-ring-arc"
          stroke={meta.ink}
          strokeDasharray={`${dash} ${C}`}
          transform="rotate(-90 64 64)"
        />
        {concluded && conclusion === "failed" ? (
          // the break: a short mark at the point the arc stops
          <g transform={`rotate(${-90 + shown * 360} 64 64)`}>
            <line x1={64 + R - 7} y1="64" x2={64 + R + 7} y2="64" stroke={meta.ink} strokeWidth={3} strokeLinecap="round" />
          </g>
        ) : null}
      </svg>
      <div className="pv-ring-center">
        {concluded ? (
          <>
            <span className="pv-ring-verdict" style={{ color: meta.ink }}>{meta.label}</span>
            <span className="pv-ring-scope">on the checked workflow</span>
          </>
        ) : (
          <>
            <span className="pv-ring-count">{Math.round(fraction * OBLIGATIONS.length)}<span className="pv-ring-of">/{OBLIGATIONS.length}</span></span>
            <span className="pv-ring-scope">obligations checked</span>
          </>
        )}
      </div>
    </div>
  );
}

// ── the stylized evidence frame — a depiction of the app state at the moment of contradiction. NOT a real
// screenshot: an evidence object with its own capture metadata, expected-vs-observed framing. ──
function EvidenceFrameView({ frame }: { frame: EvidenceFrame }) {
  const pro = frame === "plan-pro";
  return (
    <div className="pv-frame" aria-hidden>
      <div className="pv-frame-bar"><span className="pv-frame-dot" /><span className="pv-frame-dot" /><span className="pv-frame-dot" /><span className="pv-frame-url">northwind-store.example/account</span></div>
      <div className="pv-frame-body">
        <div className="pv-frame-row"><span className="pv-frame-k">Account</span><span className="pv-frame-v">buyer-7f3</span></div>
        <div className="pv-frame-row">
          <span className="pv-frame-k">Plan</span>
          <span className={`pv-plan ${pro ? "pv-plan--pro" : "pv-plan--free"}`}>{pro ? "Pro" : "Free"}</span>
        </div>
        <div className="pv-frame-note">{pro ? "Pro capability reachable" : "Upgrade charged · Pro not applied"}</div>
      </div>
    </div>
  );
}

export function ProofConsole() {
  const [recIdx, setRecIdx] = useState(0);
  const rec = RECORDS[recIdx];
  const term = terminalStep(rec);
  // revealed 0..term. SSR default = term so a no-JS / reduced-motion visitor sees the resolved record.
  const [revealed, setRevealed] = useState(term);
  const [playing, setPlaying] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedRef = useRef(false);
  const liveId = useId();
  const [announce, setAnnounce] = useState("");

  const concluded = revealed >= term;
  const conclusion = !concluded ? "running" : rec.conclusion;
  const fraction = revealed / OBLIGATIONS.length;

  // Load a record. autoplay=true resets to the start and plays; otherwise jumps to the resolved frame.
  const load = useCallback((i: number, autoplay: boolean) => {
    const r = RECORDS[i];
    setRecIdx(i);
    setRevealed(autoplay && !reducedRef.current ? 0 : terminalStep(r));
    setPlaying(autoplay && !reducedRef.current);
  }, []);

  // On mount: honor reduced-motion. Motion on -> rewind and auto-play the story; motion reduced -> hold resolved.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    if (!mq.matches) { setRevealed(0); setPlaying(true); }
    const onChange = (e: MediaQueryListEvent) => { reducedRef.current = e.matches; if (e.matches) setPlaying(false); };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // Advance within the record.
  useEffect(() => {
    if (!playing || concluded) return;
    const t = window.setTimeout(() => setRevealed((r) => Math.min(r + 1, term)), revealed === 0 ? FIRST_MS : STEP_MS);
    return () => window.clearTimeout(t);
  }, [playing, revealed, concluded, term]);

  // Hold on the conclusion, then advance to the next record (loops the Failed -> Failed -> Verified story).
  useEffect(() => {
    if (!playing || !concluded) return;
    const t = window.setTimeout(() => load((recIdx + 1) % RECORDS.length, true), HOLD_MS);
    return () => window.clearTimeout(t);
  }, [playing, concluded, recIdx, load]);

  // Pause when the tab is hidden or the console scrolls out of view (never fight the reader, never burn cycles).
  useEffect(() => {
    const onVis = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener("visibilitychange", onVis);
    const el = rootRef.current;
    let io: IntersectionObserver | undefined;
    if (el && "IntersectionObserver" in window) {
      io = new IntersectionObserver((es) => { es.forEach((e) => { if (!e.isIntersecting) setPlaying(false); }); }, { threshold: 0.25 });
      io.observe(el);
    }
    return () => { document.removeEventListener("visibilitychange", onVis); io?.disconnect(); };
  }, []);

  // Announce phase / conclusion politely (does not move focus).
  useEffect(() => {
    if (concluded) {
      setAnnounce(`${rec.label}. Conclusion: ${CONCLUSION_META[rec.conclusion].label}. ${rec.outcome}`);
    } else {
      const ob = OBLIGATIONS[Math.max(0, revealed - 1)];
      if (revealed > 0) setAnnounce(`Checking ${ob.short.toLowerCase()}.`);
    }
  }, [revealed, concluded, rec]);

  const stepTo = (n: number) => { setPlaying(false); setRevealed(Math.max(0, Math.min(n, term))); };
  const meta = CONCLUSION_META[conclusion];
  const activeIdx = Math.max(0, revealed - 1);

  return (
    <div className="pv-console" ref={rootRef} aria-label="Vraelis verification, replayable demonstration">
      {/* instrument status bar */}
      <div className="pv-bar">
        <span className="pv-bar-lead"><span className={`pv-live ${!concluded ? "pv-live--on" : ""}`} aria-hidden />Verification</span>
        <span className="pv-bar-id">{rec.id}</span>
        <span className="pv-bar-chip" style={{ color: meta.ink, background: meta.bg, borderColor: meta.line }}>
          {concluded ? meta.label : "Verifying"}
        </span>
      </div>

      {/* claim */}
      <div className="pv-claim">
        <span className="pv-eyebrow">Submitted claim</span>
        <p className="pv-claim-text">{CLAIM}</p>
        <span className="pv-claim-meta">Pinned deployment <b>{rec.deployment}</b> · commit {rec.commit}</span>
      </div>

      <div className="pv-grid">
        {/* left: the proof path through the compiled obligations */}
        <div className="pv-spine" role="list" aria-label="Proof obligations">
          {OBLIGATIONS.map((o, i) => {
            const step = rec.steps[i];
            const shown = i < revealed;
            // Reached -> its real result; beyond a concluded run -> not reached (skipped); otherwise pending.
            const st: StepState | "pending" = shown ? step.state : concluded ? "skipped" : "pending";
            const isActive = i === activeIdx && !concluded;
            const isBreak = shown && step.state === "fail";
            return (
              <button
                key={o.id}
                type="button"
                role="listitem"
                className={`pv-node pv-node--${st}${isActive ? " pv-node--active" : ""}${isBreak ? " pv-node--break" : ""}`}
                onClick={() => stepTo(i + 1)}
                aria-current={isActive ? "step" : undefined}
              >
                <span className="pv-rail" aria-hidden />
                <span className="pv-bead" aria-hidden>
                  {st === "pass" ? <Glyph kind="pass" /> : st === "fail" ? <Glyph kind="fail" /> : st === "skipped" ? null : <Glyph kind="ring" />}
                </span>
                <span className="pv-node-body">
                  <span className="pv-node-title">{o.short}</span>
                  <span className="pv-node-obs">
                    {shown
                      ? step.observed
                      : <span className="pv-node-action">{o.action}</span>}
                  </span>
                </span>
                <span className="pv-node-state" aria-hidden>
                  {st === "pass" ? "held" : st === "fail" ? "did not hold" : st === "skipped" ? "not reached" : shown ? "" : ""}
                </span>
              </button>
            );
          })}
        </div>

        {/* right: the ring, the conclusion, and the representative evidence */}
        <div className="pv-side">
          <RingMark fraction={fraction} conclusion={conclusion} concluded={concluded} />

          <div className="pv-verdict">
            <div className="pv-verdict-head">
              <span className="pv-verdict-chip" style={{ color: meta.ink, background: meta.bg, borderColor: meta.line }}>{concluded ? meta.label : "Verifying"}</span>
              <span className="pv-verdict-scope">{concluded ? "on the checked workflow" : `${revealed} of ${OBLIGATIONS.length}`}</span>
            </div>
            <p className="pv-verdict-outcome">{concluded ? rec.outcome : (revealed > 0 ? rec.steps[activeIdx].observed : "Compiling the claim into proof obligations…")}</p>
          </div>

          {/* one representative evidence expansion, shown once the contradiction (or confirmation) is reached */}
          {concluded ? (
            <div className="pv-evidence">
              <span className="pv-eyebrow">Evidence · {rec.evidence.label}</span>
              <div className="pv-ev-cols">
                <div className="pv-ev-col"><span className="pv-ev-k">Expected</span><span className="pv-ev-v">{rec.evidence.expected}</span></div>
                <div className="pv-ev-col"><span className="pv-ev-k">Observed</span><span className="pv-ev-v" style={{ color: rec.conclusion === "verified" ? "#0A7B54" : "#A8452A" }}>{rec.evidence.observed}</span></div>
              </div>
              <EvidenceFrameView frame={rec.evidence.frame} />
              <span className="pv-ev-cap">{rec.evidence.caption}</span>
            </div>
          ) : (
            <div className="pv-evidence pv-evidence--wait"><span className="pv-eyebrow">Evidence</span><span className="pv-ev-cap">Retained as each obligation is checked.</span></div>
          )}
        </div>
      </div>

      {/* controls */}
      <div className="pv-controls">
        <div className="pv-ctrl-group">
          <button type="button" className="pv-btn" onClick={() => load(recIdx, true)}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M8 3V1L5 4l3 3V5a3.2 3.2 0 1 1-3.2 3.2" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
            Replay
          </button>
          <button type="button" className="pv-btn pv-btn--primary" aria-pressed={playing} onClick={() => setPlaying((p) => !p)}>
            {playing
              ? <><svg width="12" height="12" viewBox="0 0 16 16" aria-hidden><rect x="4" y="3" width="3" height="10" fill="currentColor" /><rect x="9" y="3" width="3" height="10" fill="currentColor" /></svg>Pause</>
              : <><svg width="12" height="12" viewBox="0 0 16 16" aria-hidden><path d="M4 3l9 5-9 5z" fill="currentColor" /></svg>Play</>}
          </button>
        </div>
        <div className="pv-scrub">
          <button type="button" className="pv-step" onClick={() => stepTo(revealed - 1)} disabled={revealed <= 0} aria-label="Previous obligation">‹</button>
          <span className="pv-scrub-label">{concluded ? "concluded" : `obligation ${revealed} of ${OBLIGATIONS.length}`}</span>
          <button type="button" className="pv-step" onClick={() => stepTo(revealed + 1)} disabled={revealed >= term} aria-label="Next obligation">›</button>
        </div>
      </div>

      {/* three separate historical records */}
      <div className="pv-lineage" role="tablist" aria-label="Verification records">
        {RECORDS.map((r, i) => {
          const m = CONCLUSION_META[r.conclusion];
          const sel = i === recIdx;
          return (
            <button key={r.id} type="button" role="tab" aria-selected={sel} className={`pv-rec${sel ? " pv-rec--sel" : ""}`} onClick={() => load(i, false)}>
              <span className="pv-rec-top"><span className="pv-rec-n">{r.index}</span><span className="pv-rec-chip" style={{ color: m.ink, background: m.bg, borderColor: m.line }}>{m.label}</span></span>
              <span className="pv-rec-label">{r.label}</span>
              <span className="pv-rec-out">{r.outcome}</span>
              <span className="pv-rec-id">{r.id}</span>
            </button>
          );
        })}
      </div>
      <p className="pv-lineage-note">Each attempt is a separate, preserved historical record. A later Verified never overwrites an earlier failure.</p>

      <span id={liveId} role="status" aria-live="polite" className="sr-only">{announce}</span>
    </div>
  );
}
