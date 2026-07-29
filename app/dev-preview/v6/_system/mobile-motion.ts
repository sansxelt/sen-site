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
// THE PARTS THE SCRUB DRIVES. On a desktop these are animated by --p and must NOT be touched here, or the
// entry reveal and the scrub would both be writing the same opacity. They are observed only where the
// scrub does not run, which is the width and the preference below.
const SCRUBBED_PARTS = [
  ".v6-gap__t",       // chapter 2: the claim, the absence, the verdict
  ".v6-st__cond",     // chapter 3: the conditions that close the ring
  ".v6-rg__row",      // chapter 5: the register's rows
  ".v6-rg__foot",
  ".v6-dr__layer",    // reach: the stack a result fans into
  ".v6-tm__ex",       // the terminal's exit codes
  ".v6-cs__m > *",    // the authored mobile stack for chapter 3
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
  ".v6-st__h", ".v6-st__sub",
  ".v6-rg__h",
  ".v6-dr__h", ".v6-dr__sub",
  ".v6-rx__h", ".v6-rx__sub",
  ".v6-tm__h",
  ".v6-kn__sheet", ".v6-kn__col", ".v6-kn__ex",   // the knowledge field
].join(", ");

const MOBILE = "(max-width: 900px)";
const REDUCED = "(prefers-reduced-motion: reduce)";

/** True where the scrubbed chapters do NOT run, so their parts need entry motion instead. */
export function mobileMotionWanted(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(MOBILE).matches && !window.matchMedia(REDUCED).matches;
}

/** True where entry motion should animate a part on its way in rather than settle it instantly. */
function entryMotionWanted(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return !window.matchMedia(REDUCED).matches;
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
    // TWO SETS, ONE OBSERVER.
    //
    // ALWAYS_PARTS run everywhere, because the scrub never drove them and on a desktop they had no motion
    // at all. SCRUBBED_PARTS run only where the scrub does not, or the reveal and the scrub would both be
    // writing the same opacity on the same element.
    //
    // Reduced motion still gets the class and still gets the observer: the stylesheet decides that its
    // reveal is a fade with no travel, which is a question about distance, not about whether a reader is
    // allowed to see anything arrive.
    if (!entryMotionWanted()) return;
    const root = document.documentElement;
    const selector = mobileMotionWanted() ? `${ALWAYS_PARTS}, ${SCRUBBED_PARTS}` : ALWAYS_PARTS;

    // Marked FIRST, in the same synchronous pass that sets up the observer. The hidden start state and the
    // thing that can undo it arrive together, so there is no window in which content is hidden by a class
    // whose observer does not exist yet.
    root.classList.add("v6-mo");

    const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
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
