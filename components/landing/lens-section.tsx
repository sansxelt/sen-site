"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useRef } from "react";

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

/* HUD chips float around the lens circle at different positions */
const HUD_CHIPS = [
  {
    label: "Translation · JP → EN",
    style: { top: "8%",  left: "-18%" },
    delay: 0.3,
  },
  {
    label: "Navigate · 200m →",
    style: { bottom: "14%", left: "-22%" },
    delay: 0.45,
  },
  {
    label: "Memory · last context",
    style: { top: "12%",  right: "-20%" },
    delay: 0.6,
  },
];

const CAPABILITIES = [
  { title: "Real-time visual overlays",  body: "Contextual labels, object identification, and information layers in your field of view." },
  { title: "Live translation",           body: "Spoken and written translation displayed as natural overlays without breaking immersion." },
  { title: "Navigation and spatial cues",body: "Directions, distances, and spatial annotations tied to what you're actually looking at." },
  { title: "Gaze-driven UI",             body: "Interface elements that respond to focus, not touch. Less friction, less distraction." },
  { title: "Memory cues",                body: "Context from Sansxel Memory surfaced visually when it's relevant to what you see." },
];

function LensVisual({ inView }: { inView: boolean }) {
  const shouldReduce = useReducedMotion();

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 380,
        opacity: 0.92,
      }}
      role="img"
      aria-label="Sansxel Lens concept — future visual AI interface"
    >
      {/* Lens circle */}
      <motion.div
        className="landing-lens-circle"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={inView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.9, ease: EASE }}
      >
        <div className="landing-lens-crosshair" aria-hidden />
        <div className="landing-lens-gaze" aria-hidden />
      </motion.div>

      {/* Floating HUD chips */}
      {HUD_CHIPS.map((chip, i) => (
        <motion.div
          key={chip.label}
          className="landing-hud-chip"
          style={chip.style as React.CSSProperties}
          initial={{ opacity: 0, y: shouldReduce ? 0 : 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, ease: EASE, delay: chip.delay }}
          aria-hidden
        >
          <span className="landing-hud-tick" />
          {chip.label}
        </motion.div>
      ))}
    </div>
  );
}

export function LensSection() {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div className="landing-section-deep" id="lens" style={{ position: "relative", overflow: "hidden" }}>
      {/* HUD grid overlay — the section background has a subtle blueprint feel */}
      <div className="landing-lens-hud-grid" aria-hidden />

      <div className="landing-divider" />
      <div className="landing-section" ref={ref}>
        <div
          className="landing-lens-content"
          style={{ display: "grid", gap: 64, alignItems: "center" }}
        >
          {/* Text left */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.65, ease: EASE }}
          >
            {/* Future badge — clearly marks this as vision, not shipping */}
            <div className="landing-future-badge">
              <span className="landing-future-dot" />
              future direction
            </div>

            <div className="landing-kicker landing-kicker--future">── sansxel lens</div>
            <h2 className="landing-h2 landing-gradient-text">
              The future interface is your field of view.
            </h2>
            <p className="landing-body">
              Lens is the long-term vision for where this system goes — AI
              overlays in your line of sight. Real-time information, translation,
              navigation, and memory surfaced exactly when you need them.
            </p>
            <p
              className="landing-body"
              style={{ marginTop: 14, fontSize: "0.875rem", color: "#52525b" }}
            >
              Not shipping today. Built toward, deliberately.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 32 }}>
              {CAPABILITIES.map((c, i) => (
                <motion.div
                  key={c.title}
                  className="landing-feature-row"
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: i * 0.06, ease: EASE }}
                >
                  <div
                    className="landing-feature-dot"
                    style={{ background: "rgba(255,205,112,0.50)" }}
                  />
                  <div>
                    <div className="landing-feature-title" style={{ color: "#d4d4d8" }}>{c.title}</div>
                    <div className="landing-feature-body">{c.body}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Lens visual right */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8 }}
          >
            {/* inView passed via parent — use whileInView animation within LensVisual instead */}
            <LensVisualInView />
          </motion.div>
        </div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .landing-lens-content { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}

/* Wrapper to handle inView state for the lens visual */
function LensVisualInView() {
  return (
    <motion.div
      initial={false}
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      variants={{ visible: {} }}
    >
      {/* Re-use the visual but drive its entrance via whileInView on children */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 380,
          opacity: 0.92,
        }}
        role="img"
        aria-label="Sansxel Lens concept — future visual AI interface"
      >
        <motion.div
          className="landing-lens-circle"
          initial={{ opacity: 0, scale: 0.85 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: EASE }}
        >
          <div className="landing-lens-crosshair" aria-hidden />
          <div className="landing-lens-gaze" aria-hidden />
        </motion.div>

        {HUD_CHIPS.map((chip) => (
          <motion.div
            key={chip.label}
            className="landing-hud-chip"
            style={chip.style as React.CSSProperties}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, ease: EASE, delay: chip.delay }}
            aria-hidden
          >
            <span className="landing-hud-tick" />
            {chip.label}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
