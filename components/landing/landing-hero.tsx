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

  const compY    = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const compOp   = useTransform(scrollYProgress, [0, 0.70], [1, 0]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 30]);
  const contentOp = useTransform(scrollYProgress, [0, 0.50], [1, 0]);

  return (
    <section
      ref={sectionRef}
      className="landing-hero"
      style={{ paddingBottom: 60 }}
    >
      {/* Stage background light */}
      <div className="landing-hero-light" />

      {/* Dark edge vignette */}
      <div
        style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background:
            "radial-gradient(ellipse 90% 75% at 50% 60%, rgba(80,65,160,0.06) 0%, transparent 62%)",
        }}
      />

      {/* Text content */}
      <motion.div
        className="landing-hero-content"
        style={shouldReduce ? {} : { y: contentY, opacity: contentOp }}
      >
        {/* Eyebrow */}
        <motion.div
          className="landing-eyebrow"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.10 }}
        >
          <span className="landing-eyebrow-dot" aria-hidden />
          VRAELIS · one system
        </motion.div>

        {/* H1 */}
        <motion.h1
          className="landing-h1 landing-gradient-text"
          style={{ display: "block", textAlign: "center" }}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.80, ease: EASE, delay: 0.20 }}
        >
          The AI workshop<br />for makers.
        </motion.h1>

        {/* Supporting line */}
        <motion.p
          style={{
            fontSize: "clamp(1.0rem, 1.8vw, 1.2rem)",
            fontWeight: 500,
            color: "rgba(255,255,255,0.55)",
            marginBottom: 10,
            letterSpacing: "-0.01em",
          }}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.70, ease: EASE, delay: 0.32 }}
        >
          One AI. One purpose: help.
        </motion.p>

        {/* Subtext */}
        <motion.p
          className="landing-hero-sub"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.70, ease: EASE, delay: 0.42 }}
        >
          VRAELIS connects workspace, private audio, and future visual interfaces
          in one system.
        </motion.p>

        {/* CTAs */}
        <motion.div
          className="landing-hero-ctas"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.70, ease: EASE, delay: 0.54 }}
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

      {/* Hardware composition */}
      <motion.div
        style={shouldReduce ? {} : { y: compY, opacity: compOp }}
        initial={{ opacity: 0, y: 56 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.20, ease: EASE, delay: 0.58 }}
      >
        <ProductComposition />
      </motion.div>

      {/* Scroll hint */}
      <motion.div
        className="landing-scroll-hint"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ delay: 1.8, duration: 0.8 }}
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
