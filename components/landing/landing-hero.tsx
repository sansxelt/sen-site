"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";
import { ProductComposition } from "@/components/landing/product-composition";

const EASE = [0.16, 1, 0.3, 1] as const;

export function LandingHero({ signedIn }: { signedIn: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  const shouldReduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const compY    = useTransform(scrollYProgress, [0, 1], [0, 70]);
  const compOp   = useTransform(scrollYProgress, [0, 0.72], [1, 0]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 26]);
  const contentOp = useTransform(scrollYProgress, [0, 0.52], [1, 0]);

  return (
    <section
      ref={sectionRef}
      style={{
        position: "relative",
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingBottom: 60,
        background: "#050507",
        overflowX: "clip",
      }}
    >
      {/* Dark stage background — very subtle radial */}
      <div
        style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background:
            "radial-gradient(ellipse 75% 55% at 50% 70%, rgba(100,80,180,0.07) 0%, transparent 65%)",
        }}
      />

      {/* Text content */}
      <motion.div
        className="landing-hero-content"
        style={shouldReduce ? {} : { y: contentY, opacity: contentOp }}
      >
        <motion.div
          className="landing-eyebrow"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.10 }}
        >
          <span className="landing-eyebrow-dot" aria-hidden />
          sansxel · one system
        </motion.div>

        <motion.h1
          className="landing-h1 landing-gradient-text"
          style={{ display: "block", textAlign: "center" }}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.80, ease: EASE, delay: 0.20 }}
        >
          The AI workshop<br />for makers.
        </motion.h1>

        <motion.p
          className="landing-hero-sub"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.70, ease: EASE, delay: 0.36 }}
        >
          Sansxel connects workspace, private audio, and future visual interfaces
          in one system built for people who ship.
        </motion.p>

        <motion.div
          className="landing-hero-ctas"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.70, ease: EASE, delay: 0.50 }}
        >
          <Link
            href={signedIn ? "/app" : "/signin?callbackUrl=/app"}
            className="landing-cta-primary"
          >
            Open workspace
          </Link>
          <a
            href="https://discord.gg/5sxuuewf3u"
            target="_blank"
            rel="noopener noreferrer"
            className="landing-cta-ghost"
          >
            Join Discord
            <span className="landing-cta-arrow" aria-hidden>↗</span>
          </a>
        </motion.div>
      </motion.div>

      {/* Physical product composition — contact lens + earbuds */}
      <motion.div
        style={shouldReduce ? {} : { y: compY, opacity: compOp }}
        initial={{ opacity: 0, y: 48 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.15, ease: EASE, delay: 0.55 }}
      >
        <ProductComposition />
      </motion.div>

      {/* Scroll hint */}
      <motion.div
        className="landing-scroll-hint"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ delay: 1.7, duration: 0.8 }}
        aria-hidden
      >
        <motion.span
          animate={shouldReduce ? {} : { y: [0, 6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >↓</motion.span>
      </motion.div>
    </section>
  );
}
