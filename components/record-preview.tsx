"use client";

// A VERIFICATION RECORD, AS THE CONSOLE SHOWS IT, FROM A REAL RUN.
//
// Used where a page needs to show the product rather than describe it: the homepage hero and the sign-in
// screen. Every value comes from a recorded production run in app/dev-preview/v6/_content/demos.ts (the
// checkout that forgets, run 3fad10f5, 22 Jul 2026): the sentence, the eleven steps with their recorded
// timings, the step that failed with what it expected and what it saw. Nothing is invented for effect.
//
// `replay` plays the steps in at their recorded pace (slowed so a person can follow) when the record scrolls
// into view, then says what it found and shows the repair prompt; it plays once, and a reader can replay
// it. Without `replay`, or with reduced motion, the finished record is shown as it is.
//
// The answer words (Verified, Failed) are not printed here (2026-09-30, the direction change recorded in
// app/dev-preview/v6/_system/positioning.ts rule 8): the chip says "Found a problem". The repair prompt is
// the product's own builder (lib/preflight/repair-prompt.ts) run over the recorded failure, not text
// written for this component.
//
// Self-contained styling (record-preview.css) with its own values, so it renders the same on the site's
// tokens and on the product's.
import { useEffect, useRef, useState } from "react";
import { DEMOS } from "@/app/dev-preview/v6/_content/demos";
import { buildRepairPrompt } from "@/lib/preflight/repair-prompt";
import "./record-preview.css";

const DEMO = DEMOS[0];
const RUN = DEMO.runs[0];
const STEPS = RUN.journeys[0].steps;
const HOST = DEMO.url.replace(/^https?:\/\//, "");
const DATE = new Date(RUN.recorded + "T12:00:00Z").toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

// The repair prompt a coding agent receives for this failure, built by the product from the record.
const FAIL_AT = STEPS.findIndex((s) => !s.ok);
const PROMPT = buildRepairPrompt({
  severity: "high", category: "persistence_failure", title: DEMO.title, requirement_refs: [],
  expected: RUN.failure?.expected ?? "", observed: RUN.failure?.observed ?? "",
  repro: STEPS.slice(0, FAIL_AT + 1).map((s, i) => `${i + 1}. ${s.say}`), possible_explanation: null,
  evidence: { failed_step_index: FAIL_AT, failed_action: STEPS[FAIL_AT]?.say ?? "", console_errors: [], network_failures: [], current_url: `${DEMO.url}/account.html` },
  status: "open",
}, { appName: DEMO.app.split(",")[0], deploymentUrl: DEMO.url });

export function RecordPreview({ replay = false, compact = false }: { replay?: boolean; compact?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(replay ? 0 : STEPS.length);
  const [run, setRun] = useState(0); // bump to replay

  useEffect(() => {
    if (!replay) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setShown(STEPS.length); return; }
    let timers: number[] = [];
    const start = () => {
      setShown(0);
      let t = 350;
      STEPS.forEach((s, i) => {
        // Recorded timings, slowed 2.5x and floored so the quick steps are still seen arriving.
        t += Math.max(220, Math.min(1400, s.ms * 2.5));
        timers.push(window.setTimeout(() => setShown(i + 1), t));
      });
    };
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { start(); io.disconnect(); }
    }, { threshold: 0.35 });
    io.observe(el);
    return () => { io.disconnect(); timers.forEach((x) => window.clearTimeout(x)); timers = []; };
  }, [replay, run]);

  const done = shown >= STEPS.length;
  const running = !done;
  const elapsed = STEPS.slice(0, shown).reduce((a, s) => a + s.ms, 0);
  // Compact shows the first steps, then the failing one, so the card stays short on narrow screens.
  const visible = STEPS.map((s, i) => ({ s, i })).filter(({ i }) => !compact || i < 3 || i >= STEPS.length - 2);

  return (
    <div ref={root} className="rp" data-state={done ? "failed" : "running"} aria-label="A recorded Vraelis check">
      <div className="rp__bar">
        <span className="rp__crumb"><span className="rp__crumbk">Checks</span><span aria-hidden>/</span><span className="rp__host">{HOST}</span></span>
        {done
          ? <span className="rp__chip rp__chip--fail"><span aria-hidden className="rp__dot" />Found a problem</span>
          : <span className="rp__chip rp__chip--run"><span aria-hidden className="rp__dot" />Checking</span>}
      </div>

      <div className="rp__head">
        <p className="rp__label">The sentence</p>
        <p className="rp__claim">{DEMO.claim}</p>
        <p className="rp__meta">
          <span>{RUN.journeys[0].steps.length} steps</span><span aria-hidden>·</span>
          <span>{running ? `${(elapsed / 1000).toFixed(1)} s` : `${RUN.seconds} s`}</span><span aria-hidden>·</span>
          <span>{DATE}</span><span aria-hidden>·</span><span>Plan approved by a person</span>
        </p>
      </div>

      <ol className="rp__steps">
        {visible.map(({ s, i }, k) => {
          const state = i < shown ? (s.ok ? "ok" : "fail") : i === shown ? "now" : "todo";
          const gap = compact && k === 3 && i >= STEPS.length - 2;
          return (
            <li key={i} className="rp__step" data-state={state}>
              {gap ? <span className="rp__gap" aria-hidden>{STEPS.length - 5} more steps</span> : null}
              <span className="rp__srow">
                <span className="rp__sico" aria-hidden />
                <span className="rp__sn">{String(i + 1).padStart(2, "0")}</span>
                <span className="rp__st">{s.say}</span>
                <span className="rp__sms">{i < shown ? `${s.ms} ms` : ""}</span>
              </span>
              {state === "fail" && RUN.failure ? (
                <span className="rp__diff">
                  <span><b>Expected</b>{RUN.failure.expected}</span>
                  <span><b>Observed</b>{RUN.failure.observed}</span>
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="rp__repair" data-open={done}>
        <div className="rp__rhead">
          <span>Repair prompt for a coding agent</span>
          <span className="rp__rbtns">
            <span className="rp__btn rp__btn--ghost">Copy</span>
            <span className="rp__btn">Re-check</span>
          </span>
        </div>
        <pre className="rp__prompt">{PROMPT}</pre>
      </div>

      {replay && done ? (
        <button type="button" className="rp__replay" onClick={() => { setShown(0); setRun((r) => r + 1); }}>Replay the run</button>
      ) : null}
    </div>
  );
}
