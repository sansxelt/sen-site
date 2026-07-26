"use client";

// THE SPECTRAL REVEAL. A major statement enters through one pass of moving light and resolves into the
// system's own monochrome, adapted from the Scale reference as a mechanic, not as branding.
//
// THE STATEMENT EXISTS EXACTLY ONCE, IN EVERY SENSE.
//
// Two earlier versions both failed this. The first rendered the sentence as two real text nodes, so it
// was announced twice, extracted twice and copied twice. The second moved the coloured layer into a
// ::after on the element itself, which fixed innerText and copy but NOT the accessibility tree: pseudo
// content on a visible element still contributes to the computed accessible name, so the heading's name
// was the sentence twice over. That was verified with Accessibility.getFullAXTree, and the source comment
// claiming otherwise was wrong.
//
// The structure below satisfies all five requirements at once:
//
//   <tag class="v6-spec">
//     <span class="v6-spec__t">Sentence</span>                      real text: the ONLY copy
//     <span class="v6-spec__fx" aria-hidden data-text="Sentence" />  EMPTY element, ::after paints it
//   </tag>
//
//   accessible name  the decorative span is aria-hidden, and aria-hidden excludes the whole subtree
//                    INCLUDING its pseudo-element content, so only the real span contributes
//   innerText        the decorative span has no child nodes; generated content is never in innerText
//   copy / select    user-select:none, and generated content is not selectable anyway
//   screen readers   one announcement, from the real span
//   axe              nothing duplicated to flag
//
// Everything visual derives in pure CSS from one local variable, --sv (0..1), which the call site maps
// from its chapter's continuously rendered scroll progress. Nothing here is a fixed-duration animation:
// fast scrolling resolves to the correct point immediately, reverse scrolling brings the pass back in
// reverse, and a direction change never restarts it, because --sv is a pure function of scroll.
//
// Local schedule, in --sv:
//   0.00-0.15  dim, slightly low, slightly blurred, no meaningful colour
//   0.15-0.42  the pass arrives: opacity and position resolve, colour travels in
//   0.42-0.68  fully readable; the pass continues across the remaining letters and starts to desaturate
//   0.68-0.82  the colour leaves entirely; transform and blur reach zero
//   0.82-1.00  stable monochrome, nothing left moving
//
// Used on 2 to 3 major statements per page, never on navigation, body copy, labels or buttons.
// Reduced motion renders the final solid text immediately and drops the decorative layer (see v6.css).
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
  /** Plain string, not children: the decorative layer is generated from it, so it must be one string. */
  text: string;
}) {
  return createElement(
    as,
    { className: `v6-spec ${className}`, style: { "--sv": sv } as CSSProperties },
    createElement("span", { className: "v6-spec__t", key: "t" }, text),
    createElement("span", {
      className: "v6-spec__fx",
      key: "fx",
      "aria-hidden": true,
      "data-text": text,
    }),
  );
}
