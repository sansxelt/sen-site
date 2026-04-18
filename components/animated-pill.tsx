import type { ReactNode } from "react";

type Props = {
  children:  ReactNode;
  className?: string;
};

/**
 * AnimatedPill — a pill badge with a rotating conic-gradient border.
 *
 * The gradient rotation is driven by an @property-registered CSS
 * custom property (--hx-angle), animated infinitely.  A mask subtracts
 * the pill's interior so only the ~1px border glows.  Pure CSS, no JS.
 *
 * Use sparingly — reserve for "New", "v2", or similarly high-signal
 * moments.  Overuse dilutes the premium feel.
 */
export function AnimatedPill({ children, className = "" }: Props) {
  return (
    <span
      className={`hx-pill inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-200 ${className}`}
    >
      {children}
    </span>
  );
}
