"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * The driver for the `.reveal` motion system in public/vraelis/styles.css.
 *
 * The CSS half has always been there: `.reveal` starts at opacity 0 and
 * `.reveal.in` settles it to 1, with `data-d="1".."5"` staggering the
 * transition-delay. The half that adds `.in` was a per-element <Reveal>
 * wrapper inside the old app/(vraelis) route group, and it was deleted
 * with that group in 23217bd1. Nothing replaced it, so `.reveal` became
 * a class that hides content permanently — which is why the marketing
 * pages carry no reveal markup at all today.
 *
 * This is the same idea rebuilt as ONE document-level observer instead of
 * a wrapper component. Two reasons it is not a straight restore:
 *
 *  - Plain markup. A wrapper forces every animated element to become a
 *    <Reveal> and to thread className/style/as through it. An observer
 *    over [class~="reveal"] means a section animates by gaining one
 *    class, so server components stay server components.
 *  - One observer, not N. The homepage would otherwise mount a dozen
 *    IntersectionObservers that each watch a single node.
 *
 * Mounted once in the site shell. Re-runs per pathname because a client
 * navigation swaps the body without remounting the shell.
 */
export function Reveal() {
  const pathname = usePathname();

  useEffect(() => {
    // Reduced motion: the stylesheet already forces `.reveal` to
    // opacity:1 !important, so there is nothing to drive and nothing to
    // strand. Bail before creating an observer.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const show = (el: Element) => el.classList.add("in");
    const pending = () =>
      Array.from(document.querySelectorAll<HTMLElement>(".reveal:not(.in)"));

    const targets = pending();
    if (targets.length === 0) return;

    // No IntersectionObserver: reveal everything rather than leave the
    // page invisible. `.reveal` defaults to opacity 0, so failing to
    // fire here costs the reader the content, not just the animation.
    if (typeof IntersectionObserver === "undefined") {
      targets.forEach(show);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            show(e.target);
            io.unobserve(e.target);
          }
        }
      },
      // Matches the thresholds the deleted wrapper used, so restored
      // markup animates the way it was authored to.
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    // THE SKIPPED-PAST CASE, which the observer cannot report.
    //
    // An element that moves from below the viewport to above it inside a
    // single frame never intersects, so IntersectionObserver never queues
    // a callback for it — there is no entry to inspect, and checking
    // boundingClientRect inside the callback does not help because the
    // callback does not run. Left alone it keeps `.reveal`'s opacity 0
    // forever, and the reader has lost that content for the session.
    //
    // A jump to the bottom of this page strands 17 of 19 elements, and it
    // is not a synthetic case: in-page anchors, a restored scroll position
    // on reload, and find-in-page all move the viewport that way.
    //
    // So the scroll handler sweeps for anything the page has scrolled
    // beyond and settles it. It is cheap (only elements still pending are
    // considered, and the list empties as the reader descends) and it runs
    // on rAF rather than per event.
    let sweeping = false;
    const sweepPast = () => {
      sweeping = false;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      for (const el of pending()) {
        const r = el.getBoundingClientRect();
        // Past the top, or already inside the viewport. The second half
        // matters because a jump can also land with an element sitting in
        // view that the observer never got to watch arrive — it is on
        // screen, so it has to be readable, animation or not.
        if (r.bottom < 0 || (r.top < vh && r.bottom > 0)) show(el);
      }
    };
    const onScroll = () => {
      if (sweeping) return;
      sweeping = true;
      requestAnimationFrame(sweepPast);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // Arriving part-way down the page (a reload that restores scroll, or a
    // link to an anchor) leaves content above the fold that the observer
    // will never report, because it was already past before it started
    // watching. Settle those synchronously, unanimated: they are behind
    // the reader, and animating them would be motion nobody sees.
    for (const el of targets) {
      if (el.getBoundingClientRect().bottom < 0) show(el);
      else io.observe(el);
    }

    // Anything added after mount (a section that renders once data
    // arrives) still needs driving, and it would otherwise sit at
    // opacity 0 forever.
    const mo = new MutationObserver(() => {
      for (const el of pending()) io.observe(el);
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      mo.disconnect();
      io.disconnect();
    };
  }, [pathname]);

  return null;
}
