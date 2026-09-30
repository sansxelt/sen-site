"use client";

/* THE PRODUCT, ON THE FIRST SCREEN.

   The founder's read of the old opening (2026-09-30): too much text and no product. This is the product: a
   window laid out the way the console lays out a check, replaying real production runs from
   _content/demos.ts at their recorded pace. The rail lists the four recorded runs, the middle plays the
   steps, and the right shows the browser, what was found and the repair prompt.

   NOTHING HERE IS SCRIPTED. The sentence, the steps, their timings, what each check expected and saw, and
   the screenshot all come from the run records. The repair prompt is not written for this page either: it
   is the product's own builder (lib/preflight/repair-prompt.ts) run over the recorded failure, so it reads
   exactly as a coding agent would receive it. Where the record has nothing (console errors, network
   failures) the prompt leaves that section out rather than inventing one.

   The answer words (Verified, Failed) are not printed here (positioning.ts rule 8). A finished run says
   what happened in plain words.

   Reduced motion: the finished run is shown at once and nothing animates. */
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEMOS, type Demo, type DemoRun } from "../_content/demos";
import { buildRepairPrompt } from "@/lib/preflight/repair-prompt";
import "./run-window.css";

type Entry = { demo: Demo; run: DemoRun; id: string; name: string };

// The rail, in the order a reader should meet them: the checkout that forgets, the same check after the
// fix, then the two other apps.
const ENTRIES: Entry[] = DEMOS.flatMap((demo) =>
  demo.runs.map((run) => ({
    demo, run,
    id: `${demo.key}-${run.label}`,
    name: demo.runs.length > 1 ? `${demo.tab}, ${run.label.toLowerCase()}` : demo.tab,
  })),
);

// The run ids from the header of _content/demos.ts, so the window names the record it is replaying.
const RUN_IDS: Record<string, string> = {
  "checkout-Before the fix": "3fad10f5",
  "checkout-After the fix": "588c48f7",
  "notes-Verified": "4fc6e52c",
  "projects-Failed": "de53ab8b",
};

const MIN_BEAT = 170;
const MAX_BEAT = 950;

const host = (u: string) => { try { return new URL(u).host; } catch { return u; } };
const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`);
const fmtDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "UTC" });
const appName = (d: Demo) => d.app.split(",")[0];

/** Where the browser was after the first `upto` steps: the last page a step opened. */
function lastPath(run: DemoRun, upto = Infinity): string {
  const opened = run.journeys.flatMap((j) => j.steps).slice(0, upto).map((s) => /^Open (\/\S*)/.exec(s.say)?.[1]).filter(Boolean);
  return opened.length ? String(opened[opened.length - 1]) : "/";
}

/** The product's repair prompt, built from the recorded failure. */
function promptFor(e: Entry): string | null {
  const f = e.run.failure;
  if (!f) return null;
  const steps = e.run.journeys.flatMap((j) => j.steps);
  const at = steps.findIndex((s) => !s.ok);
  return buildRepairPrompt({
    severity: "high", category: "persistence_failure", title: e.demo.title,
    requirement_refs: [], expected: f.expected, observed: f.observed,
    repro: steps.slice(0, at + 1).map((s, i) => `${i + 1}. ${s.say}`),
    possible_explanation: null,
    evidence: { failed_step_index: at, failed_action: steps[at]?.say ?? "", console_errors: [], network_failures: [], current_url: `${e.demo.url.split("?")[0].replace(/\/$/, "")}${lastPath(e.run)}` },
    status: "open",
  }, { appName: appName(e.demo), deploymentUrl: e.demo.url });
}

export function RunWindow() {
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState(0);
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const timers = useRef<number[]>([]);
  const started = useRef(false);
  // Once the reader picks a run, replays, or copies, the window stops choosing for them.
  const touched = useRef(false);

  const e = ENTRIES[sel];
  const steps = useMemo(() => e.run.journeys.flatMap((j) => j.steps), [e]);
  const prompt = useMemo(() => promptFor(e), [e]);
  const failed = !!e.run.failure;

  const play = useCallback((idx: number) => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    const s = ENTRIES[idx].run.journeys.flatMap((j) => j.steps);
    setCopied(false);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(s.length); setDone(true); return; }
    setShown(0); setDone(false);
    let at = 450;
    s.forEach((step, i) => {
      at += Math.min(MAX_BEAT, Math.max(MIN_BEAT, step.ms));
      timers.current.push(window.setTimeout(() => setShown(i + 1), at));
    });
    timers.current.push(window.setTimeout(() => setDone(true), at + 380));
  }, []);

  // The first replay starts once the window is on screen, which on most screens is at load.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => {
      if (es.some((x) => x.isIntersecting) && !started.current) { started.current = true; play(0); }
    }, { threshold: 0.2 });
    io.observe(el);
    const t = timers.current;
    return () => { io.disconnect(); t.forEach((x) => window.clearTimeout(x)); };
  }, [play]);

  // Keep the step being run in view INSIDE the list. Never scrolls the page.
  useEffect(() => {
    const box = list.current;
    if (!box || box.scrollHeight <= box.clientHeight) return;
    const now = box.querySelector<HTMLElement>("[data-s='now']") ?? box.querySelector<HTMLElement>("[data-s='fail']");
    const target = now ? now.offsetTop - box.clientHeight / 2 : done ? box.scrollHeight : 0;
    box.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  }, [shown, done]);

  const choose = (i: number, byReader = true) => {
    if (byReader) touched.current = true;
    setSel(i); started.current = true; play(i); list.current?.scrollTo({ top: 0 });
  };

  // THE STORY, ONCE: the checkout that forgets, then the same check after the fix. When the first replay
  // ends and the reader has not taken over, the window moves on to the fixed run by itself, one time.
  useEffect(() => {
    if (!done || sel !== 0 || touched.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setTimeout(() => { if (!touched.current) choose(1, false); }, 7000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, sel]);
  const copy = async () => {
    if (!prompt) return;
    try { await navigator.clipboard.writeText(prompt); setCopied(true); } catch { /* clipboard refused: the text is on screen to select */ }
  };

  const total = steps.length;
  const elapsed = steps.slice(0, shown).reduce((a, s) => a + s.ms, 0);
  const current = steps[Math.min(shown, total - 1)];
  const starts = e.run.journeys.map((_, j) => e.run.journeys.slice(0, j).reduce((a, x) => a + x.steps.length, 0));
  const state = !done ? "run" : failed ? "found" : "held";
  const at = lastPath(e.run, done ? Infinity : shown + 1);
  const address = `${host(e.demo.url)}${at === "/" ? "" : at}`;

  return (
    <div ref={root} className="rw" data-state={state} onPointerDown={() => { touched.current = true; }} onKeyDown={() => { touched.current = true; }}>
      <div className="rw__top">
        <span className="rw__brand">
          <span className="rw__mark" aria-hidden>V</span>
          <span className="rw__crumb">Checks <span aria-hidden>/</span> <b>{appName(e.demo)}</b></span>
        </span>
        <span className="rw__rec v6-mono">Run {RUN_IDS[e.id] ?? ""} · {fmtDate(e.run.recorded)} 2026</span>
        <button type="button" className="rw__replay" onClick={() => { touched.current = true; play(sel); }}>
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden><path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v2.6h2.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Replay
        </button>
      </div>

      <div className="rw__grid">
        <nav className="rw__rail" aria-label="Recorded runs">
          <p className="rw__railh">Recent checks</p>
          <ul>
            {ENTRIES.map((x, i) => (
              <li key={x.id}>
                <button type="button" className="rw__item" aria-pressed={i === sel} onClick={() => choose(i)}>
                  <span className="rw__idot" data-f={x.run.failure ? "found" : "held"} aria-hidden />
                  <span className="rw__iname">{x.name}</span>
                  <span className="rw__imeta">{appName(x.demo)} · {fmtDate(x.run.recorded)}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="rw__railnote">Real runs on Vraelis demo apps, replayed from their records.</p>
        </nav>

        <div className="rw__main">
          <div className="rw__status">
            <span className="rw__chip" data-s={state}>
              <span className="rw__cdot" aria-hidden />
              {state === "run" ? "Checking the live app" : state === "found" ? "Found a problem" : "Did what the sentence says"}
            </span>
            <span className="rw__stat v6-mono">
              {Math.min(shown, total)}/{total} steps · {done ? `${e.run.seconds.toFixed(1)} s` : `${(elapsed / 1000).toFixed(1)} s`}
            </span>
          </div>

          <div className="rw__claim">
            <p className="rw__k">{e.demo.claim ? "The sentence" : "The journey, as recorded"}</p>
            <p className="rw__say">{e.demo.claim ?? e.demo.journeyName}</p>
            <p className="rw__tags">
              <span>Plan approved</span><span>Real browser</span><span>{host(e.demo.url)}</span>
            </p>
          </div>

          <div ref={list} className="rw__steps" aria-live="off">
            {e.run.journeys.map((j, ji) => (
              <div key={j.name} className="rw__journey">
                {e.run.journeys.length > 1 ? <p className="rw__jn">{j.name}</p> : null}
                <ol>
                  {j.steps.map((s, k) => {
                    const i = starts[ji] + k;
                    const st = i < shown ? (s.ok ? "ok" : "fail") : i === shown && !done ? "now" : "wait";
                    return (
                      <li key={k} className="rw__step" data-s={st}>
                        <span className="rw__sico" aria-hidden />
                        <span className="rw__sn v6-mono">{String(i + 1).padStart(2, "0")}</span>
                        <span className="rw__st">{s.say}</span>
                        <span className="rw__sms v6-mono">{i < shown ? fmtMs(s.ms) : ""}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        </div>

        <div className="rw__side">
          <div className="rw__browser">
            <div className="rw__bbar">
              <span className="rw__bdots" aria-hidden><i /><i /><i /></span>
              <span className="rw__addr v6-mono">{address}</span>
            </div>
            <div className="rw__view">
              {done ? (
                <Image src={e.run.shot} alt={`${e.run.shotCaption} The screenshot the run saved.`} sizes="(max-width: 900px) 92vw, 380px" className="rw__shot" />
              ) : (
                <div className="rw__live">
                  <span className="rw__lstep v6-mono">Step {Math.min(shown + 1, total)} of {total}</span>
                  <span className="rw__lnow">{current?.say}</span>
                  <span className="rw__lbar" aria-hidden><span style={{ width: `${Math.round((Math.min(shown, total) / total) * 100)}%` }} /></span>
                </div>
              )}
            </div>
          </div>
          <p className="rw__cap">{done ? e.run.shotCaption : "The run saves a screenshot of where it ended."}</p>

          <div className="rw__card" data-on={done}>
            {done && e.run.failure ? (
              <>
                <p className="rw__ch">What it found <span className="v6-mono">{e.run.failure.at}</span></p>
                <dl className="rw__diff">
                  <div><dt>Expected</dt><dd>{e.run.failure.expected}</dd></div>
                  <div><dt>Observed</dt><dd>{e.run.failure.observed}</dd></div>
                </dl>
              </>
            ) : done ? (
              <>
                <p className="rw__ch">What it found</p>
                <p className="rw__none">Every step did what the plan expected, {total} of {total}.</p>
              </>
            ) : (
              <p className="rw__wait">What it finds appears here when the run ends.</p>
            )}
          </div>

          {done && prompt ? (
            <div className="rw__prompt">
              <div className="rw__ph">
                <span>Repair prompt for your coding agent</span>
                <button type="button" className="rw__copy" onClick={() => { touched.current = true; void copy(); }}>{copied ? "Copied" : "Copy"}</button>
              </div>
              <pre className="v6-mono">{prompt}</pre>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
