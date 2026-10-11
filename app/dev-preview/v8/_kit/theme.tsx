"use client";

import { useEffect, useState } from "react";
import { preferencesAllowed } from "@/lib/privacy-choice";
import { LIGHT_TOKENS, THEME_KEY, THEME_STYLE_ID } from "./scripts";

// LIGHT AND DARK (x.ai's footer toggle; founder 2026-10-10 "keep this light to dark", "synced"). Follows the device
// until the visitor picks one; a pick in one tab carries to the others when Preferences allow keeping it. Choosing
// light adds a style element with the light tokens, which is also what THEME_SCRIPT does before first paint, so a
// reload never flashes the wrong ground. Where the choice is kept: always for this visit (sessionStorage); across
// visits (localStorage "vraelis-theme") only when Preferences are allowed, and that key is in PREFERENCE_LOCAL_KEYS so
// declining clears it.

function apply(light: boolean) {
  let el = document.getElementById(THEME_STYLE_ID);
  if (light && !el) { el = document.createElement("style"); el.id = THEME_STYLE_ID; el.textContent = LIGHT_TOKENS; document.head.appendChild(el); }
  if (!light && el) el.remove();
}

export function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    setLight(!!document.getElementById(THEME_STYLE_ID));
    const saved = () => { try { return sessionStorage.getItem(THEME_KEY) || localStorage.getItem(THEME_KEY); } catch { return null; } };
    // Follow the device until the visitor picks one, as x.ai does.
    const mq = matchMedia("(prefers-color-scheme: light)");
    const onSystem = () => { if (!saved()) { apply(mq.matches); setLight(mq.matches); } };
    // Another open tab changed it: follow.
    const onStorage = (e: StorageEvent) => { if (e.key === THEME_KEY && e.newValue) { const l = e.newValue === "light"; apply(l); setLight(l); } };
    mq.addEventListener("change", onSystem);
    window.addEventListener("storage", onStorage);
    return () => { mq.removeEventListener("change", onSystem); window.removeEventListener("storage", onStorage); };
  }, []);
  const flip = () => {
    const next = !light; setLight(next); apply(next);
    const v = next ? "light" : "dark";
    try { sessionStorage.setItem(THEME_KEY, v); } catch { /* storage blocked */ }
    try { if (preferencesAllowed()) localStorage.setItem(THEME_KEY, v); else localStorage.removeItem(THEME_KEY); } catch { /* storage blocked */ }
  };
  return (
    <button type="button" className="v8-theme" onClick={flip} aria-label={light ? "Switch to dark theme" : "Switch to light theme"} aria-pressed={light}>
      {light ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      )}
    </button>
  );
}
