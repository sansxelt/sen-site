"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function NavArrows() {
  const pathname = usePathname();
  const visitCount = useRef(0);
  const [canGoBack, setCanGoBack] = useState(false);

  // Increment every time the pathname changes — reliable in App Router
  useEffect(() => {
    visitCount.current += 1;
    setCanGoBack(visitCount.current > 1);
  }, [pathname]);

  const btnBase =
    "group flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-neutral-950/70 backdrop-blur-md transition-all duration-200 hover:border-white/25 hover:bg-neutral-800/80";
  const disabledCls = "opacity-20 cursor-not-allowed pointer-events-none";

  return (
    <div className="pointer-events-none fixed inset-y-0 inset-x-0 z-40 flex items-center justify-between px-3 sm:px-4">
      <button
        onClick={() => window.history.back()}
        aria-label="Go back"
        className={`pointer-events-auto ${btnBase} ${!canGoBack ? disabledCls : ""}`}
      >
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-neutral-400 transition group-hover:text-white" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 3L5 8l5 5" />
        </svg>
      </button>

      <button
        onClick={() => window.history.forward()}
        aria-label="Go forward"
        className={`pointer-events-auto ${btnBase} opacity-20 cursor-not-allowed pointer-events-none`}
      >
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-neutral-400 transition group-hover:text-white" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3l5 5-5 5" />
        </svg>
      </button>
    </div>
  );
}
