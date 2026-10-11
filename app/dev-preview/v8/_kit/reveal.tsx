"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";
import { REVEAL_STYLE_ID } from "./scripts";

// LAYERED ENTRANCES (founder, 2026-10-10: every page's content comes in "layered up to down", as on x.ai).
//
// On every page, each section's blocks rise in, in reading order: the eyebrow, then the heading, the lead, the
// actions, then each card of a grid one after another. Blocks already on screen go on load with a short stagger;
// lower ones go as they scroll into view. The blocks are found, not hand-tagged: inside each section, a grid or flex
// container, or a plain wrapper of blocks, is opened up and its children become the layers, down to four levels.
// Elements that already have their own entrance (.v8-fade, the homepage hero and bento, the pinned chapters) are
// left alone. REVEAL_SCRIPT hides the sections before first paint so nothing shows and then vanishes; this removes
// that once the layers are marked, and a timer in the script removes it anyway if this never runs.

const SKIP = ".v8-hero, .v8-fade, .v8-bento, .v8-chapters, [data-no-reveal]";
const LEAF = "figure, img, video, picture, pre, table, canvas, svg, form, details, .v8-tabs, .v8-chapters, .v8-code, .v8-codeframe";
const STEP = 70, MAX = 8;

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
    for (const el of els) el.classList.add("v8-rv");
    pending();
    const vh = window.innerHeight;
    let n = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Once a layer has landed, its classes come off so its own hover transitions and transforms apply again.
    const show = (el: Element, i: number) => {
      const d = Math.min(i, MAX) * STEP;
      (el as HTMLElement).style.setProperty("--rv-d", `${d}ms`);
      el.classList.add("v8-rv--in");
      timers.push(setTimeout(() => { el.classList.remove("v8-rv", "v8-rv--in"); (el as HTMLElement).style.removeProperty("--rv-d"); }, d + 900));
    };
    const below: Element[] = [];
    let io: IntersectionObserver | undefined;
    requestAnimationFrame(() => {
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.top < vh * .92) show(el, n++); else below.push(el);
      }
      if (!below.length) return;
      io = new IntersectionObserver((entries) => {
        let k = 0;
        for (const e of entries) if (e.isIntersecting) { show(e.target, k++); io?.unobserve(e.target); }
      }, { rootMargin: "0px 0px -8% 0px" });
      below.forEach((el) => io!.observe(el));
    });
    return () => {
      io?.disconnect();
      timers.forEach(clearTimeout);
      for (const el of els) { el.classList.remove("v8-rv", "v8-rv--in"); (el as HTMLElement).style.removeProperty("--rv-d"); }
    };
  }, [pathname]);
  return null;
}
