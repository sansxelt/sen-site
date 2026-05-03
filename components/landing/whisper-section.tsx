"use client";

import { motion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

const WAVE_BARS = Array.from({ length: 24 });

const FEATURES = [
  { icon: "◉", title: "Real-time voice responses", body: "Low-latency AI voice in your ear — answers, summaries, and guidance without looking at a screen." },
  { icon: "◎", title: "Live translation",           body: "Spoken translation as conversations happen. Works in both directions." },
  { icon: "○", title: "Reminders and alerts",       body: "Context-aware nudges delivered at the right moment, not whenever your phone buzzes." },
  { icon: "◌", title: "Adaptive privacy modes",     body: "Whisper scales from discreet guidance to full conversation. You control what it says and when." },
];

export function WhisperSection() {
  return (
    <div className="landing-section-deep" id="whisper">
      <div className="landing-divider" />
      <div className="landing-section">
        <div
          className="landing-whisper-grid"
          style={{ display: "grid", gap: 64, alignItems: "center" }}
        >
          {/* Visual left */}
          <motion.div
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, padding: "40px 0" }}
            initial={{ opacity: 0, scale: 0.92 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: EASE }}
            aria-hidden
          >
            {/* Orb with pulse rings */}
            <div style={{ position: "relative", width: 110, height: 110, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div className="landing-whisper-ring" style={{ inset: -12 }} />
              <div className="landing-whisper-ring" style={{ inset: -24, animationDelay: "1s", borderColor: "rgba(168,196,255,0.04)" }} />
              <div className="landing-whisper-orb" />
            </div>

            {/* Waveform */}
            <div className="landing-waveform">
              {WAVE_BARS.map((_, i) => (
                <div key={i} className="landing-wave-bar" />
              ))}
            </div>

            {/* Privacy indicator */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "5px 14px",
                borderRadius: 100,
                border: "1px solid rgba(168,196,255,0.14)",
                background: "rgba(168,196,255,0.04)",
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(168,196,255,0.60)",
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "rgba(168,196,255,0.70)",
                  boxShadow: "0 0 6px rgba(168,196,255,0.85)",
                  flexShrink: 0,
                }}
              />
              Private mode · active
            </div>
          </motion.div>

          {/* Text right */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.65, ease: EASE }}
          >
            <div className="landing-kicker">── sansxel whisper</div>
            <h2 className="landing-h2 landing-gradient-text">
              Private AI audio.
            </h2>
            <p className="landing-body">
              Whisper is the private audio layer — starting through the
              earbuds you already own. Voice responses, live translation,
              reminders, and guidance delivered directly to your ear.
            </p>
            <p
              className="landing-body"
              style={{ marginTop: 14, fontSize: "0.875rem", color: "#52525b" }}
            >
              Works with what you already own. Future first-party audio
              hardware is part of the long-term plan.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 32 }}>
              {FEATURES.map((f, i) => (
                <motion.div
                  key={f.title}
                  style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.07, ease: EASE }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      border: "1px solid rgba(168,196,255,0.13)",
                      background: "rgba(168,196,255,0.04)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      color: "rgba(168,196,255,0.65)",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {f.icon}
                  </div>
                  <div>
                    <div className="landing-feature-title">{f.title}</div>
                    <div className="landing-feature-body">{f.body}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .landing-whisper-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}
