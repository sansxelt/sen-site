"use client";

// CHAPTER 1 — the opening.
//
// One category label, one headline, one sentence, one action, on a full-height graphite field. The
// operational landscape that used to sit in the bottom band is gone: it competed with the type and did not
// earn the room it took. Positioning copy comes from _system/positioning.ts and is provisional.
import { CTA, EditorialLink } from "./ui";
import { CATEGORY, HEADLINE, SUPPORT } from "./positioning";
import { PUBLIC_HOW_IT_WORKS, V6_BASE } from "@/lib/v6-routes";
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
        {/* One dominant action. The secondary link has been "See the proof" and then "Watch it run"; both
            were a second decision offered before the reader had a reason to make one, and both are gone.
            The header already carries Open Vraelis and Sign in. A second Open button here sent a visitor
            who has never signed in straight into an app that can only ask them to sign in, and it spent the
            page's one dominant action on a destination the header already owns. The hero's job is to earn
            the next scroll, so it points at how the thing works.
            THE QUIET LINK BESIDE IT IS DIFFERENT IN KIND, and it is a founder decision (2026-08-23): the
            live-versus-planned list is the page a serious reader wants first and it was reachable only
            through submenus. This is not a second call to action; it is the site's honesty, offered on the
            first screen. Same name the menus and the footer use, so it reads as one destination. */}
        <div className="v6-h__cta">
          <CTA brand lg href={PUBLIC_HOW_IT_WORKS}>See how it works</CTA>
          <EditorialLink href={`${V6_BASE}/platform#current`}>What is built, and what is next</EditorialLink>
        </div>
      </div>
    </section>
  );
}
