"use client";

// A VERIFICATION RECORD, AS THE CONSOLE SHOWS IT, FROM A REAL RUN.
//
// Used where a page needs to show the product rather than describe it: the homepage hero and the sign-in
// screen. Every value comes from a recorded production run in app/dev-preview/v6/_content/demos.ts (the
// checkout that forgets, run 3fad10f5, 22 Jul 2026): the sentence, the eleven steps with their recorded
// timings, the step that failed with what it expected and what it saw. Nothing is invented for effect.
//
// `replay` plays the steps in at their recorded pace (slowed so a person can follow) when the record scrolls
// into view, then stamps the decision and shows the repair prompt; it plays once, and a reader can replay
// it. Without `replay`, or with reduced motion, the finished record is shown as it is.
//
// Self-contained styling (record-preview.css) with its own values, so it renders the same on the site's
// tokens and on the product's.
import { useEffect, useRef, useState } from "react";
import { DEMOS } from "@/app/dev-preview/v6/_content/demos";
import "./record-preview.css";

const DEMO = DEMOS[0];
const RUN = DEMO.runs[0];
const STEPS = RUN.journeys[0].steps;
const HOST = DEMO.url.replace(/^https?:\/\//, "");
const DATE = new Date(RUN.recorded + "T12:00:00Z").toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

// The repair prompt a coding agent receives for this failure, in the product's own wording.
const PROMPT = [
  `A check of ${HOST} failed.`,
  `Checking: ${RUN.failure?.expected ?? ""}, after signing out and back in.`,
  `Observed: ${RUN.failure?.observed ?? ""}.`,
  "Reproduce: upgrade to Pro, start a fresh session, sign in, open /account.html.",
];

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
  const visible = STEPS.map((s, i) => ({ s, i })).filter(({ i }) => !compact || i < 4 || i >= STEPS.length - 2);

  return (
    <div ref={root} className="rp" data-state={done ? "failed" : "running"} aria-label="A recorded Vraelis verification">
      <div className="rp__bar">
        <span className="rp__crumb"><span className="rp__crumbk">Verification</span><span aria-hidden>/</span><span className="rp__host">{HOST}</span></span>
        {done
          ? <span className="rp__chip rp__chip--fail"><span aria-hidden className="rp__dot" />Failed</span>
          : <span className="rp__chip rp__chip--run"><span aria-hidden className="rp__dot" />Running</span>}
      </div>

      <div className="rp__head">
        <p className="rp__label">The claim</p>
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
          const gap = compact && k === 4 && i >= STEPS.length - 2;
          return (
            <li key={i} className="rp__step" data-state={state}>
              {gap ? <span className="rp__gap" aria-hidden>{STEPS.length - 6} more steps</span> : null}
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
        <pre className="rp__prompt">{PROMPT.join("\n")}</pre>
      </div>

      {replay && done ? (
        <button type="button" className="rp__replay" onClick={() => { setShown(0); setRun((r) => r + 1); }}>Replay the run</button>
      ) : null}
    </div>
  );
}
