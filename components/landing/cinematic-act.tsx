"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { Lazy3DScene } from "@/components/3d/lazy-scene";
import { Scrim } from "./cinematic-scrim";

// CinematicAct. One full-bleed "scene" of the reveal film.
//
// Layers, back to front:
//   - 3D scene fills the viewport
//   - Scrim (top + bottom + vignette) softens the scene into the page
//   - Act marker chip in the top-left ("ACT 02 / 07 — WHISPER")
//   - Headline slab (massive type, bottom-left or chosen anchor)
//   - Body line (smaller, sits beneath the headline)
//   - CTA (one ghost link, optional)
//
// Scroll behaviour:
//   - 3D wrapper scales 1 → 1.06 over the section (slow push-in)
//   - Headline rises 30px from below as the act enters
//   - Marker, body, CTA fade in on a stagger
//   - All motion gated by prefers-reduced-motion

const EASE = [0.16, 1, 0.3, 1] as const;

type Anchor = "bottom-left" | "bottom-center" | "top-right";

type Props = {
  index: number;
  total: number;
  marker: string;
  headline: ReactNode;
  body?: ReactNode;
  cta?: { href: string; label: string };
  scene: ReactNode;
  poster: string;
  posterAlt: string;
  cameraPosition?: [number, number, number];
  cameraFov?: number;
  accent?: string;
  anchor?: Anchor;
  // Optional small inline element inserted between body and CTA, e.g.
  // a row of pills or specs.
  meta?: ReactNode;
  bg?: string;
};

export function CinematicAct({
  index,
  total,
  marker,
  headline,
  body,
  cta,
  scene,
  poster,
  posterAlt,
  cameraPosition = [0, 0, 6],
  cameraFov = 42,
  accent = "#a8c4ff",
  anchor = "bottom-left",
  meta,
  bg = "#050507",
}: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  // Camera "push-in" — the scene wrapper scales subtly as you scroll
  // through the act. Reads as a slow dolly toward the subject.
  const sceneScale = useTransform(scrollYProgress, [0, 0.5, 1], [1.0, 1.06, 1.12]);
  const sceneY     = useTransform(scrollYProgress, [0, 1], [40, -40]);

  // Foreground typography parallax — moves slightly slower than the
  // scene so the layers feel decoupled.
  const textY  = useTransform(scrollYProgress, [0, 1], [80, -40]);
  const textOp = useTransform(scrollYProgress, [0, 0.18, 0.85, 1], [0, 1, 1, 0.4]);

  const anchorStyle: React.CSSProperties = (() => {
    switch (anchor) {
      case "bottom-left":
        return { left: "clamp(20px, 5vw, 80px)", bottom: "clamp(80px, 14vh, 160px)", textAlign: "left" };
      case "bottom-center":
        return { left: "50%", transform: "translateX(-50%)", bottom: "clamp(80px, 14vh, 160px)", textAlign: "center" };
      case "top-right":
        return { right: "clamp(20px, 5vw, 80px)", top: "clamp(120px, 16vh, 200px)", textAlign: "right" };
    }
  })();

  return (
    <section
      ref={sectionRef}
      style={{
        position: "relative",
        height: "100vh",
        minHeight: 720,
        overflow: "hidden",
        background: bg,
      }}
    >
      {/* 3D scene fills viewport. Subject offset is derived from the
          headline anchor: when text sits bottom-left, we push the
          subject toward the right edge so the eye reads across the
          frame instead of stacking copy on top of the product. */}
      <motion.div
        style={{
          position: "absolute",
          inset: 0,
          x:
            anchor === "bottom-left"
              ? "14vw"
              : anchor === "top-right"
              ? "-14vw"
              : "0",
          ...(reduce ? {} : { scale: sceneScale, y: sceneY }),
        }}
      >
        <Lazy3DScene
          poster={poster}
          alt={posterAlt}
          cameraPosition={cameraPosition}
          cameraFov={cameraFov}
          style={{ width: "100%", height: "100%" }}
        >
          {scene}
        </Lazy3DScene>
      </motion.div>

      {/* Atmosphere */}
      <Scrim bg={bg} />

      {/* Act marker chip — small monospaced "chapter card" in the
          top-left, the only persistent UI through the reel */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: -8 }}
        whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.6, ease: EASE }}
        style={{
          position: "absolute",
          top: "clamp(20px, 4vh, 40px)",
          left: "clamp(20px, 5vw, 80px)",
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "5px 12px",
          borderRadius: 100,
          border: `1px solid ${accent}26`,
          background: "rgba(0,0,0,0.30)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          fontSize: 10,
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: `${accent}d9`,
          zIndex: 3,
        }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: accent,
            boxShadow: `0 0 8px ${accent}`,
          }}
        />
        ACT {String(index).padStart(2, "0")} / {String(total).padStart(2, "0")} · {marker}
      </motion.div>

      {/* Foreground typography slab */}
      <motion.div
        style={{
          position: "absolute",
          maxWidth: "min(900px, 80vw)",
          zIndex: 2,
          ...anchorStyle,
          ...(reduce ? {} : { y: textY, opacity: textOp }),
        }}
      >
        <motion.h2
          initial={reduce ? false : { opacity: 0, y: 30, filter: "blur(8px)" }}
          whileInView={reduce ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 1.0, ease: EASE }}
          className="cinematic-display"
          style={{ marginBottom: 22 }}
        >
          {headline}
        </motion.h2>

        {body && (
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.18 }}
            style={{
              fontSize: "clamp(1rem, 1.4vw, 1.25rem)",
              lineHeight: 1.55,
              color: "rgba(245,245,247,0.72)",
              maxWidth: 540,
              letterSpacing: "-0.005em",
              marginBottom: meta || cta ? 24 : 0,
            }}
          >
            {body}
          </motion.p>
        )}

        {meta && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.28 }}
            style={{ marginBottom: cta ? 24 : 0 }}
          >
            {meta}
          </motion.div>
        )}

        {cta && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.36 }}
          >
            <Link
              href={cta.href}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 22px",
                borderRadius: 100,
                border: `1px solid ${accent}33`,
                background: "rgba(0,0,0,0.30)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                color: `${accent}f0`,
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
                letterSpacing: "-0.005em",
              }}
            >
              {cta.label}
              <span aria-hidden style={{ fontSize: 13 }}>→</span>
            </Link>
          </motion.div>
        )}
      </motion.div>
    </section>
  );
}
