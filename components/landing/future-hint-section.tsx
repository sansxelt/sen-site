"use client";

import { motion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

const HINTS = [
  {
    id: "whisper",
    icon: "◉",
    label: "Whisper",
    badge: "coming",
    badgeColor: "rgba(168,196,255,0.55)",
    badgeBg: "rgba(168,196,255,0.08)",
    accent: "rgba(168,196,255,0.30)",
    title: "AI audio, through earbuds you own.",
    body: "Whisper is the private audio layer. Voice responses, live translation, and guidance delivered directly to your ear — through AirPods, Pixel Buds, or any BT headset.",
    chips: ["Voice responses", "Live translation", "Audio guidance"],
  },
  {
    id: "lens",
    icon: "○",
    label: "Lens",
    badge: "future direction",
    badgeColor: "rgba(255,205,112,0.60)",
    badgeBg: "rgba(255,205,112,0.07)",
    accent: "rgba(255,205,112,0.25)",
    title: "The interface is your field of view.",
    body: "Lens is the long-term vision: AI overlays in your line of sight. Real-time information, navigation, and memory surfaced when you need them. Not shipping today — built toward, deliberately.",
    chips: ["Visual overlays", "Navigation cues", "Memory context"],
  },
];

export function FutureHintSection() {
  return (
    <div className="landing-section-deep">
      <div className="landing-divider" />
      <div className="landing-section">
        <motion.div
          style={{ textAlign: "center", marginBottom: 48 }}
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="landing-kicker landing-kicker--dim" style={{ justifyContent: "center" }}>
            what comes next
          </div>
          <h2 className="landing-h2 landing-gradient-text">
            Beyond the screen.
          </h2>
          <p className="landing-body" style={{ maxWidth: 480, margin: "0 auto" }}>
            The workspace is where it starts. Whisper and Lens extend it
            into audio and eventually vision — each a layer on top of the same AI.
          </p>
        </motion.div>

        <div
          style={{
            display: "grid",
            gap: 16,
          }}
          className="future-hint-grid"
        >
          {HINTS.map((h, i) => (
            <motion.div
              key={h.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, ease: EASE, delay: i * 0.1 }}
              style={{
                borderRadius: 20,
                border: `1px solid ${h.accent}`,
                background: "rgba(255,255,255,0.02)",
                padding: "28px 28px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20, color: h.badgeColor }}>{h.icon}</span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
                    {h.label}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    padding: "3px 8px",
                    borderRadius: 100,
                    background: h.badgeBg,
                    color: h.badgeColor,
                    whiteSpace: "nowrap",
                  }}
                >
                  {h.badge}
                </span>
              </div>

              <div>
                <div style={{ fontSize: 16, fontWeight: 500, color: "rgba(255,255,255,0.80)", lineHeight: 1.4, marginBottom: 10 }}>
                  {h.title}
                </div>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.42)", lineHeight: 1.65, margin: 0 }}>
                  {h.body}
                </p>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: "auto" }}>
                {h.chips.map((c) => (
                  <span
                    key={c}
                    style={{
                      fontSize: 11,
                      padding: "3px 10px",
                      borderRadius: 100,
                      border: `1px solid ${h.accent}`,
                      color: h.badgeColor,
                    }}
                  >
                    {c}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .future-hint-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}
