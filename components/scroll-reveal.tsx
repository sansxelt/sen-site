"use client";

import { useEffect, useRef, type ReactNode, type ElementType } from "react";

type Props<T extends ElementType = "div"> = {
  as?:        T;
  children:   ReactNode;
  className?: string;
  /** Delay before the reveal animation starts, in ms.  Pair with
   *  incremented values on siblings to create a stagger cascade. */
  delay?:     number;
  /** Percentage of the element that must be visible before reveal
   *  triggers.  0 = first pixel in, 1 = fully visible.  Default 0.15. */
  threshold?: number;
};

/**
 * ScrollReveal, wraps its children in a div that fades + translates
 * up on viewport entry.  One-shot (unobserves after reveal) so scrolling
 * back up doesn't re-hide the content.
 *
 * Pair multiple instances with incrementing `delay` props for a
 * staggered cascade, e.g. grid items that appear 80ms apart.
 *
 * The actual transition is defined in globals.css under
 * [data-hx-reveal] so reduced-motion users get zero animation.
 */
export function ScrollReveal({
  as: Tag = "div",
  children,
  className = "",
  delay = 0,
  threshold = 0.15,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // If IntersectionObserver isn't available or the user has reduced
    // motion on, just show immediately.
    const reducedMotion = typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || typeof IntersectionObserver === "undefined") {
      node.setAttribute("data-hx-reveal", "shown");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            // Delay before flipping to shown.
            window.setTimeout(() => {
              node.setAttribute("data-hx-reveal", "shown");
            }, delay);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold, rootMargin: "0px 0px -40px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [delay, threshold]);

  const Element = Tag as unknown as "div";

  return (
    <Element
      ref={ref}
      data-hx-reveal="hidden"
      className={className}
    >
      {children}
    </Element>
  );
}
