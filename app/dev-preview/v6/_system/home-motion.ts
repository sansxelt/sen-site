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
    let disposed = false;
    const pending: (() => void)[] = [];
    const mobile = matchMedia("(max-width:900px)");
    const arrive = (part: HTMLElement) => {
      const media = part.closest<HTMLElement>("[data-media-ready]");
      if (mobile.matches && media?.dataset.mediaReady === "pending") {
        const ready = () => {
          if (disposed || media.dataset.mediaReady !== "ready") return;
          part.classList.add("home-arrived");
          media.removeEventListener("vraelis:media-ready", ready);
        };
        media.addEventListener("vraelis:media-ready", ready);
        pending.push(() => media.removeEventListener("vraelis:media-ready", ready));
      } else part.classList.add("home-arrived");
    };
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        arrive(entry.target as HTMLElement);
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
      disposed = true;
      pending.forEach(cleanup => cleanup());
      observer.disconnect();
      parts.forEach(part => { part.classList.remove("home-arrival", "home-arrived"); part.style.removeProperty('--arrival-delay'); });
    };
  }, [root]);
}
