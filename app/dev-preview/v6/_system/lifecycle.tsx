"use client";

// The homepage signature scene: ONE responsibility object, followed across four states.
//
// This replaces the eight-step numbered lifecycle. There is a single object on screen the whole way through
// (the same billing responsibility introduced in the opening and resolved in the closing scene); what changes
// is its state chip and the record accumulating underneath it. The record is never rewritten, only added to,
// which is the product's actual behaviour rendered as the composition.
//
// WHY NOT GSAP: the scene needs discrete phase changes, not a scrubbed timeline. `position: sticky` pins
// natively, a rAF-throttled scroll read gives the phase index, and CSS transitions carry the state change.
// ScrollTrigger would add a dependency to reimplement what the platform already does here, and a scrubbed
// timeline would tie the record's legibility to how fast someone happens to scroll.
//
// Desktop and mobile are authored separately (two components, one data source). Desktop pins and advances
// through a record window; mobile never pins the scene, keeps the object lightly sticky at the top so it
// stays identifiable, and gives each state its own screen.
import { useEffect, useRef, useState } from "react";
import "./lifecycle.css";

type Sig = "go" | "wait" | "stop";
type Row = { k: string; v: string; s?: Sig };
type Phase = {
  title: string;   // the narration headline for this state
  tag: string;     // the short label this state's entries file under in the record
  say: string;
  state: string;
  stateSig?: Sig;
  rows: Row[];
};

// The four states. Every row is one beat of the same story, and rows only ever accumulate.
//
// TRUTHFULNESS: Vraelis does not watch an agent work. It holds a requirement outside the code, checks the
// running software against that requirement when the work is claimed complete, routes decisions to a person,
// rechecks a repair as its own run, and preserves every result. State 2 below is therefore what the agent
// did and what it then claimed, not something Vraelis observed live. Nothing here may be reworded into
// continuous monitoring, live activity tracking, automatic repair, or control of production.
const PHASES: Phase[] = [
  {
    title: "Work begins.",
    tag: "Required",
    say: "A person writes down the outcome the business cannot afford to lose, in one sentence, and approves the plan meant to prove it. Both are fixed before any of it runs, and the agent cannot move either one.",
    state: "Plan approved",
    rows: [
      { k: "requirement", v: "written by a person, held outside the code" },
      { k: "plan approved", v: "6 steps, fixed before the run" },
    ],
  },
  {
    title: "Systems change.",
    tag: "Claimed",
    say: "The agent edits code and calls services that move real money. Then it reports that the work is finished. That report is a claim, and a claim is where Vraelis starts.",
    state: "Claimed complete",
    rows: [
      { k: "in scope", v: "billing-web, checkout, account-api" },
      { k: "agent reported", v: "complete" },
    ],
  },
  {
    title: "Vraelis intervenes.",
    tag: "Checked",
    say: "The claim does not survive contact with the running software. One gap is a defect, one is a judgement call that was never the agent's to make, and neither is allowed to ship quietly.",
    state: "Held for review",
    stateSig: "wait",
    rows: [
      { k: "exercised", v: "checkout, sign out, sign back in, in a real browser" },
      { k: "found", v: "the free-plan usage limit is not enforced", s: "stop" },
      { k: "sent to a person", v: "the new pricing needs an owner's approval", s: "wait" },
      { k: "repair rechecked", v: "same requirement, run again from scratch", s: "go" },
    ],
  },
  {
    title: "The company decides what ships.",
    tag: "Decided",
    say: "A named person approves the pricing, the repair holds on its own run, and the change goes out with the record of how it got there still attached.",
    state: "Shipped",
    stateSig: "go",
    rows: [
      { k: "approved by", v: "Nadia R., 14:22, reason recorded", s: "go" },
      { k: "kept", v: "2 failures, 1 repair, 1 approval, none overwritten" },
    ],
  },
];

const TASK = "Add usage-based billing without ever overcharging an existing customer.";
const SYSTEM = "billing-web";

function StateChip({ label, sig }: { label: string; sig?: Sig }) {
  return (
    <span className={`v6-lc__chip ${sig ? `is-${sig}` : ""}`}>
      <span className="v6-lc__chip-dot" aria-hidden />
      {label}
    </span>
  );
}

function Record({ rows, on, tag }: { rows: Row[]; on: boolean; tag: string }) {
  return (
    <>
      <p className="v6-lc__grph" data-on={on}>{tag}</p>
      {rows.map((r, i) => (
        <div key={r.k} className="v6-lc__row" data-on={on} style={{ ["--ri" as string]: i }}>
          <span className={`v6-lc__rdot ${r.s ? `is-${r.s}` : ""}`} aria-hidden />
          <span className="v6-lc__rk">{r.k}</span>
          <span className={`v6-lc__rv ${r.s ? `is-${r.s}` : ""}`}>{r.v}</span>
        </div>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ desktop --- */
function LifecycleDesktop() {
  const wrap = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState(0);
  const [shift, setShift] = useState(0);

  // Phase index from scroll position through the tall wrapper. Native scrolling throughout: nothing is
  // hijacked, captured, or re-timed. The listener no-ops when the desktop scene is display:none on mobile.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let raf = 0;
    // Reduced motion resolves straight to the last state, so the static article shows the finished record.
    // Deferred a frame rather than set synchronously here, matching the rest of this shell: a synchronous
    // setState in an effect body cascades a second render pass.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      raf = requestAnimationFrame(() => setPhase(PHASES.length - 1));
      return () => cancelAnimationFrame(raf);
    }
    const read = () => {
      raf = 0;
      if (!el.offsetParent) return; // hidden at this breakpoint
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      if (total <= 0) return;
      const p = Math.min(0.9999, Math.max(0, -r.top / total));
      setPhase(Math.floor(p * PHASES.length));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(read); };
    onScroll(); // first read on the next frame, not inside the effect body
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Keep the newest entries in the record window. Measured rather than assumed, so the scene survives a
  // short viewport, a long value wrapping to two lines, and a different font stack.
  // Measured on the next frame, after the newly-revealed rows have taken their final layout.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const t = track.current;
      const win = t?.parentElement;
      if (!t || !win) return;
      const g = t.querySelector<HTMLElement>(`[data-g="${phase}"]`);
      if (!g) return;
      const over = g.offsetTop + g.offsetHeight - win.clientHeight;
      setShift(Math.max(0, Math.min(over, Math.max(0, t.scrollHeight - win.clientHeight))));
    });
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const cur = PHASES[phase];

  return (
    <div className="v6-lc" ref={wrap} data-phase={phase} data-nav-dark>
      <div className="v6-lc__pin">
        <div className="v6-lc__in">
          <header className="v6-lc__head">
            <p className="v6-lc__count v6-mono">
              State {phase + 1} of {PHASES.length}
            </p>
            <div className="v6-lc__titles">
              {PHASES.map((p, i) => (
                <div className="v6-lc__title" key={p.title} data-on={i === phase} aria-hidden={i !== phase}>
                  <h2>{p.title}</h2>
                  <p>{p.say}</p>
                </div>
              ))}
            </div>
          </header>

          <div className="v6-lc__obj">
            <div className="v6-lc__objbar">
              <span className="v6-lc__objk v6-mono">Requirement, {SYSTEM}</span>
              <StateChip label={cur.state} sig={cur.stateSig} />
            </div>
            <p className="v6-lc__task">{TASK}</p>
            <div className="v6-lc__win">
              <div className="v6-lc__track" ref={track} style={{ transform: `translate3d(0,${-shift}px,0)` }}>
                {PHASES.map((p, pi) => (
                  <div className="v6-lc__grp" key={p.title} data-g={pi}>
                    <Record rows={p.rows} on={pi <= phase} tag={p.tag} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- mobile --- */
// Not the desktop scene stacked. Nothing pins: the object rides along at the top of the section so it stays
// identifiable, and each state gets its own screen with its record underneath it.
function LifecycleMobile() {
  const [seen, setSeen] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    // No observer, or motion is not wanted: every state is shown resolved straight away.
    if (typeof IntersectionObserver === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const raf = requestAnimationFrame(() => setSeen(PHASES.length));
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (!e.isIntersecting) continue;
          const i = Number((e.target as HTMLElement).dataset.g ?? 0);
          setSeen((s) => Math.max(s, i + 1));
          io.unobserve(e.target);
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -12% 0px" }
    );
    el.querySelectorAll("[data-g]").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  return (
    <div className="v6-lcm" ref={root} data-nav-dark>
      <div className="v6-lcm__obj">
        <span className="v6-lc__objk v6-mono">Requirement, {SYSTEM}</span>
        <p className="v6-lcm__task">{TASK}</p>
      </div>
      {PHASES.map((p, i) => (
        <section className="v6-lcm__ph" key={p.title} data-g={i} data-on={i < seen}>
          <div className="v6-lcm__bar">
            <span className="v6-lc__count v6-mono">State {i + 1} of {PHASES.length}</span>
            <StateChip label={p.state} sig={p.stateSig} />
          </div>
          <h2 className="v6-lcm__t">{p.title}</h2>
          <p className="v6-lcm__say">{p.say}</p>
          <div className="v6-lcm__rows">
            {p.rows.map((r) => (
              <div key={r.k} className="v6-lc__row" data-on>
                <span className={`v6-lc__rdot ${r.s ? `is-${r.s}` : ""}`} aria-hidden />
                <span className="v6-lc__rk">{r.k}</span>
                <span className={`v6-lc__rv ${r.s ? `is-${r.s}` : ""}`}>{r.v}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function Lifecycle() {
  return (
    <>
      <LifecycleDesktop />
      <LifecycleMobile />
    </>
  );
}
