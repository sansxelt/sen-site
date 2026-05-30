"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: [0.25, 0.1, 0.25, 1] as const },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.08, ease: "linear" as const },
  },
};

/**
 * Layout-level page transition using AnimatePresence.
 * Lives inside SiteShell so it persists across navigations and can
 * run an exit animation on the outgoing page before the new page enters.
 * Previously, transitions only had an enter (CSS keyframe) with no exit —
 * leaving any page felt like an instant cut.
 */
export function SiteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
