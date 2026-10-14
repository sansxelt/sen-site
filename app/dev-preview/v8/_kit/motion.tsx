"use client";

import { useSyncExternalStore } from "react";

// ONE MOTION CONTROL FOR THE SITE (website handoff 2026-10-12, item 4): the long loops (the hero keyword, the tile
// videos, the capture and research rotations, the docs search loop, the partner band) can be paused and resumed by
// the visitor. The choice is a per-visitor convenience kept in localStorage; it never blocks rendering. CSS-driven
// loops are held by a style element (React compares attributes on <html> when it hydrates, so none is set there).
// Under reduced motion nothing loops in the first place, so the control is hidden (v8.css).

const KEY = "v8-motion";
const STYLE_ID = "v8-motion-paused";
const HELD = ".hm-band__track,.nf__code{animation-play-state:paused !important}";
const subs = new Set<() => void>();
let paused = false;

function apply() {
  if (typeof document === "undefined") return;
  const el = document.getElementById(STYLE_ID);
  if (paused && !el) { const s = document.createElement("style"); s.id = STYLE_ID; s.textContent = HELD; document.head.appendChild(s); }
  if (!paused && el) el.remove();
}

if (typeof window !== "undefined") {
  try { paused = localStorage.getItem(KEY) === "paused"; } catch { /* storage blocked: motion plays */ }
  apply();
}

export const motionPaused = () => paused;

export function setMotionPaused(v: boolean) {
  paused = v;
  try { localStorage.setItem(KEY, v ? "paused" : "on"); } catch { /* storage blocked: the choice lasts this page */ }
  apply();
  subs.forEach((f) => f());
}

export function useMotionPaused() {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => paused, () => false);
}

/** "Pause motion" / "Play motion": a real button, keyboard reachable, its state announced through aria-pressed. */
export function MotionToggle({ className }: { className?: string }) {
  const on = useMotionPaused();
  return (
    <button type="button" className={`v8-motion${className ? ` ${className}` : ""}`} aria-pressed={on} onClick={() => setMotionPaused(!on)}>
      {on
        ? <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3 2l7 4-7 4z" fill="currentColor" /></svg>
        : <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3 2h2v8H3zM7 2h2v8H7z" fill="currentColor" /></svg>}
      <span>{on ? "Play motion" : "Pause motion"}</span>
    </button>
  );
}
