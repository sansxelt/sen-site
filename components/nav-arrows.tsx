"use client";

import { useEffect, useState } from "react";

export function NavArrows() {
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  // Re-evaluate on every navigation
  useEffect(() => {
    function update() {
      setCanGoBack(window.history.state?.idx > 0);
      // No reliable browser API for forward; approximate with a flag approach
      setCanGoForward(false); // will be set true after a back() is triggered
    }

    update();
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);

  function goBack() {
    window.history.back();
    // After going back, forward becomes available
    setTimeout(() => setCanGoForward(true), 50);
  }

  function goForward() {
    window.history.forward();
    setTimeout(() => setCanGoForward(false), 50);
  }

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
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className="h-3.5 w-3.5 text-neutral-400 transition group-hover:text-white"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 3L5 8l5 5" />
        </svg>
      </button>

      <button
        onClick={goForward}
        aria-label="Go forward"
        className={`pointer-events-auto ${btnBase} ${!canGoForward ? disabledCls : ""}`}
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className="h-3.5 w-3.5 text-neutral-400 transition group-hover:text-white"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 3l5 5-5 5" />
        </svg>
      </button>
    </div>
  );
}
