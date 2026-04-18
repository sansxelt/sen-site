"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * AuroraBackground — two soft blurred color blobs that slowly drift,
 * sitting behind all page content.  Opt-in per page by rendering this
 * once at the top of a server component — no mouse handlers, no
 * JS bundle cost beyond the portal wrapper.  Animation is pure CSS
 * (transforms) so it stays on the compositor thread and respects
 * prefers-reduced-motion.
 *
 * Why a portal:
 *   The page-transition wrapper applies `transform: translate3d(...)`
 *   on route changes.  Any `position: fixed` descendant of a
 *   transformed element positions itself relative to that element
 *   instead of the viewport — so without the portal the aurora would
 *   ride the page animation (visibly crossing above the header edge
 *   for the duration of every transition).  Rendering into
 *   document.body escapes the transformed ancestor and pins the
 *   aurora to the viewport the way fixed positioning is supposed to
 *   work.
 */
export function AuroraBackground() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="hx-aurora-blob-1" />
      <div className="hx-aurora-blob-2" />
    </div>,
    document.body,
  );
}
