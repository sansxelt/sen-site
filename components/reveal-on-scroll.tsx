"use client";

import { useEffect } from "react";

// Watches every [data-reveal] in the DOM, adds .is-revealed when it
// scrolls into view. One-shot — the class doesn't get removed when
// the element scrolls back out, so the reveal only plays once.
export function RevealOnScroll() {
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll("[data-reveal]"));
    if (targets.length === 0 || typeof IntersectionObserver === "undefined") {
      // No JS support → make everything visible immediately
      targets.forEach((el) => el.classList.add("is-revealed"));
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

    targets.forEach((el) => io.observe(el));

    return () => io.disconnect();
  }, []);

  return null;
}
