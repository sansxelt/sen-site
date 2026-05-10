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

type Anchor = "bottom-left" | "bottom-center" | "top-right" | "center";

type Props = {
  headline: ReactNode;
  body?: ReactNode;
  cta?: { href: string; label: string };
  // Either an R3F scene (procedural 3D) OR a 2D hero image. Mutually
  // exclusive. If `imageUrl` is set, the 3D path is skipped entirely
  // and the act renders as a cinematic still with Ken-Burns slow zoom.
  scene?: ReactNode;
  imageUrl?: string;
  // For full-bleed AI environments (cover): where the subject sits.
  // For transparent product shots (contain): unused; positioning is
  // derived from the headline anchor.
  imageObjectPosition?: string;
  // True when imageUrl points at a transparent PNG (just the product,
  // no background). Switches object-fit from cover to contain so the
  // whole product shows and the page background reads through the
  // transparency.
  transparent?: boolean;
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
  // Adds a strong left-to-right dark gradient over the image, which
  // gives bottom-left or top-left text a guaranteed legible bed even
  // when the photo's left side is bright. No-op for `bottom-center`
  // and `center` anchors, where a centered dark scrim would just look
  // like the image is broken.
  leftScrim?: boolean;
};

export function CinematicAct({
  headline,
  body,
  cta,
  scene,
  imageUrl,
  imageObjectPosition = "center",
  transparent = false,
  poster,
  posterAlt,
  cameraPosition = [0, 0, 6],
  cameraFov = 42,
  accent = "#a8c4ff",
  anchor = "bottom-left",
  meta,
  bg = "#050507",
  leftScrim = false,
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
        // Tighter bottom inset on phones so the CTA stays above the
        // address bar; loosens on tablets/desktop.
        return { left: "clamp(16px, 5vw, 80px)", right: "clamp(16px, 5vw, 80px)", bottom: "clamp(48px, 12vh, 160px)", textAlign: "left" };
      case "bottom-center":
        // Center via left:0 / right:0 / margin auto rather than
        // translateX(-50%). Framer combines `y` into a single
        // transform string and clobbers the inline translateX, which
        // shifts the text off-center and clips it on the right edge.
        return { left: 0, right: 0, marginInline: "auto", paddingInline: "clamp(16px, 5vw, 80px)", bottom: "clamp(48px, 12vh, 160px)", textAlign: "center" };
      case "top-right":
        return { right: "clamp(16px, 5vw, 80px)", left: "clamp(16px, 5vw, 80px)", top: "clamp(96px, 14vh, 200px)", textAlign: "right" };
      case "center":
        // Vertically + horizontally centered. Wrapper fills the
        // section (inset: 0) and uses flex to center its children.
        // We can't translateY(-50%) here because Framer's y parallax
        // shares the transform string and would overwrite our manual
        // translate.
        return {
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "clamp(40px, 8vh, 100px) clamp(20px, 5vw, 80px)",
        };
    }
  })();

  return (
    <section
      ref={sectionRef}
      className="cinematic-act"
      style={{
        position: "relative",
        // svh = small viewport height, never grows with the address bar
        // so phones don't end up with the CTA below the fold. Falls
        // back to vh on browsers that don't support svh.
        height: "100svh",
        minHeight: 560,
        overflow: "hidden",
        background: bg,
      }}
    >
      {/* Scene layer fills viewport. Subject offset is derived from
          the headline anchor: when text sits bottom-left, we push the
          subject toward the right edge so the eye reads across the
          frame instead of stacking copy on top of the product.
          imageUrl wins over scene when both are provided. When neither
          is provided, the section renders as a quiet text-only act
          with just the atmospheric backdrop (no fake-looking
          procedural geometry standing in as a placeholder). */}
      {(imageUrl || scene) && (
      <motion.div
        style={{
          position: "absolute",
          inset: 0,
          // Asymmetric x-offset only applies to the full-bleed paths
          // (cover image + 3D scene). For transparent contain images
          // we drive the bias via objectPosition instead.
          x:
            transparent
              ? 0
              : anchor === "bottom-left"
              ? "14vw"
              : anchor === "top-right"
              ? "-14vw"
              : "0",
          ...(reduce ? {} : { scale: sceneScale, y: sceneY }),
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={posterAlt}
            style={{
              width: "100%",
              height: "100%",
              objectFit: transparent ? "contain" : "cover",
              objectPosition: transparent
                ? anchor === "bottom-left"
                  ? "75% center"
                  : anchor === "top-right"
                  ? "25% center"
                  : "center"
                : imageObjectPosition,
              display: "block",
            }}
            loading="eager"
            decoding="async"
          />
        ) : (
          <Lazy3DScene
            poster={poster}
            alt={posterAlt}
            cameraPosition={cameraPosition}
            cameraFov={cameraFov}
            style={{ width: "100%", height: "100%" }}
          >
            {scene}
          </Lazy3DScene>
        )}
      </motion.div>
      )}

      {/* Atmospheric backdrop for text-only acts. A radial accent
          glow on a dark field, no scene, no image. Renders only when
          neither imageUrl nor scene is present. */}
      {!imageUrl && !scene && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(ellipse 60% 50% at 50% 50%, ${accent}14 0%, transparent 60%)`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Optional left-side dark scrim. Pushes the bright photo into
          shadow on the left third so bottom-left / top-left text has
          a legible bed no matter what the source photo looks like. */}
      {leftScrim && (anchor === "bottom-left" || anchor === "top-right") && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              anchor === "top-right"
                ? "linear-gradient(270deg, rgba(5,5,7,0.92) 0%, rgba(5,5,7,0.55) 30%, rgba(5,5,7,0) 60%)"
                : "linear-gradient(90deg, rgba(5,5,7,0.92) 0%, rgba(5,5,7,0.55) 30%, rgba(5,5,7,0) 60%)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
      )}

      {/* Atmosphere */}
      <Scrim bg={bg} />

      {/* Foreground typography slab */}
      <motion.div
        style={{
          position: "absolute",
          maxWidth: "min(900px, 92vw)",
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
