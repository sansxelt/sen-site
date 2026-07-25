"use client";

// CHAPTER 1 — the opening.
//
// One headline, one sentence, one action, one quiet action, one visual. Nothing else. The previous opening
// put a requirement, a five-state trajectory, a findings panel and a decision line above the fold, which is
// four ideas competing before anyone has scrolled. The opening's job is scale and curiosity; the proof is
// chapters 2 to 5.
//
// The visual is a fragment of the system graph that chapter 3 opens out in full, cropped hard by the right
// edge of the viewport. It is deliberately unexplained: two node labels, one broken edge, no legend.
// Positioning copy comes from _system/positioning.ts and is provisional.
import { CTA } from "./ui";
import { CATEGORY, HEADLINE, SUPPORT } from "./positioning";
import "./hero.css";

function GraphFragment() {
  // Authored at 900x900 and anchored off the right edge, so a visitor sees a slice of something larger
  // rather than a diagram sitting in a box.
  return (
    <svg className="v6-h__gfx" viewBox="0 0 900 900" aria-hidden focusable="false">
      <defs>
        <linearGradient id="v6hEdge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0.34" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <g fill="none" strokeWidth="1.5">
        <path d="M120 470 C 300 470, 320 250, 470 250" stroke="url(#v6hEdge)" />
        <path d="M120 470 C 300 470, 330 700, 500 700" stroke="url(#v6hEdge)" />
        <path d="M470 250 C 640 250, 660 470, 790 470" stroke="url(#v6hEdge)" />
        {/* the one edge that did not hold */}
        <path d="M500 700 C 660 700, 680 470, 790 470" stroke="var(--stop-dk)" strokeOpacity="0.7" strokeDasharray="9 13" />
      </g>
      <g className="v6-h__gfx-nodes">
        <circle cx="120" cy="470" r="12" />
        <circle cx="470" cy="250" r="9" />
        <circle cx="500" cy="700" r="9" />
        <circle className="is-hub" cx="790" cy="470" r="27" />
      </g>
      <g className="v6-h__gfx-x">
        <line x1="488" y1="688" x2="512" y2="712" />
        <line x1="512" y1="688" x2="488" y2="712" />
      </g>
      <text className="v6-h__gfx-t" x="120" y="514">checkout</text>
      <text className="v6-h__gfx-t" x="500" y="744">account-api</text>
    </svg>
  );
}

export function Hero() {
  return (
    <section className="v6-h" data-nav-dark>
      <div className="v6-h__field" aria-hidden />
      <div className="v6-h__gfxwrap" aria-hidden>
        <GraphFragment />
      </div>

      <div className="v6-h__inner">
        <p className="v6-eyebrow v6-h__eyebrow">{CATEGORY}</p>
        <h1 className="v6-h__h1">
          <span className="v6-mask"><span className="v6-mask__in lead-clause">{HEADLINE[0]}</span></span>
          <span className="v6-mask"><span className="v6-mask__in" style={{ animationDelay: "170ms" }}>{HEADLINE[1]}</span></span>
        </h1>
        <p className="v6-h__say">{SUPPORT}</p>
        <div className="v6-h__cta">
          <CTA brand lg>Open Vraelis</CTA>
        </div>
      </div>
    </section>
  );
}
