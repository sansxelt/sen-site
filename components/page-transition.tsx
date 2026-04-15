"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

const FADE_MS = 180;

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const [content, setContent] = useState(children);
  const latestChildren = useRef(children);
  const prevPathname = useRef(pathname);
  latestChildren.current = children;

  useEffect(() => {
    // Skip initial render
    if (prevPathname.current === pathname) return;
    prevPathname.current = pathname;

    // Fade out — old content stays visible during the fade
    setVisible(false);

    const timer = setTimeout(() => {
      // Swap content while fully invisible
      setContent(latestChildren.current);
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });

      // Wait one frame so the browser paints at opacity 0, then fade in
      requestAnimationFrame(() => {
        setVisible(true);
      });
    }, FADE_MS);

    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transition: `opacity ${FADE_MS}ms ease`,
      }}
    >
      {content}
    </div>
  );
}
