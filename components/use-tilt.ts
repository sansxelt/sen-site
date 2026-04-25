"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";

// v0.1.13 — Tiny reusable 3D tilt hook. Drop-in for any card-shaped
// element that wants the same heist-style parallax HeistCard ships
// with, without having to swap the element type. Returns a ref to
// attach + pointer handlers. Mouse-only — coarse pointers (touch /
// pen) fall through so we don't ship dead hover state to mobile.
export function useTilt(maxDeg = 6) {
  const ref = useRef<HTMLDivElement>(null);

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return;
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rx = (0.5 - py) * maxDeg;
    const ry = (px - 0.5) * maxDeg;
    node.style.transform = `perspective(1000px) rotate3d(${rx.toFixed(3)}, ${ry.toFixed(3)}, 0, ${maxDeg}deg)`;
  }

  function onPointerLeave() {
    const node = ref.current;
    if (!node) return;
    node.style.transform = "";
  }

  // Tilt elements need a transform-style transition + will-change so
  // the reset on leave animates instead of snapping. Caller composes
  // these into the element's className.
  const tiltClass = "transition-transform duration-200 ease-out will-change-transform";

  return { ref, onPointerMove, onPointerLeave, tiltClass };
}
