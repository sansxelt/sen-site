"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

/** Shared wheel easing for the public site and app; nested panels retain their own scroll. */
export function SmoothScroll() {
  const pathname = usePathname();
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = matchMedia("(hover: hover) and (pointer: fine)");
    let smooth: Lenis | undefined;
    const sync = () => {
      smooth?.destroy(); smooth = undefined;
      if (!reduced.matches && pointer.matches) smooth = new Lenis({
        autoRaf: true, lerp: .085, smoothWheel: true, syncTouch: false,
        anchors: true, allowNestedScroll: true,
        prevent: node => Boolean(node.closest('.v6-mission-demo__screen.is-exploring, [role="dialog"], [role="menu"], textarea, [contenteditable="true"]')),
      });
    };
    sync(); reduced.addEventListener("change", sync); pointer.addEventListener("change", sync);
    return () => { smooth?.destroy(); reduced.removeEventListener("change", sync); pointer.removeEventListener("change", sync); };
  }, [pathname]);
  return null;
}
