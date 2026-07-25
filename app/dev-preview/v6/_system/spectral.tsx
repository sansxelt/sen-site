"use client";

// THE SPECTRAL REVEAL. A major statement enters through one pass of moving light and resolves into the
// system's own monochrome, adapted from the Scale reference as a mechanic, not as branding.
//
// Two layers occupy identical geometry:
//   base   the final solid text (white on dark, near-black on light). This is the real, readable text and
//          the only thing assistive tech sees.
//   light  the same text with a restrained spectral gradient clipped to the letterforms, revealed by a
//          travelling background-position so the coloured region MOVES THROUGH the sentence rather than
//          tinting the whole line, then leaves completely.
//
// Everything derives in pure CSS from one local variable, --sv (0..1), which the call site maps from its
// chapter's continuously rendered scroll progress. Nothing here is a fixed-duration animation: fast
// scrolling resolves to the correct point immediately, reverse scrolling brings the pass back in reverse,
// and a direction change never restarts the reveal, because --sv is a pure function of scroll.
//
// Local schedule, in --sv:
//   0.00-0.15  dim, slightly low, slightly blurred, no meaningful colour
//   0.15-0.42  the pass arrives: opacity and position resolve, colour travels in
//   0.42-0.68  fully readable; the pass continues across the remaining letters and starts to desaturate
//   0.68-0.82  the colour leaves entirely; transform and blur reach zero
//   0.82-1.00  stable monochrome, nothing left moving
//
// It appears on 2-3 major statements on the whole page, never on navigation, body copy, labels or buttons.
// Reduced motion renders the final solid text immediately (see v6.css).
import { createElement, type CSSProperties, type ReactNode } from "react";

export function Spectral({
  as = "span",
  className = "",
  sv,
  children,
}: {
  as?: string;
  className?: string;
  /** CSS expression for the local reveal progress, e.g. "clamp(0, calc((var(--p) - 0.62) / 0.26), 1)" */
  sv: string;
  children: ReactNode;
}) {
  return createElement(
    as,
    { className: `v6-spec ${className}`, style: { "--sv": sv } as CSSProperties },
    <span className="v6-spec__base">{children}</span>,
    <span className="v6-spec__light" aria-hidden>{children}</span>,
  );
}
