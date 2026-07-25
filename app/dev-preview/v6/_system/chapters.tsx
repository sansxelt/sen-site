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
   THE COMPLETION GAP.

   ONE STORY for the whole homepage. This chapter used to run a billing demo (pricing decisions, usage
   limits) and then the rest of the page switched to the Pro-access demonstration, which read as two
   unrelated demos stapled together. It is now the same Pro-access story the case file, the archive and
   the distribution chapter all use.

   The verdict is FAILED, not Blocked. The checkout actually ran and produced evidence contradicting the
   guarantee, which is the definition of Failed. Blocked is reserved for the case where Vraelis could not
   obtain enough requirements, coverage, authorization or execution evidence to reach a decision at all.

   Composition: one centred column. Every traveller owns a trajectory through the same space driven by
   --p, and the ranges are sequenced so ONE state is dominant at a time rather than three being legible
   at once. */
const OBSERVED = [
  "Payment succeeded.",
  "Pro access was missing.",
  "The first repair failed after signing back in.",
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
            <p className="v6-gap__turn">Complete is a claim.</p>
          </div>

          <div className="v6-gap__t v6-gap__sys">
            <p className="v6-gap__label">One change crossed</p>
            <ul className="v6-gap__syslist">
              {["checkout", "payment", "account access"].map((t) => (
                <li key={t} className="v6-mono">{t}</li>
              ))}
            </ul>
          </div>

          <div className="v6-gap__t v6-gap__found">
            <p className="v6-gap__label">What Vraelis observed</p>
            <ul className="v6-gap__list">
              {OBSERVED.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </div>

          <div className="v6-gap__t v6-gap__verdictwrap">
            <p className="v6-gap__verdict">Failed.</p>
            <p className="v6-gap__verdictsay">
              Checked in the deployed workflow, before the completion claim could be trusted.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════ CHAPTER 3 ══
   THE CONNECTED OPERATING ENVIRONMENT.

   ONE environment, not three cards. The whole system is drawn once, twice as wide as the viewport, and the
   chapter pans across it as you scroll. Three regions come into focus in turn; the other two stay on screen
   at lower contrast the entire time, so focus moves inside a space rather than replacing it.

     region 0  the guarantee, held outside the code, connected to what it applies to
     region 1  a browser run travelling through the deployed workflow
     region 2  finding, person, repair, recheck, all returning into the same record
   ------------------------------------------------------------------------------------------------- */
const ACTS: [string, string][] = [
  ["Define the outcome", "State what the business cannot afford to lose."],
  ["Check the deployed workflow", "Vraelis derives the requirements and browser plan, then runs the real product rather than inspecting only the source."],
  ["Verify the repair", "Failures return with evidence and a repair handoff. A new run determines whether the fix held."],
];

export function SystemMap() {
  const wrap = useRef<HTMLDivElement>(null);
  const [act, setAct] = useState(0);
  const lastAct = useRef(0);
  // The act index derives from the same RENDERED progress that drives the pan, inside the engine's frame
  // callback, so the sentence and the environment can never disagree. React state changes twice on the
  // whole chapter; every frame in between is CSS only.
  useScrollProgress(wrap, {
    onFrame: (p) => {
      // matches the dwell schedule in chapters.css: the sentence changes at the midpoint of each travel
      const next = p < 0.24 ? 0 : p < 0.69 ? 1 : 2;
      if (next !== lastAct.current) { lastAct.current = next; setAct(next); }
    },
  });
  return (
    <section className="v6-cs" data-nav-dark data-nav-theme="dark" data-act={act} ref={wrap}>
      <div className="v6-cs__pin">
        <div className="v6-cs__head">
          <p className="v6-eyebrow">One guarantee, every system it crosses</p>
          <div className="v6-cs__acts">
            {ACTS.map(([t, d], i) => (
              <div key={t} className="v6-cs__act" style={{ ["--i" as string]: i }}>
                <h2>{t}</h2>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="v6-cs__viewport">
          <svg className="v6-cs__scene" viewBox="0 0 2760 470" role="img"
            aria-label="One environment. A guarantee held outside the code connects to the application, checkout and account services. A browser run crosses the deployed workflow. A finding goes to a person, a repair returns, and an independent recheck writes back to the same record.">
            {/* The record spine: present across the whole environment, tying all three regions together, and
                running on past the last node so nothing implies the trail stops where the result lands. */}
            <line className="v6-cs__spine" x1="30" y1="392" x2="2745" y2="392" />
            <text className="v6-cs__spinet" x="89" y="426">every run stays attached to the same outcome</text>

            {/* ── region 0: the guarantee, outside the code ── */}
            <g className="v6-cs__r" data-r="0">
              <rect className="v6-cs__guar" x="89" y="40" width="600" height="98" rx="14" />
              <text className="v6-cs__guart" x="119" y="78">Guarantee</text>
              <text className="v6-cs__guarb" x="119" y="114">A paying customer keeps Pro access.</text>
              {["application", "checkout", "account-api"].map((t, i) => (
                <g key={t}>
                  <rect className="v6-cs__svc" x={99 + i * 200} y="234" width="176" height="56" rx="10" />
                  <text className="v6-cs__svct" x={187 + i * 200} y="269">{t}</text>
                  <path className="v6-cs__link" d={`M389 138 C 389 190, ${187 + i * 200} 182, ${187 + i * 200} 234`} />
                  <path className="v6-cs__drop" d={`M${187 + i * 200} 290 L ${187 + i * 200} 392`} />
                </g>
              ))}
            </g>

            {/* ── region 1: the browser run crossing the deployed workflow ── */}
            <g className="v6-cs__r" data-r="1">
              <rect className="v6-cs__plane" x="1000" y="52" width="740" height="238" rx="16" />
              <text className="v6-cs__planet" x="1030" y="96">Browser run, live deployment</text>
              <line className="v6-cs__planerule" x1="1000" y1="120" x2="1740" y2="120" />
              {["open checkout", "pay", "sign out", "sign back in"].map((t, i) => (
                <g key={t} className="v6-cs__step">
                  <circle cx={1090 + i * 180} cy="194" r="11" />
                  <text x={1090 + i * 180} y="240">{t}</text>
                </g>
              ))}
              <path className="v6-cs__run" d="M1090 194 L 1630 194" />
              <path className="v6-cs__drop" d="M1370 290 L 1370 392" />
            </g>

            {/* ── region 2: finding, person, repair, recheck, all back onto the record ──
                Pulled 50 units left of the old positions so the resolved node and its label keep a clear
                margin from the right edge of the frame when the pan finishes. */}
            <g className="v6-cs__r" data-r="2">
              <g className="v6-cs__node is-stop"><circle cx="2030" cy="118" r="13" /><text x="2030" y="84">finding</text></g>
              <g className="v6-cs__node is-wait"><circle cx="2240" cy="190" r="13" /><text x="2240" y="158">a person decides</text></g>
              <g className="v6-cs__node"><circle cx="2420" cy="118" r="13" /><text x="2420" y="84">repair</text></g>
              <g className="v6-cs__node is-go"><circle cx="2590" cy="190" r="15" /><text x="2590" y="158">recheck holds</text></g>
              <path className="v6-cs__arc" d="M2030 118 C 2130 118, 2150 190, 2240 190" />
              <path className="v6-cs__arc" d="M2240 190 C 2330 190, 2340 118, 2420 118" />
              <path className="v6-cs__arc" d="M2420 118 C 2510 118, 2520 190, 2590 190" />
              <path className="v6-cs__drop" d="M2030 131 L 2030 392" />
              <path className="v6-cs__drop" d="M2590 205 L 2590 392" />
            </g>
          </svg>
        </div>

        {/* Mobile is authored, not the desktop scene on a horizontal scroller. Three stages read top to
            bottom, and one record line runs down the left through all of them so it is still one
            environment rather than three sections. */}
        <ol className="v6-cs__m">
          <li className="v6-cs__mstage">
            <p className="v6-cs__mh">{ACTS[0][0]}</p>
            <div className="v6-cs__mguar">A paying customer keeps Pro access.</div>
            <ul className="v6-cs__mtags">
              {["application", "checkout", "account-api"].map((t) => <li key={t}>{t}</li>)}
            </ul>
            <p className="v6-cs__ms">Kept outside the code, so a change cannot quietly drop it.</p>
          </li>
          <li className="v6-cs__mstage">
            <p className="v6-cs__mh">{ACTS[1][0]}</p>
            <ul className="v6-cs__mpath">
              {["open checkout", "pay", "sign out", "sign back in"].map((t) => <li key={t}>{t}</li>)}
            </ul>
            <div className="v6-cs__mobs">
              <span>Expected</span>access is still there
              <span>Observed</span><b>access is gone</b>
            </div>
            <p className="v6-cs__ms">A real browser crosses the deployed workflow, not the source.</p>
          </li>
          <li className="v6-cs__mstage">
            <p className="v6-cs__mh">{ACTS[2][0]}</p>
            <ul className="v6-cs__mres">
              <li className="is-stop">finding</li>
              <li className="is-wait">a person decides</li>
              <li>repair</li>
              <li className="is-go">recheck holds</li>
            </ul>
            <p className="v6-cs__ms">All of it lands on the same permanent record.</p>
          </li>
        </ol>
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
  { s: "stop", h: "Access was missing", d: "The account never received the Pro entitlement." },
  { s: "none", h: "The first repair appeared to work", d: "Access appeared only inside the session that was already open." },
  { s: "stop", h: "Signing back in broke it again", d: "The apparent fix did not survive a new session." },
  { s: "go", h: "The second repair held", d: "A new session inherited the entitlement." },
];

export function Proof() {
  const root = useRef<HTMLElement>(null);
  const seen = useSeen(root, 1);
  return (
    <section className="v6-pf" data-nav-theme="light" ref={root}>
      <div className="v6-pf__head">
        <p className="v6-eyebrow">Internal production demonstration</p>
        <h2 className="v6-pf__h">Payment succeeded. The guarantee did not.</h2>
        <p className="v6-pf__guar">
          <span>The guarantee</span>A customer who pays for Pro receives access and keeps it after signing back in.
        </p>
      </div>

      <div className="v6-pf__case" data-i="0" data-on={seen > 0}>
        {/* the lane that worked, stated once and kept quiet */}
        <div className="v6-pf__minor">
          <p className="v6-pf__lanen">Payment succeeded</p>
          <p className="v6-pf__minors">
            <span className="v6-pf__tick" aria-hidden />
            Checkout completed and payment was confirmed.
          </p>
        </div>

        {/* the lane the business actually depends on */}
        <div className="v6-pf__major">
          <p className="v6-pf__lanen">
            Entitlement
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
  { t: "evidence", n: "Run 1", head: "Failed", body: "Payment succeeded. Pro access was missing.", s: "stop" },
  { t: "change", n: "Repair 1", head: "Access granted", body: "Access was granted only inside the active session." },
  { t: "evidence", n: "Run 2", head: "Failed", body: "Access disappeared after signing out and back in.", s: "stop" },
  { t: "decision", head: "Human decision", body: "The second repair was approved, with the reason recorded." },
  { t: "change", n: "Repair 2", head: "Entitlement attached", body: "The entitlement was attached to the account." },
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
            <p className="v6-rec__docv">A customer who pays for Pro keeps access after signing back in.</p>
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
          <figcaption className="v6-rx__fcap v6-mono">github.com/acme/billing-web</figcaption>
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
              <span className="v6-rx__p">{"$ "}</span><span className="v6-rx__cmd">{"vraelis verify pro-access\n"}</span>
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
              <p className="v6-rx__depn">billing-web<em>Production</em></p>
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
              <p className="v6-rx__said">The Pro access guarantee held after the second repair.</p>
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
  "claim": "Pro access survives sign-in"
}`}</pre>
          </figure>

        </div>

        <Link href={`${BASE}/docs`} className="v6-kn__cta">Read the documentation<span className="v6-arw" aria-hidden>→</span></Link>
      </div>
    </section>
  );
}
