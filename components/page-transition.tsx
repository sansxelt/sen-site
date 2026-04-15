"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

const MS = 200;

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const navRef = useRef(false);
  const prevPath = useRef(pathname);

  /* ── Enter: when pathname changes, animate new content in from below ── */
  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;

    const el = ref.current;
    if (!el) return;

    el.style.transition = "none";
    el.style.opacity = "0";
    el.style.transform = "translateY(16px)";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = `opacity ${MS}ms ease-out, transform ${MS}ms ease-out`;
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      });
    });
  }, [pathname]);

  /* ── Exit: intercept link clicks, animate out upward, then navigate ── */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a) return;
      if (a.target && a.target !== "_self") return;
      const href = a.getAttribute("href");
      if (!href || href === pathname) return;
      if (href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:")) return;
      if (navRef.current) return;

      e.preventDefault();
      navRef.current = true;

      const el = ref.current;
      if (el) {
        el.style.transition = `opacity ${MS}ms ease-in, transform ${MS}ms ease-in`;
        el.style.opacity = "0";
        el.style.transform = "translateY(-16px)";
      }

      setTimeout(() => {
        router.push(href);
        navRef.current = false;
      }, MS);
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname, router]);

  return <div ref={ref}>{children}</div>;
}
