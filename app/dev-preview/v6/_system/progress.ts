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
// Reduced motion pins the value to 1 and never listens.
import { useEffect, type RefObject } from "react";

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
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
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
    return () => {
      window.removeEventListener("scroll", kick);
      window.removeEventListener("resize", kick);
      if (raf) cancelAnimationFrame(raf);
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
