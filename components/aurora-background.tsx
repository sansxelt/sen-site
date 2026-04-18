/**
 * AuroraBackground — two soft blurred color blobs that slowly drift,
 * sitting behind all page content.  Opt-in per page by rendering this
 * once at the top of a server component — no mouse handlers, no
 * JS bundle cost.  All animation is pure CSS (transforms) so it stays
 * on the compositor thread and respects prefers-reduced-motion.
 *
 * Position is fixed (not absolute) so it stays anchored to the viewport
 * as the user scrolls — feels like a consistent ambient light source.
 */
export function AuroraBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="hx-aurora-blob-1" />
      <div className="hx-aurora-blob-2" />
    </div>
  );
}
