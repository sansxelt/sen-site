"use client";

// THE SPECTRAL REVEAL. A major statement enters through one pass of moving light and resolves into the
// system's own monochrome, adapted from the Scale reference as a mechanic, not as branding.
//
// ONE TEXT NODE ONLY. The first version rendered the sentence twice, once for the base and once for the
// coloured layer. Both entered the accessibility tree, so screen readers announced the statement twice,
// document.body.innerText contained it twice, and page-text extraction (YC's included) saw a duplicate.
// The coloured layer is now a ::after pseudo-element fed by data-text, which cannot be selected, copied,
// announced, or extracted. The heading keeps exactly one semantic node and one real string.
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
import { createElement, type CSSProperties } from "react";

export function Spectral({
  as = "span",
  className = "",
  sv,
  text,
}: {
  as?: string;
  className?: string;
  /** CSS expression for the local reveal progress, e.g. "clamp(0, calc((var(--p) - 0.62) / 0.26), 1)" */
  sv: string;
  /** Plain string, not children: the decorative layer is generated from it, so it must be one text node. */
  text: string;
}) {
  return createElement(
    as,
    {
      className: `v6-spec ${className}`,
      style: { "--sv": sv } as CSSProperties,
      // read by the ::after pseudo-element; never announced, never selectable, never extracted
      "data-text": text,
    },
    text,
  );
}
