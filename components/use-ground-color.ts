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
// That last sentence was untrue for a while, and the drift it predicts is exactly what happened: the v6
// shell kept its own copy of the walk, this one gained rAF throttling and that one did not, and every fix
// had to be made twice or it was not made at all. app/dev-preview/v6/_system/shell.tsx calls the hook now.
// Nothing samples the ground anywhere else. If a third surface needs it, it calls this.
//
// WHY SAMPLING RATHER THAN A TRANSITION. There is deliberately no easing on the result. A hard cut at a
// section boundary is one frame here because the ground changes in one frame; a slow resolve is slow here
// because the ground is. Matching the source beats animating toward it, and it is the only way the bar is
// never seen catching up — which was the original complaint.
//
// WHY THE SECTION AND NOT THE TOPMOST ELEMENT. elementsFromPoint returns whatever is painted at the sample
// line, which may be a card, a code block or a table row. Reading that would hand the bar a card's colour.
// The walk starts from the nearest ancestor that declares a theme AND is band-level (see BAND below), or
// failing that the nearest <section>, and only then looks for a non-transparent background.

/**
 * Lightness of a computed colour, in whatever notation the browser returns.
 *
 * This must not assume rgb(). A background built with color-mix(in oklab, ...) computes to `oklab(L a b)`,
 * and reading those three numbers as 0-255 channels made pure white (L 0.999) resolve to a luma of 0.0008,
 * so the bar decided it was over something black and painted white text onto a white bar. It failed
 * hardest exactly where the interpolation it exists to follow actually lives.
 *
 * oklab/oklch already carry perceptual lightness as their first component, which is a better answer than
 * anything derivable from channels, so it is used directly. lab/lch are the same on a 0-100 scale.
 *
 * color() is the same failure in a third notation. It names its colour space before the channels and that
 * name can end in a digit, so `color(display-p3 0.9 0.1 0.1)` read as the channels [3, 0.9, 0.1] and came
 * back at a lightness of 0.0031. The space is stripped before the numbers are taken, and its channels run
 * 0-1 rather than 0-255 so they are not divided.
 */
export function colorLightness(c: string | null | undefined): number | null {
  if (!c) return null;
  const channels = (s: string): number[] | null => {
    const n = s.match(/-?[\d.]+/g)?.map(Number);
    return n && n.length >= 3 ? n : null;
  };
  const rgbLuma = (n: number[], scale: number) =>
    (0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2]) / scale;

  if (/^\s*ok(lab|lch)\(/i.test(c)) { const n = channels(c); return n ? n[0] : null; }
  if (/^\s*(lab|lch)\(/i.test(c)) { const n = channels(c); return n ? n[0] / 100 : null; }
  const spaced = c.match(/^\s*color\(\s*[\w-]+\s+([^)]*)\)/i);
  if (spaced) { const n = channels(spaced[1]); return n ? rgbLuma(n, 1) : null; }
  const n = channels(c);
  return n ? rgbLuma(n, 255) : null;
}

/**
 * Alpha of a computed colour. 1 when the notation carries none.
 *
 * Both forms getComputedStyle can return are covered: the legacy comma form rgba(r, g, b, a), and the slash
 * form every other colour space uses, oklab(L a b / a) and color(display-p3 r g b / a).
 */
function alphaOf(c: string): number {
  const slash = c.match(/\/\s*([\d.]+)(%?)\s*\)\s*$/);
  if (slash) { const a = Number(slash[1]); return Number.isFinite(a) ? (slash[2] ? a / 100 : a) : 1; }
  const legacy = c.match(/^\s*rgba\(([^)]*)\)/i);
  if (legacy) {
    const parts = legacy[1].split(",");
    if (parts.length >= 4) {
      const raw = parts[3].trim();
      const a = parseFloat(raw);
      return Number.isFinite(a) ? (raw.endsWith("%") ? a / 100 : a) : 1;
    }
  }
  return 1;
}

/**
 * True when a colour hides whatever is behind it.
 *
 * Exported because a bar only earns the right to switch its backdrop blur off when the colour it is
 * painting is solid, and keying that off "a colour was sampled" is what put a 94% see-through bar with no
 * blur on the console. The two facts are the same today, since the walk below refuses a see-through
 * reading, and they should stay independently checked so they cannot come apart again.
 */
export function isOpaqueColor(c: string | null | undefined): boolean {
  return !!c && c !== "transparent" && alphaOf(c) >= 1;
}

// A COLOUR YOU CAN SEE THROUGH IS NOT THE GROUND, so the walk continues past it to the first fully opaque
// ancestor. This used to reject only the literal `rgba(0, 0, 0, 0...`, which meant a 6% accent wash was
// handed back as the answer: the bar then painted itself 94% see-through and turned its blur off.
const TRANSPARENT = (c: string) => !isOpaqueColor(c);

/** Nearest ancestor of `from` that actually paints an opaque background. */
function paintedBackground(from: HTMLElement | null): string | null {
  let n: HTMLElement | null = from;
  while (n && n !== document.documentElement) {
    const bg = getComputedStyle(n).backgroundColor;
    if (!TRANSPARENT(bg)) return bg;
    n = n.parentElement;
  }
  return null;
}

// A DECLARATION ONLY SPEAKS FOR THE GROUND WHEN IT IS ON THE BAND, because closest() matches ancestor OR
// SELF and two inline CARDS declare data-nav-dark: the graphite panel on /platform and the quoted-claim
// card on /agents. Both are rendered full width inside a paper section, and below about 760px the flex row
// they sit in collapses, so innerWidth/2 lands on the card and the bar flipped near-black over a white
// page. Neither attribute can be removed, because v6.css keys its on-dark TEXT treatments to it, so the
// reader is what narrows.
//
// Band-level means a <section>, the site footer, the console's <main>, or an element that opts in with
// data-nav-band. The opt-in exists for the one surface that is genuinely a band without being any of those
// tags: the docs environment, which is a div wrapping a whole route.
const BAND = "section[data-nav-theme], section[data-nav-dark], footer[data-nav-theme], footer[data-nav-dark], "
  + "main[data-nav-theme], main[data-nav-dark], [data-nav-band]";

export type Ground = {
  /** The painted colour under the bar, always fully opaque, or null when nothing could be read. */
  bg: string | null;
  /** True when that colour is dark enough that the bar's own text should be light. */
  dark: boolean;
  /**
   * The `resetKey` this reading was taken under, empty when the caller passes none.
   *
   * A reading can only arrive after the commit that changed the page, so on a route change the value in
   * hand for one commit is the PREVIOUS route's. Comparing this against the current key is how a caller
   * tells the two apart and falls back to what it already knows, rather than painting the old route's
   * colour onto the new one.
   */
  resetKey: string | number;
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
 * measure would read the panel's own colour rather than the page's. Unpausing re-samples, because the page
 * underneath may have moved or resized while it was covered.
 *
 * `resetKey` re-enters the effect and takes a fresh reading immediately. A client-side route change swaps
 * the entire DOM under a bar that is not scrolling and may not resize either, so without it the last
 * reading of the PREVIOUS route stands until something happens to scroll. The v6 shell passes the pathname.
 * It comes back on the reading (`Ground.resetKey`) so the caller can also tell which route it was taken on.
 */
export function useGroundColor(
  ref: RefObject<HTMLElement | null>,
  opts?: { atTopFallback?: boolean; topZone?: number; paused?: boolean; resetKey?: string | number },
): Ground {
  const atTopFallback = opts?.atTopFallback ?? false;
  const topZone = opts?.topZone ?? 4;
  const paused = opts?.paused ?? false;
  const resetKey = opts?.resetKey ?? "";

  const [ground, setGround] = useState<Ground>({ bg: null, dark: atTopFallback, resetKey });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;

    // The key is part of the reading, so a reading that only stamps the new key still has to replace the
    // one in state. Comparing all three is what keeps an unchanged ground from re-rendering on every frame.
    const commit = (bg: string | null, dark: boolean) => setGround((g) =>
      g.bg === bg && g.dark === dark && g.resetKey === resetKey ? g : { bg, dark, resetKey });

    // Returns the colour it read, so step() below can tell whether the ground has stopped moving.
    const settle = (): string | null => {
      if (window.scrollY <= topZone) {
        commit(null, atTopFallback);
        return null;
      }

      const y = Math.round(el.getBoundingClientRect().bottom) + 1;
      const stack = document.elementsFromPoint(Math.round(window.innerWidth / 2), y) as HTMLElement[];

      // Prefer a declared surface, because a page that labels its own theme has already answered the
      // question. Fall back to the nearest section, which is what an unlabelled band is.
      let from: HTMLElement | null = null;
      for (const node of stack) {
        const declared = node.closest?.(BAND) as HTMLElement | null;
        if (declared) { from = declared; break; }
      }
      if (!from) from = (stack[0]?.closest?.("section") ?? stack[0]) ?? null;

      const bg = paintedBackground(from);
      if (!bg) {
        commit(null, atTopFallback);
        return null;
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

      commit(bg, dark);
      return bg;
    };

    // THE GROUND KEEPS MOVING AFTER THE LAST SCROLL EVENT, AND THIS USED TO STOP LISTENING BEFORE IT DID.
    //
    // Sampling on scroll alone is right for a page whose sections are flat colours: the ground under the bar
    // changes only because the bar is over something else, and that only happens while scrolling. This page
    // is not that page. Chapter 3 resolves its ground from paper to graphite off --settle, which derives
    // from --p, which progress.ts eases toward its target on its OWN rAF loop with a 55ms time constant. So
    // --p goes on changing for roughly a quarter of a second after the reader's hand stops, and every one of
    // those frames repaints the ground -- with no scroll event to sample any of them.
    //
    // The bar was therefore left holding whichever colour the ground happened to be at the instant the last
    // scroll event fired, which is the value from BEFORE the transition finished. Measured at the end of
    // chapter 3: the ground had reached oklab lightness 0.145 and the bar was still painting 0.574, a hard
    // horizontal edge across the top of the page between a mid-grey bar and a near-black chapter. Stopping
    // anywhere mid-resolve reproduced it, and it never corrected itself, because nothing was scrolling.
    //
    // So the sampler now chases: after each scroll it keeps reading until the reading stops changing.
    // CHASE_STABLE frames of an identical colour is "the ground has settled" -- comfortably longer than the
    // easing tail at 60fps, and it costs nothing when there is nothing to chase, because a flat ground is
    // already stable on the second frame. CHASE_MAX is a hard cap so a ground that animates forever cannot
    // pin an rAF loop open; it bounds the chase at about a second and a half rather than trusting the page.
    // commit() already de-dupes, so the extra frames re-render nothing while the colour is unchanged.
    const CHASE_STABLE = 8;
    const CHASE_MAX = 90;
    let stableFor = 0;
    let chased = 0;
    let lastRead: string | null | undefined;

    const step = () => {
      raf = 0;
      if (paused) return;
      const bg = settle();
      if (bg === lastRead) stableFor += 1;
      else { stableFor = 0; lastRead = bg; }
      chased += 1;
      if (stableFor < CHASE_STABLE && chased < CHASE_MAX) raf = requestAnimationFrame(step);
    };

    const onScroll = () => {
      // A new gesture restarts the chase: whatever it had decided was settled is now stale again.
      stableFor = 0;
      chased = 0;
      if (!raf) raf = requestAnimationFrame(step);
    };

    settle();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref, atTopFallback, topZone, paused, resetKey]);

  return ground;
}
