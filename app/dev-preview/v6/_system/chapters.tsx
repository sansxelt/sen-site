"use client";

// CHAPTERS 2-6 of the homepage.
//
// Each one is a full-screen chapter with a single dominant visual and almost no copy. The rule applied
// throughout: one idea per viewport, the visual IS the section, and every explanation that used to sit on
// this page now lives on /platform, /method, /research or /docs where a reader has asked for it.
//
// Backgrounds alternate graphite / stone at every chapter boundary, so scrolling reads as changes of
// atmosphere rather than as a stack of modules.
import { useEffect, useRef, useState, type RefObject } from "react";
import { useScrollProgress, entryProgress } from "./progress";
import { Spectral } from "./spectral";
import Link from "next/link";
import { DOCS } from "../_content/docs";
import { CHANGELOG } from "../_content/changelog";
import "./chapters.css";

const BASE = "/dev-preview/v6";

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

   Verified is the most dangerous word the product can say. It is issued only when all eight conditions
   hold at once; any one unmet and the honest answer is Failed, or Blocked. That is also why Blocked
   exists as a first-class answer, which most tools refuse to say.

   The motif is the company's own: a gapped ring. The centre holds the claim, the outer path is the
   independent verification closing around it, one segment per condition. The ring only closes when every
   segment does, and the conclusion resolves in the centre only after it has.
   ------------------------------------------------------------------------------------------------- */
const STANDARD: [string, string][] = [
  ["The business requirement is preserved", "Not quietly softened into something easier to pass."],
  ["The plan can actually prove it", "Every clause maps to an obligation and an observable assertion."],
  ["The real product was exercised", "The deployed software, not a mock and not the source."],
  ["The evidence supports the conclusion", "Read from what the run captured, not from its own summary."],
  ["The result is scoped", "What it covers, and just as plainly what it does not."],
  ["The plan is not stale", "Still valid for the deployment it ran against."],
  ["The work could not grade itself", "The system that wrote it cannot approve it."],
  ["The record is inspectable", "Anyone can check the conclusion against the evidence."],
];

export function Standard() {
  const wrap = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const last = useRef(0);
  // The active condition derives from the SAME rendered progress that closes the ring, inside the engine's
  // frame callback, so the segment and the sentence can never disagree. React renders eight times across
  // the whole chapter; every frame between is CSS only.
  useScrollProgress(wrap, {
    onFrame: (p) => {
      // 0.06 to 0.86 carries the eight conditions; the rest is the arrival and the conclusion
      const k = Math.min(STANDARD.length - 1, Math.max(0, Math.floor(((p - 0.06) / 0.80) * STANDARD.length)));
      if (k !== last.current) { last.current = k; setAt(k); }
    },
  });
  return (
    <section className="v6-st" data-nav-dark data-nav-theme="dark" data-at={at} ref={wrap}>
      <div className="v6-st__pin">
        <div className="v6-st__head">
          <p className="v6-eyebrow">The standard</p>
          <h2 className="v6-st__h">Verified is the most dangerous word this product can say.</h2>
          <p className="v6-st__sub">
            It is issued only when all eight of these hold. Any one unmet and the honest answer is Failed,
            or Blocked.
          </p>
        </div>

        <div className="v6-st__stage">
          {/* the gapped ring: centre is the claim, the outer path is the verification closing around it */}
          <div className="v6-st__ringwrap">
            <svg className="v6-st__ring" viewBox="0 0 240 240" aria-hidden>
              <circle className="v6-st__track" cx="120" cy="120" r="104" />
              {STANDARD.map(([t], i) => (
                <circle key={t} className="v6-st__seg" cx="120" cy="120" r="104"
                  style={{ ["--i" as string]: i }} />
              ))}
            </svg>
            <div className="v6-st__centre">
              <p className="v6-st__count"><span>{at + 1}</span> of {STANDARD.length}</p>
              <p className="v6-st__verdict">Verified</p>
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
   INTERNAL PRODUCTION DEMONSTRATION, as a case file.

   Authored as a document rather than a chart. The earlier version drew seven events as points on two thin
   traces: at the width this section runs it read as an oscilloscope, the labels sat at 16-19px scattered
   across 1400px, and the decision was a plate resting on top of the last observation.

   The composition now carries five beats and nothing else:
     payment           one quiet statement, because it succeeded immediately and never failed again
     entitlement       four segments at full weight, because the guarantee lives in this lane
     the session wall  a solid division through the entitlement track, not a dashed hairline
     the decision      a separate area below, holding the observed outcome and the decision as two objects

   It is an authored reconstruction. No screenshot, no invented run identifier, no invented timestamp, and
   it says so on the page.
   ------------------------------------------------------------------------------------------------- */
type Beat = { s: "stop" | "none" | "go"; h: string; d: string };
const ENT: Beat[] = [
  { s: "stop", h: "Access was wrong", d: "An unauthorized account could read customer records." },
  { s: "none", h: "The first repair appeared to work", d: "Access appeared only inside the session that was already open." },
  { s: "stop", h: "Signing back in broke it again", d: "The apparent fix did not survive a new session." },
  { s: "go", h: "The second repair held", d: "A new session inherited the corrected permission." },
];

export function Proof() {
  const root = useRef<HTMLElement>(null);
  const seen = useSeen(root, 1);
  return (
    <section className="v6-pf" data-nav-theme="light" ref={root}>
      <div className="v6-pf__head">
        <p className="v6-eyebrow">Internal production demonstration</p>
        <h2 className="v6-pf__h">The work shipped. The guarantee did not hold.</h2>
        <p className="v6-pf__guar">
          <span>The guarantee</span>Only authorized staff can read customer records, and that stays true after signing back in.
        </p>
      </div>

      <div className="v6-pf__case" data-i="0" data-on={seen > 0}>
        {/* the lane that worked, stated once and kept quiet */}
        <div className="v6-pf__minor">
          <p className="v6-pf__lanen">The change shipped</p>
          <p className="v6-pf__minors">
            <span className="v6-pf__tick" aria-hidden />
            The work was written, reviewed and deployed without incident.
          </p>
        </div>

        {/* the lane the business actually depends on */}
        <div className="v6-pf__major">
          <p className="v6-pf__lanen">
            Access
            <em>where the guarantee actually lives</em>
          </p>

          <ol className="v6-pf__track">
            {ENT.slice(0, 2).map((e, i) => (
              <li key={e.h} className="v6-pf__seg" data-s={e.s} style={{ ["--i" as string]: i }}>
                <p className="v6-pf__segh">{e.h}</p>
                <p className="v6-pf__segd">{e.d}</p>
              </li>
            ))}

            {/* the turning point of the whole demonstration, drawn as a division rather than a hairline */}
            <li className="v6-pf__wall" style={{ ["--i" as string]: 2 }}>
              <span>Sign out<br />Sign back in</span>
            </li>

            {ENT.slice(2).map((e, i) => (
              <li key={e.h} className="v6-pf__seg" data-s={e.s} style={{ ["--i" as string]: i + 3 }}>
                <p className="v6-pf__segh">{e.h}</p>
                <p className="v6-pf__segd">{e.d}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* the decision is not the outcome: two objects, read left to right, with the reasoning between */}
        <div className="v6-pf__decide" style={{ ["--i" as string]: 5 }}>
          <div className="v6-pf__obs">
            <p className="v6-pf__dh">What the last run observed</p>
            <p className="v6-pf__dv">Access remained after signing back in.</p>
          </div>
          <div className="v6-pf__dec">
            <p className="v6-pf__dh">Decision</p>
            <p className="v6-pf__verd">Verified</p>
            <p className="v6-pf__dn">The original failure and incomplete repair remained preserved.</p>
          </div>
        </div>
      </div>

      <p className="v6-pf__disclose">Authored reconstruction of an internal production demonstration.</p>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════ CHAPTER 5 ══
   THE PERMANENT RECORD, as an archive.

   The previous version filed seven identical rounded rows down the page, which reads as a dashboard list
   no matter what the rows say. An archive does not look like that: one document is anchored, everything
   else is filed against a spine, and the KIND of each thing filed is legible before you read a word.

   Four kinds, four treatments:
     evidence    what a run observed. A bordered record with its own tab.
     change      what was altered between runs. No card at all: a note filed against the spine.
     decision    a person accepting something, with the signature line the other kinds do not have.
     result      the closing entry. The heaviest object on the page, and the only one that carries green.

   The guarantee is not one of them. It sits on the left and stays there while the archive accumulates
   beside it, because it is the thing all of this is filed against.
   ------------------------------------------------------------------------------------------------- */
type Filed =
  | { t: "evidence"; n: string; head: string; body: string; s: "stop" }
  | { t: "change"; n: string; head: string; body: string }
  | { t: "decision"; head: string; body: string }
  | { t: "result"; head: string; body: string };

const ARCHIVE: Filed[] = [
  { t: "evidence", n: "Run 1", head: "Failed", body: "The change shipped. Access was wrong.", s: "stop" },
  { t: "change", n: "Repair 1", head: "Access granted", body: "Access was granted only inside the active session." },
  { t: "evidence", n: "Run 2", head: "Failed", body: "Access disappeared after signing out and back in.", s: "stop" },
  { t: "decision", head: "Human decision", body: "The second repair was approved, with the reason recorded." },
  { t: "change", n: "Repair 2", head: "Permission corrected", body: "The permission was corrected on the account itself." },
  { t: "result", head: "Verified", body: "Persistence confirmed." },
];

export function Record() {
  const root = useRef<HTMLElement>(null);
  const seen = useSeen(root, ARCHIVE.length);
  return (
    <section className="v6-rec" data-nav-dark data-nav-theme="dark" ref={root}>
      <div className="v6-rec__head">
        <p className="v6-eyebrow">The record</p>
        <h2 className="v6-rec__h">The success does not erase how it got there.</h2>
      </div>

      <div className="v6-rec__arch">
        {/* the anchor: the one document everything else is filed against. A div, not an aside: a
            complementary landmark nested inside a section is a landmark violation, and this is part of
            the composition rather than an aside to it. */}
        <div className="v6-rec__anchor">
          <div className="v6-rec__doc">
            <p className="v6-rec__dock">Guarantee</p>
            <p className="v6-rec__docv">Only authorized staff can read customer records.</p>
          </div>
        </div>

        {/* the archive: a spine, and things of different kinds filed against it */}
        <ol className="v6-rec__spine">
          {ARCHIVE.map((f, i) => (
            <li key={i} className="v6-rec__filed" data-t={f.t} data-i={i} data-on={i < seen}
              style={{ ["--i" as string]: i }}>
              {f.t === "evidence" ? (
                <div className="v6-rec__ev" data-s={f.s}>
                  <p className="v6-rec__tab"><span className="v6-mono">{f.n}</span>Evidence</p>
                  <p className="v6-rec__fh">{f.head}</p>
                  <p className="v6-rec__fb">{f.body}</p>
                </div>
              ) : null}

              {f.t === "change" ? (
                <div className="v6-rec__ch">
                  <p className="v6-rec__chn v6-mono">{f.n}</p>
                  <p className="v6-rec__fh">{f.head}</p>
                  <p className="v6-rec__fb">{f.body}</p>
                </div>
              ) : null}

              {f.t === "decision" ? (
                <div className="v6-rec__de">
                  <p className="v6-rec__tab">Signed decision</p>
                  <p className="v6-rec__fh">{f.head}</p>
                  <p className="v6-rec__fb">{f.body}</p>
                </div>
              ) : null}

              {f.t === "result" ? (
                <div className="v6-rec__re">
                  <p className="v6-rec__tab">Result</p>
                  <p className="v6-rec__fh">{f.head}</p>
                  <p className="v6-rec__fb">{f.body}</p>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
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
// ONE example identifier, shown ONCE, on the Vraelis decision itself. It used to repeat on all seven
// surfaces, which made an authored diagram start to look like a captured production record.
const RESULT_REF = "vrf_2f8a";

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
          <figcaption className="v6-rx__fcap v6-mono">github.com/acme/records-web</figcaption>
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
              <span className="v6-rx__p">{"$ "}</span><span className="v6-rx__cmd">{"vraelis verify record-access\n"}</span>
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
  "guarantee": "record-access"
}`}</code>
          </pre>
        </figure>

        <figure className="v6-rx__f v6-rx__f--dep" data-i="1" data-on={seen > 1}>
          <figcaption className="v6-rx__fcap">Deployment</figcaption>
          <div className="v6-rx__dep">
            <span className="v6-rx__mark" aria-hidden />
            <div>
              <p className="v6-rx__depn">records-web<em>Production</em></p>
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
          <span className="v6-rx__ref v6-mono">{RESULT_REF}</span>
        </figure>

        <figure className="v6-rx__f v6-rx__f--slack" data-i="2" data-on={seen > 2}>
          <figcaption className="v6-rx__fcap">#billing</figcaption>
          <div className="v6-rx__msg">
            <span className="v6-rx__av" aria-hidden>V</span>
            <div>
              <p className="v6-rx__who">Vraelis<em>app</em></p>
              <p className="v6-rx__said">The record access guarantee held after the second repair.</p>
            </div>
          </div>
        </figure>
      </div>

      <p className="v6-rx__ill">Illustrative. The surfaces are real; the identifier shown is an example.</p>
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
            <p className="v6-kn__run"><span>The Vraelis Method</span><span>Position 3 of 8</span></p>
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
  "claim": "record access survives sign-in"
}`}</pre>
          </figure>

        </div>

        <Link href={`${BASE}/docs`} className="v6-kn__cta">Read the documentation<span className="v6-arw" aria-hidden>→</span></Link>
      </div>
    </section>
  );
}
