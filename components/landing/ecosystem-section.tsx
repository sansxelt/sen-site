"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const EASE        = [0.16, 1, 0.3,  1   ] as [number, number, number, number];
const EASE_SPRING = [0.34, 1.56, 0.64, 1] as [number, number, number, number];

const NODES = [
  { id: "web",     label: "Web",     icon: "⬡", desc: "helps you think" },
  { id: "copilot", label: "Copilot", icon: "◆", desc: "helps you act"   },
  { id: "memory",  label: "Memory",  icon: "◎", desc: "connects it all", center: true },
  { id: "whisper", label: "Whisper", icon: "◉", desc: "helps you hear"  },
  { id: "lens",    label: "Lens",    icon: "○", desc: "helps you see"   },
];

/*
  SVG connection lines:  hub-spoke from center Memory node to each outer node.
  Viewbox: 600 × 100.  Node centers at: Web=60, Copilot=180, Memory=300, Whisper=420, Lens=540.
  All lines go through the Memory x=300 center; simplified as horizontal connector lines
  since all nodes share the same Y.  A subtle vertical "root" below Memory adds depth.
*/
const SVG_LINES = [
  { d: "M300,50 L60,50",  delay: 0.1 },
  { d: "M300,50 L180,50", delay: 0.2 },
  { d: "M300,50 L420,50", delay: 0.2 },
  { d: "M300,50 L540,50", delay: 0.1 },
];

function ConnectionLines() {
  return (
    <svg
      viewBox="0 0 600 100"
      aria-hidden
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "100%",
        maxWidth: 700,
        height: "100%",
        pointerEvents: "none",
        overflow: "visible",
      }}
      preserveAspectRatio="xMidYMid meet"
    >
      {SVG_LINES.map((line, i) => (
        <motion.path
          key={i}
          d={line.d}
          stroke="rgba(168,196,255,0.18)"
          strokeWidth="1"
          fill="none"
          strokeDasharray="4 3"
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: line.delay, ease: "easeInOut" }}
        />
      ))}
    </svg>
  );
}

export function EcosystemSection({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="landing-section-dark" id="ecosystem">
      <div className="landing-divider" />
      <div
        className="landing-section"
        style={{ textAlign: "center" }}
      >
        <motion.div
          className="landing-kicker"
          style={{ justifyContent: "center" }}
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          ── the system
        </motion.div>

        <motion.h2
          className="landing-h2 landing-gradient-text"
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.06 }}
        >
          One AI across every layer.
        </motion.h2>

        <motion.p
          className="landing-body"
          style={{ margin: "0 auto 64px", maxWidth: 480 }}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.12 }}
        >
          Web helps you think. Copilot helps you act. Whisper helps you hear.
          Lens helps you see. Memory connects it all.
        </motion.p>

        {/* Node diagram */}
        <div
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "center",
            marginBottom: 56,
          }}
        >
          <div
            style={{
              position: "relative",
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 0,
              width: "100%",
              maxWidth: 680,
              alignItems: "center",
            }}
          >
            <ConnectionLines />

            {NODES.map((node, i) => (
              <motion.div
                key={node.id}
                className="landing-eco-node"
                style={{ position: "relative", zIndex: 2 }}
                initial={{ opacity: 0, scale: 0.7 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.5,
                  delay: 0.05 + i * 0.08,
                  ease: EASE_SPRING,
                }}
              >
                <div
                  className={`landing-eco-icon${node.center ? " landing-eco-icon--center" : ""}`}
                >
                  {node.icon}
                </div>
                <div
                  className={`landing-eco-label${node.center ? " landing-eco-label--center" : ""}`}
                >
                  {node.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Per-layer desc row */}
        <motion.div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "8px 24px",
            marginBottom: 52,
          }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.45 }}
        >
          {NODES.map((node) => (
            <span
              key={node.id}
              style={{
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                fontSize: 11,
                color: node.center ? "rgba(168,196,255,0.55)" : "rgba(255,255,255,0.28)",
                letterSpacing: "0.10em",
              }}
            >
              {node.label} {node.desc}
            </span>
          ))}
        </motion.div>

        {/* Final CTA */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
        >
          <Link
            href={signedIn ? "/app" : "/signin?callbackUrl=/app"}
            className="landing-cta-primary"
            style={{ display: "inline-flex" }}
          >
            {signedIn ? "Open workspace" : "Start with Sansxel today"}
          </Link>
          <p
            style={{
              marginTop: 14,
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              fontSize: 11,
              color: "rgba(255,255,255,0.22)",
              letterSpacing: "0.12em",
            }}
          >
            / free to start · no card required
          </p>
        </motion.div>
      </div>
    </div>
  );
}
