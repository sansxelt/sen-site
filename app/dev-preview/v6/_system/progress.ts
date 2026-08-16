"use client";

// THE MOTION ENGINE for every scroll-scrubbed composition on the site.
//
// Scroll position is the source of truth, but it is not written to the DOM raw. Raw writes made the scene
// jump to the new absolute value on each wheel event and then FREEZE until the next one, which is exactly
// the "set of frames" feel: scroll, snap, stop, scroll, snap. Scale-style continuity comes from the value
// continuing to travel between inputs.
//
//   scroll / resize   ->  TARGET progress   (measured from the wrapper's position, absolute, instant)
//   one rAF loop      ->  RENDERED progress (chases target with time-based exponential smoothing)
//   rendered          ->  written straight to a CSS custom property; CSS derives everything else
//
// Behaviour this buys, all measured rather than intended:
//   - between wheel events the scene keeps producing intermediate frames until it settles
//   - a fast scroll approaches the correct ABSOLUTE position (tau 55ms: 95% in ~165ms, still inside the
//     settle budget) without replaying skipped states or queueing anything. 32ms tracked the wheel so
//     tightly that the scene read as jumpy rather than smooth; 55 keeps it continuous.
//   - reverse scrolling reverses from the exact current value, never restarts
//   - scrollbar drags and PageDown land on the correct composition because target is always absolute
//   - React never renders during this: the loop writes styles, not state
//
// The loop runs ONLY while rendered is still chasing target; at rest there is no rAF churn at all.
// Where the cascade throws --p away the value is pinned to 1 and no scroll listener is ever attached; the
// media queries that decide that are listened to, so crossing one turns the engine on or off in place.
import { useEffect, type RefObject } from "react";
import { SHORT } from "./mobile-motion";

type Options = {
  /** Written on the element as this custom property. Defaults to "--p". */
  property?: string;
  /** Called with the rendered value on every engine frame; for derived discrete state (an act index). */
  onFrame?: (rendered: number) => void;
  /**
   * Maps the wrapper's geometry to target progress. The default is the pinned-chapter mapping
   * (-top / (height - viewport)). Compositions that are not pinned pass their own.
   */
  measure?: (rect: DOMRect, viewportHeight: number) => number;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const pinned = (rect: DOMRect, vh: number) => {
  const total = rect.height - vh;
  return total > 0 ? clamp01(-rect.top / total) : 0;
};

export function useScrollProgress(ref: RefObject<HTMLElement | null>, options?: Options) {
  const property = options?.property ?? "--p";
  const onFrame = options?.onFrame;
  const measure = options?.measure ?? pinned;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Tears down whatever the current branch built. Null while the value is pinned, because that branch
    // builds nothing at all.
    let stop: (() => void) | null = null;

    // THREE PLACES NOTHING READS THIS, so in none of them should it be computed.
    //
    // Every chapter's mobile block unpins its scene and overrides each --p-driven declaration, which means
    // on a phone this loop was attaching a scroll listener, measuring getBoundingClientRect() and writing a
    // custom property that the cascade then discarded. Measured on an iPhone 13 viewport: --p travelled a
    // full 0.00 -> 1.00 while not one part of any chapter moved. Scroll work with no rendered result is the
    // most expensive kind, and it is a fair share of why the page felt heavy on a phone. Reduced motion and
    // a window too short to pin a scene in reach the same unpinned composition and waste the same work.
    // SHORT is imported rather than restated so the stylesheet, the reveal and this cannot drift apart.
    //
    // The value is pinned to 1 rather than left unset: a consumer that survives here reads a finished
    // scene, never a half-scrubbed one.
    //
    // AND THE GATE IS LIVE, WHICH IT WAS NOT. It ran once against deps that never changed, while
    // chapters.css re-evaluates the identical queries on every resize. So a window that crossed 767px tall
    // after mount kept whichever branch it loaded with: re-entering fullscreen on a Chromebook left about
    // 13,100px of pinned scene frozen at --p: 1, and chapter 3's end state at that value is a BLANK right
    // column, because every condition's opacity is clamp(0, 3.235 - 5.88 * dist, 1) and all four are past
    // it. The three MediaQueryLists are built once so a listener can hang off each, and any crossing tears
    // the current branch down and re-enters this one. Two of them firing on the same resize is harmless:
    // the teardown is idempotent and the second pass finds nothing left to remove.
    const gates = [
      window.matchMedia("(prefers-reduced-motion: reduce)"),
      window.matchMedia("(max-width: 900px)"),
      window.matchMedia(SHORT),
    ];

    const start = () => {
      if (gates.some((m) => m.matches)) {
        el.style.setProperty(property, "1");
        onFrame?.(1);
        return;
      }

      let target = 0;
      let rendered = -1; // first frame adopts target directly, so a mid-page load never animates from 0
      let raf = 0;
      let lastTime = 0;

      const readTarget = () => {
        if (!el.offsetParent) return;
        target = measure(el.getBoundingClientRect(), window.innerHeight);
      };

      const frame = (now: number) => {
        raf = 0;
        const dt = lastTime ? Math.min(64, now - lastTime) : 16.7;
        lastTime = now;
        if (rendered < 0) {
          rendered = target;
        } else {
          // exponential approach: frame-rate independent, always moving toward the absolute target
          rendered += (target - rendered) * (1 - Math.exp(-dt / 55));
          // snap when the remaining distance is invisible, so the loop can actually stop
          if (Math.abs(target - rendered) < 0.0004) rendered = target;
        }
        el.style.setProperty(property, rendered.toFixed(4));
        onFrame?.(rendered);
        if (rendered !== target) {
          raf = requestAnimationFrame(frame);
        } else {
          lastTime = 0;
        }
      };

      const kick = () => {
        readTarget();
        if (!raf) raf = requestAnimationFrame(frame);
      };

      kick();
      window.addEventListener("scroll", kick, { passive: true });
      window.addEventListener("resize", kick);
      stop = () => {
        window.removeEventListener("scroll", kick);
        window.removeEventListener("resize", kick);
        if (raf) cancelAnimationFrame(raf);
      };
    };

    // A crossing in either direction is a full teardown and a full re-entry, never a patch. Coming back
    // into the scrub, `rendered` starts at -1 again, so the first frame adopts the absolute target instead
    // of animating up from the 1 the pinned branch left behind.
    const recheck = () => {
      stop?.();
      stop = null;
      start();
    };

    start();
    for (const m of gates) m.addEventListener("change", recheck);
    return () => {
      for (const m of gates) m.removeEventListener("change", recheck);
      stop?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- options are stable per call site
  }, [ref, property]);
}

/**
 * Progress for a composition that is NOT pinned: 0 while the element's top is below the viewport, 1 once
 * it has risen `span` viewports into view. Continuous in scroll position, so it scrubs both directions.
 */
export const entryProgress = (span = 0.85) => (rect: DOMRect, vh: number) =>
  clamp01((vh - rect.top) / (vh * span));
