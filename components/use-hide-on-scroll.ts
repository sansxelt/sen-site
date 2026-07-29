"use client";

import { useEffect, useRef, useState } from "react";

/** How far past the top the bar stays pinned no matter what. Above this the
 *  page is still "at the top" and hiding the chrome reads as a glitch. */
const TOP_ZONE = 72;
/** Pointer distance from the top edge that summons the bar back. Roughly the
 *  height of the bar itself, so aiming at where it *was* brings it back. */
const HOVER_ZONE = 80;
/** Scroll delta required before a direction change counts.
 *
 *  Two things this absorbs. The small one is trackpad jitter. The larger one
 *  is `scroll-behavior: smooth` (set on <html> in styles.css): the browser
 *  eases into a target and settles back onto it, so one downward scroll ends
 *  with tens of pixels of backward drift. Below the threshold that tail reads
 *  as a deliberate scroll up and pops the bar open at the end of every
 *  gesture — the opposite of what the reader asked for.
 *
 *  60px clears the drift with margin. The cost is that a flick up shorter
 *  than that does not summon the bar; reaching the top of the page and the
 *  pointer-proximity path both still do, and a reader who wants the nav back
 *  scrolls further than 60px anyway.
 *
 *  NOTE: this does NOT fully settle the bar on narrow viewports, and cannot.
 *  The homepage itself oscillates there — one scrollTo(1400) leaves the page
 *  cycling between 1400/1443/1502 indefinitely, and it does so on a clean
 *  checkout with this hook removed entirely, so it is a pre-existing layout
 *  instability rather than something the nav introduced. Those swings are
 *  larger than any sane threshold, so the bar follows them. Raising this
 *  number further would only mask a page bug behind a nav constant. */
const THRESHOLD = 60;

/**
 * Hide-on-scroll-down, reveal-on-scroll-up — plus reveal when the pointer
 * approaches the top edge, so a mouse user can summon the nav without
 * scrolling backwards.
 *
 * Returns whether the bar should currently be shown. The caller animates it
 * with a transform (never `height` or `display`), so the bar slides out of
 * the document's paint without reflowing the page under it.
 *
 * Notes on the two things that make this feel wrong when done naively:
 *
 *  - Reading scrollY in the listener and setting state every event pegs the
 *    main thread during a fast scroll. The handler here only marks a frame
 *    dirty; the read and the compare happen once per rAF.
 *  - `scroll-behavior: smooth` (set on <html> in styles.css) means one
 *    gesture becomes a long animation through many intermediate positions,
 *    all of them ordinary scroll events. Anything that re-decides per event
 *    will flicker while a single scroll is still settling, which is why the
 *    anchor below tracks the run's extreme rather than the last position.
 */
export function useHideOnScroll(): boolean {
  const [shown, setShown] = useState(true);
  // The furthest point of the current run: the deepest position reached while
  // descending, the highest while climbing. Deltas are measured from here, so
  // a reversal is detectable at a fixed distance however long the run was.
  // See the reasoning in settle() — both of the obvious alternatives break.
  const anchor = useRef(0);
  const ticking = useRef(false);
  // The pointer wins over scroll direction: while the mouse is in the top
  // band the bar stays put even if the page keeps scrolling under it.
  const nearTop = useRef(false);

  useEffect(() => {
    anchor.current = window.scrollY;

    const settle = () => {
      ticking.current = false;
      const y = window.scrollY;

      // At the top of the document the bar is always present. The run is
      // reset here too: leaving the top zone should start measuring from the
      // edge of it, not from wherever the reader last turned around.
      if (y <= TOP_ZONE) {
        anchor.current = y;
        setShown(true);
        return;
      }

      // Pointer parked at the top edge outranks scroll direction, but the run
      // still has to track the page, or dropping out of the zone would
      // compare against a position from before the scroll.
      if (nearTop.current) {
        anchor.current = y;
        setShown(true);
        return;
      }

      // The anchor is the FURTHEST POINT of the current run — the deepest
      // point reached while descending, the highest while climbing — and the
      // delta is measured from there. That is what makes a reversal
      // detectable at a constant distance no matter how long the run was:
      //
      //  - Anchoring to "wherever we last looked" reacts to the easing tail
      //    of a single smooth scroll, so the bar flickers while one gesture
      //    is still settling. (`scroll-behavior: smooth` is set on <html> in
      //    styles.css, so every programmatic scroll is an animation.)
      //  - Anchoring to "the last turning point" is worse in the other
      //    direction: after descending 800px the delta is +800, and scrolling
      //    back up 400 only shrinks it to +400. Still positive, so the bar
      //    stays hidden and the reader cannot get it back without returning
      //    to the very top. That is the bug the settled mobile test caught.
      //
      // Tracking the extreme means the delta is always "how far back from the
      // furthest point", which crosses THRESHOLD after a few pixels of real
      // reversal and nothing else.
      const delta = y - anchor.current;

      if (delta > 0) {
        // Descending, or reversing out of a climb.
        if (delta >= THRESHOLD) {
          setShown(false);
          anchor.current = y;
        }
      } else if (-delta >= THRESHOLD) {
        // Climbing, or reversing out of a descent.
        setShown(true);
        anchor.current = y;
      }
    };

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(settle);
    };

    const onPointerMove = (e: PointerEvent) => {
      // Touch drags report as pointer events too, and a thumb near the top
      // of the screen during an upward fling would pin the bar open. Only a
      // real cursor gets proximity reveal.
      if (e.pointerType !== "mouse") return;
      const inZone = e.clientY <= HOVER_ZONE;
      if (inZone === nearTop.current) return;
      nearTop.current = inZone;
      if (inZone) setShown(true);
      else anchor.current = window.scrollY;
    };

    // Leaving the window entirely (up into the browser chrome) should not
    // strand the bar pinned open forever.
    const onPointerLeave = () => {
      if (!nearTop.current) return;
      nearTop.current = false;
      anchor.current = window.scrollY;
    };

    settle();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return shown;
}
