"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function NavArrows() {
  const router   = useRouter();
  const pathname = usePathname();

  // Our own history stack — router.push() is reliable in App Router,
  // window.history.back/forward is not (popstate doesn't fire for Link nav).
  const histRef   = useRef<string[]>([]);
  const posRef    = useRef(-1);
  const ourNavRef = useRef(false); // true when WE triggered the navigation

  const [canGoBack,    setCanGoBack]    = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  useEffect(() => {
    if (ourNavRef.current) {
      // We triggered this pathname change — pos already updated in the handler
      ourNavRef.current = false;
    } else {
      // Link or external navigation — push, drop any forward history
      const base = histRef.current.slice(0, posRef.current + 1);
      base.push(pathname);
      histRef.current = base;
      posRef.current  = base.length - 1;
    }
    setCanGoBack(posRef.current > 0);
    setCanGoForward(posRef.current < histRef.current.length - 1);
  }, [pathname]);

  const goBack = () => {
    if (posRef.current <= 0) return;
    posRef.current--;
    ourNavRef.current = true;
    setCanGoBack(posRef.current > 0);
    setCanGoForward(posRef.current < histRef.current.length - 1);
    router.push(histRef.current[posRef.current]);
  };

  const goForward = () => {
    if (posRef.current >= histRef.current.length - 1) return;
    posRef.current++;
    ourNavRef.current = true;
    setCanGoBack(posRef.current > 0);
    setCanGoForward(posRef.current < histRef.current.length - 1);
    router.push(histRef.current[posRef.current]);
  };

  const btnBase =
    "group flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-neutral-950/70 backdrop-blur-md transition-all duration-200 hover:border-white/25 hover:bg-neutral-800/80";
  const disabledCls = "opacity-20 cursor-not-allowed pointer-events-none";

  return (
    <div className="pointer-events-none fixed inset-y-0 inset-x-0 z-40 flex items-center justify-between px-3 sm:px-4">
      <button
        onClick={goBack}
        aria-label="Go back"
        className={`pointer-events-auto ${btnBase} ${!canGoBack ? disabledCls : ""}`}
      >
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-neutral-400 transition group-hover:text-white" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 3L5 8l5 5" />
        </svg>
      </button>

      <button
        onClick={goForward}
        aria-label="Go forward"
        className={`pointer-events-auto ${btnBase} ${!canGoForward ? disabledCls : ""}`}
      >
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-neutral-400 transition group-hover:text-white" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3l5 5-5 5" />
        </svg>
      </button>
    </div>
  );
}
