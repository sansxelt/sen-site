"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

/** The running instance, for code that scrolls the page itself (v8's logo glides to the top through it: the
 *  browser's own smooth scroll is overridden by Lenis and would jump). */
let current: Lenis | undefined;
export const smoothScroller = () => current;

// With v8 public (NEXT_PUBLIC_VRAELIS_V8_PUBLIC=1), "/" is v8's homepage (and the docs home on docs.vraelis.com),
// which has no scroll-driven chapters, so it gets the easing like every other reading page (founder, 2026-10-13:
// "where did my smooth scrolling go": the "/" skip below was written for the v6 homepage and silently covered v8's).
const v8Public = process.env.NEXT_PUBLIC_VRAELIS_V8_PUBLIC === "1";

/** Wheel easing for reading pages; the v6 homepage's scroll-driven chapters and account forms use native scrolling. */
export function SmoothScroll() {
  const pathname = usePathname();
  useEffect(() => {
    // The homepage already derives its animation from scroll position. A second
    // easing loop keeps an old wheel target alive after a reversal or Home key.
    if ((pathname === "/" && !v8Public) || pathname === "/dev-preview/v6" || pathname === "/signin" || pathname.startsWith("/auth/")) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = matchMedia("(hover: hover) and (pointer: fine)");
    let smooth: Lenis | undefined;
    const fullscreen = () => {
      if (document.fullscreenElement) smooth?.stop();
      else smooth?.start();
    };
    const sync = () => {
      smooth?.destroy(); smooth = undefined; current = undefined;
      if (!reduced.matches && pointer.matches) smooth = new Lenis({
        autoRaf: true, lerp: .085, smoothWheel: true, syncTouch: false,
        anchors: true, allowNestedScroll: true,
        prevent: node => Boolean(node.closest('.v6-mission-demo__screen.is-exploring, [role="dialog"], [role="menu"], textarea, [contenteditable="true"]')),
      });
      current = smooth;
      fullscreen();
    };
    document.addEventListener("fullscreenchange", fullscreen);
    sync(); reduced.addEventListener("change", sync); pointer.addEventListener("change", sync);
    return () => { document.removeEventListener("fullscreenchange", fullscreen); smooth?.destroy(); current = undefined; reduced.removeEventListener("change", sync); pointer.removeEventListener("change", sync); };
  }, [pathname]);
  return null;
}
