"use client";

import type { ReactNode } from "react";

// Animation is now handled by SiteTransition in SiteShell (layout level),
// which gives us proper exit animations via AnimatePresence.
// This component is kept as a passthrough so template.tsx compiles unchanged.
export function PageTransition({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
