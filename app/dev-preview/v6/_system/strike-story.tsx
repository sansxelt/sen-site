"use client";

/* HOW A CHECK WORKS, ON A MISSION CONSOLE (2026-10-01).

   The founder, against the first version of this scene: use "an example of an attack drone and who to target
   and who not to", "not that we SUPPLY the software but the verification software"; it should look as
   complex as what these teams build, say why they would let us do this, show our own CLI, and lose the
   generic text and the dots. The founder chose a real check over a drawn one.

   So the scene is one real verification of Larkspur, a simulated mission console that Vraelis serves as a
   demo fixture (lib/fixtures/strike-console.ts). Its one rule: only a contact classified Hostile AND
   confirmed by the operator may show "Cleared to engage". Its one planted bug sits behind that rule.

   THE SHEETS. Scale.com's scroll presentation stacks glass sheets in perspective; ours are the mission
   picture, drawn from the fixture's own geometry (strike-map.tsx): the area of operations at the back, the
   live picture with its four contacts in the middle, and Vraelis's own output at the front, one chapter at
   a time. The only colour is the battlefield convention the console uses, and the finding.

   EVERY FRONT PANEL IS THE RECORD'S OWN OUTPUT (_content/strike.ts): the CLI's transcript as it printed it,
   the plan a person approved, the steps the browser took with their timings, the screenshot, what was
   expected and what was seen, and the repair prompt. Nothing is drawn to look better than it ran.

   Desktop pins the scene and scrubs it from scroll (progress.ts). Phones, short screens and reduced motion
   get the chapters as plain blocks in their finished state. */
import Image, { type StaticImageData } from "next/image";
import { Fragment, useEffect, useRef, useState, type RefObject } from "react";
import { useScrollProgress } from "./progress";
import { EditorialLink } from "./ui";
import { AreaLayer, PictureLayer } from "./strike-map";
import { V6_BASE } from "@/lib/v6-routes";
import "./strike-story.css";

export type StrikeStep = { say: string; ms: number; ok: boolean };
export type StrikeRecord = {
  /** The address the run checked: the fixture, in its broken mode. */
  url: string;
  claim: string;
  /** The CLI's own output, line by line, with its colour codes, exactly as captured. */
  cli: { command: string; lines: string[] } | null;
  plan: { id: string; requirements: string[]; flows: { name: string; steps: number }[]; approvedAt: string | null };
  run: null | {
    id: string;
    recorded: string;
    seconds: number;
    journeys: { name: string; steps: StrikeStep[] }[];
    /** The record's critical issue, verbatim, plus what the run's screenshot shows on that contact and a
     *  plain note of anything else the record holds, so the panel never implies it was the only failure. */
    failure: { contact: string; at: string; expected: string; observed: string; shown: string; more?: string } | null;
    shots: { run: StaticImageData | string; failure: StaticImageData | string };
    /** How the finding's screenshot is cut down to the part that shows it: a scale and a transform origin. */
    failureCrop?: { scale: number; origin: string };
    repairPrompt: string;
  };
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const fmt = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`);
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

/* ── the front panels; `k` is the progress inside the chapter, 0 to 1 (1 = finished) ── */

function Terminal({ r, k }: { r: StrikeRecord; k: number }) {
  const lines = r.cli?.lines ?? [];
  const shown = Math.round(clamp01(k / 0.85) * lines.length);
  return (
    <div className="sk-p sk-term">
      <div className="sk-p__bar"><span>Terminal</span><span className="sk-mono sk-dim">vraelis 0.3.0</span></div>
      <pre className="sk-term__body" data-no-translate>
        <span className="sk-term__cmd"><span className="sk-dim">$ </span>{r.cli?.command}</span>{"\n"}
        {lines.slice(0, shown).map((l, i) => <Fragment key={i}><Ansi line={l} />{"\n"}</Fragment>)}
      </pre>
    </div>
  );
}

function Plan({ r, k }: { r: StrikeRecord; k: number }) {
  const approved = k > 0.7 && !!r.plan.approvedAt;
  const total = r.plan.flows.reduce((a, f) => a + f.steps, 0);
  return (
    <div className="sk-p">
      <div className="sk-p__bar">
        <span className="sk-p__mark">V</span><span>Plan</span>
        <span className="sk-mono sk-dim" data-no-translate>{r.plan.id.slice(0, 12)}</span>
        <span className="sk-chip" data-s={approved ? "ok" : "wait"}>{approved ? "Approved by a person" : "Waiting for approval"}</span>
      </div>
      <div className="sk-plan">
        <div className="sk-plan__req">
          <p className="sk-k">What it will hold the console to</p>
          <ol data-no-translate>{r.plan.requirements.map((q, i) => <li key={i}><span className="sk-mono">{String(i + 1).padStart(2, "0")}</span>{q}</li>)}</ol>
        </div>
        <div className="sk-plan__flows">
          <p className="sk-k">{`${total} steps in ${r.plan.flows.length} flows`}</p>
          <ul data-no-translate>{r.plan.flows.map((f) => <li key={f.name}><span>{f.name}</span><span className="sk-mono">{f.steps}</span></li>)}</ul>
          <p className="sk-note">Your agent can ask for a plan. Only a person can approve it.</p>
        </div>
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
  const lo = Math.max(0, Math.min(shown - 5, steps.length - 8));
  return (
    <div className="sk-p">
      <div className="sk-p__bar">
        <span className="sk-p__mark">V</span><span className="sk-mono" data-no-translate>{host(r.url)}</span>
        <span className="sk-chip" data-s={done && fail >= 0 ? "stop" : "run"}>{done && fail >= 0 ? "Found a problem" : "Checking the live app"}</span>
      </div>
      <div className="sk-run">
        <ol className="sk-steps" data-no-translate>
          {steps.slice(lo, lo + 8).map((s, j) => {
            const i = lo + j;
            const st = i < shown ? (s.ok ? "ok" : "fail") : i === shown ? "now" : "wait";
            return (
              <li key={i} data-s={st}>
                <span className="sk-mono">{String(i + 1).padStart(2, "0")}</span>
                <span className="sk-steps__t">{s.say}</span>
                <span className="sk-mono">{st === "fail" ? <><span className="sk-steps__f">Problem</span> {fmt(s.ms)}</> : st === "ok" ? fmt(s.ms) : ""}</span>
              </li>
            );
          })}
        </ol>
        <div className="sk-browser">
          <div className="sk-browser__bar sk-mono" data-no-translate>{host(r.url)}{path(r.url)}</div>
          <div className="sk-browser__view">
            <Image src={run.shots.run} alt="" fill sizes="520px" style={{ objectFit: "cover", objectPosition: "top left" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Finding({ r, inSheet }: { r: StrikeRecord; inSheet?: boolean }) {
  const run = r.run!;
  const f = run.failure;
  const steps = run.journeys.flatMap((j) => j.steps);
  const at = steps.findIndex((s) => !s.ok);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(run.repairPrompt); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard refused: the prompt is on screen to select */ }
  };
  return (
    <div className="sk-p">
      <div className="sk-p__bar">
        <span className="sk-p__mark">V</span><span>Record</span>
        <span className="sk-mono sk-dim" data-no-translate>{run.id.slice(0, 12)}</span>
        <span className="sk-chip" data-s={f ? "stop" : "ok"}>{f ? "Found a problem" : "Did what the sentence says"}</span>
      </div>
      <div className="sk-find">
        <div className="sk-find__l">
          {f ? (
            <>
              <p className="sk-k">{`Step ${at + 1} of ${steps.length}`}</p>
              <dl className="sk-diff">
                <div><dt>Expected</dt><dd data-no-translate>{f.expected}</dd></div>
                <div><dt>Observed</dt><dd data-s="stop" data-no-translate>{f.observed}</dd></div>
              </dl>
              {f.more ? <p className="sk-more">{f.more}</p> : null}
            </>
          ) : null}
          <div className="sk-find__shot">
            <Image src={run.shots.failure} alt="" fill sizes="320px" style={{ objectFit: "contain", objectPosition: "center", ...(run.failureCrop ? { transform: `scale(${run.failureCrop.scale})`, transformOrigin: run.failureCrop.origin } : {}) }} />
          </div>
        </div>
        <div className="sk-prompt">
          <div className="sk-prompt__h"><span>Repair prompt for a coding agent</span><button type="button" className="sk-mini" onClick={() => void copy()} tabIndex={inSheet ? -1 : undefined}>{copied ? "Copied" : "Copy"}</button></div>
          <pre>{run.repairPrompt}</pre>
        </div>
      </div>
    </div>
  );
}

type Chapter = { eyebrow: string; t: string; d: string; link?: { href: string; label: string } };

/**
 * FITS THE SHEETS TO THE SCREEN. They are drawn at 880px, and on a laptop-height screen (1280x720, 1366x768)
 * that ran them under the header and onto the chapter's own title. So the stage is zoomed down until the
 * sheets, as the browser actually draws them in perspective, fit between the header and the copy, and moved
 * to sit centred in that space. Measured again whenever the copy or the window changes size (a longer
 * translation, the fonts arriving).
 */
function useFitStage(root: RefObject<HTMLElement | null>, stage: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = root.current, st = stage.current;
    const pin = el?.querySelector<HTMLElement>(".v6-sk__pin");
    const copy = el?.querySelector<HTMLElement>(".v6-sk__copy");
    if (!el || !st || !pin || !copy) return;
    const union = () => {
      const rs = Array.from(st.querySelectorAll<HTMLElement>(".v6-sk__sheet, .v6-sk__front")).map((s) => s.getBoundingClientRect());
      return { top: Math.min(...rs.map((x) => x.top)), bottom: Math.max(...rs.map((x) => x.bottom)) };
    };
    let raf = 0;
    const fit = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (getComputedStyle(pin).display === "none") return;
        st.style.zoom = ""; st.style.translate = "";
        const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) || 66;
        // 36 below the header, not 14: the picture sheet comes forward and up by about 20px in the later chapters.
        const lo = pin.getBoundingClientRect().top + navH + 36, hi = copy.getBoundingClientRect().top - 22;
        const u = union();
        const z = Math.max(0.5, Math.min(1, (hi - lo) / ((u.bottom - u.top) * 1.04)));
        st.style.zoom = String(z);
        const v = union();
        // The zoomed element's own lengths are zoomed too, so the shift is given in its unzoomed pixels.
        st.style.translate = `0 ${((lo + hi) / 2 - (v.top + v.bottom) / 2) / z}px`;
      });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(copy); ro.observe(pin);
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
    <section ref={root} id="how-a-check-works" className="v6-sk" aria-labelledby="v6-sk-h" data-nav-dark data-nav-theme="dark" style={{ height: `${n * 115 + 60}vh` }}>
      <h2 id="v6-sk-h" className="v6-sk__sr">How a check works</h2>

      {/* The sheets are pictures of the copy beside them, so only the copy is read out. */}
      <div className="v6-sk__pin">
        <div ref={stage} className="v6-sk__stage" aria-hidden>
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
        <div className="v6-sk__copy">
          {chapters.map((c, i) => (
            <div key={i} className="v6-sk__ch" data-on={i === idx} onFocus={() => showChapter(i)}>
              <p className="v6-sk__eb"><span className="sk-mono">{String(i + 1).padStart(2, "0")}</span>{c.eyebrow}</p>
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
            <p className="v6-sk__eb"><span className="sk-mono">{String(i + 1).padStart(2, "0")}</span>{c.eyebrow}</p>
            <h3 className="v6-sk__t">{c.t}</h3>
            <p className="v6-sk__d">{c.d}</p>
            {/* The picture the sheets carry on a desktop: at the start, and again with the finding on it. */}
            {i === 0 || (i === chapters.length - 1 && finding) ? (
              <div className="v6-sk__flatmap" aria-hidden>
                <AreaLayer />
                <PictureLayer sector={i === 0 ? null : "B3"} mark={i === 0 || !finding ? null : { id: finding.contact, text: finding.shown }} />
              </div>
            ) : null}
            <div className="v6-sk__flatp">{panel(i, 1)}</div>
          </li>
        ))}
        <li className="v6-sk__cap">{caption}</li>
      </ol>
    </section>
    {/* On a desktop the caption follows the pinned story instead of taking room from the sheets. */}
    <p className="v6-sk__cap v6-sk__after">{caption}</p>
    </>
  );
}

export const STRIKE_LINKS = {
  cli: { href: `${V6_BASE}/agents`, label: "Set up the CLI" },
  approval: { href: `${V6_BASE}/security`, label: "Who can approve a plan" },
  coverage: { href: `${V6_BASE}/platform#coverage`, label: "What it can check today" },
};
