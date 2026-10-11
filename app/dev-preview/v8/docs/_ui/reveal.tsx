"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";
import { DOCS_LAYERS, DOCS_READY_ATTR } from "../_data/reveal";

// The docs' layered entrance (see _data/reveal.ts): on every docs page, the layers already on screen rise in
// order, 70ms apart (capped at eight steps), and lower ones rise as they scroll into view. Once a layer has landed
// its classes come off, so nothing is left holding a transform.

const STEP = 70, MAX = 8;

export function DocsReveal() {
  const pathname = usePathname();
  useLayoutEffect(() => {
    const root = document.querySelector(".v8-docs");
    const ready = () => root?.setAttribute(DOCS_READY_ATTR, "");
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { ready(); return; }
    const els = Array.from(document.querySelectorAll<HTMLElement>(DOCS_LAYERS)).filter((el) => el.getClientRects().length > 0);
    for (const el of els) el.classList.add("v8-drv");
    ready();
    const timers: ReturnType<typeof setTimeout>[] = [];
    const show = (el: HTMLElement, i: number) => {
      const d = Math.min(i, MAX) * STEP;
      el.style.setProperty("--drv-d", `${d}ms`);
      el.classList.add("v8-drv--in");
      timers.push(setTimeout(() => { el.classList.remove("v8-drv", "v8-drv--in"); el.style.removeProperty("--drv-d"); }, d + 900));
    };
    let io: IntersectionObserver | undefined;
    const raf = requestAnimationFrame(() => {
      const vh = window.innerHeight;
      const below: HTMLElement[] = [];
      let n = 0;
      for (const el of els) {
        if (el.getBoundingClientRect().top < vh * 0.92) show(el, n++); else below.push(el);
      }
      if (!below.length) return;
      io = new IntersectionObserver((entries) => {
        let k = 0;
        for (const e of entries) if (e.isIntersecting) { show(e.target as HTMLElement, k++); io?.unobserve(e.target); }
      }, { rootMargin: "0px 0px -6% 0px" });
      below.forEach((el) => io!.observe(el));
    });
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
      timers.forEach(clearTimeout);
      for (const el of els) { el.classList.remove("v8-drv", "v8-drv--in"); el.style.removeProperty("--drv-d"); }
    };
  }, [pathname]);
  return null;
}
