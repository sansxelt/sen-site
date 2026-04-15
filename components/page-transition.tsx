"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

const MS = 160;

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
        transitionNode.style.transition = `opacity ${MS}ms ease-in, transform ${MS}ms ease-in`;
        transitionNode.style.opacity = "0";
        transitionNode.style.transform = "translateY(-10px)";
      }

      window.setTimeout(() => {
        navRef.current = false;
        router.push(href);
      }, MS);
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
      style={{ ["--route-transition-ms" as string]: `${MS}ms` }}
    >
      {children}
    </div>
  );
}
