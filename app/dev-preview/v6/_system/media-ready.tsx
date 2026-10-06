"use client";

import { useLayoutEffect, type RefObject } from "react";
import "./media-ready.css";

/** Reveal paired mobile copy after the selected image has decoded, or on load failure. */
export function useMediaReady(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const owner = el.closest<HTMLElement>("[data-media-ready]");
    const groups = new Set<HTMLElement>([
      ...(owner ? [owner] : []),
      ...el.querySelectorAll<HTMLElement>("[data-media-ready]"),
    ]);
    const mobile = matchMedia("(max-width:900px)");
    let disposed = false;
    const cleanups: (() => void)[] = [];
    const nearby = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        // Start nearby lazy images before their captions reach the viewport.
        entry.target.querySelector<HTMLImageElement>("img")?.setAttribute("loading", "eager");
        nearby.unobserve(entry.target);
      }
    }, { rootMargin:"600px 0px" });

    for (const group of groups) {
      const img = group.querySelector<HTMLImageElement>("img");
      const video = group.querySelector<HTMLVideoElement>("video");
      const reveal = () => {
        if (disposed || group.dataset.mediaReady === "ready") return;
        group.dataset.mediaReady = "ready";
        group.dispatchEvent(new CustomEvent("vraelis:media-ready", { bubbles:true }));
      };
      const decoded = () => {
        if (img?.naturalWidth) void img.decode().then(reveal, reveal);
        else reveal(); // Failed media must never block the page's text or controls.
      };
      if (img) {
        img.addEventListener("load", decoded);
        img.addEventListener("error", reveal);
        cleanups.push(() => { img.removeEventListener("load", decoded); img.removeEventListener("error", reveal); });
        if (img.complete) decoded();
        else if (mobile.matches) nearby.observe(group);
      } else if (!video) reveal();
      // The homepage film can paint before its fallback poster finishes downloading.
      if (video) {
        video.addEventListener("loadeddata", reveal);
        cleanups.push(() => video.removeEventListener("loadeddata", reveal));
        if (video.readyState >= 2) reveal();
      }
    }
    return () => { disposed = true; nearby.disconnect(); cleanups.forEach(cleanup => cleanup()); };
  }, [ref]);
}

export function MediaReadyFallback() {
  return <noscript><style>{`[data-media-ready="pending"] [data-media-copy] { visibility:visible!important; } [data-media-ready="pending"] [data-media-copy] * { animation-play-state:running!important; }`}</style></noscript>;
}
