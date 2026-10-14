"use client";

// The founder removed the shared motion control. Clear its old preference so a visitor
// cannot remain paused with no control to resume. Components still respect reduced motion.
if (typeof window !== "undefined") {
  try { localStorage.removeItem("v8-motion"); } catch { /* Storage may be unavailable. */ }
  document.getElementById("v8-motion-paused")?.remove();
}

export const motionPaused = () => false;
export const useMotionPaused = () => false;
