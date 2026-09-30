"use client";

// CHAPTERS 2-7 of the homepage.
//
// Each one is a full-screen chapter with a single dominant visual and almost no copy. The rule applied
// throughout: one idea per viewport, the visual IS the section, and every explanation that used to sit on
// this page now lives on /platform, /method, /research or /docs where a reader has asked for it.
//
// Backgrounds alternate graphite / stone at every chapter boundary, so scrolling reads as changes of
// atmosphere rather than as a stack of modules.
import { MARK_PATH, MARK_VIEWBOX } from "@/lib/brand-mark";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useScrollProgress, entryProgress } from "./progress";
import { Spectral } from "./spectral";
import { Reveal, SectionHead, Kicker, EditorialLink } from "./ui";
import "./coverage.css";
import Link from "next/link";
import { DOCS } from "../_content/docs";
import { CHANGELOG } from "../_content/changelog";
import "./chapters.css";
import { V6_BASE } from "@/lib/v6-routes";

const BASE = V6_BASE;
/* ---------------------------------------------------------------------------
   Scroll phase. A tall wrapper, a pinned scene, an integer phase read off the
   wrapper's progress. Native scrolling only: nothing is captured or re-timed,
   and reduced motion resolves straight to the final phase.
   --------------------------------------------------------------------------- */
/** Marks a node "seen" once and never unsets it, for compositions that accumulate. */
function useSeen(root: RefObject<HTMLElement | null>, total: number) {
  const [seen, setSeen] = useState(0);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const raf = requestAnimationFrame(() => setSeen(total));
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (!e.isIntersecting) continue;
          const i = Number((e.target as HTMLElement).dataset.i ?? 0);
          setSeen((s) => Math.max(s, i + 1));
          io.unobserve(e.target);
        }
      },
      { threshold: 0.35, rootMargin: "0px 0px -16% 0px" }
    );
    // include the root itself: some chapters mark the very element they hand us
    if (el.matches("[data-i]")) io.observe(el);
    el.querySelectorAll("[data-i]").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [root, total]);
  return seen;
}

/* ══════════════════════════════════════════════════════ CHAPTER 2 ══
   THE MISSING AUTHORITY.

   The one chapter on this page that makes a claim about the WORLD rather than about the product, and it is
   the reason the company exists. Everything else here describes a mechanism; this describes an absence.

   THE CLAIM IS DELIBERATELY NARROWER THAN THE ONE IT REPLACED, and narrower is what makes it survive a
   hostile reader. The first draft said an independent authority for software had never existed. That is
   false and a serious reader knows it: SOC 2 has auditors, DO-178C mandates independent verification, NASA
   runs an IV&V facility. The true version is sharper. The authority was only ever built where a regulator
   forced it into existence, which is a vanishingly small share of the software any business actually runs.
   Everywhere else the authority was a person, and a person was enough, because a person can be held to it.

   So this chapter does not claim a void where an institution exists. It claims the institution was never
   built for ordinary software, names exactly why that was survivable, and names what changed.

   IT ENDS OPEN, WHICH IS THE WHOLE REASON IT SITS HERE AND NOT LATER. It states the absence and refuses to
   resolve it. The chapter directly below (the agent's "Complete.", struck) carries the resolution, and its
   existing last line — "So something independent has to answer it. That is the whole of what Vraelis
   does." — stops being a small observation about one agent and becomes the answer to this. Neither chapter
   says the other's sentence. If a resolution ever appears in this file, delete it there, not below.

   THE MOTIF IS THE COMPANY'S OWN GAPPED RING, reused rather than invented. Chapter 3 closes a ring one
   segment per refusal; here five seals close one per discipline, and the fifth stops partway and stays
   open. That gap is the argument, drawn in the same language the rest of the page already speaks.
   ------------------------------------------------------------------------------------------------- */
/* Four precedents and one absence. Every one of the four is an authority that is independent of the
   builder BY LAW, not by convention, which is the property being claimed. Nothing here names a company,
   characterises a competitor, or asserts anything about software Vraelis has not seen. */
const PRECEDENTS: { field: string; who: string | null; says: string }[] = [
  { field: "Accounts", who: "The external auditor", says: "The statements are true." },
  { field: "Buildings", who: "The inspector", says: "It is safe to occupy." },
  { field: "Medicine", who: "The controlled trial", says: "It does what the label says." },
  { field: "Flight software", who: "Independent verification", says: "It may carry passengers." },
  // The fifth is the chapter. Its authority is missing, so the slot that holds a name in the other four
  // holds a rule, and the sentence underneath is the tell rather than a certification.
  { field: "Your software", who: null, says: "Whoever built it says it is done." },
];

export function Authority() {
  const wrap = useRef<HTMLDivElement>(null);
  // Same engine as every other pinned chapter, and the same reason there is no React state: the five
  // seals derive their arc length from --p in CSS, so nothing re-renders while the reader scrolls and no
  // seal can fall out of step with the row it belongs to.
  useScrollProgress(wrap);
  return (
    <section className="v6-au" data-nav-dark data-nav-theme="dark" ref={wrap}>
      <div className="v6-au__pin">
        <div className="v6-au__head">
          <p className="v6-eyebrow">What was never built</p>
          <h2 className="v6-au__h">Every discipline that matters has someone who is not the builder.</h2>
          <p className="v6-au__sub">
            Where being wrong was expensive enough, the law built an authority and gave it a name.
            Everywhere else, the authority was the person who wrote the code.
          </p>
        </div>

        <ol className="v6-au__seals">
          {PRECEDENTS.map((pr, i) => (
            <li key={pr.field} className="v6-au__seal" style={{ ["--i" as string]: i }} data-open={pr.who === null}>
              <div className="v6-au__stamp">
                <svg viewBox="0 0 100 100" aria-hidden>
                  <circle className="v6-au__track" cx="50" cy="50" r="40" />
                  {/* r 40, circumference 251.33. The arc is drawn by retracting a full-circumference dash,
                      so a seal at --c 1 is closed and at 0 is absent. The fifth carries a lower ceiling
                      through --max and therefore stops with a visible gap no matter how far the reader
                      scrolls, which is the one thing on this page that never completes. */}
                  <circle className="v6-au__arc" cx="50" cy="50" r="40" />
                </svg>
              </div>
              <p className="v6-au__field">{pr.field}</p>
              {/* THE ABSENCE HAS TO SIT ON THE SAME LINE AS THE FOUR NAMES. It was first drawn as a ruled
                  blank ABOVE the word, which pushed "No one" a line lower than "The external auditor" and
                  the other three, and a row of five whose fifth entry is simply lower reads as a layout
                  fault rather than as a missing institution. The word now occupies the name's exact slot,
                  in the name's exact type, and the rule sits under it where a form leaves a line empty. */}
              {pr.who === null
                ? <p className="v6-au__who v6-au__who--none">No one<span className="v6-au__blank" aria-hidden /></p>
                : <p className="v6-au__who">{pr.who}</p>}
              <p className="v6-au__says">{pr.says}</p>
            </li>
          ))}
        </ol>

        <div className="v6-au__turn">
          <p className="v6-au__turnt">
            That was survivable while a person wrote the code. A person can be asked, can be wrong in
            public, and can be held to it.
          </p>
          <p className="v6-au__turnt v6-au__turnt--2">
            An agent cannot. It has no licence to lose, no name on the certificate, and no stake in the
            answer it gives you.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════ CHAPTER 3 ══
   THE COMPLETION GAP, AT COMPANY LEVEL.

   This chapter used to walk a checkout: payment succeeded, Pro access was missing, the first repair
   failed. That is a feature-level anecdote, and running it here made the whole page read as one bug
   report rather than a company. The concrete demonstration belongs in ONE chapter, later, as proof.

   What this chapter argues instead is the thing that is true of every AI-built company: a completion
   claim is an assertion, and an assertion is not evidence. What it cannot tell you is what the change
   reached and whether the outcomes the business depends on are still true.

   It does NOT end on a verdict. Closing on "Unverified." in display type made the chapter dwell on an
   absence, which reads as an argument against software rather than for this product. It now ends by
   handing off: something independent has to answer the claim, and that is what the rest of the page is.

   There were four states; there are now three. The middle one listed what a completion claim DOES settle
   as two small pills, which is the weakest thing a full viewport can hold: a tiny tag in an enormous
   empty field. The chapter is stronger as claim, absence, verdict, with nothing small in it.
   ------------------------------------------------------------------------------------------------- */
// Read only by the .v6-gap__found traveller, which is commented out in Gap() below. Kept rather than
// deleted so restoring that beat is uncommenting one block, not rewriting its copy from the git history.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const UNCOVERED = [
  "Which pages the change actually reached.",
  "Whether a person can still do what they came to do.",
  "What moved somewhere nobody was looking.",
];

export function Gap() {
  const wrap = useRef<HTMLDivElement>(null);
  useScrollProgress(wrap);
  return (
    <section className="v6-gap" id="gap" data-nav-theme="light" ref={wrap}>
      <div className="v6-gap__pin">
        <div className="v6-gap__stage">
          {/* TWO BEATS, WHICH IS THE THIRD ANSWER AND THE RIGHT ONE.
              Three beats re-argued the hero before the reader reached any proof, so this was cut to one —
              and that hollowed out the opening instead: after the hero there was nothing at all until the
              resolution, which is what got reported. One line does not carry a screen.
              The claim comes back because it is the only beat here that PRESENTS rather than states: a
              display-scale word with a strike drawn through it, and the strike is the argument. The
              three-line "what it does not" list stays out — it was the most redundant of the three and the
              one that read as a wall on a phone. So: the claim is made, it is struck, and the resolution
              answers it. */}
          <div className="v6-gap__t v6-gap__claim">
            {/* WHOEVER SAID IT. This read "The agent reported". The claim is the same claim whether a
                developer, an agency, a teammate or an AI agent makes it, and naming only the agent made the
                page about one kind of builder (founder, 2026-09-28: wide on the audience). */}
            <p className="v6-gap__label">The work reported</p>
            <p className="v6-gap__word">
              <span className="v6-gap__wordt">Complete.</span>
              <span className="v6-gap__strike" aria-hidden />
            </p>
            <p className="v6-gap__turn">An assertion, made by whoever did the work.</p>
          </div>

          {/* STILL OUT, still restorable, and UNCOVERED above is kept for it. Uncommenting this needs one
              more beat's worth of scroll and a shift of the windows in chapters.css.

          <div className="v6-gap__t v6-gap__found">
            <p className="v6-gap__label">What it does not</p>
            <ul className="v6-gap__list">
              {UNCOVERED.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </div>
          */}

          <div className="v6-gap__t v6-gap__verdictwrap">
            <p className="v6-gap__verdict">So something independent has to answer it.</p>
            <p className="v6-gap__verdictsay">That is the whole of what Vraelis does.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════ CHAPTER 4 ══
   WHAT VERIFIED HAS TO MEAN.

   This chapter replaces a three-step "define, check, repair" diagram, which explained the mechanism and
   argued nothing. The strongest thing this company has is the STANDARD it holds itself to, and it was
   nowhere on the page.

   Verified is the most dangerous word the product can say, so this chapter shows the four cases where the
   product refuses to say anything at all. Each is a real pre-launch refusal with a real code behind it
   (claim_not_provable, validation_error, reviewed_plan_expired, reviewed_plan_deployment_changed).

   The motif is the company's own: a gapped ring. The centre holds the claim, the outer path is the
   independent verification closing around it, one segment per condition. The ring only closes when every
   segment does, and the conclusion resolves in the centre only after it has.
   ------------------------------------------------------------------------------------------------- */
/* AUDITED 2026-07-25. The previous version of this list asserted eight conditions and said Verified "is
   issued only when all eight of these hold". Every one of the eight was traced through the executable
   product path (POST /api/v1/verifications, the worker executor, and cli/vraelis.mjs). NONE of them gated a
   decision. Invalid cases were driven all the way to Verified through the real executor for the evidence,
   scope, self-approval and inspectability claims. That sentence was false and is gone.

   What IS real is narrower and, said plainly, sharper: Vraelis refuses to START a verification it cannot
   stand behind. These four refusals are executable, run on the paid path, and were each confirmed against
   the code that returns them. They are launch refusals, not decisions, and the chapter now says so, because
   claiming they produce a Blocked verdict would be the same kind of overstatement as before. */
const STANDARD: [string, string][] = [
  ["The claim has to be coverable", "Every obligation the claim implies must appear in the plan, or the run is refused before it starts."],
  ["The plan has to exercise it", "The steps have to actually reach the behaviour, not merely mention it."],
  ["The target has to be a real deployment", "A public, reachable, encrypted address. Not localhost, not a private address, not an unreachable host."],
  ["The approved plan has to still fit", "Expired, or pointed at a different deployment than the one reviewed, and it will not run."],
];

export function Standard() {
  const wrap = useRef<HTMLDivElement>(null);
  // No React state at all. The four conditions derive their position and opacity from --p in CSS, so
  // there is nothing to re-render as the reader scrolls and nothing that can snap out of step with the
  // ring. The counter reads from the same value.
  useScrollProgress(wrap);
  return (
    <section className="v6-st" data-nav-dark data-nav-theme="dark" ref={wrap}>
      <div className="v6-st__pin">
        <div className="v6-st__head">
          <p className="v6-eyebrow">The standard</p>
          <h2 className="v6-st__h">Verified is the most dangerous word this product can say.</h2>
          <p className="v6-st__sub">
            So the useful question is not when Vraelis says it, but when it refuses to start at all. These
            four refusals run on the verification API, the path the CLI, CI and AI assistants take, before a
            run exists.
          </p>
        </div>

        <div className="v6-st__stage">
          {/* the gapped ring: centre is the claim, the outer path is the verification closing around it */}
          <div className="v6-st__ringwrap">
            <svg className="v6-st__ring" viewBox="0 0 240 240" aria-hidden>
              <circle className="v6-st__track" cx="120" cy="120" r="104" />
              {/* One slice per refusal, so the ring is a count of the thing it is counting. */}
              {Array.from({ length: STANDARD.length }, (_, i) => (
                <circle key={i} className="v6-st__seg" cx="120" cy="120" r="104"
                  style={{ ["--i" as string]: i }} />
              ))}
            </svg>
            <div className="v6-st__centre">
              <p className="v6-st__count">{STANDARD.length} refusals</p>
              <p className="v6-st__verdict">Refused</p>
            </div>
          </div>

          {/* one condition at a time, at readable scale */}
          <ol className="v6-st__list">
            {STANDARD.map(([t, d], i) => (
              <li key={t} className="v6-st__cond" style={{ ["--i" as string]: i }}>
                <p className="v6-st__condn v6-mono">{String(i + 1).padStart(2, "0")}</p>
                <p className="v6-st__condt">{t}</p>
                <p className="v6-st__condd">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════ CHAPTER 5 ══
   THE PRODUCT, IN A REAL TERMINAL.

   NOT a scroll chapter. Everything else on this page is scrubbed by scroll, but a terminal is the one
   thing that should not be: making someone scroll to watch a command type itself is a chore, and the run
   is short enough to simply happen. It plays on its own, fast, the moment the window comes into view,
   and it replays if the reader leaves and comes back.

   The command is typed a character at a time and the output lands line by line, so it reads as someone
   working rather than as a block of text fading in. Everything in the transcript is the shipped contract
   from cli/vraelis.mjs and app/api/v1. The three exit codes are the payoff, with Blocked deliberately
   kept out of success.

   Once the run finishes the window HANDS OVER: a live prompt appears and the reader can type. It is a
   sandbox, so nothing is executed and nothing leaves the page.

   THE TITLE BAR HOLDS ONE CONTROL AND IT WORKS. It used to open with three dots drawn as a macOS window's
   close, minimise and zoom buttons, aria-hidden with a comment conceding they did nothing. Hovering them
   revealed their glyphs, which promised an action a second time. Borrowed chrome that answers nothing is
   the exact tell this chapter is written against, so they are gone and Replay is the only thing in the bar
   a reader can press.
   ------------------------------------------------------------------------------------------------- */
type LK = "cmd" | "out" | "dim" | "go" | "stop" | "wait";
type Line = { k: LK; t: string };
// THE COMMAND IS THE INSTALLED ONE. This used to type `node vraelis.mjs verify`, from before the CLI
// installed as a command, and the transcript stopped at "plan minted, awaiting approval" as though that were
// a step the reader watched go by. The CLI now prints the approval link, opens it when a person is at the
// terminal, waits for the approval, runs, and exits on the decision, so the transcript shows exactly that.
// The example claim is ordinary product behaviour on purpose: it is not an agent task, it is a sentence
// anyone responsible for the app could write.
const CMD = 'vraelis verify --url https://app.example.com --claim "A signed-in user can cancel their plan from Billing and then sees Cancelled" --wait';
const RUN: Line[] = [
  { k: "dim", t: "writing a plan from the claim" },
  { k: "out", t: "plan written, waiting for a person to approve it" },
  { k: "dim", t: "approve at https://app.vraelis.com/review/rvp_3c9e26ef" },
  { k: "out", t: "plan approved" },
  { k: "dim", t: "opening a real browser on the deployed app" },
  { k: "out", t: "signed in, opened Billing, cancelled the plan" },
  { k: "stop", t: "failed: Billing still showed Active after cancelling" },
  { k: "out", t: "expected Cancelled, observed Active" },
  { k: "dim", t: "evidence and a repair prompt written to the record" },
];
const EXITS: [string, string, string, "go" | "stop" | "wait"][] = [
  ["0", "Verified", "The claim held on the live app, with the evidence.", "go"],
  ["1", "Failed", "The live app contradicts it. A repair prompt is attached.", "stop"],
  ["2", "Blocked", "It could not be decided, which is not success.", "wait"],
];

/** A sandbox shell. Nothing is executed, nothing leaves the page; it answers from a table. */
function reply(raw: string): Line[] {
  const cmd = raw.trim();
  if (!cmd) return [];
  const [head, ...rest] = cmd.split(/\s+/);
  const say = (t: string, k: LK = "out"): Line[] => [{ k, t }];
  switch (head) {
    case "help":
      return [
        { k: "out", t: 'vraelis verify --url <deployment> --claim "<what should work>" --wait' },
        { k: "dim", t: "  --url     the deployed app, public https" },
        { k: "dim", t: "  --claim   what should work, as one sentence" },
        { k: "out", t: "vraelis recheck <vrf_id> --wait" },
        { k: "dim", t: "  after a fix, the same approved plan, no new approval" },
        { k: "out", t: "exit codes  0 verified   1 failed   2 blocked" },
        { k: "dim", t: "this window runs nothing: it demonstrates the shape of a real run" },
      ];
    case "vraelis":
      if (rest[0] === "recheck") {
        return [
          { k: "dim", t: "re-running the approved plan" },
          { k: "wait", t: "blocked: this sandbox has no verification to re-check" },
          { k: "dim", t: "exit 2. blocked is not success, which is the whole point." },
        ];
      }
      if (rest[0] !== "verify") return say(`vraelis: unknown command '${rest[0] ?? ""}'. try: vraelis verify`, "dim");
      if (!cmd.includes("--url")) return say("vraelis: --url is required. try: help", "stop");
      if (!cmd.includes("--claim")) return say("vraelis: --claim is required. try: help", "stop");
      return [
        { k: "dim", t: "writing a plan from the claim" },
        { k: "out", t: "plan written, waiting for a person to approve it" },
        { k: "wait", t: "blocked: this sandbox cannot reach a deployment" },
        { k: "dim", t: "exit 2. blocked is not success, which is the whole point." },
      ];
    // Anything outside the implemented set is NOT answered with invented shell output. Fabricating a
    // filesystem or a result would be the exact thing this product exists to catch.
    default:
      return [
        { k: "dim", t: `${head}: not part of this demonstration` },
        { k: "dim", t: "implemented here: verify, recheck, help, clear" },
      ];
  }
}

export function Product() {
  const root = useRef<HTMLElement>(null);
  const [typed, setTyped] = useState(0);      // characters of the command typed
  const [shown, setShown] = useState(0);      // output lines landed
  const [done, setDone] = useState(false);
  const [log, setLog] = useState<Line[]>([]);
  const [val, setVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Plays ONCE, when the window is substantially visible. It does not restart because the reader moved a
  // pixel out and back in; a replay is offered instead, as a control they choose. Reduced motion skips
  // straight to the finished output, and the finished output stays on screen either way.
  const played = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const play = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTyped(CMD.length); setShown(RUN.length); setDone(true); return;
    }
    setTyped(0); setShown(0); setDone(false); setLog([]);
    // ~3s in total. Faster than this and the phases (derive, plan, approve, execute, decide) read as
    // decorative typing rather than a workflow anyone could follow.
    for (let i = 1; i <= CMD.length; i++) timers.current.push(setTimeout(() => setTyped(i), i * 12));
    const after = CMD.length * 12 + 260;
    RUN.forEach((_, i) => timers.current.push(setTimeout(() => setShown(i + 1), after + i * 190)));
    timers.current.push(setTimeout(() => setDone(true), after + RUN.length * 190 + 300));
  }, []);

  // A THRESHOLD IS A FRACTION OF THE OBSERVED ELEMENT, NOT OF THE SCREEN.
  //
  // threshold: 0.45 asked for 45% of this section to be visible at once. The section is taller than a short
  // window -- roughly 2.4x at 390px of height -- so 45% of it COULD NOT BE VISIBLE, the observer never
  // reported an intersection, play() never ran, and the whole product demonstration rendered as an empty
  // rectangle holding one prompt glyph. It is reachable live: rotate to landscape, leave fullscreen into a
  // short window, or open split-screen, and a chapter that was correct a moment ago is blank.
  //
  // Expressed against the viewport instead, the trigger means what it was always meant to mean -- "the top
  // of this has come properly into view" -- and cannot be defeated by an element that is merely tall.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => {
      for (const e of es) {
        if (e.isIntersecting && !played.current) { played.current = true; play(); }
      }
    }, { threshold: 0, rootMargin: "0px 0px -35% 0px" });
    io.observe(el);

    // The preference can change while the run is in flight -- a battery saver switching it on is enough --
    // and the sample inside play() is taken once, at the start. Honour it from wherever the run has reached:
    // drop the timers and show the finished output, which is where the animation was going anyway.
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const settle = () => {
      if (!mq.matches) return;
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setTyped(CMD.length); setShown(RUN.length); setDone(true);
    };
    mq.addEventListener("change", settle);

    const t = timers.current;
    return () => { io.disconnect(); mq.removeEventListener("change", settle); t.forEach(clearTimeout); };
  }, [play]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const entered = val;
    setVal("");
    if (entered.trim() === "clear") { setLog([]); return; }
    const echoed: Line = { k: "cmd", t: entered };
    setLog((l) => [...l, echoed, ...reply(entered)].slice(-40));
  };

  return (
    <section className="v6-tm" id="run" data-nav-dark data-nav-theme="dark" ref={root}>
      <div className="v6-tm__in">
        <div className="v6-tm__head">
          <p className="v6-eyebrow">The command</p>
          <h2 className="v6-tm__h">One command. Three answers. No false green.</h2>
        </div>

        <div className="v6-tm__win">
          <header className="v6-tm__bar">
            <span className="v6-tm__title">vraelis CLI</span>
            <button type="button" className="v6-tm__replay" onClick={play}>Replay</button>
          </header>

          <div className="v6-tm__body" onClick={() => inputRef.current?.focus()}>
            <p className="v6-tm__line is-cmd">
              <b aria-hidden>{"$ "}</b>{CMD.slice(0, typed)}
              {typed < CMD.length ? <span className="v6-tm__caret" aria-hidden /> : null}
            </p>
            {RUN.slice(0, shown).map((l) => (
              <p key={l.t} className={`v6-tm__line is-${l.k}`}>{l.t}</p>
            ))}
            {done ? (
              <>
                <p className="v6-tm__line is-cmd"><b aria-hidden>{"$ "}</b>echo $?</p>
                <p className="v6-tm__line is-cmd">1</p>
                {log.map((l, i) => (
                  <p key={i} className={`v6-tm__line is-${l.k}`}>
                    {l.k === "cmd" ? <b aria-hidden>{"$ "}</b> : null}{l.t}
                  </p>
                ))}
                <form className="v6-tm__prompt" onSubmit={submit}>
                  <label className="v6-tm__ps" htmlFor="v6-tm-in" aria-hidden>{"$ "}</label>
                  <input id="v6-tm-in" ref={inputRef} className="v6-tm__in-field" value={val}
                    spellCheck={false} autoComplete="off" autoCapitalize="off" autoCorrect="off"
                    aria-label="Demonstration terminal. Nothing you type is executed."
                    placeholder={log.length ? "" : "help"}
                    onChange={(e) => setVal(e.target.value)} />
                </form>
              </>
            ) : null}
          </div>
        </div>

        <ol className="v6-tm__exits" data-on={done}>
          {EXITS.map(([code, name, s2, k], i) => (
            <li key={code} className={`v6-tm__ex is-${k}`} style={{ ["--i" as string]: i }}>
              <p className="v6-tm__exc">exit {code}</p>
              <p className="v6-tm__exn">{name}</p>
              <p className="v6-tm__exs">{s2}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════ CONNECTED DEVICES ══
   DRONES, ROBOTS AND FLEETS, THROUGH THE PANEL THAT RUNS THEM.

   Added 2026-09-28 on the founder's call that connected devices are where the niche is: a named area of the
   page, not the identity of the company. It is deliberately NOT a scroll scene and NOT a demo. A device demo
   (a simulated drone console and a real recorded run) is being built separately and will sit in the demos
   section; this chapter is static copy on the site's ordinary card grid, so it adds no motion and no fixture.

   THE HONEST LINE, and every card holds to it. What works today is the device's WEB CONTROL PANEL: that is
   a web app, so it is the same real-browser check as everything else on this page. Reading the device
   itself (firmware, sensors, telemetry) is not built, and the third card says so in its first words. It also
   says Vraelis does not certify safety, which _content/coverage.ts states as a rule for every device line.

   Light ground between two graphite chapters (Standard above, the loop below), which keeps the page's
   alternation intact.
   ------------------------------------------------------------------------------------------------- */
export function Devices() {
  return (
    <section className="v6-sec v6-sec--sunk" id="devices" data-nav-theme="light">
      <div className="v6-wrap">
        <Reveal>
          <SectionHead
            eyebrow="Connected devices"
            title="Drones, robots and fleets, checked through the panel that runs them."
            lead="Most connected hardware is run from a web control panel. Vraelis checks it there, the same way it checks any web app: an operator action goes in, and a real browser reads the state the system reports afterwards."
          />
        </Reveal>
        <div className="v6-grid3">
          <Reveal className="v6-gcard">
            {/* A roadmap tier, not a result, so the neutral tier chip rather than a state colour. */}
            <p style={{ margin: "0 0 14px" }}><span className="v6-tier" data-tier="live">Works today</span></p>
            <h3>Through the control panel</h3>
            <p>Vraelis opens the device&rsquo;s web control panel or dashboard in a real browser, takes the action the claim names, and checks what the panel reports afterwards, including after a reload.</p>
          </Reveal>
          <Reveal className="v6-gcard" i={1}>
            <p style={{ margin: "0 0 14px" }}><Kicker>An example claim</Kicker></p>
            <h3>&ldquo;After an operator presses Return home, the drone shows Landed, and still does after a reload.&rdquo;</h3>
            <p>You see every step the browser took on the panel, a screenshot, and anything that went wrong, like any other check.</p>
          </Reveal>
          <Reveal className="v6-gcard" i={2}>
            <p style={{ margin: "0 0 14px" }}><span className="v6-tier" data-tier="next">Not built yet</span></p>
            <h3>Checks on the device itself</h3>
            <p>Reading firmware, sensors or telemetry directly is not built. Today Vraelis sees only what the control panel shows, and it does not certify that any device is safe.</p>
          </Reveal>
        </div>
        <Reveal style={{ marginTop: 26 }}>
          <EditorialLink href={`${BASE}/platform#coverage`}>What it can reach</EditorialLink>
        </Reveal>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════ CHAPTER 6 ══
   THE LOOP, ONCE, IN THE ORDER IT HAPPENS.

   This chapter was "The software changes. What the business depends on does not.": eight illustrative
   business guarantees grouped by consequence. It sold the guarantee as the product, and on 2026-09-28 the
   founder locked the public story on one thing instead: one sentence about what a deployed web app should
   do, checked on the live app, answered with evidence. A guarantee is still in the product (a claim saved so
   it can be checked again), but it is a console concept now, not the pitch.

   THE COMPOSITION IS KEPT and only the copy changed: four groups of two rows arriving on --p, with a narrow
   second column naming who acts. Every row is a rule the code enforces today: the plan is derived from the
   sentence, a person approves it (POST /v1/verifications/plans/{id}/approve refuses every API key with
   plan_requires_human), a real browser runs it, the answer carries the evidence, and a re-check reuses the
   approved plan inside the limits in lib/preflight/recheck.ts (24 hours, 10 re-checks, same scheme and
   host). The "who" column says whoever asks, never a specific assistant: the audience is wide on purpose.
   ------------------------------------------------------------------------------------------------- */
type Step = { t: string; who: string };
const STEPS: { h: string; rows: Step[] }[] = [
  { h: "Say what should work", rows: [
    { t: "One sentence about the deployed app: a signed-in user can cancel their plan from Billing.",
      who: "Whoever asks" },
    { t: "Vraelis turns it into a plan: what the sentence requires and the browser steps that prove it.",
      who: "Vraelis" },
  ] },
  { h: "Approve the plan", rows: [
    { t: "A person reads the requirements and the steps, and approves with one click.",
      who: "A person" },
    { t: "An API key cannot approve a plan, so no script or agent signs off on its own check.",
      who: "Rule" },
  ] },
  { h: "Try it on the live app", rows: [
    { t: "A real browser opens the deployed app and follows the approved steps.",
      who: "Vraelis" },
    { t: "Verified, Failed or Blocked comes back with steps, screenshots, console errors and failed requests.",
      who: "Vraelis" },
  ] },
  { h: "Fix and re-check", rows: [
    { t: "On Failed: expected against observed, and a repair prompt for whoever fixes it.",
      who: "Vraelis" },
    { t: "After the fix, the same plan runs again with no new approval, for 24 hours, up to 10 times.",
      who: "Rule" },
  ] },
];

export function Loop() {
  const wrap = useRef<HTMLDivElement>(null);
  useScrollProgress(wrap);
  return (
    <section className="v6-rg" data-nav-dark data-nav-theme="dark" ref={wrap}>
      <div className="v6-rg__pin">
        <div className="v6-rg__head">
          <p className="v6-eyebrow">How a check runs</p>
          <h2 className="v6-rg__h">From one sentence to one answer, on the live app.</h2>
        </div>

        <div className="v6-rg__stage">
          <div className="v6-rg__cols" aria-hidden>
            <span>Step</span><span>Who</span>
          </div>

          {STEPS.map((g, gi) => (
            <section key={g.h} className="v6-rg__grp" style={{ ["--g" as string]: gi }}>
              <h3 className="v6-rg__gh">{g.h}</h3>
              {g.rows.map((r, ri) => (
                <article key={r.t} className="v6-rg__row" style={{ ["--i" as string]: gi * 2 + ri }}>
                  <div className="v6-rg__gcell"><p className="v6-rg__t">{r.t}</p></div>
                  <p className="v6-rg__m">{r.who}</p>
                </article>
              ))}
            </section>
          ))}
        </div>

        <p className="v6-rg__foot">
          Every run, a re-check included, is billed as one verification. Vraelis looks at the running app in
          a browser. It does not read your code, and it does not watch anyone while they work.
        </p>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════ CHAPTER 7A: REACH ══
   WHERE THE ANSWER LANDS.

   Seven fragments, each drawn as the surface it actually is, staggered across three stages so the
   composition moves left to right and down rather than sitting in equal columns. Rewritten 2026-09-28 around
   the four ways a check is started and read: the console, the CLI, CI through the API, and an AI assistant
   over MCP. None of the four is the identity; they sit side by side, which is the point of the chapter.

   Every fragment is a real shape: vraelis_verify is the MCP tool name, the terminal is the installed CLI and
   its exit code, POST /v1/verifications answers a first submit with state review_required, the approval
   page lives at app.vraelis.com/review, verification.completed is the webhook event, and the Slack delivery
   is the formatted message the webhook dispatcher sends. The pull request check that used to open this
   chapter is gone: nothing in the product posts a check to a pull request.

   The identifier appears ONCE, on the Vraelis decision itself. The composition is labelled illustrative on
   the page.
   ------------------------------------------------------------------------------------------------- */

export function Reach() {
  const root = useRef<HTMLElement>(null);
  const seen = useSeen(root, 3);
  return (
    <section className="v6-rx" data-nav-theme="light" ref={root}>
      <div className="v6-rx__head">
        <p className="v6-eyebrow">Where it lands</p>
        <h2 className="v6-rx__h">One answer, wherever you work.</h2>
        <p className="v6-rx__sub">
          Start a check from the Vraelis console, the CLI, a CI job through the API, or an AI assistant over
          MCP. The answer comes back to the same place, and a webhook can send it on to your team.
        </p>
      </div>

      <div className="v6-rx__flow">
        {/* ── ask ── */}
        <p className="v6-rx__stage" data-i="0" data-on={seen > 0}><span>Ask</span></p>

        <figure className="v6-rx__f v6-rx__f--gh" data-i="0" data-on={seen > 0}>
          <figcaption className="v6-rx__fcap">AI assistant, over MCP</figcaption>
          <div className="v6-rx__ghrow">
            <span className="v6-rx__ghtick" aria-hidden>&#10003;</span>
            <span className="v6-rx__ghname">vraelis_verify</span>
            <span className="v6-rx__ghstate">Verified</span>
          </div>
          <div className="v6-rx__ghrow is-sub">
            <span className="v6-rx__ghtick" aria-hidden />
            <span className="v6-rx__ghsay">The answer goes back to the assistant that asked.</span>
          </div>
        </figure>

        <figure className="v6-rx__f v6-rx__f--cli" data-i="0" data-on={seen > 0}>
          <figcaption className="v6-rx__fcap">Terminal or CI</figcaption>
          {/* built from an array rather than inline JSX: JSX collapses the source indentation between
              elements into single spaces, which silently shifted every line of the transcript */}
          <pre className="v6-rx__term">
            <code>
              <span className="v6-rx__p">{"$ "}</span><span className="v6-rx__cmd">{"vraelis verify --wait\n"}</span>
              <span className="v6-rx__dim">{"approved, running on the live app\n"}</span>
              <span className="v6-rx__ok">{"verified\n"}</span>
              <span className="v6-rx__p">{"$ "}</span><span className="v6-rx__cmd">{"echo $?\n"}</span>
              <span className="v6-rx__cmd">{"0"}</span>
            </code>
          </pre>
        </figure>

        {/* ── approve ── */}
        <p className="v6-rx__stage" data-i="1" data-on={seen > 1}><span>Approve</span></p>

        <figure className="v6-rx__f v6-rx__f--api" data-i="1" data-on={seen > 1}>
          <figcaption className="v6-rx__fcap"><b className="v6-mono">POST</b> /v1/verifications</figcaption>
          <pre className="v6-rx__json">
            <code>{`{
  "state": "review_required",
  "human_reviewed": false
}`}</code>
          </pre>
        </figure>

        <figure className="v6-rx__f v6-rx__f--dep" data-i="1" data-on={seen > 1}>
          <figcaption className="v6-rx__fcap">Approval</figcaption>
          <div className="v6-rx__dep">
            <span className="v6-rx__mark" aria-hidden />
            <div>
              <p className="v6-rx__depn">app.vraelis.com/review</p>
              <p className="v6-rx__depsay">A person approves the plan once. No API key can.</p>
            </div>
          </div>
        </figure>

        {/* ── answer ── */}
        <p className="v6-rx__stage" data-i="2" data-on={seen > 2}><span>Answer</span></p>

        <figure className="v6-rx__f v6-rx__f--hook" data-i="2" data-on={seen > 2}>
          <figcaption className="v6-rx__fcap">Webhook</figcaption>
          <pre className="v6-rx__json">
            <code>{`{ "event":    "verification.completed",
  "decision": "verified" }`}</code>
          </pre>
        </figure>

        <figure className="v6-rx__f v6-rx__f--dec" data-i="2" data-on={seen > 2}>
          <figcaption className="v6-rx__fcap">Vraelis console</figcaption>
          <p className="v6-rx__decv">Verified</p>
          <p className="v6-rx__decsay">The decision, the evidence, and every earlier run of the same check.</p>
        </figure>

        <figure className="v6-rx__f v6-rx__f--slack" data-i="2" data-on={seen > 2}>
          <figcaption className="v6-rx__fcap">Team channel</figcaption>
          <div className="v6-rx__msg">
            <span className="v6-rx__av" aria-hidden>
              <svg viewBox={MARK_VIEWBOX} width="13" height="13"><path d={MARK_PATH} fill="currentColor" /></svg>
            </span>
            <div>
              <p className="v6-rx__who">Vraelis<em>app</em></p>
              <p className="v6-rx__said">A verification finished: Verified. The evidence is linked.</p>
            </div>
          </div>
        </figure>
      </div>

      <p className="v6-rx__ill">Illustrative. These are the real places an answer reaches. No customer, repository or run shown here is a real one.</p>
    </section>
  );
}

/* THE DIRECTION CHAPTER THAT USED TO SIT HERE IS GONE (2026-09-28).
   It was "The operating memory of an AI-built company": a Compile, Challenge and Accumulate roadmap that
   ended in a durable graph of guarantees, systems, owners and decisions. It was labelled Direction three
   times and was still the largest idea on the page, which is how a reader came away thinking the company
   sells a future graph rather than a check they can run today. The founder took it out of the public story.
   Its stylesheet rules (.v6-dr) and the mobile-motion selectors for it are left in place and render nothing;
   remove them together if they are ever cleaned up, because scripts/mobile-motion-verify.ts pairs them. */

/* ══════════════════════════════════════ CHAPTER 7B — KNOWLEDGE ══
   A PUBLICATION, not a card grid.

   The previous version put the Method, the documentation and the changelog in three equal columns that
   all began on the same rule, which is the flattest arrangement available. This is composed instead:

     the Method sheet      dominant, a white document on the grey ground, with a visible page edge
     the documentation     a second sheet, lifted above the top line and cropped by the page edge
     the API fragment      an exhibit slipped across the lower corner of the Method sheet
     the changelog         a dated vertical rail running down beside the sheet

   Every word is the real published text of the surface it links to.
   ------------------------------------------------------------------------------------------------- */
export function Knowledge() {
  const recent = CHANGELOG.slice(0, 5);
  const doc = DOCS.find((d) => d.slug === "completion")!;
  // Entry progress, not a threshold: the Method statement resolves through one spectral pass as the
  // section rises into view, scrubbing in both directions with the reader's exact scroll position.
  const root = useRef<HTMLElement>(null);
  useScrollProgress(root, { measure: entryProgress(0.92) });
  return (
    <section className="v6-kn" data-nav-theme="light" ref={root}>
      <div className="v6-kn__in">
        <p className="v6-eyebrow v6-kn__eyebrow">Written down</p>

        <div className="v6-kn__field">
          {/* the dominant document */}
          <Link href={`${BASE}/method`} className="v6-kn__sheet">
            <p className="v6-kn__run"><span>The Vraelis Method</span><span>Position 2 of 8</span></p>
            <blockquote className="v6-kn__q">
              <Spectral sv="clamp(0, calc((var(--p) - 0.18) / 0.78), 1)"
                text="An agent that plans, writes, and repairs the work will also tell you it is finished." />
            </blockquote>
            <p className="v6-kn__qp">
              The system that produced the work should not be the only authority on whether it succeeded.
              Independence is structural.
            </p>
            <span className="v6-kn__more">Read all eight positions<span className="v6-arw" aria-hidden>→</span></span>
          </Link>

          {/* the right column: a second sheet lifted above the top line and running off the page edge,
              with the dated rail directly beneath it */}
          <div className="v6-kn__col">
          <Link href={`${BASE}/docs/${doc.slug}`} className="v6-kn__doc">
            <p className="v6-kn__run"><span>Documentation</span><span>{doc.group}</span></p>
            <p className="v6-kn__doct">{doc.title}</p>
            <p className="v6-kn__docb">{doc.summary}</p>
            <span className="v6-kn__more">Open the page<span className="v6-arw" aria-hidden>→</span></span>
          </Link>

          {/* the dated rail */}
          <Link href={`${BASE}/changelog`} className="v6-kn__rail">
            <p className="v6-kn__railh">Changelog</p>
            <ol className="v6-kn__rl">
              {recent.map((c) => (
                <li key={c.title}>
                  <span className="v6-kn__rd v6-mono">{c.date}</span>
                  <span className="v6-kn__rt">{c.title}</span>
                </li>
              ))}
            </ol>
            <span className="v6-kn__more">Everything that shipped<span className="v6-arw" aria-hidden>→</span></span>
          </Link>
          </div>

          {/* the exhibit, slipped across the lower corner of the Method sheet */}
          <figure className="v6-kn__ex">
            <figcaption>Exhibit: a decision, read back</figcaption>
            <pre>{`GET /v1/verifications/{id}

{
  "decision": "verified",
  "claim": "A paid customer keeps Pro access after signing back in."
}`}</pre>
          </figure>

        </div>

        <Link href={`${BASE}/docs`} className="v6-kn__cta">Read the documentation<span className="v6-arw" aria-hidden>→</span></Link>
      </div>
    </section>
  );
}
