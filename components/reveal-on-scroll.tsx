"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Watches every [data-reveal] in the DOM, adds .is-revealed when it
// scrolls into view. One-shot, the class doesn't get removed when
// the element scrolls back out, so the reveal only plays once.
//
// Resilience pass: any element that's already on-screen at mount
// gets revealed immediately via a synchronous getBoundingClientRect
// check. Then IO handles future scrolls. Without this, race conditions
// between React commit and IO callback could leave above-the-fold
// elements invisible (because [data-reveal] defaults to opacity:0).
export function RevealOnScroll() {
  const pathname = usePathname();

  useEffect(() => {
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-revealed)"),
    );
    if (targets.length === 0) return;

    // Sync pass: anything already in (or above) the viewport gets
    // revealed immediately so we never strand visible content invisible.
    const viewportBottom = window.innerHeight || document.documentElement.clientHeight;
    const stillToObserve: HTMLElement[] = [];
    for (const el of targets) {
      const rect = el.getBoundingClientRect();
      if (rect.top < viewportBottom * 1.1) {
        el.classList.add("is-revealed");
      } else {
        stillToObserve.push(el);
      }
    }

    if (stillToObserve.length === 0 || typeof IntersectionObserver === "undefined") {
      // Nothing left below the fold, or no IO support. Reveal everything.
      stillToObserve.forEach((el) => el.classList.add("is-revealed"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );

    stillToObserve.forEach((el) => io.observe(el));

    return () => io.disconnect();
  }, [pathname]);

  return null;
}
