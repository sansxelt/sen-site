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
   failures) the prompt leaves that section out rather than inventing one. For the same reason the page
   translator leaves the record's own words alone (data-no-translate): a translated step is not the step
   the run took. Only the window's labels are translated.

   The answer words (Verified, Failed) are not printed here (positioning.ts rule 8). A finished run says
   what happened in plain words.

   THE WINDOW DOES NOT CHANGE SIZE BY ITSELF. Stacked on a phone it is as tall as what it shows, and what a
   finished run adds (the finding, the repair prompt) used to grow it under the reader and push the next
   section down by a third of the screen (CLS 0.39 at 390px, with no input). Now everything a run will show
   is laid out from its first frame and only made visible when the run ends; the notes beside each part
   say how.

   Reduced motion: the finished run is shown at once and nothing animates. */
import Image from "next/image";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";
import { DEMOS, type Demo, type DemoRun } from "../_content/demos";
import { buildRepairPrompt } from "@/lib/preflight/repair-prompt";
import { useLocale } from "@/lib/i18n/client";
import { LOCALES } from "@/lib/i18n/locales";
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
// Where the window stacks into one column (the same query as run-window.css).
const STACKED = "(max-width: 980px)";

const host = (u: string) => { try { return new URL(u).host; } catch { return u; } };
const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`);
// A recorded date is a calendar day: noon UTC keeps it on that day wherever the reader is.
const day = (iso: string) => new Date(`${iso}T12:00:00Z`);
const appName = (d: Demo) => d.app.split(",")[0];

// The longest the step counter reads on any run ("18/18 steps · 17.4 s"). A hidden copy sits under the live
// counter, so the status line is laid out once and does not re-wrap as the numbers grow or the run changes.
const WIDEST = ENTRIES
  .map((x) => ({ n: x.run.journeys.reduce((a, j) => a + j.steps.length, 0), s: x.run.seconds.toFixed(1) }))
  .reduce((w, x) => (`${x.n}${x.s}`.length > `${w.n}${w.s}`.length ? x : w));

/** Where the browser was after the first `upto` steps: the last page a step opened. */
function lastPath(run: DemoRun, upto = Infinity): string {
  const opened = run.journeys.flatMap((j) => j.steps).slice(0, upto).map((s) => /^Open (\/\S*)/.exec(s.say)?.[1]).filter(Boolean);
  return opened.length ? String(opened[opened.length - 1]) : "/";
}

/** The page the run ended on keeps the demo's query (?mode=broken), or the repro opens the working app. */
const withQuery = (u: string, demoUrl: string) => (u.includes("?") || !demoUrl.includes("?") ? u : `${u}?${demoUrl.split("?")[1]}`);

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
    evidence: { failed_step_index: at, failed_action: steps[at]?.say ?? "", console_errors: [], network_failures: [], current_url: withQuery(`${e.demo.url.split("?")[0].replace(/\/$/, "")}${lastPath(e.run)}`, e.demo.url) },
    status: "open",
  }, { appName: appName(e.demo), deploymentUrl: e.demo.url });
}

/** Whether a box scrolls at its current size. One that scrolls needs a keyboard stop (axe
 *  scrollable-region-focusable); stacked, the steps show in full, and a stop there would do nothing. */
function useScrolls(ref: RefObject<HTMLElement | null>, content: unknown): boolean {
  const [scrolls, setScrolls] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // A ResizeObserver reports once as it starts and again on every size change (a new width or layout).
    const ro = new ResizeObserver(() => setScrolls(getComputedStyle(el).overflowY !== "visible" && el.scrollHeight > el.clientHeight + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, content]);
  return scrolls;
}

export function RunWindow() {
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const pre = useRef<HTMLPreElement>(null);
  const promptHead = useId();
  const [sel, setSel] = useState(0);
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const timers = useRef<number[]>([]);
  const started = useRef(false);
  // Once the reader picks a run, replays, or copies, the window stops choosing for them.
  const touched = useRef(false);

  // Dates in the page's language. useLocale is "en" while hydrating and the real language after, so the
  // server's English render still matches. Each date sits in a data-no-translate span, or the translator
  // would rewrite Intl's wording from the English catalogue.
  const lang = LOCALES[useLocale()].htmlLang;
  const [railDate, recDate] = useMemo(() => [
    new Intl.DateTimeFormat(lang, { month: "short", day: "numeric", timeZone: "UTC" }),
    new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeZone: "UTC" }),
  ], [lang]);

  const e = ENTRIES[sel];
  const steps = useMemo(() => e.run.journeys.flatMap((j) => j.steps), [e]);
  const prompt = useMemo(() => promptFor(e), [e]);
  const failed = !!e.run.failure;
  const stepsScroll = useScrolls(list, sel);
  const promptScroll = useScrolls(pre, sel);

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

  // Keep the step being run in view INSIDE the list. Never scrolls the page. Stacked, the list is not a
  // scroller (every step shows, so a swipe on it moves the page), and there is nothing to follow.
  useEffect(() => {
    const box = list.current;
    if (!box || getComputedStyle(box).overflowY === "visible" || box.scrollHeight <= box.clientHeight) return;
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
  // Stacked, the window is taller than the screen and the fixed run is shorter (it has no repair prompt):
  // moving on while the window's foot was on screen swapped out what the reader was reading and pulled the
  // next section up under them. There it waits until its foot is below the screen, where the change moves
  // nothing anyone can see.
  useEffect(() => {
    if (!done || sel !== 0 || touched.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let due = false;
    const moveOn = () => {
      const el = root.current;
      if (!due || touched.current || !el) return;
      if (window.matchMedia(STACKED).matches && el.getBoundingClientRect().bottom <= window.innerHeight) return;
      due = false; // once: a burst of scroll events must not restart the replay it just began
      choose(1, false);
    };
    const t = window.setTimeout(() => { due = true; moveOn(); }, 7000);
    window.addEventListener("scroll", moveOn, { passive: true });
    return () => { window.clearTimeout(t); window.removeEventListener("scroll", moveOn); };
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
          {/* On a phone "Checks /" steps aside so the app's name fits beside Replay. */}
          <span className="rw__crumb"><span className="rw__up">Checks <span aria-hidden>/</span> </span><b data-no-translate>{appName(e.demo)}</b></span>
        </span>
        {/* An identifier, not a sentence: translated, "Run" became a verb ("Ausführen"). */}
        <span className="rw__rec v6-mono" data-no-translate>Run {RUN_IDS[e.id] ?? ""} · {recDate.format(day(e.run.recorded))}</span>
        <button type="button" className="rw__replay" onClick={() => { touched.current = true; play(sel); }}>
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden><path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v2.6h2.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Replay
        </button>
      </div>

      <div className="rw__grid">
        <nav className="rw__rail" aria-label="Recorded runs">
          <p className="rw__railh">Recorded runs</p>
          <ul>
            {ENTRIES.map((x, i) => (
              <li key={x.id}>
                <button type="button" className="rw__item" aria-pressed={i === sel} onClick={() => choose(i)}>
                  <span className="rw__iname">{x.name}</span>
                  {/* The outcome in words, coloured because the colour IS the outcome; no dot beside it. */}
                  <span className="rw__imeta"><span data-f={x.run.failure ? "found" : "held"}>{x.run.failure ? "Found a problem" : "Did what the sentence says"}</span>{" · "}<span className="rw__date" data-no-translate>{railDate.format(day(x.run.recorded))}</span></span>
                </button>
              </li>
            ))}
          </ul>
          <p className="rw__railnote">Real runs on Vraelis demo apps, replayed from their records.</p>
        </nav>

        <div className="rw__main">
          {/* The pill and the counter each keep, hidden underneath, the longest thing they will show, so this
              line is laid out once: a pill that grew when a run ended pushed the counter onto a second line.
              The pill itself still hugs its words; the room it may need is held beside it. */}
          <div className="rw__status">
            <span className="rw__chips">
              <span className="rw__chip rw__sz" aria-hidden>Checking the live app</span>
              <span className="rw__chip rw__sz" aria-hidden>Found a problem</span>
              <span className="rw__chip rw__sz" aria-hidden>Did what the sentence says</span>
              <span className="rw__chip" data-s={state}>{state === "run" ? "Checking the live app" : state === "found" ? "Found a problem" : "Did what the sentence says"}</span>
            </span>
            <span className="rw__stat v6-mono">
              <span className="rw__sz" aria-hidden>{WIDEST.n}/{WIDEST.n} steps · {`${WIDEST.s} s`}</span>
              <span>{Math.min(shown, total)}/{total} steps · {done ? `${e.run.seconds.toFixed(1)} s` : `${(elapsed / 1000).toFixed(1)} s`}</span>
            </span>
          </div>

          <div className="rw__claim">
            <p className="rw__k">{e.demo.claim ? "The sentence" : "The journey, as recorded"}</p>
            <p className="rw__say" data-no-translate>{e.demo.claim ?? e.demo.journeyName}</p>
            <p className="rw__tags">
              <span>Plan approved</span><span>Real browser</span><span data-no-translate>{host(e.demo.url)}</span>
            </p>
          </div>

          <div ref={list} className="rw__steps" role="region" aria-label="Steps of this run" tabIndex={stepsScroll ? 0 : undefined} aria-live="off">
            {e.run.journeys.map((j, ji) => (
              <div key={j.name} className="rw__journey">
                {e.run.journeys.length > 1 ? <p className="rw__jn" data-no-translate>{j.name}</p> : null}
                <ol>
                  {j.steps.map((s, k) => {
                    const i = starts[ji] + k;
                    const st = i < shown ? (s.ok ? "ok" : "fail") : i === shown && !done ? "now" : "wait";
                    const result = s.ok ? fmtMs(s.ms) : <><span className="rw__sf">Problem</span> {fmtMs(s.ms)}</>;
                    return (
                      // No status icons (founder, 2026-10-01: no dots). The outcome is said in words, and only a
                      // failure is coloured, because that is the one row a reader has to find.
                      <li key={k} className="rw__step" data-s={st}>
                        <span className="rw__sn v6-mono">{String(i + 1).padStart(2, "0")}</span>
                        <span className="rw__st" data-no-translate>{s.say}</span>
                        {/* Holds the widest this cell gets in the run ("Running" or the result), so the step's
                            words keep their line breaks as the run reaches it. */}
                        <span className="rw__sms v6-mono">
                          <span className="rw__sz" aria-hidden><span className="rw__snow">Running</span></span>
                          <span className="rw__sz" aria-hidden>{result}</span>
                          <span>{st === "fail" || st === "ok" ? result : st === "now" ? <span key="now" className="rw__snow">Running</span> : ""}</span>
                        </span>
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
              <span className="rw__addr v6-mono" data-no-translate>{address}</span>
            </div>
            <div className="rw__view">
              {done ? (
                <Image src={e.run.shot} alt={`${e.run.shotCaption} The screenshot the run saved.`} sizes="(max-width: 900px) 92vw, 380px" className="rw__shot" />
              ) : (
                <div className="rw__live">
                  <span className="rw__lstep v6-mono">Step {Math.min(shown + 1, total)} of {total}</span>
                  <span className="rw__lnow" data-no-translate>{current?.say}</span>
                  <span className="rw__lbar" aria-hidden><span style={{ width: `${Math.round((Math.min(shown, total) / total) * 100)}%` }} /></span>
                </div>
              )}
            </div>
          </div>
          {/* Both captions share one cell, the one not in use hidden, so the line is as tall as the longer from
              the start. The run's caption quotes its screenshot ("Free"), so it stays as recorded. */}
          <p className="rw__cap">
            <span data-on={!done}>The run saves a screenshot of where it ended.</span>
            <span data-on={done} data-no-translate>{e.run.shotCaption}</span>
          </p>

          {/* Stacked, the waiting line and the finding share one cell (run-window.css), so the card is the size
              it ends at from the first frame. */}
          <div className="rw__card" data-on={done}>
            <div className="rw__cwait">
              <p className="rw__wait">What it finds appears here when the run ends.</p>
            </div>
            <div className="rw__cdone">
              {e.run.failure ? (
                <>
                  <p className="rw__ch">What it found <span className="v6-mono">{e.run.failure.at}</span></p>
                  <dl className="rw__diff">
                    <div><dt>Expected</dt><dd data-no-translate>{e.run.failure.expected}</dd></div>
                    <div><dt>Observed</dt><dd data-no-translate>{e.run.failure.observed}</dd></div>
                  </dl>
                </>
              ) : (
                <>
                  <p className="rw__ch">What it found</p>
                  <p className="rw__none">Every step did what the plan expected, {total} of {total}.</p>
                </>
              )}
            </div>
          </div>

          {/* A run that will have a repair prompt has its place from the first frame (stacked, a dim panel like
              the steps not reached yet; wide, hidden), filled when the run ends, so its arrival adds nothing
              to the window's height. */}
          {prompt ? (
            <div className="rw__prompt" data-on={done}>
              <div className="rw__ph">
                <span className="rw__pt" id={promptHead}>Repair prompt for your coding agent</span>
                <button type="button" className="rw__copy" onClick={() => { touched.current = true; void copy(); }}>{copied ? "Copied" : "Copy"}</button>
              </div>
              {/* Named by its heading, which the translator reaches; it skips everything on a <pre>. */}
              <pre ref={pre} className="v6-mono" role="region" aria-labelledby={promptHead} tabIndex={promptScroll ? 0 : undefined}>{prompt}</pre>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
