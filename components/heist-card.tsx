"use client";

import { useRef, type ReactNode, type HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLDivElement> & {
  as?: "div" | "article" | "section";
  children: ReactNode;
  className?: string;
  /**
   * When true the card responds to pointer position with a subtle
   * perspective-based 3D tilt (~6deg max).  Disabled on touch devices
   * via the `(hover: hover) and (pointer: fine)` guard inside the
   * handler, coarse pointers leave the transform untouched so we
   * don't ship a dead hover state to phones / tablets.
   */
  tilt?: boolean;
  /**
   * Stronger border / glow.  Used to mark the highlighted plan in the
   * pricing tier row, but reusable for any "this is the recommended
   * one" surface.
   */
  highlighted?: boolean;
};

/**
 * HeistCard, outlined card in the heist.lol visual language.
 *
 * Shape:
 *   - 1px translucent white border
 *   - rounded-[20px] corners
 *   - dark gradient interior (top-left lighter → bottom-right darker)
 *   - optional 3D tilt on pointer move
 *
 * The tilt math reads pointer X/Y relative to the card's bounding rect,
 * normalises to [-1, 1] on each axis, and feeds that into a
 * `rotate3d(y, x, 0, 6deg)` transform.  Reset on pointer leave.  All
 * transitions are GPU-only (transform / opacity) so cards composite
 * cleanly even when several are on screen at once.
 */
export function HeistCard({
  as: Tag = "div",
  children,
  className = "",
  tilt = false,
  highlighted = false,
  ...rest
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!tilt) return;
    if (e.pointerType !== "mouse") return;
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;   // 0..1
    const py = (e.clientY - rect.top) / rect.height;   // 0..1
    const rx = (0.5 - py) * 6;  // tilt up when cursor is high
    const ry = (px - 0.5) * 6;  // tilt right when cursor is right
    node.style.transform = `perspective(1000px) rotate3d(${rx.toFixed(3)}, ${ry.toFixed(3)}, 0, 6deg)`;
  }

  function handlePointerLeave() {
    const node = ref.current;
    if (!node) return;
    node.style.transform = "";
  }

  const Element = Tag as unknown as "div";

  // Heist surface: dark base with a soft top-left highlight gradient,
  // pulled together by a faint inner ring on top of the visible border.
  const baseClasses = [
    "relative isolate overflow-hidden rounded-[20px]",
    "border border-white/10",
    "bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-black/40",
    "shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset,0_18px_40px_-24px_rgba(0,0,0,0.6)]",
    tilt
      ? "transition-transform duration-200 ease-out will-change-transform"
      : "",
    highlighted
      ? "border-white/25 shadow-[0_0_0_1px_rgba(196,181,253,0.18)_inset,0_24px_60px_-22px_rgba(140,92,246,0.45)]"
      : "",
  ].join(" ");

  return (
    <Element
      {...(rest as HTMLAttributes<HTMLDivElement>)}
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`${baseClasses} ${className}`}
    >
      {children}
    </Element>
  );
}
