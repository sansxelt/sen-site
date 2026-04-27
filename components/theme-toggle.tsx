"use client";

import { useEffect, useState } from "react";
import { getThemeChoice, setThemeChoice } from "./theme-provider";

type Choice = "light" | "dark" | "system";

// Compact header-mounted theme toggle. Single-button rotation
// through Light → System → Dark so the chrome stays narrow on
// every shell (marketing nav, ZoneShell, DashboardNav). The deeper
// 3-up picker still lives in /account/settings for users who want
// a steady setting instead of a quick flip.

const ORDER: Choice[] = ["light", "system", "dark"];

const META: Record<Choice, { label: string; next: string; icon: React.ReactNode }> = {
  light: {
    label: "Light",
    next: "Switch to system",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
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
  system: {
    label: "System",
    next: "Switch to dark",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1.5" y="2" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5 14h6M8 11v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  dark: {
    label: "Dark",
    next: "Switch to light",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
};

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [choice, setChoice] = useState<Choice>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setChoice(getThemeChoice());
    setMounted(true);
    // Pick up changes from another tab / from /account/settings.
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<Choice>).detail;
      if (next === "light" || next === "dark" || next === "system") {
        setChoice(next);
      }
    };
    window.addEventListener("sansxel:theme:changed", onChange);
    return () => window.removeEventListener("sansxel:theme:changed", onChange);
  }, []);

  const cycle = () => {
    const idx = ORDER.indexOf(choice);
    const next = ORDER[(idx + 1) % ORDER.length];
    setChoice(next);
    setThemeChoice(next);
  };

  // Render the dark icon during SSR + first client paint to avoid
  // hydration mismatch on a dark-default load. Real choice fills in
  // after the localStorage read on mount.
  const display = mounted ? choice : "dark";
  const meta = META[display];

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Theme: ${meta.label}. ${meta.next}.`}
      aria-label={`Theme: ${meta.label}. Click to ${meta.next.toLowerCase()}.`}
      className={
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-neutral-300 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white " +
        className
      }
    >
      {meta.icon}
    </button>
  );
}
