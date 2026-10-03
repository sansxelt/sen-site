"use client";

// A VERIFICATION RECORD, AS THE CONSOLE SHOWS IT, FROM A REAL RUN.
//
// Used where a page needs to show the product rather than describe it: the sign-in screen's side panel
// (app/_components/auth-frame.tsx) and _system/hero-asides.tsx. Every value comes from a recorded production
// run in app/dev-preview/v6/_content/demos.ts (the checkout that forgets, run 3fad10f5, 2026-07-22): the
// sentence, the eleven steps with their recorded timings, the step that found the problem with what it
// expected and what it saw. Nothing is invented for effect.
//
// `replay` plays the steps in at their recorded pace (slowed so a person can follow) when the record scrolls
// into view, then says what it found and shows the repair prompt; it plays once, and a reader can replay
// it. Without `replay`, or with reduced motion, the finished record is shown as it is.
//
// The answer words (Verified, Failed) are not printed here (2026-09-30, the direction change recorded in
// app/dev-preview/v6/_system/positioning.ts rule 8): the state reads "Found a problem". The repair prompt is
// the product's own builder (lib/preflight/repair-prompt.ts) run over the recorded failure, not text
// written for this component.
//
// 2026-10-02 (site plan, revision 2): no dots of any kind. The ring and tick circle on every step are gone,
// and so are the "·" separators in the meta row (its items sit 20px apart). The state is a plain word, not a
// chip; only the step that found the problem is coloured, because that is the row a reader has to find. The
// outer element carries data-panel (a product panel: the page's word budget skips it), the record's own words
// are data-no-translate (a translated step is not the step the run took), and the repair prompt, which
// scrolls, takes keyboard focus.
//
// Self-contained styling (record-preview.css) with its own values, so it renders the same on the site's
// tokens and on the product's.
import { useEffect, useId, useRef, useState } from "react";
import { DEMOS } from "@/app/dev-preview/v6/_content/demos";
import { buildRepairPrompt } from "@/lib/preflight/repair-prompt";
import "./record-preview.css";

const DEMO = DEMOS[0];
const RUN = DEMO.runs[0];
const STEPS = RUN.journeys[0].steps;
const HOST = DEMO.url.replace(/^https?:\/\//, "");
// Whole strings, so the page translator keys on each one as it is (never a number and a word in two nodes).
const STEP_COUNT = `${STEPS.length} steps`;
const MORE = `${STEPS.length - 5} more steps`;

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
  const promptHead = useId();
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
    <div ref={root} className="rp" data-panel="" data-state={done ? "failed" : "running"} role="figure" aria-label="A recorded Vraelis check">
      <div className="rp__bar">
        <span className="rp__crumb"><span className="rp__crumbk">Checks</span><span aria-hidden>/</span><span className="rp__host" data-no-translate>{HOST}</span></span>
        {done
          ? <span className="rp__state rp__state--fail">Found a problem</span>
          : <span className="rp__state">Checking the live app</span>}
      </div>

      <div className="rp__head">
        <p className="rp__label">The sentence</p>
        <p className="rp__claim" data-no-translate>{DEMO.claim}</p>
        <p className="rp__meta">
          <span>{STEP_COUNT}</span>
          <span className="rp__mono" data-no-translate>{running ? `${(elapsed / 1000).toFixed(1)} s` : `${RUN.seconds} s`}</span>
          <span className="rp__mono" data-no-translate>{RUN.recorded}</span>
          <span>Plan approved by a person</span>
        </p>
      </div>

      <ol className="rp__steps">
        {visible.map(({ s, i }, k) => {
          const state = i < shown ? (s.ok ? "ok" : "fail") : i === shown ? "now" : "todo";
          const gap = compact && k === 3 && i >= STEPS.length - 2;
          return (
            <li key={i} className="rp__step" data-state={state}>
              {gap ? <span className="rp__gap" aria-hidden>{MORE}</span> : null}
              <span className="rp__srow">
                <span className="rp__sn" data-no-translate>{String(i + 1).padStart(2, "0")}</span>
                <span className="rp__st" data-no-translate>{s.say}</span>
                <span className="rp__sms" data-no-translate>{i < shown ? `${s.ms} ms` : ""}</span>
              </span>
              {state === "fail" && RUN.failure ? (
                <span className="rp__diff">
                  <span><b>Expected</b><span data-no-translate>{RUN.failure.expected}</span></span>
                  <span><b>Observed</b><span data-no-translate>{RUN.failure.observed}</span></span>
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="rp__repair" data-open={done}>
        <div className="rp__rhead">
          <span id={promptHead}>Repair prompt for a coding agent</span>
          <span className="rp__rbtns" aria-hidden>
            <span className="rp__btn rp__btn--ghost">Copy</span>
            <span className="rp__btn">Re-check</span>
          </span>
        </div>
        {/* It scrolls, so it takes a keyboard stop (axe scrollable-region-focusable), named by its heading. */}
        <pre className="rp__prompt" role="region" aria-labelledby={promptHead} tabIndex={0}>{PROMPT}</pre>
      </div>

      {replay && done ? (
        <button type="button" className="rp__replay" onClick={() => { setShown(0); setRun((r) => r + 1); }}>Replay the run</button>
      ) : null}
    </div>
  );
}
