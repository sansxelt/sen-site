"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { Lazy3DScene } from "@/components/3d/lazy-scene";
import { Scrim } from "./cinematic-scrim";

// CinematicAct. One full-bleed scene of the page.
//
// Layers, back to front:
//   - 3D scene fills the viewport, offset toward one third of the
//     frame based on the headline anchor (asymmetric framing)
//   - Scrim (top + bottom + vignette) softens the scene into the page
//   - Headline slab (massive type, bottom-left or chosen anchor)
//   - Body line (smaller, sits beneath the headline)
//   - CTA (one ghost link, optional)
//
// Scroll behaviour:
//   - 3D wrapper scales 1.0 to 1.12 (slow dolly push)
//   - Text slab parallaxes vertically at a slower rate
//   - Each headline / body / CTA fades in via whileInView
//   - All motion gated by prefers-reduced-motion

const EASE = [0.16, 1, 0.3, 1] as const;

type Anchor = "bottom-left" | "bottom-center" | "top-right";

type Props = {
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
  // scene so the layers feel decoupled. No opacity transform on the
  // wrapper: with `target` pointing at the section, the first hero
  // act mounts before Framer measures scroll progress, so an
  // opacity-on-progress transform reads 0 during that gap and the
  // wrapper hides everything inside it. Each child's whileInView
  // handles its own entrance.
  const textY = useTransform(scrollYProgress, [0, 1], [80, -40]);

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

      {/* Foreground typography slab */}
      <motion.div
        style={{
          position: "absolute",
          maxWidth: "min(900px, 80vw)",
          zIndex: 2,
          ...anchorStyle,
          ...(reduce ? {} : { y: textY }),
        }}
      >
        <motion.h2
          initial={reduce ? false : { y: 28 }}
          animate={reduce ? undefined : { y: 0 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}
          className="cinematic-display"
          style={{ marginBottom: 22 }}
        >
          {headline}
        </motion.h2>

        {body && (
          <motion.p
            initial={reduce ? false : { y: 16 }}
            animate={reduce ? undefined : { y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.25 }}
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
            initial={reduce ? false : { y: 12 }}
            animate={reduce ? undefined : { y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.32 }}
            style={{ marginBottom: cta ? 24 : 0 }}
          >
            {meta}
          </motion.div>
        )}

        {cta && (
          <motion.div
            initial={reduce ? false : { y: 8 }}
            animate={reduce ? undefined : { y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.40 }}
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
