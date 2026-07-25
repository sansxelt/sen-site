"use client";

// CHAPTER 1 — the opening.
//
// A full-width operational landscape, not a flowchart and not a node constellation. The company's software
// is drawn as long horizontal plates receding into depth; one change travels across all of them, dips into a
// browser check, raises a finding, passes a person, and arrives at a trusted result. The plates are cropped
// hard by both viewport edges so the landscape reads as larger than the screen.
//
// Depth is real: three plate depths at different scales and opacities, each drifting at its own rate with
// scroll. Positioning copy comes from _system/positioning.ts and is provisional.
import { useEffect, useRef } from "react";
import { CTA } from "./ui";
import { CATEGORY, HEADLINE, SUPPORT } from "./positioning";
import "./hero.css";

/** Plates the change crosses, back to front. Authored positions, not generated. */
const PLATES: { x: number; y: number; w: number; label: string; depth: 1 | 2 | 3 }[] = [
  { x: -140, y: 236, w: 600, label: "application", depth: 1 },
  { x: 400, y: 302, w: 520, label: "deployment", depth: 2 },
  { x: 860, y: 374, w: 470, label: "payment", depth: 3 },
  { x: 1270, y: 302, w: 470, label: "account access", depth: 2 },
  { x: 1620, y: 236, w: 520, label: "database", depth: 1 },
];

/** Where the change actually goes. One continuous path across the whole landscape. */
const PATH =
  "M -80 258 C 220 258, 320 322, 540 328 C 760 334, 820 398, 1040 400 " +
  "C 1260 402, 1330 326, 1470 328 C 1610 330, 1660 258, 1960 258";

export function Hero() {
  const root = useRef<HTMLElement>(null);

  // Slow scroll-linked drift. Each depth layer moves at its own rate, which is what makes the landscape read
  // as a space rather than a picture. An absolute function of scroll position, so it never queues.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
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
  }, []);

  return (
    <section className="v6-h" data-nav-dark ref={root}>
      <div className="v6-h__field" aria-hidden />

      <div className="v6-h__land" aria-hidden>
        <svg className="v6-h__svg" viewBox="0 0 1960 620" preserveAspectRatio="xMidYMid slice">
          <g className="v6-h__far">
            {[104, 146, 188].map((y) => <line key={y} x1="-240" y1={y} x2="2200" y2={y} />)}
          </g>

          {PLATES.map((pl) => (
            <g key={pl.label} className={`v6-h__plate is-d${pl.depth}`}>
              <rect x={pl.x} y={pl.y} width={pl.w} height="14" rx="7" />
              <text x={pl.x + 18} y={pl.y - 18}>{pl.label}</text>
            </g>
          ))}

          <path className="v6-h__trail" d={PATH} fill="none" />

          <g className="v6-h__stop is-check"><circle cx="1040" cy="400" r="11" /><text x="1040" y="444">browser check</text></g>
          <g className="v6-h__stop is-find"><circle cx="1270" cy="362" r="11" /><text x="1270" y="334">finding</text></g>
          <g className="v6-h__stop is-person"><circle cx="1470" cy="328" r="11" /><text x="1470" y="300">a person decides</text></g>
          <g className="v6-h__stop is-done"><circle cx="1770" cy="258" r="15" /><text x="1770" y="224">verified</text></g>
        </svg>
      </div>

      <div className="v6-h__inner">
        <p className="v6-eyebrow v6-h__eyebrow">{CATEGORY}</p>
        <h1 className="v6-h__h1">
          <span className="v6-mask"><span className="v6-mask__in lead-clause">{HEADLINE[0]}</span></span>
          <span className="v6-mask"><span className="v6-mask__in" style={{ animationDelay: "170ms" }}>{HEADLINE[1]}</span></span>
        </h1>
        <p className="v6-h__say">{SUPPORT}</p>
        <div className="v6-h__cta"><CTA brand lg>Open Vraelis</CTA></div>
      </div>
    </section>
  );
}
