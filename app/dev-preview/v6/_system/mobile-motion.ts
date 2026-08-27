"use client";

// MOTION FOR PHONES, WHICH HAD NONE.
//
// Every scroll-scrubbed chapter on this page is switched off below 900px. The stylesheet says why, and the
// reason is right: `a phone is never held inside a scroll sequence it cannot leave`. Pinning a scene to a
// 100vh viewport and scrubbing it from scroll position is hostile on a device whose URL bar resizes the
// viewport mid-gesture and whose only navigation IS the scroll.
//
// But the fix that was applied was `opacity: 1 !important; transform: none !important` on every moving
// part, and the opposite of scroll-jacking is not stillness. Measured on an iPhone 13 viewport, not one
// part of any chapter ever left its rest state, while the same page on a 1440px viewport animated all of
// them. A phone got the finished frames of an argument the desktop gets to watch being made.
//
// So this restores motion in the form a phone can actually afford:
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
// THE PARTS THE SCRUB DRIVES, AND WHY THEY ARE NOW OBSERVED EVERYWHERE ANYWAY.
//
// On a desktop these are animated by --p, and the reveal must not write the same opacity there. It does
// not, because the hide and the .v6-in release that undoes it BOTH live inside one media query in
// chapters.css, `(max-width: 900px), (prefers-reduced-motion: reduce), (max-height: 619px)`, which is the
// inverse of where the scrub runs. Outside it neither rule matches, so carrying .v6-in on a scrubbed
// element is inert.
//
// That is what makes it safe to observe them unconditionally, and unconditional is what they have to be.
// The selector used to be chosen from a media query ONCE, at mount, while the hide rule is re-evaluated by
// the browser on every resize. A window that crossed the gate height after mount therefore got the hide with
// nothing watching for its reveal, and six classes of homepage content sat at opacity 0 until the next
// navigation. Toggling a Chromebook out of fullscreen is exactly that resize. A media query is live; a
// JavaScript read of one is a single sample, and the two must not be asked to agree.
const SCRUBBED_PARTS = [
  ".v6-au__seal",     // chapter 2: the five seals, four of which close
  ".v6-au__turnt",    // chapter 2: the turn underneath them
  ".v6-gap__t",       // chapter 3: the claim, the absence, the verdict
  ".v6-st__cond",     // chapter 4: the conditions that close the ring
  ".v6-rg__row",      // chapter 6: the register's rows
  ".v6-rg__foot",
  ".v6-dr__layer",    // reach: the stack a result fans into
  ".v6-tm__ex",       // the terminal's exit codes
].join(", ");

// EVERYTHING THE SCRUB NEVER TOUCHED, WHICH IS MOST OF THE PAGE.
//
// Four of thirteen sections are pinned and scrubbed. The other nine had no motion of any kind on a desktop:
// counted on the live page, 7 category labels, 5 chapter headlines, 3 supporting lines and the whole
// knowledge section simply existed. The film was real and it was also most of what moved, which is why the
// page could be described as not having much animation while the film was demonstrably running.
//
// Verified against the stylesheet before adding any of these: not one is derived from --p or from any of
// the scrub's intermediate variables, so nothing here can contend with a scrubbed declaration.
const ALWAYS_PARTS = [
  ".v6-eyebrow",                    // every chapter's category label
  ".v6-au__h", ".v6-au__sub",
  ".v6-st__h", ".v6-st__sub",
  ".v6-rg__h",
  ".v6-dr__h", ".v6-dr__sub",
  ".v6-rx__h", ".v6-rx__sub",
  ".v6-tm__h",
  ".v6-kn__sheet", ".v6-kn__col", ".v6-kn__ex",   // the knowledge field
].join(", ");

const MOBILE = "(max-width: 900px)";
const REDUCED = "(prefers-reduced-motion: reduce)";
// THE WINDOW IS TOO SHORT TO PIN A SCENE IN. Every pin is `height: 100svh; overflow: hidden`, so a window
// shorter than the scene was composed for does not compress it, it clips it.
//
// THIS WAS 767px AND IS NOW 619px. At 1366x657 the Direction chapter used to lose a whole layer off the
// bottom and overprint its disclosure line with the graph, which is why the gate sat above that size. The
// scenes no longer meet a short window carrying a tall window's spacing: SHORT-WINDOW DENSITY in
// chapters.css interpolates against window height continuously, so every scene now measures clean from
// 620px up and the gate moved down to where the composition actually stops fitting rather than where it
// used to. Below 620px the shortfall stops being whitespace and the stacked composition is still right:
// that band is a landscape phone, and a 1366x657 laptop at 125% scaling, which reports 1093x526.
// chapters.css unpins the scenes below this height for that reason, and the
// literal is repeated there in three media queries. See NOT ENOUGH ROOM TO PIN for the four gates.
export const SHORT = "(max-height: 619px), (max-width: 900px) and (max-height: 767px)";

/**
 * True where the scrubbed chapters do NOT run, so their parts need entry motion instead.
 *
 * NOTHING IN THIS FILE CALLS IT ANY MORE, and that is the point. It used to choose the observer's
 * selector, which sampled a live media query once at mount and left content hidden after a resize across
 * it. The reveal now observes everything and lets the cascade decide, so this survives as the one written
 * statement in JavaScript of "the scrub does not run here", which is gate 4 of the four in chapters.css.
 * Read it before changing any of the three literals above; do not reintroduce it as a branch around a
 * class or a selector.
 */
export function mobileMotionWanted(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  // REDUCED MOTION IS NOT ITS OWN PAGE. It gets what a phone gets: the scrubbed chapters unpinned and
  // revealed on entry. The preference is about how far a thing TRAVELS, not about whether a reader is
  // allowed to see anything arrive, and the stylesheet answers that separately by damping the travel to
  // zero and keeping the fade.
  //
  // Measured before this changed, on the same page: desktop 26,869px with four pins and a live scrub;
  // desktop with the preference set 11,325px with no pins, no scrub AND no reveals — a third composition
  // that nobody designed, reached by a setting a battery saver turns on without asking. Branching a page on
  // that preference is the mistake; expressing it as an amount of movement is not.
  // A SHORT WINDOW IS THE THIRD WAY INTO THE UNPINNED STACK, and it wants what the other two want. Left
  // out of this list, a 1366x657 Chromebook is a window the stylesheet unpins and forces to rest with
  // !important, so it would neither scrub nor be counted anywhere as a place the scrub does not run. That
  // is the same "third composition nobody designed" the reduced-motion note above describes, reached from
  // the other side.
  return window.matchMedia(MOBILE).matches
    || window.matchMedia(REDUCED).matches
    || window.matchMedia(SHORT).matches;
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
    // TWO SETS, ONE OBSERVER, AND NO MEDIA QUERY READ FROM JAVASCRIPT.
    //
    // ALWAYS_PARTS run everywhere, because the scrub never drove them and on a desktop they had no motion
    // at all. SCRUBBED_PARTS are observed everywhere too: the stylesheet decides where their reveal has
    // any effect, and it decides it live, on every resize. See the note above SCRUBBED_PARTS for the
    // failure this replaces, which was content stuck at opacity 0 after a resize across the gate height.
    //
    // Reduced motion still gets the class and still gets the observer: the stylesheet decides that its
    // reveal is a fade with no travel, which is a question about distance, not about whether a reader is
    // allowed to see anything arrive.
    // No gate on the preference any more: everybody gets the observer. What differs is only how far a
    // revealed part moves, which is decided in chapters.css.
    const root = document.documentElement;
    const selector = `${ALWAYS_PARTS}, ${SCRUBBED_PARTS}`;

    // Marked FIRST, in the same synchronous pass that sets up the observer. The hidden start state and the
    // thing that can undo it arrive together, so there is no window in which content is hidden by a class
    // whose observer does not exist yet.
    root.classList.add("v6-mo");

    const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
    // Stagger is per PARENT, not per page: --i restarts inside each chapter, so a chapter's own parts
    // cascade while a chapter further down does not inherit a delay from how much came before it. A single
    // page-wide counter would give the last chapter a delay measured in seconds.
    //
    // AN AUTHORED --i IS NEVER OVERWRITTEN, and that became load-bearing the moment SCRUBBED_PARTS were
    // observed on a desktop as well. Four of them carry --i inline from chapters.tsx and the SCRUB reads
    // it: .v6-st__cond derives --slot from it, .v6-rg__row and .v6-dr__layer derive --on, .v6-tm__ex
    // derives its transition-delay. Writing a per-parent counter over those values reindexes the scrub
    // itself, so the register's eight rows would have settled in pairs of 0,1 instead of in sequence.
    // The authored index is also the correct reveal order, so there is nothing to compute for them.
    const seen = new Map<Element, number>();
    for (const el of els) {
      if (el.style.getPropertyValue("--i")) continue;
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
