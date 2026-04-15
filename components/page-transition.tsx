"use client";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

const transition = {
  duration: 0.28,
  ease: [0.25, 0.46, 0.45, 0.94] as const,
};

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return (
    <MotionConfig reducedMotion="never">
      {/* Outer div gives the stacking context so exiting/entering pages overlap */}
      <div style={{ display: "grid" }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
            style={{ gridArea: "1/1" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
