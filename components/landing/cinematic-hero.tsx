"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";
import { Lazy3DScene } from "@/components/3d/lazy-scene";
import { EcosystemOrbit } from "@/components/3d/ecosystem-orbit";

const EASE = [0.16, 1, 0.3, 1] as const;

// Cinematic hero. Headline + supporting copy on the left, 3D
// ecosystem orbit on the right. On small screens the orbit collapses
// below the copy and uses the static fallback if the user's on a
// narrow viewport or has prefers-reduced-motion set.

export function CinematicHero({ signedIn }: { signedIn: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const heroY  = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const heroOp = useTransform(scrollYProgress, [0, 0.65], [1, 0]);
  const sceneY = useTransform(scrollYProgress, [0, 1], [0, 100]);

  return (
    <section
      ref={sectionRef}
      style={{
        position: "relative",
        minHeight: "100vh",
        padding: "clamp(80px, 12vh, 140px) clamp(20px, 5vw, 80px) 60px",
        overflow: "hidden",
      }}
    >
      {/* Stage glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 70% 60% at 70% 40%, rgba(94,170,255,0.10) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 30% 70%, rgba(168,196,255,0.06) 0%, transparent 55%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          maxWidth: 1600,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 40,
          alignItems: "center",
        }}
        className="cinematic-hero-grid"
      >
        {/* Copy column */}
        <motion.div style={reduce ? {} : { y: heroY, opacity: heroOp }}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.05 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 12px",
              borderRadius: 100,
              border: "1px solid rgba(168,196,255,0.18)",
              background: "rgba(168,196,255,0.04)",
              fontSize: 11,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "rgba(168,196,255,0.75)",
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              marginBottom: 28,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#a8c4ff",
                boxShadow: "0 0 10px #a8c4ff",
              }}
            />
            sansxel · ecosystem reveal
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, ease: EASE, delay: 0.18 }}
            style={{
              fontSize: "clamp(2.6rem, 7vw, 5.6rem)",
              fontWeight: 600,
              lineHeight: 0.95,
              letterSpacing: "-0.035em",
              marginBottom: 24,
              background:
                "linear-gradient(180deg, #ffffff 0%, #cdd6f4 55%, #8aa4d4 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            One AI.
            <br />
            Every surface.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.32 }}
            style={{
              fontSize: "clamp(1.05rem, 1.6vw, 1.3rem)",
              lineHeight: 1.5,
              color: "rgba(255,255,255,0.62)",
              maxWidth: 540,
              marginBottom: 36,
              letterSpacing: "-0.01em",
            }}
          >
            Workshop is the brain. Whisper is the voice. Lens is the eye. One
            memory core, three surfaces, all connected.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.46 }}
            style={{ display: "flex", flexWrap: "wrap", gap: 12 }}
          >
            <Link
              href={signedIn ? "/app" : "/signin?callbackUrl=/app"}
              className="landing-cta-primary"
            >
              Open Workshop
            </Link>
            <Link
              href="/product"
              className="landing-cta-ghost"
              style={{ textDecoration: "none" }}
            >
              See the system
              <span className="landing-cta-arrow" aria-hidden>
                ↗
              </span>
            </Link>
          </motion.div>

          {/* Module ticker */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.7 }}
            style={{
              marginTop: 56,
              display: "flex",
              flexWrap: "wrap",
              gap: 14,
              fontSize: 12,
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              color: "rgba(255,255,255,0.4)",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={dot("#22d3ee")} /> workshop
            </span>
            <span style={sep}>·</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={dot("#60a5fa")} /> whisper
            </span>
            <span style={sep}>·</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={dot("#c084fc")} /> lens
            </span>
            <span style={sep}>·</span>
            <span style={{ color: "rgba(255,255,255,0.28)" }}>memory core, persistent</span>
          </motion.div>
        </motion.div>

        {/* 3D scene column */}
        <motion.div
          style={{
            position: "relative",
            aspectRatio: "1 / 1",
            maxWidth: 640,
            justifySelf: "center",
            width: "100%",
            ...(reduce ? {} : { y: sceneY }),
          }}
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: EASE, delay: 0.4 }}
        >
          <Lazy3DScene
            poster="/landing/ecosystem-orbit-poster.svg"
            alt="sansxel ecosystem orbit"
            cameraPosition={[0, 0.5, 7.5]}
            cameraFov={42}
            style={{ width: "100%", height: "100%" }}
          >
            <EcosystemOrbit />
          </Lazy3DScene>
        </motion.div>
      </div>

      <style>{`
        @media (min-width: 980px) {
          .cinematic-hero-grid {
            grid-template-columns: 1.1fr 1fr !important;
            gap: 60px !important;
          }
        }
      `}</style>
    </section>
  );
}

const dot = (c: string): React.CSSProperties => ({
  width: 7,
  height: 7,
  borderRadius: "50%",
  background: c,
  boxShadow: `0 0 8px ${c}`,
});

const sep: React.CSSProperties = { color: "rgba(255,255,255,0.18)" };
