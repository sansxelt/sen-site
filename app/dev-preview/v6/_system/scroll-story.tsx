"use client";

/* HOW A CHECK WORKS, AS ONE PINNED SCENE (2026-10-01).

   Adapted from scale.com's scroll presentation (a layered 3D object that holds the middle of the screen
   while the chapter under it changes), as the founder asked: adapted, not copied. Four chapters, one line
   each: say it, a person approves it, a real browser runs it, you see what happened.

   EVERY PANEL IS THE PRODUCT'S OWN OUTPUT FOR ONE REAL RUN: the "before the fix" checkout run on Lumen Notes,
   a Vraelis demo app (_content/demos.ts, record 3fad10f5). The sentence, the eleven planned steps and their
   recorded timings, the failure, the screenshot, and the repair prompt, which is built by the product's own
   builder (lib/preflight/repair-prompt.ts) from that failure. The caption under the scene says so.

   Desktop pins the scene and scrubs it from scroll (progress.ts). Phones, short screens and reduced motion
   get the four chapters as plain blocks in their finished state: nothing is pinned where it cannot be left. */
import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { DEMOS } from "../_content/demos";
import { buildRepairPrompt } from "@/lib/preflight/repair-prompt";
import { useScrollProgress } from "./progress";
import "./scroll-story.css";

const DEMO = DEMOS[0];
const RUN = DEMO.runs[0];
const STEPS = RUN.journeys[0].steps;
const HOST = new URL(DEMO.url).host;
const CLAIM = DEMO.claim ?? "";
// One string, so the page translator sees one sentence rather than three fragments.
const CAPTION = `A real recorded run on ${DEMO.app.split(",")[0]}, a Vraelis demo app.`;

const CHAPTERS = [
  { t: "Say what should work.", d: "One sentence, from the console, your terminal or your coding agent." },
  { t: "A person approves the plan.", d: "Vraelis writes the steps. Nothing runs until a person says yes, and an agent never can." },
  { t: "A real browser checks the live product.", d: "Production, staging or a preview, used the way a person would." },
  { t: "See exactly what happened.", d: "Every step, a screenshot, and a repair prompt your agent can act on." },
];

const fmt = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function useRepairPrompt() {
  return useMemo(() => {
    const f = RUN.failure!;
    const at = STEPS.findIndex((s) => !s.ok);
    return buildRepairPrompt({
      severity: "high", category: "persistence_failure", title: DEMO.title,
      requirement_refs: [], expected: f.expected, observed: f.observed,
      repro: STEPS.slice(0, at + 1).map((s, i) => `${i + 1}. ${s.say}`),
      possible_explanation: null,
      evidence: { failed_step_index: at, failed_action: STEPS[at]?.say ?? "", console_errors: [], network_failures: [], current_url: `${DEMO.url}/account.html` },
      status: "open",
    }, { appName: DEMO.app.split(",")[0], deploymentUrl: DEMO.url });
  }, []);
}

/* ── the four panels; `k` is the progress inside the chapter, 0 to 1 (1 = finished) ── */

function Compose({ k }: { k: number }) {
  const n = Math.round(clamp01(k / 0.8) * CLAIM.length);
  return (
    <div className="ss-p">
      <div className="ss-p__bar"><span className="ss-p__mark">V</span><span>New verification</span></div>
      <div className="ss-p__body">
        <div className="ss-tabs" aria-hidden><span data-on="true">Console</span><span>Terminal</span><span>AI agent</span></div>
        <p className="ss-k">Live address</p>
        <div className="ss-field ss-mono">https://{HOST}</div>
        <p className="ss-k">What should be true</p>
        <div className="ss-field ss-field--tall">{CLAIM.slice(0, n)}<span className="ss-caret" data-on={n < CLAIM.length} /></div>
        <div className="ss-row"><span className="ss-note">Reviewing a plan is free.</span><span className="ss-btn" data-ready={n >= CLAIM.length}>Review the plan</span></div>
      </div>
    </div>
  );
}

function Plan({ k }: { k: number }) {
  const approved = k > 0.72;
  return (
    <div className="ss-p">
      <div className="ss-p__bar"><span className="ss-p__mark">V</span><span>Plan</span><span className="ss-chip" data-s={approved ? "ok" : "wait"}>{approved ? "Approved by a person" : "Waiting for approval"}</span></div>
      <div className="ss-p__body">
        <p className="ss-claim">{CLAIM}</p>
        <ol className="ss-plan">
          {STEPS.slice(0, 7).map((s, i) => <li key={i}><span className="ss-mono">{String(i + 1).padStart(2, "0")}</span>{s.say}</li>)}
          <li className="ss-plan__more">{`and ${STEPS.length - 7} more steps`}</li>
        </ol>
        <div className="ss-row"><span className="ss-note">Your agent can ask for a plan. Only a person can approve it.</span><span className="ss-btn" data-ready={!approved} data-done={approved}>{approved ? "Approved" : "Approve plan"}</span></div>
      </div>
    </div>
  );
}

function Run({ k }: { k: number }) {
  const shown = Math.min(STEPS.length, Math.floor(clamp01(k / 0.85) * (STEPS.length + 1)));
  const done = shown >= STEPS.length;
  return (
    <div className="ss-p ss-p--run">
      <div className="ss-p__bar"><span className="ss-p__mark">V</span><span className="ss-mono">{HOST}</span><span className="ss-chip" data-s={done ? "stop" : "run"}>{done ? "Found a problem" : "Running"}</span></div>
      <div className="ss-run">
        <ol className="ss-steps">
          {STEPS.map((s, i) => {
            const st = i < shown ? (s.ok ? "ok" : "fail") : i === shown ? "now" : "wait";
            return (
              <li key={i} data-s={st}>
                <span className="ss-mono">{String(i + 1).padStart(2, "0")}</span>
                <span className="ss-steps__t">{s.say}</span>
                <span className="ss-mono">{st === "fail" ? <><span className="ss-steps__f">Failed</span> {fmt(s.ms)}</> : st === "ok" ? fmt(s.ms) : st === "now" ? "Running" : ""}</span>
              </li>
            );
          })}
        </ol>
        <div className="ss-browser">
          <div className="ss-browser__bar"><span className="ss-mono">{HOST}/account.html</span></div>
          <div className="ss-browser__view" data-on={done}>
            <Image src={RUN.shot} alt="" fill sizes="320px" style={{ objectFit: "cover", objectPosition: "top" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Record({ prompt }: { prompt: string }) {
  const f = RUN.failure!;
  return (
    <div className="ss-p">
      <div className="ss-p__bar"><span className="ss-p__mark">V</span><span>Record</span><span className="ss-chip" data-s="stop">Found a problem</span></div>
      <div className="ss-p__body">
        <p className="ss-k">{`${f.at}, after signing out and back in`}</p>
        <dl className="ss-diff">
          <div><dt>Expected</dt><dd>{f.expected}</dd></div>
          <div><dt>Observed</dt><dd data-s="stop">{f.observed}</dd></div>
        </dl>
        <div className="ss-prompt">
          <div className="ss-prompt__h"><span>Repair prompt for a coding agent</span><span className="ss-mini">Copy</span></div>
          <pre>{prompt}</pre>
        </div>
      </div>
    </div>
  );
}

function Panel({ i, k, prompt }: { i: number; k: number; prompt: string }) {
  if (i === 0) return <Compose k={k} />;
  if (i === 1) return <Plan k={k} />;
  if (i === 2) return <Run k={k} />;
  return <Record prompt={prompt} />;
}

export function ScrollStory() {
  const root = useRef<HTMLElement>(null);
  const prompt = useRepairPrompt();
  // One number drives the scene: which chapter, and how far into it.
  const [p, setP] = useState(0);
  useScrollProgress(root, { onFrame: (v) => setP((old) => (Math.abs(old - v) > 0.002 || v === 0 || v === 1 ? v : old)) });
  const pos = clamp01(p) * CHAPTERS.length;
  const idx = Math.min(CHAPTERS.length - 1, Math.floor(pos));
  const k = clamp01(pos - idx) * 1.25; // finish each chapter a little before the next begins

  return (
    <section ref={root} className="v6-ss" aria-labelledby="v6-ss-h" data-nav-dark data-nav-theme="dark">
      <h2 id="v6-ss-h" className="v6-ss__sr">How a check works</h2>

      {/* Desktop: one pinned scene. */}
      <div className="v6-ss__pin" aria-hidden>
        <div className="v6-ss__stage">
          <div className="v6-ss__stack">
            <div className="v6-ss__layer v6-ss__layer--3" />
            <div className="v6-ss__layer v6-ss__layer--2" />
            <div className="v6-ss__layer v6-ss__layer--1">
              {CHAPTERS.map((_, i) => (
                <div key={i} className="v6-ss__panel" data-on={i === idx}>
                  {/* Only the live chapter animates; the others show their finished frame under the fade. */}
                  <Panel i={i} k={i === idx ? Math.min(1, k) : i < idx ? 1 : 0} prompt={prompt} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="v6-ss__copy">
          {CHAPTERS.map((c, i) => (
            <div key={i} className="v6-ss__ch" data-on={i === idx}>
              <p className="v6-ss__n">{String(i + 1).padStart(2, "0")}</p>
              <p className="v6-ss__t">{c.t}</p>
              <p className="v6-ss__d">{c.d}</p>
            </div>
          ))}
          <ol className="v6-ss__dots">{CHAPTERS.map((_, i) => <li key={i} data-on={i === idx} />)}</ol>
        </div>
        <p className="v6-ss__cap">{CAPTION}</p>
      </div>

      {/* Phones, short screens, reduced motion: the same four chapters, finished, in reading order. */}
      <ol className="v6-ss__flat">
        {CHAPTERS.map((c, i) => (
          <li key={i}>
            <p className="v6-ss__n">{String(i + 1).padStart(2, "0")}</p>
            <h3 className="v6-ss__t">{c.t}</h3>
            <p className="v6-ss__d">{c.d}</p>
            <div className="v6-ss__flatp"><Panel i={i} k={1} prompt={prompt} /></div>
          </li>
        ))}
        <li className="v6-ss__cap">{CAPTION}</li>
      </ol>
    </section>
  );
}
