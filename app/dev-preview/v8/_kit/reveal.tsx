"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";
import { REVEAL_STYLE_ID } from "./scripts";
import { revealInOrder } from "./reveal-order";

// One top-to-bottom entrance sequence for visible content on every route.
// Hero, fades and cards share the scheduler; pinned chapters retain their scroll-linked motion.
// Docs use the same scheduler with their explicit content layers.

const SKIP = ".v8-chapters, [data-no-reveal]";
const LEAF = "figure, img, video, picture, pre, table, canvas, svg, form, details, .v8-tabs, .v8-chapters, .v8-code, .v8-codeframe, .v8-tile, .v8-fade";

function layers(root: Element, depth: number, out: Element[]) {
  for (const child of Array.from(root.children)) {
    if (!(child instanceof HTMLElement) || child.matches(SKIP) || child.closest(SKIP)) continue;
    const cs = getComputedStyle(child);
    if (cs.display === "none" || cs.position === "absolute" || cs.position === "fixed") continue;
    // Open wrappers that hold blocks rather than words: grids and flex rows of two or more, and plain wrappers
    // (div, article, header, aside, lists) whose own text is only whitespace.
    const wrapper = /^(DIV|ARTICLE|HEADER|ASIDE|NAV|UL|OL|DL)$/.test(child.tagName)
      && Array.from(child.childNodes).every((n) => n.nodeType !== 3 || !n.textContent?.trim());
    const open = depth < 4 && !child.matches(LEAF) && child.children.length >= 1
      && ((/grid|flex/.test(cs.display) && child.children.length >= 2) || wrapper);
    if (open) layers(child, depth + 1, out);
    else out.push(child);
  }
}

export function RevealOnRoute() {
  const pathname = usePathname();
  useLayoutEffect(() => {
    const main = document.getElementById("v8-main");
    const pending = () => document.getElementById(REVEAL_STYLE_ID)?.remove();
    // The docs have their own layered entrance (docs/_ui), so this one steps aside there.
    const docs = /\/docs(\/|$)/.test(pathname);
    if (!main || docs || matchMedia("(prefers-reduced-motion: reduce)").matches) { pending(); return; }
    // The roots are the page's sections; on pages built without sections (contact, the legal pages) they are the
    // top-level blocks of main.
    const els: Element[] = [];
    const roots = (el: Element): Element[] => Array.from(el.children).flatMap((c) =>
      c.tagName === "SECTION" ? [c] : c.querySelector("section") ? roots(c) : [c]);
    for (const root of roots(main)) {
      if (root.matches(SKIP)) continue;
      if (root.tagName === "SECTION" || /grid|flex/.test(getComputedStyle(root).display)) layers(root, 0, els);
      else if (root instanceof HTMLElement && root.children.length) layers(root, 0, els);
    }
    // One owner for entrances, including the hero and bento. Keep independent product/keyword motion intact.
    for (const el of els) el.setAttribute("data-v8-entrance", "");
    const cleanup = revealInOrder(els as HTMLElement[], "v8-rv", "--rv-d");
    pending();
    return () => {
      cleanup();
      for (const el of els) el.removeAttribute("data-v8-entrance");
    };
  }, [pathname]);
  return null;
}

