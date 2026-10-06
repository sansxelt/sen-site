"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

/** Shared wheel easing; account forms use native scrolling as their content changes. */
export function SmoothScroll() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === "/signin" || pathname.startsWith("/auth/")) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = matchMedia("(hover: hover) and (pointer: fine)");
    let smooth: Lenis | undefined;
    const fullscreen = () => {
      if (document.fullscreenElement) smooth?.stop();
      else smooth?.start();
    };
    const sync = () => {
      smooth?.destroy(); smooth = undefined;
      if (!reduced.matches && pointer.matches) smooth = new Lenis({
        autoRaf: true, lerp: .085, smoothWheel: true, syncTouch: false,
        anchors: true, allowNestedScroll: true,
        prevent: node => Boolean(node.closest('.v6-mission-demo__screen.is-exploring, [role="dialog"], [role="menu"], textarea, [contenteditable="true"]')),
      });
      fullscreen();
    };
    document.addEventListener("fullscreenchange", fullscreen);
    sync(); reduced.addEventListener("change", sync); pointer.addEventListener("change", sync);
    return () => { document.removeEventListener("fullscreenchange", fullscreen); smooth?.destroy(); reduced.removeEventListener("change", sync); pointer.removeEventListener("change", sync); };
  }, [pathname]);
  return null;
}
