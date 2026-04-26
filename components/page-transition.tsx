"use client";

import { motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";

const HEADER_OFFSET = "var(--site-header-height, 66px)";
// Blackout composes with the CSS route-enter/route-exit keyframes in
// globals.css, the keyframes (680ms / 220ms) handle the smooth slide,
// the blackout just masks the DOM swap between pages. Keeping the
// blackout tight makes route changes feel snappier without touching
// the actual animation feel. In ≈ cover mount, out ≈ reveal, total
// visible blackout time ≈ 260ms.
const BLACKOUT_IN_MS = 130;
const BLACKOUT_SETTLE_MS = 15;
const BLACKOUT_HOLD_MS = 20;
const BLACKOUT_OUT_MS = 160;

function getTransitionNode(): HTMLElement | null {
  return document.querySelector("[data-route-transition]") as HTMLElement | null;
}

function isHome(path: string): boolean {
  return path === "/" || path === "/home";
}

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const navRef = useRef(false);
  const firstMount = useRef(true);
  const releaseTimerRef = useRef<number | null>(null);
  const navigationTimerRef = useRef<number | null>(null);
  const [blackout, setBlackout] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);

    return () => {
      if (releaseTimerRef.current) {
        window.clearTimeout(releaseTimerRef.current);
      }

      if (navigationTimerRef.current) {
        window.clearTimeout(navigationTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (firstMount.current) {
      firstMount.current = false;
      return;
    }

    navRef.current = false;
    getTransitionNode()?.removeAttribute("data-exiting");

    if (releaseTimerRef.current) {
      window.clearTimeout(releaseTimerRef.current);
    }

    releaseTimerRef.current = window.setTimeout(() => {
      setBlackout(0);
      releaseTimerRef.current = null;
    }, BLACKOUT_HOLD_MS);
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
      if (!anchor || (anchor.target && anchor.target !== "_self")) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href === pathname) {
        return;
      }

      if (
        href.startsWith("http") ||
        href.startsWith("#") ||
        href.startsWith("mailto:")
      ) {
        return;
      }

      if (navRef.current) {
        return;
      }

      event.preventDefault();
      navRef.current = true;

      if (releaseTimerRef.current) {
        window.clearTimeout(releaseTimerRef.current);
        releaseTimerRef.current = null;
      }

      const node = getTransitionNode();
      if (node) {
        node.setAttribute("data-exiting", "");
      }

      setBlackout(1);

      if (navigationTimerRef.current) {
        window.clearTimeout(navigationTimerRef.current);
      }

      navigationTimerRef.current = window.setTimeout(() => {
        startTransition(() => router.push(href));
        navigationTimerRef.current = null;
      }, BLACKOUT_IN_MS + BLACKOUT_SETTLE_MS);
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname, router, startTransition]);

  const home = isHome(pathname);

  return (
    <>
      {mounted &&
        createPortal(
          <motion.div
            aria-hidden
            initial={false}
            animate={{ opacity: blackout }}
            transition={{
              duration: blackout === 1 ? BLACKOUT_IN_MS / 1000 : BLACKOUT_OUT_MS / 1000,
              ease: blackout === 1 ? [0.16, 1, 0.3, 1] : [0.22, 1, 0.36, 1],
            }}
            style={{
              position: "fixed",
              top: HEADER_OFFSET,
              right: 0,
              bottom: 0,
              left: 0,
              zIndex: 40,
              background: "#000",
              pointerEvents: "none",
            }}
          />,
          document.body,
        )}

      <div data-route-transition-root>
        <div aria-hidden data-nav-progress={isPending ? "active" : "idle"} />

        <div
          key={pathname}
          data-route-transition
          data-is-home={home ? "" : undefined}
        >
          {children}
        </div>
      </div>
    </>
  );
}
