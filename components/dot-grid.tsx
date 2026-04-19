import type { CSSProperties } from "react";

type Props = {
  /**
   * Spacing between dots in px.  24 reads as a "default" heist density;
   * smaller numbers feel busier, larger numbers feel like a soft texture.
   */
  size?: number;
  /** Dot radius in px.  1 stays subtle at any zoom level. */
  dotSize?: number;
  /**
   * Tailwind-friendly opacity 0..1.  Applied to the rgba dot color so
   * the grid sits behind hero text without competing.
   */
  opacity?: number;
  /** Override the dot color outright (hex / rgb / rgba). */
  color?: string;
  /**
   * `fixed` pins the grid to the viewport (parallaxes as the user
   * scrolls); `absolute` ties it to the parent — useful when a hero
   * section wants the grid only behind itself.
   */
  position?: "fixed" | "absolute";
  className?: string;
};

/**
 * DotGrid — pure-CSS radial-gradient pattern that renders a dot grid
 * background behind a section.  No SVG, no extra DOM cost beyond a
 * single positioned div.
 *
 * The trick: a 1px radial-gradient repeated on a `background-size`
 * tile produces a perfectly-aligned dot grid that scales with the
 * viewport and never needs raster assets.
 *
 * Stacks underneath everything via `-z-10`; the parent should be
 * `relative` (or this should be `position="fixed"`) for it to anchor
 * correctly.
 */
export function DotGrid({
  size = 24,
  dotSize = 1,
  opacity = 0.06,
  color,
  position = "absolute",
  className = "",
}: Props) {
  const dotColor = color ?? `rgba(255, 255, 255, ${opacity})`;

  const style: CSSProperties = {
    backgroundImage: `radial-gradient(circle, ${dotColor} ${dotSize}px, transparent ${dotSize}px)`,
    backgroundSize: `${size}px ${size}px`,
    // Fade the grid out at the edges so it doesn't visibly tile against
    // the section boundary — gives a heist-style "fog" feel where the
    // pattern dissolves into the page background.
    maskImage:
      "radial-gradient(ellipse at center, rgba(0,0,0,1) 0%, rgba(0,0,0,0.6) 55%, rgba(0,0,0,0) 90%)",
    WebkitMaskImage:
      "radial-gradient(ellipse at center, rgba(0,0,0,1) 0%, rgba(0,0,0,0.6) 55%, rgba(0,0,0,0) 90%)",
  };

  const positionClass =
    position === "fixed" ? "fixed inset-0" : "absolute inset-0";

  return (
    <div
      aria-hidden
      className={`${positionClass} pointer-events-none -z-10 ${className}`}
      style={style}
    />
  );
}
