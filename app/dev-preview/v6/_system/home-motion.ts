"use client";

import { useEffect, type RefObject } from "react";

/** Let each section arrive in order; keep the opening's existing scroll sequence. */
export function useHomeMotion(root: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const parts = Array.from(el.querySelectorAll<HTMLElement>(
      ".home-engineering .home-section-head, .home-resource"
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
      observer.disconnect();
      parts.forEach(part => { part.classList.remove("home-arrival", "home-arrived"); part.style.removeProperty('--arrival-delay'); });
    };
  }, [root]);
}
