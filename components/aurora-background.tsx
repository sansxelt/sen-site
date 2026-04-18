/**
 * AuroraBackground — two soft blurred color blobs that slowly drift,
 * sitting behind all page content.  Opt-in per page by rendering this
 * once at the top of a server component — no mouse handlers, no
 * JS bundle cost.  All animation is pure CSS (transforms) so it stays
 * on the compositor thread and respects prefers-reduced-motion.
 *
 * Position is fixed (not absolute) so it stays anchored to the viewport
 * as the user scrolls — feels like a consistent ambient light source.
 *
 * Important: the container starts *below* the site header via
 * `top: var(--site-header-height)`, with `overflow-hidden`.  Without
 * that clip, the drift animation (translateY(-5% … +15%) on blob-1)
 * pushes the bright center above the header's lower edge mid-cycle,
 * then snaps back — a visible pulse right at the 66px line.  The hard
 * boundary kills that tween artifact on every route.
 */
export function AuroraBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 overflow-hidden"
      style={{ top: "var(--site-header-height, 66px)" }}
    >
      <div className="hx-aurora-blob-1" />
      <div className="hx-aurora-blob-2" />
    </div>
  );
}
