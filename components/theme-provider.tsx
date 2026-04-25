"use client";

import { useEffect } from "react";

/**
 * Mounts at the root layout. Reads the user's preferred theme from
 * localStorage and applies it to <html> via data-theme="light" or
 * "dark". 'system' resolves via prefers-color-scheme and re-resolves
 * when the OS preference changes.
 *
 * Theme values:
 *   "light"   – force light
 *   "dark"    – force dark (default)
 *   "system"  – follow OS via prefers-color-scheme
 *
 * Other components (the Settings picker) flip the value via
 * setTheme() helper exported below; this provider just listens and
 * applies. Keeps the policy in one place.
 */

const STORAGE_KEY = "sansxel.theme";
type ThemeChoice = "light" | "dark" | "system";

function resolveTheme(choice: ThemeChoice): "light" | "dark" {
  if (choice === "light") return "light";
  if (choice === "dark") return "dark";
  // system
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return "dark";
}

function applyTheme(choice: ThemeChoice) {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(choice);
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.style.colorScheme = resolved;
}

export function getThemeChoice(): ThemeChoice {
  if (typeof window === "undefined") return "dark";
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === "light" || v === "dark" || v === "system") return v;
  return "dark";
}

export function setThemeChoice(choice: ThemeChoice) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, choice);
  applyTheme(choice);
  window.dispatchEvent(new CustomEvent("sansxel:theme:changed", { detail: choice }));
}

export function ThemeProvider() {
  useEffect(() => {
    const choice = getThemeChoice();
    applyTheme(choice);

    // Re-resolve when OS preference flips (only matters for "system").
    const mq = window.matchMedia?.("(prefers-color-scheme: light)");
    const onSystem = () => {
      if (getThemeChoice() === "system") applyTheme("system");
    };
    mq?.addEventListener?.("change", onSystem);
    return () => mq?.removeEventListener?.("change", onSystem);
  }, []);

  return null;
}
