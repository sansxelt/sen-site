"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

const MS = 120;

function isAccount(pathname: string) {
  return pathname.startsWith("/account");
}

function getContent() {
  return document.querySelector("[data-page-content]") as HTMLElement | null;
}

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const navRef = useRef(false);

  useEffect(() => {
    if (isAccount(pathname)) return;

    const content = getContent();
    if (!content) return;

    content.style.transition = "none";
    content.style.opacity = "0";
    content.style.transform = "translateY(10px)";

    requestAnimationFrame(() => {
      content.style.transition = `opacity ${MS}ms ease-out, transform ${MS}ms ease-out`;
      content.style.opacity = "1";
      content.style.transform = "translateY(0)";
    });
  }, [pathname]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const anchor = (event.target as HTMLElement).closest("a");
      if (!anchor || (anchor.target && anchor.target !== "_self")) return;

      const href = anchor.getAttribute("href");
      if (!href || href === pathname) return;
      if (
        href.startsWith("http") ||
        href.startsWith("#") ||
        href.startsWith("mailto:")
      ) {
        return;
      }
      if (navRef.current) return;
      if (isAccount(href) || isAccount(pathname)) return;

      event.preventDefault();
      navRef.current = true;

      const content = getContent();
      if (content) {
        content.style.transition = `opacity ${MS}ms ease-in, transform ${MS}ms ease-in`;
        content.style.opacity = "0";
        content.style.transform = "translateY(-10px)";
      }

      window.setTimeout(() => {
        navRef.current = false;
        router.push(href);
      }, MS);
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname, router]);

  return <>{children}</>;
}
