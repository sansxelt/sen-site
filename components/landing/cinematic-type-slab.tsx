"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef, type ReactNode } from "react";

// Pure-typography interlude between cinematic acts. One sentence,
// massive, on a quiet field. The point is rhythm: after a busy act
// the eye gets a beat to absorb, then the next act lands.
//
// Three line treatments via the `treatment` prop:
//   "white"      pure white slab — the loudest declaration
//   "gradient"   white → 40% white vertical gradient — a softer beat
//   "etched"     low-contrast graphite — quiet whisper between acts

const EASE = [0.16, 1, 0.3, 1] as const;

type Props = {
  kicker?: string;
  children: ReactNode;
  treatment?: "white" | "gradient" | "etched";
  align?: "left" | "center";
  bg?: string;
  height?: string;
};

export function CinematicTypeSlab({
  kicker,
  children,
  treatment = "gradient",
  align = "left",
  bg = "#040406",
  height = "85vh",
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });

  // The slab drifts subtly upward through its own viewport so it
  // feels alive without animating any part of the type itself.
  const y  = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const op = useTransform(scrollYProgress, [0, 0.25, 0.75, 1], [0, 1, 1, 0.4]);

  const colorClass =
    treatment === "white"   ? "cinematic-display--white"   :
    treatment === "etched"  ? "cinematic-display--etched"  :
                              "cinematic-display--gradient";

  return (
    <section
      ref={ref}
      style={{
        position: "relative",
        minHeight: height,
        display: "flex",
        alignItems: "center",
        padding: "clamp(80px, 14vh, 200px) clamp(20px, 5vw, 80px)",
        background: bg,
        overflow: "hidden",
      }}
    >
      {/* Faint dot grid backdrop — barely visible, gives the type
          something to sit on without competing */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(168,196,255,0.05) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 50%, #000 0%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 50%, #000 0%, transparent 80%)",
          pointerEvents: "none",
        }}
      />

      <motion.div
        style={{
          position: "relative",
          maxWidth: 1500,
          width: "100%",
          margin: "0 auto",
          textAlign: align,
          ...(reduce ? {} : { y, opacity: op }),
        }}
      >
        {kicker && (
          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            whileInView={reduce ? undefined : { opacity: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.8, ease: EASE }}
            style={{
              fontSize: 11,
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "rgba(168,196,255,0.55)",
              marginBottom: 28,
            }}
          >
            {kicker}
          </motion.div>
        )}

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24, filter: "blur(10px)" }}
          whileInView={reduce ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 1.1, ease: EASE, delay: 0.1 }}
          className={`cinematic-display cinematic-display--xl ${colorClass}`}
        >
          {children}
        </motion.div>
      </motion.div>
    </section>
  );
}
