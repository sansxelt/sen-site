"use client";

import { useEffect, useState } from "react";
import { getThemeChoice, setThemeChoice } from "./theme-provider";

type Choice = "light" | "system" | "dark";

// Three-segment header control. All modes always visible so System
// stays one-click reachable instead of getting skipped by the cycle
// fallback. Wider than the old single-button toggle (~96px vs 32px),
// still fits inside marketing nav, ZoneShell, and DashboardNav. The
// /account/settings picker still exists for the long-form copy.

const OPTIONS: Array<{
  value: Choice;
  label: string;
  icon: React.ReactNode;
}> = [
  {
    value: "light",
    label: "Light",
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.2 3.2l1.06 1.06M11.74 11.74l1.06 1.06M3.2 12.8l1.06-1.06M11.74 4.26l1.06-1.06"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    value: "system",
    label: "System",
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1.5" y="2" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5 14h6M8 11v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [choice, setChoiceState] = useState<Choice>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setChoiceState(getThemeChoice());
    setMounted(true);
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<Choice>).detail;
      if (next === "light" || next === "dark" || next === "system") {
        setChoiceState(next);
      }
    };
    window.addEventListener("sansxel:theme:changed", onChange);
    return () => window.removeEventListener("sansxel:theme:changed", onChange);
  }, []);

  const apply = (next: Choice) => {
    setChoiceState(next);
    setThemeChoice(next);
  };

  // Mirror the old button's SSR safeguard: paint "dark" as the active
  // segment until localStorage is read on mount, otherwise we get a
  // hydration mismatch on dark-default loads.
  const display: Choice = mounted ? choice : "dark";

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={
        "inline-flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.04] p-0.5 " +
        className
      }
    >
      {OPTIONS.map((opt) => {
        const active = display === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => apply(opt.value)}
            title={opt.label}
            aria-label={opt.label}
            className={
              "inline-flex h-7 w-7 items-center justify-center rounded-md transition " +
              (active
                ? "bg-white/[0.12] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset]"
                : "text-neutral-400 hover:bg-white/[0.06] hover:text-white")
            }
          >
            {opt.icon}
          </button>
        );
      })}
    </div>
  );
}
