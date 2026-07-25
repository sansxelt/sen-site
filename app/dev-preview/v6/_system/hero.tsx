"use client";

// CHAPTER 1 — the opening.
//
// One category label, one headline, one sentence, one action, on a full-height graphite field. The
// operational landscape that used to sit in the bottom band is gone: it competed with the type and did not
// earn the room it took. Positioning copy comes from _system/positioning.ts and is provisional.
import { CTA } from "./ui";
import { CATEGORY, HEADLINE, SUPPORT } from "./positioning";
import "./hero.css";

export function Hero() {
  return (
    <section className="v6-h" data-nav-dark data-nav-theme="dark">
      <div className="v6-h__field" aria-hidden />
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
