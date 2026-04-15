"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

const MS = 120;

function isAccount(p: string) { return p.startsWith("/account"); }

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const navRef = useRef(false);

  /* ── Enter: fade in on every pathname change + first load ── */
  useEffect(() => {
    const el = ref.current;
    if (!el || isAccount(pathname)) return;

    el.style.transition = "none";
    el.style.opacity = "0";
    el.style.transform = "translateY(10px)";

    requestAnimationFrame(() => {
      el.style.transition = `opacity ${MS}ms ease-out, transform ${MS}ms ease-out`;
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });
  }, [pathname]);

  /* ── Exit: intercept clicks, quick fade out, then navigate ── */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || (a.target && a.target !== "_self")) return;
      const href = a.getAttribute("href");
      if (!href || href === pathname) return;
      if (href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:")) return;
      if (navRef.current) return;
      if (isAccount(href) || isAccount(pathname)) return;

      e.preventDefault();
      navRef.current = true;

      const el = ref.current;
      if (el) {
        el.style.transition = `opacity ${MS}ms ease-in, transform ${MS}ms ease-in`;
        el.style.opacity = "0";
        el.style.transform = "translateY(-10px)";
      }

      setTimeout(() => {
        navRef.current = false;
        router.push(href);
      }, MS);
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname, router]);

  return <div ref={ref}>{children}</div>;
}
