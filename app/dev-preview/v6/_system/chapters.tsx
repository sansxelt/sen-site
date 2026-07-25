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
import Link from "next/link";
import { CTA, EditorialLink } from "./ui";
import { DOCS, DOC_GROUPS } from "../_content/docs";
import { CHANGELOG } from "../_content/changelog";
import "./chapters.css";

const BASE = "/dev-preview/v6";

/* ---------------------------------------------------------------------------
   Scroll phase. A tall wrapper, a pinned scene, an integer phase read off the
   wrapper's progress. Native scrolling only: nothing is captured or re-timed,
   and reduced motion resolves straight to the final phase.
   --------------------------------------------------------------------------- */
// Continuous scroll progress, 0..1, written to the DOM as a CSS variable.
//
// The previous version snapped to an integer phase and let a fixed-duration CSS transition play out. Scroll
// slowly and that looked fine; scroll quickly and the animation carried on at its own pace long after the
// reader had moved, so the scene never matched the gesture. Progress is now driven directly by scroll
// position: the composition is always exactly where the reader put it, at any speed, in either direction.
//
// The value is set on the element rather than through React state so a fast scroll does not queue a render
// per frame. Reduced motion pins it to 1 and never listens.
function useScrollProgress(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.setProperty("--p", "1");
      return;
    }
    let raf = 0;
    const read = () => {
      raf = 0;
      if (!el.offsetParent) return;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      if (total <= 0) return;
      const p = Math.min(1, Math.max(0, -r.top / total));
      el.style.setProperty("--p", p.toFixed(4));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(read); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref]);
}

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
   THE COMPLETION GAP. One word at the largest scale on the page, which then
   loses its authority as what actually happened takes the same space. Two
   states in one pinned viewport, not a heading-list-paragraph section. */
const FOUND = [
  "One pricing decision nobody approved.",
  "A usage limit never enforced.",
  "Two billing paths changed by one edit.",
];

export function Gap() {
  const wrap = useRef<HTMLDivElement>(null);
  useScrollProgress(wrap);
  return (
    <section className="v6-gap" id="gap" ref={wrap}>
      <div className="v6-gap__pin">
        {/* One continuous space, not stacked frames. Each traveller owns a trajectory through the viewport
            driven by --p: the claim rises and shrinks as it loses authority, the systems it reached pass
            through behind it, the findings climb into the space the claim vacated, and the consequence
            arrives last. Nothing cross-fades in place, so nothing ever sits on top of anything else. */}
        <div className="v6-gap__stage">
          <div className="v6-gap__t v6-gap__claim">
            <p className="v6-gap__label">The agent reported</p>
            <p className="v6-gap__word">
              <span className="v6-gap__wordt">Complete.</span>
              <span className="v6-gap__strike" aria-hidden />
            </p>
          </div>

          <div className="v6-gap__t v6-gap__sys" aria-hidden>
            <p className="v6-gap__label">Systems the change reached</p>
            <ul className="v6-gap__syslist">
              {["billing-web", "checkout", "account-api"].map((t) => (
                <li key={t} className="v6-mono">{t}</li>
              ))}
            </ul>
          </div>

          <div className="v6-gap__t v6-gap__found">
            <p className="v6-gap__label">Vraelis found</p>
            <ul className="v6-gap__list">
              {FOUND.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </div>

          <div className="v6-gap__t v6-gap__verdictwrap">
            <p className="v6-gap__verdict">Blocked.</p>
            <p className="v6-gap__verdictsay">This release cannot be trusted yet.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════ CHAPTER 3 ══
   THE CONNECTED SYSTEM. One diagram, wider than any content container, cropped
   by the viewport. It carries the whole workflow rather than a grid of feature
   names, and it is the section: the type above it is four words. */
const SPINE: [number, string][] = [
  [370, "requirement"],
  [640, "browser run"],
  [910, "findings"],
  [1180, "a person decides"],
  [1450, "verified"],
];
const STACK = ["your application", "the deployment", "your database", "payments"];

export function SystemMap() {
  const root = useRef<HTMLElement>(null);
  const seen = useSeen(root, 1);
  return (
    <section className="v6-sys" data-nav-dark ref={root}>
      <div className="v6-sys__head">
        <p className="v6-eyebrow">The system</p>
        <h2 className="v6-sys__h">Vraelis sees the whole workflow.</h2>
      </div>
      <div className="v6-sys__figure" data-i="0" data-on={seen > 0}>
        <svg className="v6-sys__svg" viewBox="0 0 1740 588" role="img"
          aria-label="Your application, deployment, database and payment provider feed one requirement. Vraelis runs the live software in a browser, raises findings, sends the decision to a person, and returns a verified result. Evidence from the run travels with the decision.">
          <g className="v6-sys__edge" fill="none">
            {/* the company's stack braces into the requirement */}
            {[120, 220, 400, 500].map((y) => (
              <path key={y} d={`M300 ${y} C 340 ${y}, 340 300, 370 300`} />
            ))}
            {/* the spine */}
            {SPINE.slice(0, -1).map(([x], i) => (
              <path key={x} d={`M${x + 230} 300 L ${SPINE[i + 1][0]} 300`}
                className={i === 2 ? "is-wait" : i === 3 ? "is-go" : ""} />
            ))}
            {/* evidence travels with the decision */}
            <path className="v6-sys__eve" d="M755 336 L 755 520 L 1295 520 L 1295 336" />
          </g>

          {STACK.map((label, i) => (
            <g key={label} className="v6-sys__node is-stack">
              <rect x="40" y={[90, 190, 370, 470][i]} width="260" height="60" rx="12" />
              <text x="170" y={[125, 225, 405, 505][i]}>{label}</text>
            </g>
          ))}

          {SPINE.map(([x, label], i) => (
            <g key={label} className={`v6-sys__node ${i === 4 ? "is-final" : ""} ${i === 2 ? "is-wait" : ""}`}>
              <rect x={x} y="264" width="230" height="72" rx="14" />
              <text x={x + 115} y="307">{label}</text>
            </g>
          ))}

          <text className="v6-sys__cap" x="755" y="556">evidence</text>
          <text className="v6-sys__band" x="40" y="66">YOUR STACK</text>
          <text className="v6-sys__band" x="370" y="240">VRAELIS</text>
        </svg>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════ CHAPTER 4 ══
   THE REAL CHECKOUT PROOF. The strongest concrete evidence Vraelis has, drawn
   as a single line: trust falls twice and only holds on the third run. The two
   failures stay marked on the line rather than being tidied away. */
type Beat = { x: number; y: number; label: string; sub?: string; s?: "go" | "stop"; up?: boolean };
// Labels alternate above and below their own lane so neighbours never share a baseline. At 250 units apart
// two 20px labels on the same line overlapped, which is what made the start of the line unreadable.
// Evenly spaced across the full width, and short enough that no two labels crowd. The earlier spacing
// bunched the first three beats into the left third, which read as a cluster rather than a sequence.
const BEATS: Beat[] = [
  { x: 80, y: 118, label: "Checkout said success", up: true },
  { x: 340, y: 118, label: "Payment succeeded" },
  { x: 600, y: 352, label: "Pro access missing", s: "stop" },
  { x: 860, y: 118, label: "Repair 1 granted access", up: true },
  { x: 1120, y: 352, label: "Lost on sign-in", s: "stop" },
  { x: 1380, y: 118, label: "Repair 2 held" },
  { x: 1610, y: 92, label: "Verified", s: "go", up: true },
];

export function Proof() {
  const root = useRef<HTMLElement>(null);
  const seen = useSeen(root, 1);
  return (
    <section className="v6-pf" ref={root}>
      <div className="v6-pf__head">
        <p className="v6-eyebrow">One real run</p>
        <h2 className="v6-pf__h">Payment went through. Access did not.</h2>
      </div>

      <div className="v6-pf__figure" data-i="0" data-on={seen > 0}>
        <svg className="v6-pf__svg" viewBox="0 0 1700 452" role="img"
          aria-label="A checkout run reported success and payment succeeded, but Pro access was missing. A first repair granted access, which disappeared after signing back in. A second repair held and the run verified. Both earlier failures stay on the record.">
          <line className="v6-pf__base" x1="40" y1="118" x2="1660" y2="118" />
          <line className="v6-pf__base" x1="40" y1="352" x2="1660" y2="352" />
          <text className="v6-pf__lane" x="40" y="102">ACCESS HELD</text>
          <text className="v6-pf__lane" x="40" y="382">ACCESS LOST</text>

          <polyline className="v6-pf__line"
            points={BEATS.map((b) => `${b.x},${b.y}`).join(" ")} fill="none" />

          {BEATS.map((b, i) => (
            <g key={b.label} className={`v6-pf__pt ${b.s ? `is-${b.s}` : ""}`} style={{ ["--i" as string]: i }}>
              <circle cx={b.x} cy={b.y} r={b.s === "go" ? 13 : 9} />
              {/* the outer labels anchor to their own edge; centred, the first one ran off the left of the
                  figure and the last one off the right */}
              <text x={b.x} y={b.y + (b.y > 200 ? (b.up ? 46 : 74) : (b.up ? -56 : -28))}
                textAnchor={i === 0 ? "start" : i === BEATS.length - 1 ? "end" : "middle"}>{b.label}</text>
            </g>
          ))}
        </svg>
      </div>

      {/* Mobile redraw: the same seven beats as a vertical rail. Squeezing the chart made its labels collide. */}
      <ol className="v6-pf__m" data-on={seen > 0}>
        {BEATS.map((b) => (
          <li key={b.label} className={`v6-pf__mrow ${b.s ? `is-${b.s}` : ""}`}>
            <span className="v6-pf__mdot" aria-hidden />
            <span className="v6-pf__mt">{b.label}</span>
            <span className="v6-pf__ml v6-mono">{b.y > 200 ? "access lost" : "access held"}</span>
          </li>
        ))}
      </ol>
      <p className="v6-pf__note">Both failures are still on the record. A later pass never erases an earlier one.</p>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════ CHAPTER 5 ══
   THE PERMANENT RECORD. The composition literally grows: each entry arrives and
   stays, and by the end of the chapter the reader is looking at a solid block
   that was assembled in front of them. */
const RECORD: [string, string, ("go" | "stop" | "wait")?][] = [
  ["Requirement", "A paid customer keeps Pro access after signing back in."],
  ["Systems", "billing-web, checkout, account-api"],
  ["Run 1", "Failed. Access not granted.", "stop"],
  ["Repair 1", "Access granted."],
  ["Run 2", "Failed. Access lost on sign-in.", "stop"],
  ["Decision", "Approved by a person, reason recorded.", "wait"],
  ["Run 3", "Verified.", "go"],
];

export function Record() {
  const root = useRef<HTMLElement>(null);
  const seen = useSeen(root, RECORD.length);
  return (
    <section className="v6-rec" data-nav-dark ref={root}>
      <div className="v6-rec__head">
        <p className="v6-eyebrow">The record</p>
        <h2 className="v6-rec__h">Nothing is overwritten.</h2>
      </div>
      <div className="v6-rec__stack">
        {RECORD.map(([k, v, s], i) => (
          <div key={k} className={`v6-rec__row ${s ? `is-${s}` : ""}`} data-i={i} data-on={i < seen}>
            <span className="v6-rec__k v6-mono">{k}</span>
            <span className="v6-rec__v">{v}</span>
            <span className="v6-rec__dot" aria-hidden />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════ CHAPTER 6 ══
   DISTRIBUTION AND KNOWLEDGE. Two movements separated by a lot of silence: one
   result fanning into the stack a company already runs, then the writing behind
   the product set as a publication rather than as cards. */
const REACH: [string, string][] = [
  ["Web app", "the decision and its evidence"],
  ["API", "GET /v1/verifications/{id}"],
  ["CLI", "one command, one exit code"],
  ["GitHub", "a check on the pull request"],
  ["Vercel", "the deployment it ran against"],
  ["Slack", "the channel that owns the system"],
  ["Webhook", "verification.completed"],
];
const NEXT = ["IDE", "Desktop", "Browser companion", "Mobile approvals", "MCP and agent tools"];

export function Reach() {
  const root = useRef<HTMLElement>(null);
  const seen = useSeen(root, 1);
  const y0 = 40, step = 76, endX = 660;
  return (
    <section className="v6-rx" ref={root}>
      <div className="v6-rx__head">
        <p className="v6-eyebrow">Where it lands</p>
        <h2 className="v6-rx__h">One result, everywhere you already work.</h2>
      </div>

      <div className="v6-rx__figure" data-i="0" data-on={seen > 0}>
        <svg className="v6-rx__svg" viewBox="0 0 1180 600" role="img"
          aria-label={"One verified result reaches " + REACH.map((r) => r[0]).join(", ") + "."}>
          <g className="v6-rx__edge" fill="none">
            {REACH.map(([k], i) => (
              <path key={k} d={`M240 300 C 450 300, 470 ${y0 + i * step}, ${endX} ${y0 + i * step}`} />
            ))}
          </g>
          <g className="v6-rx__src">
            <rect x="20" y="262" width="220" height="76" rx="14" />
            <text className="v6-rx__srct" x="130" y="294">vrf_ff9d6c0d</text>
            <text className="v6-rx__srcs" x="130" y="318">VERIFIED</text>
          </g>
          {REACH.map(([k, v], i) => (
            <g key={k} className="v6-rx__end" style={{ ["--i" as string]: i }}>
              <circle cx={endX} cy={y0 + i * step} r="5" />
              <text className="v6-rx__endk" x={endX + 26} y={y0 + i * step - 2}>{k}</text>
              <text className="v6-rx__endv" x={endX + 26} y={y0 + i * step + 20}>{v}</text>
            </g>
          ))}
        </svg>
      </div>

      <ol className="v6-rx__m" data-on={seen > 0}>
        <li className="v6-rx__msrc"><span className="v6-mono">vrf_ff9d6c0d</span><span className="v6-rx__mver v6-mono">Verified</span></li>
        {REACH.map(([k, v]) => (
          <li key={k} className="v6-rx__mrow"><span className="v6-rx__mk">{k}</span><span className="v6-rx__mv">{v}</span></li>
        ))}
      </ol>

      {/* Direction is secondary and must read that way: a ruled band under the live surfaces, not an inline
          run of words wedged against the caption above it. */}
      <div className="v6-rx__next">
        <p className="v6-rx__nexth">Direction, not built</p>
        <ul className="v6-rx__soons">
          {NEXT.map((n) => <li key={n}>{n}</li>)}
        </ul>
      </div>
    </section>
  );
}

export function Knowledge() {
  const groups = DOC_GROUPS.map((g) => ({ group: g, docs: DOCS.filter((d) => d.group === g) }));
  const recent = CHANGELOG.slice(0, 2);
  return (
    <section className="v6-kn">
      <div className="v6-kn__in">
        <p className="v6-eyebrow v6-kn__eyebrow">Written down</p>

        <Link href={`${BASE}/method`} className="v6-kn__quote">
          <blockquote>
            An agent that plans, writes, and repairs the work will also tell you it is finished.
          </blockquote>
          <span className="v6-kn__attr">The Vraelis Method, position 3 of 8<span className="v6-arw" aria-hidden>→</span></span>
        </Link>

        <div className="v6-kn__idx">
          <Link href={`${BASE}/docs`} className="v6-kn__col">
            <span className="v6-kn__colh">Documentation</span>
            <span className="v6-kn__colm v6-mono">{DOCS.length} pages</span>
            <span className="v6-kn__colb">{groups.map((g) => g.group).join(". ")}.</span>
          </Link>
          <Link href={`${BASE}/research`} className="v6-kn__col">
            <span className="v6-kn__colh">Research</span>
            <span className="v6-kn__colm v6-mono">Open question</span>
            <span className="v6-kn__colb">How to represent the edge of a check, so absence of evidence is never read as evidence of safety.</span>
          </Link>
          <Link href={`${BASE}/readme`} className="v6-kn__col">
            <span className="v6-kn__colh">README</span>
            <span className="v6-kn__colm v6-mono">Why this exists</span>
            <span className="v6-kn__colb">Software used to be trusted because humans held the loop. That loop is changing.</span>
          </Link>
          <Link href={`${BASE}/changelog`} className="v6-kn__col">
            <span className="v6-kn__colh">Changelog</span>
            <span className="v6-kn__colm v6-mono">{recent[0].date}</span>
            <span className="v6-kn__colb">{recent.map((c) => c.title).join(". ")}.</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Re-exported so home.tsx reads as the running order of the page. */
export { CTA, EditorialLink };
