"use client";

import { useRef, type ReactNode, type HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLDivElement> & {
  as?:       "div" | "article" | "section";
  children:  ReactNode;
  className?: string;
};

/**
 * SpotlightCard, the single signature effect off heist.lol.
 *
 * Tracks pointer X/Y as CSS custom properties (--hx-x, --hx-y) on the
 * element.  A ::before pseudo-element (set up in globals.css under
 * .hx-spotlight) reads those and paints a soft radial gradient at the
 * cursor position, giving the card a "lit from where you point"
 * feeling.  Gated to (hover: hover) + (pointer: fine) so touch devices
 * don't show a permanent glow or dead hover state.
 *
 * Drop-in replacement for a regular card div, pass the same Tailwind
 * classes you'd use for the border/bg/padding, everything else works
 * the same.
 */
export function SpotlightCard({
  as: Tag = "div",
  children,
  className = "",
  ...rest
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    node.style.setProperty("--hx-x", `${e.clientX - rect.left}px`);
    node.style.setProperty("--hx-y", `${e.clientY - rect.top}px`);
  }

  const Element = Tag as unknown as "div";

  return (
    <Element
      {...(rest as HTMLAttributes<HTMLDivElement>)}
      ref={ref}
      onPointerMove={handlePointerMove}
      className={`hx-spotlight ${className}`}
    >
      {children}
    </Element>
  );
}
