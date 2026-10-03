"use client";

/* HOW A CHECK WORKS, ON A MISSION CONSOLE (2026-10-01; the panels rebuilt to be read, 2026-10-02).

   The founder, against the first version of this scene: use "an example of an attack drone and who to target
   and who not to", "not that we SUPPLY the software but the verification software"; it should look as
   complex as what these teams build, say why they would let us do this, show our own CLI, and lose the
   generic text and the dots. The founder chose a real check over a drawn one.

   So the scene is one real verification of Larkspur, a simulated mission console that Vraelis built itself
   and serves as a demo fixture (lib/fixtures/strike-console.ts). Its one rule: only a contact classified
   Hostile AND confirmed by the operator may show "Cleared to engage". Its one planted bug sits behind that
   rule.

   THE SHEETS. Scale.com's scroll presentation stacks glass sheets in perspective; ours are the mission
   picture, drawn from the fixture's own geometry (strike-map.tsx): the area of operations at the back, the
   live picture with its four contacts in the middle, and Vraelis's own output at the front, one chapter at
   a time. The only colour is the battlefield convention the console uses, and the finding.

   EVERY FRONT PANEL IS THE RECORD'S OWN OUTPUT (_content/strike.ts): the CLI's transcript as it printed it,
   the plan a person approved, the steps the browser took with their timings, what was expected and what was
   seen, the screenshot, and the repair prompt. Nothing is drawn to look better than it ran.

   THE PANELS ARE READ, SO THEY ARE SET AT A READING SIZE (plan C "/", 2026-10-02). They were 10.5 to 12px
   and then zoomed down with the whole stage, to 6px on a 1366x657 laptop. Now every panel letter is at least
   13px on the screen whatever the stage's zoom (useFitStage counter-zooms the panels), every panel opens on a
   whole first line 20px under its bar, and every panel's last block reaches its foot (a list that runs on
   fades out; a picture fills what is left), so no panel ends on a band of nothing.

   TWO DESKTOP COMPOSITIONS, ONE SCENE. A tall window keeps the composition the founder approved: the sheets
   centred, the chapter under them. A window under 880px tall cannot hold both and a readable panel, so the
   chapter moves to the left and the sheets take the full height on the right. Phones, windows under 621px
   and reduced motion get the chapters as plain blocks in their finished state.

   Desktop pins the scene and scrubs it from scroll (progress.ts). */
import Image from "next/image";
import { Fragment, useEffect, useRef, useState, type RefObject } from "react";
import { useScrollProgress } from "./progress";
import { EditorialLink } from "./ui";
import { AreaLayer, PictureLayer } from "./strike-map";
import { STRIKE_LINKS, type StrikeRecord, type StrikeStep } from "../_content/strike-links";
import { SOLUTIONS_HREF } from "../_content/sectors";
import "./strike-story.css";

// The record's shape and the chapter links live in the server-safe _content/strike-links.ts (strike.ts reads
// them there). Re-exported under the same names so anything that imported them from here keeps working.
export { STRIKE_LINKS };
export type { StrikeRecord, StrikeStep };

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const fmt = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`);
const two = (n: number) => String(n).padStart(2, "0");
const host = (u: string) => { try { return new URL(u).host; } catch { return u; } };
const path = (u: string) => { try { const x = new URL(u); return x.pathname + x.search; } catch { return u; } };

/* The CLI's colours, read from its own SGR codes (cli/vraelis.mjs: bold 1, dim 2, red 31, green 32, amber 33,
   cyan 36). Parsed, not re-typed, so the transcript is the one the terminal showed. */
function Ansi({ line }: { line: string }) {
  const out: { t: string; c: string }[] = [];
  const re = /\x1b\[([0-9;]+)m/g;
  let cls: string[] = [], last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push({ t: line.slice(last, m.index), c: cls.join(" ") });
    for (const code of m[1].split(";")) cls = code === "0" ? [] : [...cls, `sk-a${code}`];
    last = re.lastIndex;
  }
  if (last < line.length) out.push({ t: line.slice(last), c: cls.join(" ") });
  return <>{out.map((p, i) => (p.c ? <span key={i} className={p.c}>{p.t}</span> : <Fragment key={i}>{p.t}</Fragment>))}</>;
}

/* ── the front panels; `k` is the progress inside the chapter, 0 to 1 (1 = finished). Each panel's outermost
   element carries data-panel: its words are the record's, so the page's word budget does not count them. ── */

function Terminal({ r, k }: { r: StrikeRecord; k: number }) {
  const lines = r.cli?.lines ?? [];
  const shown = Math.round(clamp01(k / 0.85) * lines.length);
  return (
    <div className="sk-p sk-term" data-panel="">
      <div className="sk-p__bar"><span>Terminal</span><span className="sk-mono sk-dim" data-no-translate>vraelis 0.3.0</span></div>
      <pre className="sk-term__body" data-no-translate>
        <span className="sk-term__cmd"><span className="sk-dim">$ </span>{r.cli?.command}</span>{"\n"}
        {lines.slice(0, shown).map((l, i) => <Fragment key={i}><Ansi line={l} />{"\n"}</Fragment>)}
      </pre>
    </div>
  );
}

function Plan({ r, k }: { r: StrikeRecord; k: number }) {
  const approved = k > 0.7 && !!r.plan.approvedAt;
  return (
    <div className="sk-p" data-panel="">
      <div className="sk-p__bar">
        <span className="sk-p__mark" aria-hidden>V</span><span>Plan</span>
        <span className="sk-mono sk-dim sk-p__id" data-no-translate>{r.plan.id.slice(0, 12)}</span>
        <span className="sk-state" data-s={approved ? "ok" : "wait"}>{approved ? "Approved by a person" : "Waiting for approval"}</span>
      </div>
      <div className="sk-plan">
        {/* The journeys first: three rows that say what will run. Then the requirements, which run on and fade
            out at the panel's foot rather than stop short of it. */}
        <p className="sk-k">Journeys, with their planned steps</p>
        <ul className="sk-plan__flows" data-no-translate>
          {r.plan.flows.map((f) => <li key={f.name}><span>{f.name}</span><span className="sk-mono">{f.steps}</span></li>)}
        </ul>
        <p className="sk-k">What it will hold the console to</p>
        <ol className="sk-plan__req" data-no-translate>
          {r.plan.requirements.map((q, i) => <li key={i}><span className="sk-mono">{two(i + 1)}</span><span>{q}</span></li>)}
        </ol>
      </div>
    </div>
  );
}

function Run({ r, k }: { r: StrikeRecord; k: number }) {
  const run = r.run!;
  const steps = run.journeys.flatMap((j) => j.steps);
  const shown = Math.min(steps.length, Math.floor(clamp01(k / 0.85) * (steps.length + 1)));
  const done = shown >= steps.length;
  const fail = steps.findIndex((s) => !s.ok);
  return (
    <div className="sk-p" data-panel="">
      {/* The bar is the browser's address: the run checked this page and nothing else. */}
      <div className="sk-p__bar">
        <span className="sk-p__mark" aria-hidden>V</span>
        <span className="sk-mono sk-p__addr" data-no-translate>{host(r.url)}{path(r.url)}</span>
        <span className="sk-state" data-s={done && fail >= 0 ? "stop" : "run"}>{done && fail >= 0 ? "Found a problem" : "Checking the live app"}</span>
      </div>
      {/* Every recorded step of the first journey, always in place: a step not reached yet is dim, so the list
          never changes height while it plays, and the step that found the problem is always on screen. */}
      <ol className="sk-steps">
        {steps.map((s, i) => {
          const st = i < shown ? (s.ok ? "ok" : "fail") : i === shown ? "now" : "wait";
          return (
            <li key={i} data-s={st}>
              <span className="sk-mono sk-steps__n">{two(i + 1)}</span>
              <span className="sk-steps__t">
                <span data-no-translate>{s.say}</span>
                {st === "fail" ? <span className="sk-steps__f">Found a problem</span> : null}
              </span>
              <span className="sk-mono sk-steps__ms" data-no-translate>{st === "ok" || st === "fail" ? fmt(s.ms) : ""}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Finding({ r, inSheet }: { r: StrikeRecord; inSheet?: boolean }) {
  const run = r.run!;
  const f = run.failure;
  const steps = run.journeys.flatMap((j) => j.steps);
  const at = steps.findIndex((s) => !s.ok);
  // Out of the journey's PLANNED steps (12), not the recorded ones (8): the run stopped where it found the
  // problem, and "8 of 8" read as if the journey had ended there.
  const planned = r.plan.flows.find((x) => x.name === f?.at)?.steps ?? steps.length;
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(run.repairPrompt); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard refused: the prompt is on screen to select */ }
  };
  return (
    <div className="sk-p" data-panel="">
      <div className="sk-p__bar">
        <span className="sk-p__mark" aria-hidden>V</span><span>Record</span>
        <span className="sk-mono sk-dim sk-p__id" data-no-translate>{run.id.slice(0, 12)}</span>
        <span className="sk-state" data-s={f ? "stop" : "ok"}>{f ? "Found a problem" : "Did what the sentence says"}</span>
      </div>
      <div className="sk-find">
        {f ? (
          <dl className="sk-diff">
            <div><dt>Step</dt><dd className="sk-mono" data-no-translate>{two(at + 1)} / {planned}</dd></div>
            <div><dt>Expected</dt><dd data-no-translate>{f.expected}</dd></div>
            <div><dt>Observed</dt><dd data-s="stop" data-no-translate>{f.observed}</dd></div>
          </dl>
        ) : null}
        {f?.more ? <p className="sk-more">{f.more}</p> : null}
        <div className="sk-find__row">
          <div className="sk-find__shot">
            <Image src={run.shots.failure} alt="" fill sizes="(max-width: 900px) 250px, 320px" style={{ objectFit: "cover", objectPosition: "left top", ...(run.failureCrop ? { transform: `scale(${run.failureCrop.scale})`, transformOrigin: run.failureCrop.origin } : {}) }} />
          </div>
          <div className="sk-prompt">
            <div className="sk-prompt__h"><span>Repair prompt</span><button type="button" className="sk-mini" onClick={() => void copy()} tabIndex={inSheet ? -1 : undefined}>{copied ? "Copied" : "Copy"}</button></div>
            <pre data-no-translate>{run.repairPrompt}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

type Chapter = { eyebrow: string; t: string; d: string; link?: { href: string; label: string } };

/**
 * FITS THE SHEETS TO THE SCREEN. They are drawn at up to 880px, and on a laptop-height screen that ran them
 * under the header and onto the chapter's own title. So the stage is zoomed down until the sheets, as the
 * browser actually draws them in perspective, fit inside the scene's own box (between the header and the
 * chapter when the chapter sits under them, the full height when it sits beside them), and moved to sit
 * centred in it. Measured again whenever the copy or the window changes size (a longer translation, the
 * fonts arriving).
 *
 * The panels must not shrink with it: they are text people read. So the stage carries --sk-zi, the inverse
 * of its zoom, and the panels are zoomed by that (strike-story.css), which puts their letters back at their
 * true size inside a box that still follows the composition.
 */
function useFitStage(root: RefObject<HTMLElement | null>, stage: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = root.current, st = stage.current;
    const pin = el?.querySelector<HTMLElement>(".v6-sk__pin");
    const scene = el?.querySelector<HTMLElement>(".v6-sk__scene");
    const copy = el?.querySelector<HTMLElement>(".v6-sk__copy");
    if (!el || !st || !pin || !scene || !copy) return;
    const union = () => {
      const rs = Array.from(st.querySelectorAll<HTMLElement>(".v6-sk__sheet, .v6-sk__front")).map((s) => s.getBoundingClientRect());
      return {
        top: Math.min(...rs.map((x) => x.top)), bottom: Math.max(...rs.map((x) => x.bottom)),
        left: Math.min(...rs.map((x) => x.left)), right: Math.max(...rs.map((x) => x.right)),
      };
    };
    let raf = 0;
    const fit = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (getComputedStyle(pin).display === "none") return;
        st.style.zoom = ""; st.style.translate = ""; st.style.removeProperty("--sk-zi");
        const box = scene.getBoundingClientRect();
        // 18 clear of the scene's top: the picture sheet comes forward and up by about 20px in the later
        // chapters, and it must not reach the header.
        const lo = box.top + 18, hi = box.bottom - 8;
        const u = union();
        // Up to 1.12 where the window has room to spare (a tall monitor), so the sheets fill the scene instead
        // of floating in it; the panels' letters stay at their size either way.
        const z = Math.max(0.5, Math.min(1.12,
          (hi - lo) / ((u.bottom - u.top) * 1.04),
          box.width / ((u.right - u.left) * 1.02)));
        st.style.zoom = String(z);
        st.style.setProperty("--sk-zi", String(1 / z));
        const v = union();
        // Room left over is shared a third above and two thirds below: the sheets sit a little above the
        // middle, which reads as centred, and the story starts closer to the film above it.
        const free = (hi - lo) - (v.bottom - v.top);
        // The zoomed element's own lengths are zoomed too, so the shift is given in its unzoomed pixels.
        const dx = ((box.left + box.right) / 2 - (v.left + v.right) / 2) / z;
        const dy = (lo + (free > 0 ? free * 0.35 : free / 2) - v.top) / z;
        st.style.translate = `${dx}px ${dy}px`;
      });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(copy); ro.observe(pin); ro.observe(scene);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [root, stage]);
}

export function StrikeStory({ record: r, chapters, caption }: { record: StrikeRecord; chapters: Chapter[]; caption: string }) {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  useFitStage(root, stage);
  const [p, setP] = useState(0);
  useScrollProgress(root, { onFrame: (v) => setP((old) => (Math.abs(old - v) > 0.002 || v === 0 || v === 1 ? v : old)) });
  const n = chapters.length;
  const pos = clamp01(p) * n;
  const idx = Math.min(n - 1, Math.floor(pos));
  const k = clamp01(pos - idx) * 1.25; // finish each chapter a little before the next begins
  const finding = r.run?.failure ?? null;

  const panel = (i: number, kk: number, inSheet?: boolean) =>
    i === 0 ? <Terminal r={r} k={kk} /> : i === 1 ? <Plan r={r} k={kk} /> : i === 2 ? <Run r={r} k={kk} /> : <Finding r={r} inSheet={inSheet} />;
  // A keyboard reaching a later chapter's link scrolls the story to that chapter, so what has focus is on screen.
  const showChapter = (i: number) => {
    const el = root.current;
    if (!el || i === idx) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + ((i + 0.4) / n) * (el.offsetHeight - window.innerHeight), behavior: "auto" });
  };
  // The middle sheet follows the story: the sector the rule is about once the browser is in the console,
  // and the finding, on the contact it is about, in the last chapter.
  const sector = idx >= 2 ? "B3" : null;
  const mark = idx === 3 && finding ? { id: finding.contact, text: finding.shown } : null;

  return (
    <>
    <section ref={root} id="how-a-check-works" className="v6-sk v6-dark" aria-labelledby="v6-sk-h" data-nav-dark data-nav-theme="dark" style={{ height: `${n * 115 + 60}vh` }}>
      <h2 id="v6-sk-h" className="v6-sk__sr" data-label="">How a check works</h2>

      {/* The sheets are pictures of the copy beside them, so only the copy is read out. */}
      <div className="v6-sk__pin">
        <div className="v6-sk__scene">
          <div ref={stage} className="v6-sk__stage" aria-hidden data-panel="">
            <div className="v6-sk__stack" data-ch={idx}>
              <div className="v6-sk__sheet v6-sk__sheet--area"><AreaLayer /><span className="v6-sk__tag sk-mono">Area of operations</span></div>
              <div className="v6-sk__sheet v6-sk__sheet--pic"><PictureLayer sector={sector} mark={mark} /><span className="v6-sk__tag sk-mono">Live picture</span></div>
            </div>
            {/* The product's own output faces the reader, flat: text drawn on a tilted layer loses the thin
                strokes of its letters (an r without its arm), and this is the text people read. */}
            <div className="v6-sk__front">
              {chapters.map((_, i) => (
                <div key={i} className="v6-sk__panel" data-on={i === idx}>
                  {/* Only the live chapter animates; the others hold their finished frame under the fade. */}
                  {panel(i, i === idx ? Math.min(1, k) : i < idx ? 1 : 0, true)}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="v6-sk__copy">
          {chapters.map((c, i) => (
            <div key={i} className="v6-sk__ch" data-on={i === idx} onFocus={() => showChapter(i)}>
              <p className="v6-sk__eb"><span className="sk-mono">{two(i + 1)}</span>{c.eyebrow}</p>
              <h3 className="v6-sk__t">{c.t}</h3>
              <p className="v6-sk__d">{c.d}</p>
              {c.link && <EditorialLink href={c.link.href}>{c.link.label}</EditorialLink>}
            </div>
          ))}
          <ol className="v6-sk__bars" aria-hidden>{chapters.map((_, i) => <li key={i} data-on={i <= idx} />)}</ol>
        </div>
      </div>

      {/* Phones, short screens, reduced motion: the same chapters, finished, in reading order. */}
      <ol className="v6-sk__flat">
        {chapters.map((c, i) => (
          <li key={i}>
            <p className="v6-sk__eb"><span className="sk-mono">{two(i + 1)}</span>{c.eyebrow}</p>
            <h3 className="v6-sk__t">{c.t}</h3>
            <p className="v6-sk__d">{c.d}</p>
            {c.link && <EditorialLink href={c.link.href}>{c.link.label}</EditorialLink>}
            {/* The picture the sheets carry on a desktop: at the start, and again with the finding on it. */}
            {i === 0 || (i === chapters.length - 1 && finding) ? (
              <div className="v6-sk__flatmap" aria-hidden data-panel="">
                <AreaLayer />
                <PictureLayer sector={i === 0 ? null : "B3"} mark={i === 0 || !finding ? null : { id: finding.contact, text: finding.shown }} />
              </div>
            ) : null}
            <div className="v6-sk__flatp">{panel(i, 1)}</div>
          </li>
        ))}
      </ol>

      {/* The words the panels switch between as the story plays, once each, so the translator's crawl finds
          every one of them whichever chapter it happened to see. */}
      <div hidden data-i18n-seed="">
        <span>Waiting for approval</span>
        <span>Approved by a person</span>
        <span>Checking the live app</span>
        <span>Found a problem</span>
        <span>Copy</span>
        <span>Copied</span>
      </div>
    </section>
    {/* After the story, on every screen: what the example was, and that it is one sector of several (plan S4).
        The link sits after the sentence, never inside it, so the translator keeps the sentence whole. */}
    <div className="v6-sk__after">
      <p className="v6-sk__cap">{caption}</p>
      <EditorialLink href={SOLUTIONS_HREF}>See every sector</EditorialLink>
    </div>
    </>
  );
}
