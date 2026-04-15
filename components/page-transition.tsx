"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

const ENTER_MS = 145;
const EXIT_MS = 120;
const EXIT_SHIFT = 3;

function isAccount(pathname: string) {
  return pathname.startsWith("/account");
}

function getTransitionNode() {
  return document.querySelector("[data-route-transition]") as HTMLElement | null;
}

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const navRef = useRef(false);

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

      const transitionNode = getTransitionNode();
      if (transitionNode) {
        transitionNode.style.animation = "none";
        transitionNode.style.transition =
          `opacity ${EXIT_MS}ms cubic-bezier(0.32, 0.72, 0, 1), ` +
          `transform ${EXIT_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`;
        transitionNode.style.opacity = "0.18";
        transitionNode.style.transform = `translate3d(0, -${EXIT_SHIFT}px, 0)`;
      }

      window.setTimeout(() => {
        navRef.current = false;
        router.push(href);
      }, EXIT_MS);
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname, router]);

  if (isAccount(pathname)) {
    return <>{children}</>;
  }

  return (
    <div
      key={pathname}
      data-route-transition
      style={{ ["--route-transition-ms" as string]: `${ENTER_MS}ms` }}
    >
      {children}
    </div>
  );
}
