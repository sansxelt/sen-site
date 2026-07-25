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
import { DOCS } from "../_content/docs";
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
   THE CONNECTED OPERATING ENVIRONMENT.

   ONE environment, not three cards. The whole system is drawn once, twice as wide as the viewport, and the
   chapter pans across it as you scroll. Three regions come into focus in turn; the other two stay on screen
   at lower contrast the entire time, so focus moves inside a space rather than replacing it.

     region 0  the guarantee, held outside the code, connected to what it applies to
     region 1  a browser run travelling through the deployed workflow
     region 2  finding, person, repair, recheck, all returning into the same record
   ------------------------------------------------------------------------------------------------- */
const ACTS: [string, string][] = [
  ["Define what must hold", "One sentence the change is not allowed to break, kept outside the code."],
  ["Check the running system", "A real browser crosses the deployed workflow, not the source."],
  ["Resolve what failed", "Findings, a decision, a repair, and an independent recheck, all on one record."],
];

export function SystemMap() {
  const wrap = useRef<HTMLDivElement>(null);
  useScrollProgress(wrap);
  // The focus index is computed here rather than in CSS. Deriving it from clamp()/max() over custom
  // properties silently failed to resolve and every act rendered at full opacity on top of the others.
  const [act, setAct] = useState(0);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let raf = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const read = () => {
      raf = 0;
      if (!el.offsetParent) return;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      if (total <= 0) return;
      const p = Math.min(0.9999, Math.max(0, -r.top / total));
      setAct(Math.floor(p * 3));
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
  }, []);
  return (
    <section className="v6-cs" data-nav-dark data-act={act} ref={wrap}>
      <div className="v6-cs__pin">
        <div className="v6-cs__head">
          <p className="v6-eyebrow">The operating environment</p>
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
          <svg className="v6-cs__scene" viewBox="0 0 2760 560" role="img"
            aria-label="One environment. A guarantee held outside the code connects to the application, checkout and account services. A browser run crosses the deployed workflow. A finding goes to a person, a repair returns, and an independent recheck writes back to the same record.">
            {/* the record spine: present across the whole environment, tying all three regions together */}
            <line className="v6-cs__spine" x1="60" y1="470" x2="2700" y2="470" />
            <text className="v6-cs__spinet" x="60" y="506">one permanent record</text>

            {/* ── region 0: the guarantee, outside the code ── */}
            <g className="v6-cs__r" data-r="0">
              <rect className="v6-cs__guar" x="80" y="60" width="600" height="112" rx="14" />
              <text className="v6-cs__guart" x="110" y="104">Guarantee</text>
              <text className="v6-cs__guarb" x="110" y="142">A paying customer keeps Pro access.</text>
              {["application", "checkout", "account-api"].map((t, i) => (
                <g key={t}>
                  <rect className="v6-cs__svc" x={90 + i * 200} y="286" width="176" height="62" rx="10" />
                  <text className="v6-cs__svct" x={178 + i * 200} y="323">{t}</text>
                  <path className="v6-cs__link" d={`M380 172 C 380 230, ${178 + i * 200} 220, ${178 + i * 200} 286`} />
                </g>
              ))}
              <path className="v6-cs__drop" d="M178 348 L 178 470" />
              <path className="v6-cs__drop" d="M378 348 L 378 470" />
              <path className="v6-cs__drop" d="M578 348 L 578 470" />
            </g>

            {/* ── region 1: the browser run crossing the deployed workflow ── */}
            <g className="v6-cs__r" data-r="1">
              <rect className="v6-cs__plane" x="1000" y="80" width="740" height="270" rx="16" />
              <text className="v6-cs__planet" x="1030" y="122">Browser run, live deployment</text>
              <line className="v6-cs__planerule" x1="1000" y1="146" x2="1740" y2="146" />
              {["open checkout", "pay", "sign out", "sign back in"].map((t, i) => (
                <g key={t} className="v6-cs__step">
                  <circle cx={1080 + i * 200} cy="232" r="11" />
                  <text x={1080 + i * 200} y="278">{t}</text>
                </g>
              ))}
              <path className="v6-cs__run" d="M1080 232 L 1680 232" />
              <path className="v6-cs__drop" d="M1370 350 L 1370 470" />
            </g>

            {/* ── region 2: finding, person, repair, recheck, all back onto the record ── */}
            <g className="v6-cs__r" data-r="2">
              <g className="v6-cs__node is-stop"><circle cx="2060" cy="140" r="13" /><text x="2060" y="106">finding</text></g>
              <g className="v6-cs__node is-wait"><circle cx="2280" cy="212" r="13" /><text x="2280" y="180">a person decides</text></g>
              <g className="v6-cs__node"><circle cx="2470" cy="140" r="13" /><text x="2470" y="106">repair</text></g>
              <g className="v6-cs__node is-go"><circle cx="2650" cy="212" r="15" /><text x="2650" y="180">recheck holds</text></g>
              <path className="v6-cs__arc" d="M2060 140 C 2160 140, 2180 212, 2280 212" />
              <path className="v6-cs__arc" d="M2280 212 C 2380 212, 2390 140, 2470 140" />
              <path className="v6-cs__arc" d="M2470 140 C 2560 140, 2570 212, 2650 212" />
              <path className="v6-cs__drop" d="M2060 153 L 2060 470" />
              <path className="v6-cs__drop" d="M2650 227 L 2650 470" />
            </g>
          </svg>
        </div>

        {/* Mobile is authored, not the desktop scene on a horizontal scroller. Three stages read top to
            bottom, and one record line runs down the left through all of them so it is still one
            environment rather than three sections. */}
        <ol className="v6-cs__m">
          <li className="v6-cs__mstage">
            <p className="v6-cs__mh">Define what must hold</p>
            <div className="v6-cs__mguar">A paying customer keeps Pro access.</div>
            <ul className="v6-cs__mtags">
              {["application", "checkout", "account-api"].map((t) => <li key={t}>{t}</li>)}
            </ul>
            <p className="v6-cs__ms">Kept outside the code, so a change cannot quietly drop it.</p>
          </li>
          <li className="v6-cs__mstage">
            <p className="v6-cs__mh">Check the running system</p>
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
            <p className="v6-cs__mh">Resolve what failed</p>
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

   Two lanes, because that is the whole point: the payment lane succeeds immediately and never fails again,
   while the entitlement lane is the one that actually carries the business guarantee. The sign-out and
   sign-in boundary is drawn as a wall through both lanes, because that is where the first repair died.

   This is an authored reconstruction. It is not a screenshot, it carries no invented run identifier and no
   invented timestamp, and it says so on the page.
   ------------------------------------------------------------------------------------------------- */
type Ev = { x: number; cy: number; ly: number; label: string; s?: "go" | "stop"; note?: string; anchor?: "start" | "middle" };
const CASE: Ev[] = [
  { x: 150, cy: 152, ly: 90, label: "Checkout reports success", anchor: "start" },
  { x: 430, cy: 152, ly: 118, label: "Payment succeeds", s: "go" },
  { x: 400, cy: 336, ly: 378, label: "Pro access missing", s: "stop" },
  { x: 700, cy: 240, ly: 216, label: "Repair 1 grants access" },
  { x: 1180, cy: 336, ly: 378, label: "Access disappears", s: "stop",
    note: "the first repair never survived a new session" },
  { x: 1480, cy: 336, ly: 378, label: "Repair 2 attaches the entitlement" },
  { x: 1740, cy: 240, ly: 206, label: "Access remains after sign-in", s: "go" },
];

export function Proof() {
  const root = useRef<HTMLElement>(null);
  const seen = useSeen(root, 1);
  return (
    <section className="v6-pf" ref={root}>
      <div className="v6-pf__head">
        <p className="v6-eyebrow">Internal production demonstration</p>
        <h2 className="v6-pf__h">Payment succeeded. The guarantee did not.</h2>
        <p className="v6-pf__guar">
          <span>The guarantee</span>A customer who pays for Pro receives access and keeps it after signing back in.
        </p>
      </div>

      <div className="v6-pf__figure" data-i="0" data-on={seen > 0}>
        <svg className="v6-pf__svg" viewBox="0 0 2000 470" role="img"
          aria-label="Checkout reported success and payment succeeded, but Pro access was missing. A first repair granted access, which disappeared after signing out and back in. A second repair attached the entitlement to the account and access remained. The result is Verified and both earlier failures are preserved.">
          {/* the two systems, named, so payment and entitlement are never confused */}
          <text className="v6-pf__lane" x="40" y="122">PAYMENT</text>
          <text className="v6-pf__lane" x="40" y="306">ENTITLEMENT</text>
          <line className="v6-pf__base" x1="40" y1="152" x2="1960" y2="152" />
          <line className="v6-pf__base" x1="40" y1="336" x2="1960" y2="336" />

          {/* the payment lane holds from the moment it succeeds */}
          <path className="v6-pf__pay" d="M150 152 L 1960 152" />

          {/* the entitlement lane: missing, granted, lost at the session wall, attached, held */}
          <path className="v6-pf__ent is-bad" d="M400 336 L 700 336" />
          <path className="v6-pf__ent" d="M700 336 L 700 240 L 1180 240" />
          <path className="v6-pf__ent is-bad" d="M1180 240 L 1180 336 L 1480 336" />
          <path className="v6-pf__ent is-good" d="M1480 336 L 1480 240 L 1740 240" />

          {/* the session wall: the turning point of the whole demonstration */}
          <g className="v6-pf__wall">
            <line x1="1180" y1="60" x2="1180" y2="410" />
            <text x="1180" y="46">SIGN OUT, SIGN BACK IN</text>
          </g>

          {CASE.map((e, i) => (
            <g key={e.label} className={`v6-pf__pt ${e.s ? `is-${e.s}` : ""}`} style={{ ["--i" as string]: i }}>
              <circle cx={e.x} cy={e.cy} r={e.s === "go" ? 12 : 9} />
              <text x={e.x} y={e.ly} textAnchor={e.anchor ?? "middle"}>{e.label}</text>
              {e.note ? <text className="v6-pf__note-t" x={e.x} y={410} textAnchor="middle">{e.note}</text> : null}
            </g>
          ))}

          {/* the decision sits BEYOND the last observation, joined to it, so the observed outcome and the
              decision drawn from it are two readable things rather than one plate on top of a label */}
          <path className="v6-pf__decide" d="M1740 240 C 1830 240, 1840 176, 1900 176" />
          <g className="v6-pf__final">
            <rect x="1760" y="146" width="188" height="60" rx="12" />
            <text x="1854" y="184">Verified</text>
          </g>
        </svg>
      </div>

      <p className="v6-pf__disclose">Authored reconstruction of an internal production demonstration.</p>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════ CHAPTER 5 ══
   THE PERMANENT RECORD, as a layered ledger.

   Seven sheets, filed one behind the next. Every earlier sheet stays on screen and legible at the final
   state: they step down and to the right rather than scrolling away inside a window, so the finished stack
   IS the argument. Nothing is hidden and nothing needs a row that says so.
   ------------------------------------------------------------------------------------------------- */
const LEDGER: [string, string, ("go" | "stop" | "wait")?][] = [
  ["Guarantee", "A customer who pays for Pro keeps access after signing back in."],
  ["Run 1", "Failed. Pro access was missing.", "stop"],
  ["Repair 1", "Access granted."],
  ["Run 2", "Failed. Access lost after signing back in.", "stop"],
  ["Decision", "Approved by a person, reason recorded.", "wait"],
  ["Repair 2", "Entitlement attached to the account."],
  ["Run 3", "Verified. Access held.", "go"],
];

export function Record() {
  const root = useRef<HTMLElement>(null);
  const seen = useSeen(root, LEDGER.length);
  return (
    <section className="v6-rec" data-nav-dark ref={root}>
      <div className="v6-rec__head">
        <p className="v6-eyebrow">The record</p>
        <h2 className="v6-rec__h">The success does not erase how it got there.</h2>
      </div>
      <div className="v6-rec__stack">
        {LEDGER.map(([k, v, sg], i) => (
          <article key={k} className={`v6-rec__sheet ${sg ? `is-${sg}` : ""}`}
            data-i={i} data-on={i < seen} style={{ ["--i" as string]: i, zIndex: i + 1 }}>
            <span className="v6-rec__k">{k}</span>
            <span className="v6-rec__v">{v}</span>
            <span className="v6-rec__dot" aria-hidden />
          </article>
        ))}
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════ CHAPTER 6A — REACH ══
   One result, three environments. The same object is carried through Build, Deploy and Decide, changing
   only its form: a check, an exit code, a response body, a deployment, an event, a decision, a message.
   ------------------------------------------------------------------------------------------------- */
type Surface = { name: string; form: string; kind: "code" | "line" };
const ENVS: { env: string; surfaces: Surface[] }[] = [
  { env: "Build", surfaces: [
    { name: "GitHub", form: "Vraelis / guarantee  ✓ passed", kind: "line" },
    { name: "CLI", form: "$ vraelis verify  ->  exit 0", kind: "code" },
    { name: "API", form: '{ "decision": "verified" }', kind: "code" },
  ] },
  { env: "Deploy", surfaces: [
    { name: "Vercel", form: "checked against this deployment", kind: "line" },
    { name: "Webhooks", form: "verification.completed", kind: "code" },
  ] },
  { env: "Decide", surfaces: [
    { name: "Vraelis", form: "the decision, and the evidence behind it", kind: "line" },
    { name: "Slack", form: "#billing  ·  the guarantee held", kind: "line" },
  ] },
];

export function Reach() {
  const root = useRef<HTMLElement>(null);
  const seen = useSeen(root, ENVS.length);
  return (
    <section className="v6-rx" ref={root}>
      <div className="v6-rx__head">
        <p className="v6-eyebrow">Where it lands</p>
        <h2 className="v6-rx__h">One result, in the form each place needs.</h2>
      </div>

      <div className="v6-rx__journey">
        {ENVS.map((e, i) => (
          <section key={e.env} className="v6-rx__env" data-i={i} data-on={i < seen}>
            <header className="v6-rx__envh">
              <span className="v6-rx__envn">{e.env}</span>
              <span className="v6-rx__chip"><span className="v6-rx__chipdot" aria-hidden />the same result</span>
            </header>
            <div className="v6-rx__surfaces">
              {e.surfaces.map((sf) => (
                <div key={sf.name} className="v6-rx__surface">
                  <span className="v6-rx__sn">{sf.name}</span>
                  <span className={`v6-rx__sf ${sf.kind === "code" ? "is-code" : ""}`}>{sf.form}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="v6-rx__next">
        <p className="v6-rx__nexth">Direction, not built</p>
        <ul className="v6-rx__soons">
          {["IDE", "Desktop", "Browser companion", "Mobile approvals", "MCP and agent tools"].map((n) => <li key={n}>{n}</li>)}
        </ul>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════ CHAPTER 6B — KNOWLEDGE ══
   A publication, not a card grid: one dominant excerpt, one documentation fragment, a dated rail, and one
   truthful technical fragment. Every word is the real published text of the surface it links to.
   ------------------------------------------------------------------------------------------------- */
export function Knowledge() {
  const recent = CHANGELOG.slice(0, 4);
  const doc = DOCS.find((d) => d.slug === "completion")!;
  return (
    <section className="v6-kn">
      <div className="v6-kn__in">
        <p className="v6-eyebrow v6-kn__eyebrow">Written down</p>

        <div className="v6-kn__grid">
          <Link href={`${BASE}/method`} className="v6-kn__lead">
            <p className="v6-kn__kicker">The Vraelis Method, position 3 of 8</p>
            <blockquote>An agent that plans, writes, and repairs the work will also tell you it is finished.</blockquote>
            <p className="v6-kn__leadp">
              A test written inside the system inherits the same assumptions the mistake came from.
              Independence is not something you reach by trying harder; it is structural.
            </p>
            <span className="v6-kn__more">Read all eight positions<span className="v6-arw" aria-hidden>→</span></span>
          </Link>

          <div className="v6-kn__side">
            <Link href={`${BASE}/docs/${doc.slug}`} className="v6-kn__frag">
              <p className="v6-kn__fragh">Documentation, {doc.group}</p>
              <p className="v6-kn__fragt">{doc.title}</p>
              <p className="v6-kn__fragb">{doc.summary}</p>
            </Link>

            <div className="v6-kn__code">
              <p className="v6-kn__codeh">A decision, read back</p>
              <pre>{`GET /v1/verifications/{id}

{
  "decision": "verified",
  "claim": "A paid customer keeps Pro access
            after signing back in."
}`}</pre>
            </div>
          </div>

          <Link href={`${BASE}/changelog`} className="v6-kn__rail">
            <p className="v6-kn__railh">Changelog</p>
            {recent.map((c) => (
              <span key={c.title} className="v6-kn__rr">
                <span className="v6-kn__rd">{c.date}</span>
                <span className="v6-kn__rt">{c.title}</span>
              </span>
            ))}
          </Link>
        </div>

        <Link href={`${BASE}/docs`} className="v6-kn__cta">Read the documentation<span className="v6-arw" aria-hidden>→</span></Link>
      </div>
    </section>
  );
}
