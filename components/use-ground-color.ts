"use client";

import { useEffect, useState, type RefObject } from "react";

// THE BAR TAKES THE COLOUR OF WHATEVER IS UNDER IT. ONE IMPLEMENTATION, BOTH SHELLS.
//
// This started life inside the v6 marketing shell, where a bar that declared its theme from a data
// attribute sat white over a ground that had interpolated its way to near-black. A declared theme is one of
// two values and chapter 2 does not have two values: it mixes paper to graphite across its last 12%.
//
// It lives here because the console had the same class of problem for the opposite reason — its bars do not
// sample at all. app/rank/_components/rank-ui.tsx painted the product topbar a fixed var(--chrome-veil) and
// the public nav a hardcoded rgba(250,248,244,0.82), so on any surface that is not that cream the bar was
// simply a different colour from the page. Two shells with two mechanisms is how they drift, and "the bar
// matches the page" is not a per-shell opinion, so there is now one hook and no per-shell copy.
//
// WHY SAMPLING RATHER THAN A TRANSITION. There is deliberately no easing on the result. A hard cut at a
// section boundary is one frame here because the ground changes in one frame; a slow resolve is slow here
// because the ground is. Matching the source beats animating toward it, and it is the only way the bar is
// never seen catching up — which was the original complaint.
//
// WHY THE SECTION AND NOT THE TOPMOST ELEMENT. elementsFromPoint returns whatever is painted at the sample
// line, which may be a card, a code block or a table row. Reading that would hand the bar a card's colour.
// The walk starts from the nearest ancestor that declares a theme, or failing that the nearest <section>,
// and only then looks for a non-transparent background.

/**
 * Lightness of a computed colour, in whatever notation the browser returns.
 *
 * This must not assume rgb(). A background built with color-mix(in oklab, ...) computes to `oklab(L a b)`,
 * and reading those three numbers as 0-255 channels made pure white (L 0.999) resolve to a luma of 0.0008
 * — so the bar decided it was over something black and painted white text onto a white bar. It failed
 * hardest exactly where the interpolation it exists to follow actually lives.
 *
 * oklab/oklch already carry perceptual lightness as their first component, which is a better answer than
 * anything derivable from channels, so it is used directly. lab/lch are the same on a 0-100 scale.
 */
export function colorLightness(c: string | null | undefined): number | null {
  if (!c) return null;
  const n = c.match(/-?[\d.]+/g)?.map(Number);
  if (!n || n.length < 3) return null;
  if (/^\s*ok(lab|lch)\(/i.test(c)) return n[0];
  if (/^\s*(lab|lch)\(/i.test(c)) return n[0] / 100;
  return (0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2]) / 255;
}

const TRANSPARENT = (c: string) => !c || c === "transparent" || c.startsWith("rgba(0, 0, 0, 0");

/** Nearest ancestor of `from` that actually paints a background. */
function paintedBackground(from: HTMLElement | null): string | null {
  let n: HTMLElement | null = from;
  while (n && n !== document.documentElement) {
    const bg = getComputedStyle(n).backgroundColor;
    if (!TRANSPARENT(bg)) return bg;
    n = n.parentElement;
  }
  return null;
}

export type Ground = {
  /** The painted colour under the bar, or null when nothing could be read. */
  bg: string | null;
  /** True when that colour is dark enough that the bar's own text should be light. */
  dark: boolean;
};

/**
 * Samples the ground beneath `ref` on scroll and resize, rAF-throttled.
 *
 * `atTopFallback` is returned while the page is within `topZone` of the top: every route's first screen is
 * a known quantity, and measuring there is what produced a white bar over a black hero — on arrival the
 * probe runs before the hero has painted, finds no surface, and falls back to light. If the reader never
 * scrolls it stays wrong.
 *
 * `paused` holds the last reading. An open mega panel or drawer covers the sample line, so continuing to
 * measure would read the panel's own colour rather than the page's.
 */
export function useGroundColor(
  ref: RefObject<HTMLElement | null>,
  opts?: { atTopFallback?: boolean; topZone?: number; paused?: boolean },
): Ground {
  const atTopFallback = opts?.atTopFallback ?? false;
  const topZone = opts?.topZone ?? 4;
  const paused = opts?.paused ?? false;

  const [ground, setGround] = useState<Ground>({ bg: null, dark: atTopFallback });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;

    const settle = () => {
      raf = 0;
      if (paused) return;

      if (window.scrollY <= topZone) {
        setGround((g) => (g.bg === null && g.dark === atTopFallback ? g : { bg: null, dark: atTopFallback }));
        return;
      }

      const y = Math.round(el.getBoundingClientRect().bottom) + 1;
      const stack = document.elementsFromPoint(Math.round(window.innerWidth / 2), y) as HTMLElement[];

      // Prefer a declared surface, because a page that labels its own theme has already answered the
      // question. Fall back to the nearest section, which is what an unlabelled band is.
      let from: HTMLElement | null = null;
      for (const node of stack) {
        const declared = node.closest?.("[data-nav-theme], [data-nav-dark]") as HTMLElement | null;
        if (declared) { from = declared; break; }
      }
      if (!from) from = (stack[0]?.closest?.("section") ?? stack[0]) ?? null;

      const bg = paintedBackground(from);
      if (!bg) {
        setGround((g) => (g.bg === null && g.dark === atTopFallback ? g : { bg: null, dark: atTopFallback }));
        return;
      }

      // THE MEASUREMENT OUTRANKS THE LABEL, and it has to. A declaration is fixed for the life of a
      // section; a background is not. Taking the bar's colour from the ground and its text from the label
      // put dark ink on a dark bar through a whole interpolation — measured at 0.04 lightness apart, which
      // is text nobody can read. The label decides only when there is nothing to measure.
      const lum = colorLightness(bg);
      const declared = from?.dataset?.navTheme;
      const dark = lum !== null
        ? lum < 0.5
        : declared ? declared === "dark" : Boolean(from?.hasAttribute("data-nav-dark"));

      setGround((g) => (g.bg === bg && g.dark === dark ? g : { bg, dark }));
    };

    const onScroll = () => { if (!raf) raf = requestAnimationFrame(settle); };

    settle();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref, atTopFallback, topZone, paused]);

  return ground;
}
