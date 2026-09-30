"use client";

/* REAL RUNS, REPLAYED.

   The rest of the homepage explains Vraelis. This section shows it working, and the only thing it is
   allowed to show is what actually happened: _content/demos.ts is read out of production verification
   records, step by step, and the screenshot in the browser frame is the one the run saved. The replay is
   paced by the recorded step timings (a step that took 0 ms still gets a beat, so it can be seen).

   The screenshot appears only when the replay reaches the decision, because it is the FINAL state of the
   run. Showing it earlier would show the answer before the steps that produced it.

   Reduced motion: everything is shown at once, and nothing moves. */
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEMOS, type Demo, type DemoRun } from "../_content/demos";
import "./demos.css";

const MIN_BEAT = 140;
const MAX_BEAT = 900;

const host = (u: string) => { try { return new URL(u).host; } catch { return u; } };
const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`);
const fmtDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function allSteps(run: DemoRun) {
  return run.journeys.flatMap((j) => j.steps);
}

export function Demos() {
  const root = useRef<HTMLElement>(null);
  const [demoIdx, setDemoIdx] = useState(0);
  const [runIdx, setRunIdx] = useState(0);
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(false);
  const started = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const demo: Demo = DEMOS[demoIdx];
  const run: DemoRun = demo.runs[Math.min(runIdx, demo.runs.length - 1)];
  const total = allSteps(run).length;

  const play = useCallback((r: DemoRun) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const steps = allSteps(r);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(steps.length); setDone(true); return;
    }
    setShown(0); setDone(false);
    let at = 250;
    steps.forEach((s, i) => {
      at += Math.min(MAX_BEAT, Math.max(MIN_BEAT, s.ms));
      timers.current.push(setTimeout(() => setShown(i + 1), at));
    });
    timers.current.push(setTimeout(() => setDone(true), at + 350));
  }, []);

  // Start the first replay when the section scrolls into view, once.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting) && !started.current) { started.current = true; play(run); }
    }, { threshold: 0, rootMargin: "0px 0px -30% 0px" });
    io.observe(el);
    const t = timers.current;
    return () => { io.disconnect(); t.forEach(clearTimeout); };
  }, [play, run]);

  const choose = useCallback((d: number, r = 0) => {
    setDemoIdx(d); setRunIdx(r);
    started.current = true;
    play(DEMOS[d].runs[r]);
  }, [play]);

  // #run-<key> (linked from the examples above) opens that run and brings the player into view.
  useEffect(() => {
    const open = () => {
      const key = window.location.hash.startsWith("#run-") ? window.location.hash.slice(5) : "";
      const d = DEMOS.findIndex((x) => x.key === key);
      if (d < 0) return;
      choose(d);
      root.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, [choose]);

  const onTabKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (demoIdx + (e.key === "ArrowRight" ? 1 : -1) + DEMOS.length) % DEMOS.length;
    choose(next);
    document.getElementById(`v6-demo-tab-${DEMOS[next].key}`)?.focus();
  };

  // Where each journey's steps start in the run's single running count.
  const starts = run.journeys.map((_, j) => run.journeys.slice(0, j).reduce((a, x) => a + x.steps.length, 0));
  return (
    <section ref={root} id="real-runs" className="v6-demo" aria-labelledby="v6-demo-h">
      <div className="v6-demo__in">
        <div className="v6-demo__head">
          <p className="v6-eyebrow">Real runs</p>
          <h2 id="v6-demo-h" className="v6-demo__h">Watch it check a live app.</h2>
          <p className="v6-demo__lead">
            Three real checks, replayed from their records. Every step, timing, screenshot and result here
            came from the run, on Vraelis demo apps you can open yourself.
          </p>
        </div>

        <div className="v6-demo__tabs" role="tablist" aria-label="Real runs" onKeyDown={onTabKey}>
          {DEMOS.map((d, i) => (
            <button
              key={d.key} id={`v6-demo-tab-${d.key}`} type="button" role="tab"
              aria-selected={i === demoIdx} aria-controls="v6-demo-panel" tabIndex={i === demoIdx ? 0 : -1}
              className="v6-demo__tab" onClick={() => choose(i)}
            >
              <span className="v6-demo__tabn v6-mono">{String(i + 1).padStart(2, "0")}</span>
              <span>{d.title}</span>
            </button>
          ))}
        </div>

        <div id="v6-demo-panel" role="tabpanel" aria-labelledby={`v6-demo-tab-${demo.key}`} className="v6-demo__stage">
          <div className="v6-demo__left">
            <p className="v6-demo__k v6-mono">{demo.claim ? "The sentence" : "The journey, as recorded"}</p>
            <p className="v6-demo__claim">{demo.claim ?? demo.journeyName}</p>
            <p className="v6-demo__app">
              {demo.app}. <a href={demo.url} target="_blank" rel="noreferrer">{host(demo.url)}</a>
            </p>

            {demo.runs.length > 1 ? (
              <div className="v6-demo__runs" role="group" aria-label="Which run">
                {demo.runs.map((r, i) => (
                  <button key={r.label} type="button" className="v6-demo__run" aria-pressed={i === runIdx} data-d={r.decision}
                    onClick={() => choose(demoIdx, i)}>
                    {r.label}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="v6-demo__steps">
              {run.journeys.map((j, ji) => (
                <div key={j.name} className="v6-demo__journey">
                  <p className="v6-demo__jn">{j.name}</p>
                  <ol>
                    {j.steps.map((s, k) => {
                      const i = starts[ji] + k;
                      const state = i < shown ? (s.ok ? "ok" : "fail") : i === shown && !done ? "now" : "wait";
                      return (
                        <li key={k} className="v6-demo__step" data-s={state}>
                          <span className="v6-demo__mark" aria-hidden="true" />
                          <span className="v6-demo__say">{s.say}</span>
                          <span className="v6-demo__ms v6-mono">{i < shown ? fmtMs(s.ms) : ""}</span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>
          </div>

          <div className="v6-demo__right">
            <div className="v6-demo__browser">
              <div className="v6-demo__bar">
                <span className="v6-demo__addr v6-mono">{host(demo.url)}</span>
                <button type="button" className="v6-demo__replay" onClick={() => play(run)}>Replay</button>
              </div>
              <div className="v6-demo__view">
                {done ? (
                  <Image src={run.shot} alt={`${run.shotCaption} Screenshot saved by the run.`} sizes="(max-width: 900px) 100vw, 640px" className="v6-demo__shot" />
                ) : (
                  <div className="v6-demo__running">
                    <span className="v6-demo__pulse" aria-hidden="true" />
                    <span className="v6-mono">A real browser is on step {Math.min(shown + 1, total)} of {total}</span>
                  </div>
                )}
              </div>
            </div>
            <p className="v6-demo__caption">{done ? run.shotCaption : " "}</p>

            <div className="v6-demo__verdict" data-d={run.decision} data-on={done} aria-live="polite">
              {done ? (
                <>
                  <p className="v6-demo__stamp">{run.decision === "verified" ? "Verified" : "Failed"}</p>
                  <p className="v6-demo__meta v6-mono">{total} steps in {run.seconds.toFixed(1)} s. Recorded {fmtDate(run.recorded)}.</p>
                  {run.failure ? (
                    <dl className="v6-demo__fail">
                      <div><dt>Where</dt><dd>{run.failure.at}</dd></div>
                      <div><dt>Expected</dt><dd>{run.failure.expected}</dd></div>
                      <div><dt>Observed</dt><dd>{run.failure.observed}</dd></div>
                    </dl>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </div>

        <p className="v6-demo__take">{demo.takeaway}</p>
      </div>
    </section>
  );
}
