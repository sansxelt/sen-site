"use client";

import { useEffect, type RefObject } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

/** Let each section arrive in order; keep the opening's existing scroll sequence. */
export function useHomeMotion(root: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = matchMedia("(hover: hover) and (pointer: fine)");
    let smooth: Lenis | undefined;
    const sync = () => {
      smooth?.destroy();
      smooth = undefined;
      if (!reduced.matches && pointer.matches) smooth = new Lenis({
        autoRaf: true, lerp: .085, smoothWheel: true, syncTouch: false, anchors: true,
        prevent: node => Boolean(node.closest('.v6-mission-demo__screen.is-exploring, [role="dialog"], [role="menu"]')),
      });
    };
    sync();
    reduced.addEventListener("change", sync);
    pointer.addEventListener("change", sync);
    const parts = Array.from(el.querySelectorAll<HTMLElement>(
      ".home-areas .home-section-head, .home-area, .v6-story__heading, .v6-mission-demo, .v6-or__copy, .home-engineering .home-section-head, .home-resource"
    ));
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.add("home-arrived");
        observer.unobserve(entry.target);
      }
    }, { threshold: 0, rootMargin: "0px 0px -8% 0px" });
    parts.forEach(part => {
      const siblings = part.matches('.home-area') ? [...el.querySelectorAll('.home-area')] : part.matches('.home-resource') ? [...el.querySelectorAll('.home-resource')] : [];
      part.style.setProperty('--arrival-delay', `${Math.max(0, siblings.indexOf(part)) * 90 + 60}ms`);
      part.classList.add("home-arrival");
      observer.observe(part);
    });
    return () => {
      smooth?.destroy(); observer.disconnect();
      reduced.removeEventListener("change", sync);
      pointer.removeEventListener("change", sync);
      parts.forEach(part => { part.classList.remove("home-arrival", "home-arrived"); part.style.removeProperty('--arrival-delay'); });
    };
  }, [root]);
}
