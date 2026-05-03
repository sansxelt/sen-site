"use client";

import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import Link from "next/link";
import { useRef } from "react";
import { DotGrid } from "@/components/dot-grid";

const HEADLINE = ["One AI.", "One purpose:", "help."];

const EASE = [0.16, 1, 0.3, 1] as const;

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const wordVar = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } },
};

export function LandingHero({ signedIn }: { signedIn: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  const shouldReduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const coreY       = useTransform(scrollYProgress, [0, 1], [0, 55]);
  const coreScale   = useTransform(scrollYProgress, [0, 1], [1, 0.93]);
  const coreOpacity = useTransform(scrollYProgress, [0, 0.65], [1, 0]);
  const contentY    = useTransform(scrollYProgress, [0, 1], [0, 28]);
  const contentOp   = useTransform(scrollYProgress, [0, 0.55], [1, 0]);

  return (
    <section ref={sectionRef} className="landing-hero">
      {/* Product light — single radial behind sphere position, no aurora blobs */}
      <div className="landing-hero-light" aria-hidden />
      <DotGrid opacity={0.04} />

      {/* Text content */}
      <motion.div
        className="landing-hero-content"
        style={shouldReduce ? {} : { y: contentY, opacity: contentOp }}
      >
        <motion.div
          className="landing-eyebrow"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
        >
          <span className="landing-eyebrow-dot" aria-hidden />
          sansxel · one AI
        </motion.div>

        <motion.h1
          className="landing-h1 landing-gradient-text"
          variants={shouldReduce ? undefined : container}
          initial={shouldReduce ? false : "hidden"}
          animate="visible"
        >
          {HEADLINE.map((word, i) => (
            <motion.span
              key={i}
              className="landing-h1-word"
              variants={shouldReduce ? undefined : wordVar}
            >
              {word}
            </motion.span>
          ))}
        </motion.h1>

        <motion.p
          className="landing-hero-sub"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.55 }}
        >
          Sansxel starts as a powerful AI workspace for thinking, creating,
          and getting things done — then grows into the help layer across web,
          desktop, audio, and future vision.
        </motion.p>

        <motion.div
          className="landing-hero-ctas"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.70 }}
        >
          <Link
            href={signedIn ? "/app" : "/signin?callbackUrl=/app"}
            className="landing-cta-primary"
          >
            {signedIn ? "Open workspace" : "Try Sansxel"}
          </Link>
          <a href="#vision" className="landing-cta-ghost">
            Explore the vision
            <span className="landing-cta-arrow" aria-hidden>↓</span>
          </a>
        </motion.div>
      </motion.div>

      {/* AI Core — parallaxes on scroll */}
      <motion.div
        className="landing-core-wrap landing-core-float"
        style={shouldReduce ? {} : { y: coreY, scale: coreScale, opacity: coreOpacity }}
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: EASE, delay: 0.2 }}
        aria-hidden
      >
        <div className="landing-core-field" />
        <div className="landing-core-outer" />
        <div className="landing-core-ring" />
        <div className="landing-core-sphere">
          <div className="landing-core-spec" />
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className="landing-scroll-hint"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.8 }}
        aria-hidden
      >
        <motion.span
          animate={shouldReduce ? {} : { y: [0, 6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          ↓
        </motion.span>
      </motion.div>
    </section>
  );
}
