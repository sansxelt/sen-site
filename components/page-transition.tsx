"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

const FADE_MS = 220;

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const prevPathRef = useRef(pathname);
  const prevChildRef = useRef<ReactNode>(children);
  const [old, setOld] = useState<ReactNode>(null);

  useEffect(() => {
    // No navigation — just keep the snapshot up to date
    if (prevPathRef.current === pathname) {
      prevChildRef.current = children;
      return;
    }

    // Navigation detected — grab the old content before updating refs
    const snapshot = prevChildRef.current;
    prevPathRef.current = pathname;
    prevChildRef.current = children;

    setOld(snapshot);
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });

    const timer = setTimeout(() => setOld(null), FADE_MS + 30);
    return () => clearTimeout(timer);
  }, [pathname, children]);

  return (
    <>
      <style>{`
        @keyframes ptIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes ptOut { from { opacity: 1 } to { opacity: 0 } }
      `}</style>
      <div style={{ display: "grid" }}>
        {/* New page — fades in */}
        <div
          key={pathname}
          style={{
            gridArea: "1/1",
            animation: old ? `ptIn ${FADE_MS}ms ease both` : undefined,
            zIndex: 1,
          }}
        >
          {children}
        </div>

        {/* Old page — fades out, removed after animation */}
        {old && (
          <div
            style={{
              gridArea: "1/1",
              animation: `ptOut ${FADE_MS}ms ease both`,
              pointerEvents: "none",
              zIndex: 0,
            }}
          >
            {old}
          </div>
        )}
      </div>
    </>
  );
}
