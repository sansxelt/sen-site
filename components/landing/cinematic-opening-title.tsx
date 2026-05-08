"use client";

import { motion, useReducedMotion } from "framer-motion";

// Opening title sequence. Holds black for ~400ms, fades SANSXEL in,
// holds, then fades a small kicker beneath it. The whole title sits
// on a 100vh black field; scrolling past it reveals the first act.
//
// The mark is rendered as type — letters, not the logo glyph — so
// the moment carries the brand name in plain language. The logo
// itself is reserved for product surfaces (etched into the lens
// carrier ring, the case lid, the whisper stem).

const EASE = [0.16, 1, 0.3, 1] as const;

export function CinematicOpeningTitle({ kicker = "an operating system" }: { kicker?: string }) {
  const reduce = useReducedMotion();

  return (
    <section
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#000000",
        overflow: "hidden",
      }}
    >
      {/* Subtle ambient glow that pulses very slowly — the only
          motion behind the title */}
      <motion.div
        aria-hidden
        initial={reduce ? false : { opacity: 0 }}
        animate={reduce ? undefined : { opacity: [0, 0.55, 0.4] }}
        transition={{ duration: 4, ease: "easeInOut" }}
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 60% 45% at 50% 50%, rgba(168,196,255,0.08) 0%, transparent 60%)",
          pointerEvents: "none",
        }}
      />

      {/* Faint corner registration marks — film leader feel */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: "clamp(20px, 4vh, 40px) clamp(20px, 5vw, 80px)",
          pointerEvents: "none",
        }}
      >
        {(["tl", "tr", "bl", "br"] as const).map((corner) => {
          const pos: React.CSSProperties = (() => {
            switch (corner) {
              case "tl": return { top: 0, left: 0 };
              case "tr": return { top: 0, right: 0 };
              case "bl": return { bottom: 0, left: 0 };
              case "br": return { bottom: 0, right: 0 };
            }
          })();
          return (
            <span
              key={corner}
              style={{
                position: "absolute",
                ...pos,
                width: 18,
                height: 18,
                borderLeft:   corner.includes("l") ? "1px solid rgba(168,196,255,0.25)" : undefined,
                borderRight:  corner.includes("r") ? "1px solid rgba(168,196,255,0.25)" : undefined,
                borderTop:    corner.includes("t") ? "1px solid rgba(168,196,255,0.25)" : undefined,
                borderBottom: corner.includes("b") ? "1px solid rgba(168,196,255,0.25)" : undefined,
              }}
            />
          );
        })}
      </div>

      {/* Kicker — small monospaced opening line, types in via fade */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={reduce ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.4 }}
        style={{
          fontSize: 11,
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          color: "rgba(168,196,255,0.6)",
          marginBottom: 32,
        }}
      >
        {kicker}
      </motion.div>

      {/* The mark — massive, blur-in fade */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 28, filter: "blur(20px)" }}
        animate={reduce ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 1.6, ease: EASE, delay: 0.8 }}
        className="cinematic-display cinematic-display--mega cinematic-display--gradient"
        style={{ textAlign: "center" }}
      >
        SANSXEL
      </motion.div>

      {/* Closing line — appears last */}
      <motion.div
        initial={reduce ? false : { opacity: 0 }}
        animate={reduce ? undefined : { opacity: 1 }}
        transition={{ duration: 0.9, ease: EASE, delay: 2.2 }}
        style={{
          fontSize: "clamp(0.85rem, 1.1vw, 1.05rem)",
          color: "rgba(245,245,247,0.45)",
          marginTop: 40,
          letterSpacing: "0.04em",
        }}
      >
        One memory. Three surfaces. All connected.
      </motion.div>

      {/* Scroll hint at bottom */}
      <motion.div
        initial={reduce ? false : { opacity: 0 }}
        animate={reduce ? undefined : { opacity: [0, 1, 0.6] }}
        transition={{ duration: 1.6, ease: EASE, delay: 3.4, repeat: Infinity, repeatType: "reverse", repeatDelay: 0.3 }}
        style={{
          position: "absolute",
          bottom: "clamp(40px, 6vh, 64px)",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 10,
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          color: "rgba(168,196,255,0.5)",
        }}
      >
        scroll
      </motion.div>
    </section>
  );
}
