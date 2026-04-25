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
  if (typeof window !== "undefined") {
    window.localStorage.setItem(`${STORAGE_KEY}.touched`, String(Date.now()));
  }
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
  // v0.1.16 — Cross-device sync. Push to the server so the same
  // preference is applied on the next sign-in from any device.
  // Fire-and-forget; failure just leaves the local copy in place.
  void fetch("/api/account/theme", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ theme: choice }),
  }).catch(() => {
    // ignore — server sync is best-effort
  });
}

export function ThemeProvider() {
  useEffect(() => {
    const choice = getThemeChoice();
    applyTheme(choice);

    // v0.1.16 — Pull the server-side preference and reconcile. If the
    // user picked Light on another device, this brings it across. Only
    // overrides local if they differ + the local one wasn't just set
    // (we use a timestamp guard to avoid clobbering an in-flight
    // local change with the server's previous value).
    void (async () => {
      try {
        const res = await fetch("/api/account/theme", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { theme?: ThemeChoice };
        if (!data.theme || data.theme === choice) return;
        // Only overwrite if the user hasn't actively changed theme in
        // the last 4 seconds (prevents reverting an action from
        // settling slow network).
        const lastChange = Number(window.localStorage.getItem(`${STORAGE_KEY}.touched`) || 0);
        if (Date.now() - lastChange < 4000) return;
        window.localStorage.setItem(STORAGE_KEY, data.theme);
        applyTheme(data.theme);
      } catch {
        // ignore — sync is best-effort
      }
    })();

    // Re-resolve when OS preference flips (only matters for "system").
    const mq = window.matchMedia?.("(prefers-color-scheme: light)");
    const onSystem = () => {
      if (getThemeChoice() === "system") applyTheme("system");
    };
    mq?.addEventListener?.("change", onSystem);

    // Re-pull on tab focus so a theme flip on another tab/device
    // takes effect when the user comes back.
    const onFocus = () => {
      void fetch("/api/account/theme", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { theme?: ThemeChoice } | null) => {
          if (!d?.theme) return;
          if (d.theme === getThemeChoice()) return;
          const lastChange = Number(window.localStorage.getItem(`${STORAGE_KEY}.touched`) || 0);
          if (Date.now() - lastChange < 4000) return;
          window.localStorage.setItem(STORAGE_KEY, d.theme);
          applyTheme(d.theme);
        })
        .catch(() => {});
    };
    window.addEventListener("focus", onFocus);

    return () => {
      mq?.removeEventListener?.("change", onSystem);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return null;
}
