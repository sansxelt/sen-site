"use client";

// CHAPTERS 2-6 of the homepage.
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

/* ══════════════════════════════════════════════════════════════ CHAPTER 2 ══
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
  "Which systems the change actually reached.",
  "Whether the outcomes the business depends on still hold.",
  "What moved somewhere nobody was looking.",
];

export function Gap() {
  const wrap = useRef<HTMLDivElement>(null);
  useScrollProgress(wrap);
  return (
    <section className="v6-gap" id="gap" data-nav-theme="light" ref={wrap}>
      <div className="v6-gap__pin">
        <div className="v6-gap__stage">
          {/* COLLAPSED TO ONE BEAT. This chapter argued the hero's point three more times before the reader
              reached anything concrete — "Complete." struck through, then what the claim does not cover,
              then the resolution — and a skimmer could bounce before the CLI demo. Only the resolution is
              kept, because it is the one that names Vraelis and ends the tension rather than restating it.

              COMMENTED OUT, NOT DELETED, as asked: both travellers below are intact and restoring them is
              uncommenting them and putting .v6-gap's height and timings back (see the note in chapters.css).
              Their CSS is left in place for the same reason. UNCOVERED is still exported above.

          <div className="v6-gap__t v6-gap__claim">
            <p className="v6-gap__label">The agent reported</p>
            <p className="v6-gap__word">
              <span className="v6-gap__wordt">Complete.</span>
              <span className="v6-gap__strike" aria-hidden />
            </p>
            <p className="v6-gap__turn">An assertion, made by the thing that wrote the work.</p>
          </div>

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

/* ══════════════════════════════════════════════════════════════ CHAPTER 3 ══
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
            four refusals run on the verification API, the path the CLI takes, before a run exists.
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

/* ══════════════════════════════════════════════════════════════ CHAPTER 4 ══
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
   sandbox, so nothing is executed and nothing leaves the page. The window controls are chrome and are
   aria-hidden, because they do nothing and must not be announced as buttons.
   ------------------------------------------------------------------------------------------------- */
type LK = "cmd" | "out" | "dim" | "go" | "stop" | "wait";
type Line = { k: LK; t: string };
const CMD = 'node vraelis.mjs verify --url https://app.example.com --claim "A paid customer keeps Pro access after signing back in."';
const RUN: Line[] = [
  { k: "dim", t: "reading the claim" },
  { k: "out", t: "obligations derived, one needs a second session" },
  { k: "dim", t: "plan minted, awaiting approval" },
  { k: "out", t: "plan approved" },
  { k: "dim", t: "opening a real browser against the deployment" },
  { k: "out", t: "paid, signed out, signed back in" },
  { k: "dim", t: "checking the obligation that needs a second session" },
  { k: "stop", t: "the account did not keep Pro after signing back in" },
  { k: "out", t: "evidence written to the record" },
];
const EXITS: [string, string, string, "go" | "stop" | "wait"][] = [
  ["0", "Verified", "The run completed and every checked flow passed.", "go"],
  ["1", "Failed", "The evidence contradicts it.", "stop"],
  ["2", "Blocked", "It could not be checked, which is not success.", "wait"],
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
        { k: "out", t: 'node vraelis.mjs verify --url <deployment> --claim "<outcome>"' },
        { k: "dim", t: "  --url     the deployment to verify, https and reachable" },
        { k: "dim", t: "  --claim   what should be true, as a sentence" },
        { k: "out", t: "exit codes  0 verified   1 failed   2 blocked" },
        { k: "dim", t: "this window runs nothing: it demonstrates the shape of a real run" },
      ];
    case "node":
    case "vraelis":
      if (rest[0] !== "verify") return say(`vraelis: unknown subcommand '${rest[0] ?? ""}'. try: node vraelis.mjs verify`, "dim");
      if (!cmd.includes("--url")) return say("vraelis: --url is required. try: help", "stop");
      if (!cmd.includes("--claim")) return say("vraelis: --claim is required. try: help", "stop");
      return [
        { k: "dim", t: "reading the claim" },
        { k: "out", t: "obligations derived, plan minted, awaiting approval" },
        { k: "wait", t: "blocked: this sandbox cannot reach a deployment" },
        { k: "dim", t: "exit 2. blocked is not success, which is the whole point." },
      ];
    // Anything outside the implemented set is NOT answered with invented shell output. Fabricating a
    // filesystem or a result would be the exact thing this product exists to catch.
    default:
      return [
        { k: "dim", t: `${head}: not part of this demonstration` },
        { k: "dim", t: "implemented here: verify, help, clear" },
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

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => {
      for (const e of es) {
        if (e.isIntersecting && !played.current) { played.current = true; play(); }
      }
    }, { threshold: 0.45 });
    io.observe(el);
    const t = timers.current;
    return () => { io.disconnect(); t.forEach(clearTimeout); };
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
            <span className="v6-tm__lights" aria-hidden>
              <i className="is-close" /><i className="is-min" /><i className="is-max" />
            </span>
            <span className="v6-tm__title">vraelis repository CLI</span>
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

/* ══════════════════════════════════════════════════════════════ CHAPTER 5 ══
   THE SOFTWARE CHANGES. THE PROMISE DOES NOT.

   This is the hinge where the page stops being about one verification.

   An earlier version of this chapter invented history: run totals and years like "148 runs since 2024".
   Vraelis did not exist then, and manufacturing usage to make a page feel established is exactly the
   dishonesty this company is supposed to be the answer to. There are no counts, no dates and no customer
   activity anywhere in here.

   What is shown instead is the argument: eight durable business guarantees grouped by consequence, with
   the implementation churning underneath them. The services, deployments and agents beneath each
   guarantee keep changing as the reader scrolls. The guarantee text never moves. That IS the point, and
   it is made by the composition rather than by a sentence claiming it.

   The guarantees are illustrative and labelled as such. Decisions use only the product's real vocabulary:
   Verified, Failed, Blocked.
   ------------------------------------------------------------------------------------------------- */
/* AUDITED. This carried an owner, a current decision and a churning list of service names for each row:
   4 invented teams, 8 fictional decisions including a Failed and a Blocked, and 32 invented service names.
   None of it exists. A page that manufactures a company's org chart and its verdicts to look established is
   the dishonesty this product is supposed to answer.

   What survives is the part that was always the argument: the guarantee sentences themselves, grouped by
   consequence. What attaches to a guarantee over time is now stated as RELATIONSHIP TYPES once, below the
   list, rather than filled in with invented values. */
type G = { t: string; area: string };
const GROUPS: { h: string; rows: G[] }[] = [
  { h: "Revenue", rows: [
    { t: "A customer who pays receives the correct plan and keeps it after signing back in.",
      area: "Revenue" },
    { t: "Cancelling a subscription stops future billing without removing access early.",
      area: "Revenue" },
  ] },
  { h: "Identity and access", rows: [
    { t: "A deactivated employee loses access across every connected system.",
      area: "Security" },
    { t: "A role change persists after a new session and cannot cross tenant boundaries.",
      area: "Security" },
  ] },
  { h: "Customer operations", rows: [
    { t: "A completed order reaches fulfillment exactly once.",
      area: "Operations" },
    { t: "A refund returns the correct amount and updates the customer's account.",
      area: "Operations" },
  ] },
  { h: "Data boundaries", rows: [
    { t: "An export contains only the requesting tenant's data.",
      area: "Security" },
    { t: "Deleting an account removes access without deleting records the business must retain.",
      area: "Compliance" },
  ] },
];

export function Register() {
  const wrap = useRef<HTMLDivElement>(null);
  useScrollProgress(wrap);
  return (
    <section className="v6-rg" data-nav-dark data-nav-theme="dark" ref={wrap}>
      <div className="v6-rg__pin">
        <div className="v6-rg__head">
          <p className="v6-eyebrow">Illustrative business guarantees</p>
          <h2 className="v6-rg__h">The software changes. What the business depends on does not.</h2>
        </div>

        <div className="v6-rg__stage">
          <div className="v6-rg__cols" aria-hidden>
            <span>Guarantee</span><span>Business area</span>
          </div>

          {GROUPS.map((g, gi) => (
            <section key={g.h} className="v6-rg__grp" style={{ ["--g" as string]: gi }}>
              <h3 className="v6-rg__gh">{g.h}</h3>
              {g.rows.map((r, ri) => (
                <article key={r.t} className="v6-rg__row" style={{ ["--i" as string]: gi * 2 + ri }}>
                  <div className="v6-rg__gcell"><p className="v6-rg__t">{r.t}</p></div>
                  <p className="v6-rg__m">{r.area}</p>
                </article>
              ))}
            </section>
          ))}
        </div>

        <p className="v6-rg__foot">
          Illustrative guarantees, not customer records. What is real is the shape of the object: a
          business outcome that keeps its own scope, ownership and decision while the systems underneath
          it are rewritten.
        </p>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════ CHAPTER 6A — REACH ══
   WHERE THE RESULT LANDS.

   The previous version was a three column directory of names and one line of text each: true, but nothing
   about it showed a result travelling anywhere. This is authored instead: seven fragments, each drawn as
   the surface it actually is, staggered across three stages so the composition moves left to right and
   down rather than sitting in equal columns.

   The identifier appears ONCE, on the Vraelis decision itself. It used to repeat on all seven surfaces,
   which made an authored diagram start to read as a captured production record no matter what the
   disclosure said. The composition is labelled illustrative on the page.
   ------------------------------------------------------------------------------------------------- */

export function Reach() {
  const root = useRef<HTMLElement>(null);
  const seen = useSeen(root, 3);
  return (
    <section className="v6-rx" data-nav-theme="light" ref={root}>
      <div className="v6-rx__head">
        <p className="v6-eyebrow">Where it lands</p>
        <h2 className="v6-rx__h">One decision, wherever the work happens.</h2>
        <p className="v6-rx__sub">
          A verification can be read in Vraelis, returned through the API and CLI, attached to the
          deployment, and delivered to the team responsible for the system.
        </p>
      </div>

      <div className="v6-rx__flow">
        {/* ── build ── */}
        <p className="v6-rx__stage" data-i="0" data-on={seen > 0}><span>Build</span></p>

        <figure className="v6-rx__f v6-rx__f--gh" data-i="0" data-on={seen > 0}>
          <figcaption className="v6-rx__fcap">Pull request check</figcaption>
          <div className="v6-rx__ghrow">
            <span className="v6-rx__ghtick" aria-hidden>&#10003;</span>
            <span className="v6-rx__ghname">Vraelis / guarantee</span>
            <span className="v6-rx__ghstate">Passed</span>
          </div>
          <div className="v6-rx__ghrow is-sub">
            <span className="v6-rx__ghtick" aria-hidden />
            <span className="v6-rx__ghsay">Attached to the work that produced the deployment.</span>
          </div>
        </figure>

        <figure className="v6-rx__f v6-rx__f--cli" data-i="0" data-on={seen > 0}>
          <figcaption className="v6-rx__fcap">Terminal</figcaption>
          {/* built from an array rather than inline JSX: JSX collapses the source indentation between
              elements into single spaces, which silently shifted every line of the transcript */}
          <pre className="v6-rx__term">
            <code>
              <span className="v6-rx__p">{"$ "}</span><span className="v6-rx__cmd">{"node vraelis.mjs verify\n"}</span>
              <span className="v6-rx__dim">{"crossing the deployed workflow\n"}</span>
              <span className="v6-rx__ok">{"verified\n"}</span>
              <span className="v6-rx__p">{"$ "}</span><span className="v6-rx__cmd">{"echo $?\n"}</span>
              <span className="v6-rx__cmd">{"0"}</span>
            </code>
          </pre>
        </figure>

        {/* ── deploy ── */}
        <p className="v6-rx__stage" data-i="1" data-on={seen > 1}><span>Deploy</span></p>

        <figure className="v6-rx__f v6-rx__f--api" data-i="1" data-on={seen > 1}>
          <figcaption className="v6-rx__fcap"><b className="v6-mono">POST</b> /v1/verifications</figcaption>
          <pre className="v6-rx__json">
            <code>{`{
  "decision":  "verified",
  "guarantee": "pro-access"
}`}</code>
          </pre>
        </figure>

        <figure className="v6-rx__f v6-rx__f--dep" data-i="1" data-on={seen > 1}>
          <figcaption className="v6-rx__fcap">Deployment</figcaption>
          <div className="v6-rx__dep">
            <span className="v6-rx__mark" aria-hidden />
            <div>
              <p className="v6-rx__depn">Production deployment</p>
              <p className="v6-rx__depsay">The result belongs to the running product, not only the branch.</p>
            </div>
          </div>
        </figure>

        {/* ── decide ── */}
        <p className="v6-rx__stage" data-i="2" data-on={seen > 2}><span>Decide</span></p>

        <figure className="v6-rx__f v6-rx__f--hook" data-i="2" data-on={seen > 2}>
          <figcaption className="v6-rx__fcap">Webhook</figcaption>
          <pre className="v6-rx__json">
            <code>{`{ "event":    "verification.completed",
  "decision": "verified" }`}</code>
          </pre>
        </figure>

        <figure className="v6-rx__f v6-rx__f--dec" data-i="2" data-on={seen > 2}>
          <figcaption className="v6-rx__fcap">Vraelis</figcaption>
          <p className="v6-rx__decv">Verified</p>
          <p className="v6-rx__decsay">The complete decision, the evidence, and the previous history.</p>
        </figure>

        <figure className="v6-rx__f v6-rx__f--slack" data-i="2" data-on={seen > 2}>
          <figcaption className="v6-rx__fcap">Team channel</figcaption>
          <div className="v6-rx__msg">
            <span className="v6-rx__av" aria-hidden>
              <svg viewBox={MARK_VIEWBOX} width="13" height="13"><path d={MARK_PATH} fill="currentColor" /></svg>
            </span>
            <div>
              <p className="v6-rx__who">Vraelis<em>app</em></p>
              <p className="v6-rx__said">A guarantee changed decision. The evidence is attached.</p>
            </div>
          </div>
        </figure>
      </div>

      <p className="v6-rx__ill">Illustrative. These are the real surfaces a decision reaches. No customer, repository or run shown here is a real one.</p>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════ CHAPTER 7 ══
   DIRECTION. THE ONLY UNSHIPPED CHAPTER ON THE PAGE, AND IT SAYS SO.

   Chapters 1 to 6 are shipped-only on purpose: independent verification, deployed browser execution,
   requirements and plan sufficiency, Verified / Failed / Blocked, evidence, repair handoff,
   reverification, preserved history, and the CLI, API and integrations that genuinely exist. That is what
   earns the right to say anything at all here.

   This chapter is where the company goes, and it is labelled DIRECTION in the eyebrow, again in a visible
   disclosure inside the chapter, and again on every future layer. It does NOT present three separate
   future products. The compiler, the challenge to sufficiency, and the graph are three layers of one
   system, and the page says which part of each exists today.

   The honest split, taken from the implementation:
     SHIPPED    a guarantee compiles into structured requirements and a browser plan, deterministic
                checks decide whether that plan can prove the claim, and a plan that cannot returns
                Blocked rather than a guess.
     DIRECTION  the same compilation across many guarantees, a system that challenges whether the plan
                and the evidence were sufficient, and the durable graph the two produce over years.

   The visual keeps the guarantee text fixed and reveals relationships beneath it: systems shared between
   guarantees, one deployment touching several, owners, and prior evidence still attached. It resolves
   into a legible operational structure, not a glowing network.
   ------------------------------------------------------------------------------------------------- */
const LAYERS: { k: string; h: string; now: string; next: string }[] = [
  {
    k: "Compile",
    h: "A business sentence becomes something provable.",
    now: "A guarantee compiles into structured requirements and a browser plan, and deterministic checks refuse a plan when they can detect an obligation it misses.",
    next: "Across every guarantee a company holds, with the obligations and environments they share.",
  },
  {
    k: "Challenge",
    h: "The plan and the evidence are questioned, not trusted.",
    now: "A plan that cannot prove the claim returns Blocked instead of a guess.",
    next: "Varying identity, tenant and session between runs, and checking relationships that must hold, so a result cannot be passed by learning the test.",
  },
  {
    k: "Accumulate",
    h: "What the company must keep true, and everything learned proving it.",
    now: "Every run, decision and repair stays attached to the guarantee it belongs to.",
    next: "Those guarantees, systems, owners, dependencies, evidence and decisions become one durable graph.",
  },
];

export function Direction() {
  const wrap = useRef<HTMLDivElement>(null);
  useScrollProgress(wrap);
  return (
    <section className="v6-dr" data-nav-dark data-nav-theme="dark" ref={wrap}>
      <div className="v6-dr__pin">
        <div className="v6-dr__head">
          <p className="v6-eyebrow v6-dr__label">Direction</p>
          <h2 className="v6-dr__h">The operating memory of an AI-built company.</h2>
          <p className="v6-dr__sub">
            Today, Vraelis verifies one deployed outcome at a time. Over time, every guarantee, system,
            owner, dependency, failure, repair and decision forms a living record of what the company must
            keep true.
          </p>
        </div>

        <div className="v6-dr__stage">
          {/* the structure assembles beneath the guarantees rather than replacing them */}
          <svg className="v6-dr__graph" viewBox="0 0 900 420" aria-hidden preserveAspectRatio="xMidYMid meet">
            {/* guarantees, fixed */}
            {[
              { y: 70, a: "A paying customer keeps", b: "the plan they purchased" },
              { y: 175, a: "A deactivated employee", b: "loses access everywhere" },
              { y: 280, a: "An export contains only", b: "that tenant's records" },
            ].map((g, i) => (
              <g key={g.y} className="v6-dr__g" style={{ ["--i" as string]: i }}>
                <rect x="24" y={g.y} width="250" height="58" rx="6" />
                <text x="40" y={g.y + 24}>{g.a}</text>
                <text x="40" y={g.y + 43}>{g.b}</text>
                <line x1="24" y1={g.y + 58} x2="274" y2={g.y + 58} />
              </g>
            ))}
            {/* systems, shared between guarantees */}
            {[
              { x: 430, y: 40, l: "billing" },
              { x: 430, y: 160, l: "identity" },
              { x: 430, y: 280, l: "records" },
            ].map((n, i) => (
              <g key={n.l} className="v6-dr__n" style={{ ["--i" as string]: i }}>
                <rect x={n.x} y={n.y} width="130" height="46" rx="6" />
                <text x={n.x + 65} y={n.y + 28}>{n.l}</text>
              </g>
            ))}
            {/* one deployment touching several outcomes */}
            <g className="v6-dr__dep">
              <rect x="690" y="150" width="170" height="52" rx="6" />
              <text x="775" y="181">one deployment</text>
            </g>
            {/* the relationships: drawn, not implied */}
            {[
              "M274 99 C 350 99, 360 63, 430 63",
              "M274 99 C 350 99, 360 183, 430 183",
              "M274 204 C 350 204, 360 183, 430 183",
              "M274 309 C 350 309, 360 303, 430 303",
              "M274 309 C 350 309, 360 183, 430 183",
              "M560 63 C 630 63, 640 176, 690 176",
              "M560 183 C 630 183, 640 176, 690 176",
              "M560 303 C 630 303, 640 176, 690 176",
            ].map((d, i) => (
              <path key={d} className="v6-dr__edge" d={d} style={{ ["--i" as string]: i }} />
            ))}
          </svg>

          <ol className="v6-dr__layers">
            {LAYERS.map((l, i) => (
              <li key={l.k} className="v6-dr__layer" style={{ ["--i" as string]: i }}>
                <p className="v6-dr__lk">{l.k}</p>
                <p className="v6-dr__lh">{l.h}</p>
                <p className="v6-dr__now"><span>Today</span>{" "}{l.now}</p>
                <p className="v6-dr__next"><span>Direction</span>{" "}{l.next}</p>
              </li>
            ))}
          </ol>
        </div>

        <p className="v6-dr__disc">Direction shown here extends beyond the currently available product.</p>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════ CHAPTER 6B — KNOWLEDGE ══
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
            <p className="v6-kn__run"><span>The Vraelis Method</span><span>Position 3 of 9</span></p>
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
