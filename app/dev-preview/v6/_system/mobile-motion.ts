"use client";

// THE MOTION SYSTEM FOR THE HOMEPAGE. Not the phone's version of it — the only one.
//
// This began as the phone's consolation prize. Every scroll-scrubbed chapter was switched off below 900px
// for a good reason — `a phone is never held inside a scroll sequence it cannot leave` — and what replaced
// it was `opacity: 1 !important` on every moving part, which is not the opposite of scroll-jacking, it is
// stillness. A phone got the finished frames of an argument the desktop watched being made. So this file
// gave those parts entry motion instead.
//
// It is now what every visitor gets. The pinned film is retired: it made the homepage three different
// compositions (a 21,580px scrubbed desktop, an 11,687px phone flow, and a third for reduced motion) that
// shared copy and little else, and the divergence was not theoretical — the founder could not find the
// film on their own site, because the preference their machine shipped with had put them on a third page
// nobody was designing. One composition, one motion system, and the only thing width or preference still
// decides is how far a part travels on its way in.
//
// The form it takes, which was always the right one and is now simply universal:
//
//   PINNING STAYS OFF. Native scroll, never captured, always leavable. Unchanged from the decision above.
//   ENTRY DRIVES IT.   An element animates once, as it arrives, then it is done and unobserved. There is
//                      no per-frame work and nothing recomputes on scroll.
//   COMPOSITOR ONLY.   opacity and transform. No property here can trigger layout or paint.
//
// AND IT TURNS OFF THE ENGINE THAT WAS RUNNING FOR NOTHING. useScrollProgress attaches a scroll listener
// and a rAF loop that measures getBoundingClientRect() and writes --p. Below 900px every consumer of --p
// is overridden, so on a phone that whole loop was computing a value the stylesheet threw away. Measured:
// --p travelled a full 0.00 -> 1.00 on the phone while nothing moved. That is the lag: the page was paying
// for animation it then refused to render.
//
// WHY THE HIDDEN STATE IS GATED ON A CLASS THIS FILE ADDS. The start state is opacity 0. If it lived in
// the stylesheet unconditionally, then any failure to run this code leaves a phone looking at a blank
// page: no JS, no observer, no reveal, no content. So the stylesheet only hides things inside `.v6-mo`,
// and `.v6-mo` exists only once this has run and is ready to reveal. The failure mode is "no animation",
// which is where the page already was, and never "no page".
import { useEffect } from "react";

// The parts each chapter's own mobile block forces visible. Kept as one list rather than pushed into the
// chapter components because it is exactly the inverse of the override list in chapters.css: these two
// have to stay in step, and they are easier to keep in step side by side than scattered across seven files.
const PARTS = [
  ".v6-gap__t",       // chapter 2: the claim, the absence, the verdict
  ".v6-st__cond",     // chapter 3: the conditions that close the ring
  ".v6-rg__row",      // chapter 5: the register's rows
  ".v6-rg__foot",
  ".v6-dr__layer",    // reach: the stack a result fans into
  ".v6-tm__ex",       // the terminal's exit codes
  ".v6-cs__m > *",    // the authored mobile stack for chapter 3
].join(", ");

/**
 * True when this document should get entry reveals instead of the scrubbed film.
 *
 * TWO POPULATIONS, ONE MECHANISM. Phone widths get entry motion because pinning is hostile there.
 * Reduced-motion readers get it AT EVERY WIDTH, because the alternative they were being handed was
 * nothing at all: every scrubbed chapter is overridden for them, so the seven-scene argument collapsed
 * into one flat column that arrives already finished. That is not restraint, it is a different and worse
 * page, and it is what a visitor sees by default on a battery saver or a managed Windows image — not a
 * rare setting somebody opted into.
 *
 * What the preference actually asks for is less MOTION, and the stylesheet honours that precisely: the
 * reduced-motion block moves nothing, it only fades. Travel is what provokes vestibular symptoms; opacity
 * does not travel. So the reveal survives and the movement does not.
 *
 * This also stops useScrollProgress from running for these readers, which is the same win it already was
 * on phones: every consumer of --p is overridden here, so the loop was computing a value the stylesheet
 * throws away.
 */
export function mobileMotionWanted(): boolean {
  if (typeof window === "undefined") return false;
  // EVERY visitor, at every width, with or without the preference. There is one composition now and this
  // is what animates it. The width and preference tests that used to live here are what made the homepage
  // three different pages; the only thing either still decides is how far a part travels on its way in,
  // which is a question for the stylesheet and not for this file.
  return true;
}

/**
 * Mount once, high in the page. Marks the document, then reveals each part as it arrives.
 *
 * Deliberately NOT a per-element hook. Every part on this page belongs to a chapter component that is
 * shared with the desktop composition, and threading a ref through each one to do nothing on desktop is
 * more code in more places to express one breakpoint's behaviour.
 */
export function useMobileMotion(): void {
  useEffect(() => {
    if (!mobileMotionWanted()) return;
    const root = document.documentElement;

    // Marked FIRST, in the same synchronous pass that sets up the observer. The hidden start state and the
    // thing that can undo it arrive together, so there is no window in which content is hidden by a class
    // whose observer does not exist yet.
    root.classList.add("v6-mo");

    const els = Array.from(document.querySelectorAll<HTMLElement>(PARTS));
    // Stagger is per PARENT, not per page: --i restarts inside each chapter, so a chapter's own parts
    // cascade while a chapter further down does not inherit a delay from how much came before it. A single
    // page-wide counter would give the last chapter a delay measured in seconds.
    const seen = new Map<Element, number>();
    for (const el of els) {
      const parent = el.parentElement ?? document.body;
      const n = seen.get(parent) ?? 0;
      seen.set(parent, n + 1);
      el.style.setProperty("--i", String(Math.min(n, 6)));   // capped: nothing waits longer than 6 steps
    }

    if (typeof IntersectionObserver === "undefined") {
      // No observer, no reveal to wait for. Show everything rather than leave it at opacity 0.
      root.classList.remove("v6-mo");
      return;
    }

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("v6-in");
        io.unobserve(e.target);        // once it has arrived it is done; nothing re-runs on the way back
      }
    }, {
      // threshold 0, NOT a fraction of the element. A fraction is a share of the ELEMENT's own area, so a
      // block taller than the viewport divided by the threshold can never reach it and stays invisible
      // forever. On a phone, where every multi-column section becomes one tall column, that is a real
      // shape and not a hypothetical. A bottom margin gives a height-independent trigger line instead.
      threshold: 0,
      rootMargin: "0px 0px -12% 0px",
    });
    for (const el of els) io.observe(el);

    // Anything already on screen at mount reveals immediately: the observer fires for it, but a fresh load
    // scrolled to the top should not animate the first screen in from nothing after the page has painted.
    const vh = window.innerHeight;
    for (const el of els) {
      if (el.getBoundingClientRect().top < vh * 0.9) { el.classList.add("v6-in"); io.unobserve(el); }
    }

    return () => { io.disconnect(); root.classList.remove("v6-mo"); };
  }, []);
}
