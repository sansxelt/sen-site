"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import { PUBLIC_SITE_PATHS } from "@/lib/public-site";
import "lenis/dist/lenis.css";

/** Wheel easing for reading pages; scroll-driven home chapters and account forms use native scrolling. */
export function SmoothScroll() {
  const pathname = usePathname();
  useEffect(() => {
    // The homepage already derives its animation from scroll position. A second
    // easing loop keeps an old wheel target alive after a reversal or Home key.
    if (PUBLIC_SITE_PATHS.some(path => path === pathname) || pathname.startsWith("/dev-preview/v7") || pathname === "/" || pathname === "/dev-preview/v6" || pathname === "/signin" || pathname.startsWith("/auth/")) return;
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
