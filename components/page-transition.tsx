"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

function isHome(path: string): boolean {
  return path === "/" || path === "/home";
}

/**
 * Wraps the (site) template with a keyed div so every route change
 * triggers a CSS `route-enter` animation (defined in globals.css).
 * Navigation is handled entirely by Next.js — no click interception,
 * no overlay, no timer. Prior implementation intercepted clicks with
 * event.preventDefault() which caused navigation to silently freeze
 * when the router.push callback didn't fire cleanly.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const home = isHome(pathname);

  return (
    <div data-route-transition-root>
      <div
        key={pathname}
        data-route-transition
        data-is-home={home ? "" : undefined}
      >
        {children}
      </div>
    </div>
  );
}
