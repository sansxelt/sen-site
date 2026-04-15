"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

const FADE_MS = 200;

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const navigatingRef = useRef(false);

  // Scroll to top on every mount (new page)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);

  // Intercept internal link clicks: fade out current page, then navigate
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;

      const href = anchor.getAttribute("href");
      if (!href) return;
      if (href === pathname) return;
      if (href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:")) return;
      if (navigatingRef.current) return;

      // Prevent Next.js Link from navigating (it checks e.defaultPrevented)
      e.preventDefault();
      navigatingRef.current = true;

      // Fade out
      const el = containerRef.current;
      if (el) {
        el.style.transition = `opacity ${FADE_MS}ms ease`;
        el.style.opacity = "0";
      }

      // Navigate after fade completes
      setTimeout(() => {
        router.push(href);
        navigatingRef.current = false;
      }, FADE_MS);
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname, router]);

  return (
    <>
      <style>{`@keyframes ptIn{from{opacity:0}to{opacity:1}}`}</style>
      <div
        ref={containerRef}
        style={{ animation: `ptIn ${FADE_MS}ms ease both` }}
      >
        {children}
      </div>
    </>
  );
}
