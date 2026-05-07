"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

// Lens OS overlay. NOT a 3D HUD floating in front of the lens. It is
// a real DOM glass card layered over the canvas at the corner of the
// 3D stage, so it reads as a system status panel paired with the
// hardware, not as a sci-fi hologram.
//
// Use as a sibling to <Lazy3DScene>:
//
//   <div style={{ position: "relative" }}>
//     <Lazy3DScene>...</Lazy3DScene>
//     <LensOSOverlay />
//   </div>

const PILLS: { label: string; value: string; accent: string }[] = [
  { label: "MODE",     value: "AMBIENT",  accent: "#a8c4ff" },
  { label: "MEMORY",   value: "47 ITEMS", accent: "#7ab5ff" },
  { label: "BATTERY",  value: "92%",      accent: "#22d3ee" },
  { label: "LINK",     value: "OK",       accent: "#22c55e" },
];

const EASE = [0.16, 1, 0.3, 1] as const;

export function LensOSOverlay({
  align = "bottom-left",
  children,
}: {
  align?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  children?: ReactNode;
}) {
  const reduce = useReducedMotion();

  const offset = (() => {
    switch (align) {
      case "bottom-left":  return { bottom: 14, left: 14 };
      case "bottom-right": return { bottom: 14, right: 14 };
      case "top-left":     return { top: 14, left: 14 };
      case "top-right":    return { top: 14, right: 14 };
    }
  })();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.7, ease: EASE, delay: 0.3 }}
      style={{
        position: "absolute",
        ...offset,
        padding: "12px 14px",
        borderRadius: 14,
        border: "1px solid rgba(168,196,255,0.18)",
        background: "linear-gradient(180deg, rgba(10,12,20,0.78), rgba(10,12,20,0.55))",
        backdropFilter: "blur(14px) saturate(1.2)",
        WebkitBackdropFilter: "blur(14px) saturate(1.2)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 40px rgba(0,0,0,0.55)",
        minWidth: 220,
        pointerEvents: "none",
        zIndex: 2,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          marginBottom: 10,
          fontSize: 10,
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          letterSpacing: "0.18em",
          color: "rgba(168,196,255,0.7)",
          textTransform: "uppercase",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#a8c4ff",
            boxShadow: "0 0 8px #a8c4ff",
          }}
        />
        Lens OS · v0.1
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {PILLS.map((p) => (
          <div
            key={p.label}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 3,
              padding: "8px 10px",
              borderRadius: 9,
              border: "1px solid rgba(255,255,255,0.05)",
              background: "rgba(255,255,255,0.018)",
            }}
          >
            <span
              style={{
                fontSize: 9,
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.45)",
                textTransform: "uppercase",
              }}
            >
              {p.label}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: p.accent,
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                letterSpacing: "0.04em",
              }}
            >
              {p.value}
            </span>
          </div>
        ))}
      </div>

      {children}
    </motion.div>
  );
}
