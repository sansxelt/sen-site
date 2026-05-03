"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const PLATFORM_NODES = [
  { icon: "◎", label: "Team memory" },
  { icon: "◇", label: "Shared projects" },
  { icon: "◆", label: "Admin controls" },
  { icon: "⬡", label: "Shared billing" },
  { icon: "◉", label: "Priority support" },
];

export function PlatformTeaserSection() {
  return (
    <div className="landing-section-dark">
      <div className="landing-divider" />
      <div className="landing-section" style={{ maxWidth: 800, textAlign: "center", margin: "0 auto" }}>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.65, ease: EASE }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              marginBottom: 20,
              padding: "4px 12px",
              borderRadius: 100,
              border: "1px solid rgba(255,172,51,0.20)",
              background: "rgba(255,172,51,0.06)",
              fontSize: 11,
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              letterSpacing: "0.12em",
              color: "rgba(255,172,51,0.65)",
            }}
          >
            ◈ platform
          </div>

          <h2 className="landing-h2 landing-gradient-text" style={{ marginBottom: 14 }}>
            Sansxel for teams.
          </h2>
          <p className="landing-body" style={{ maxWidth: 480, margin: "0 auto 36px" }}>
            Platform is built for teams that work together. Shared workspaces,
            team memory, admin controls, and dedicated infrastructure.
          </p>

          <motion.div
            style={{
              display: "flex",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 40,
            }}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {PLATFORM_NODES.map((n) => (
              <div
                key={n.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "7px 14px",
                  borderRadius: 100,
                  border: "1px solid rgba(255,172,51,0.12)",
                  background: "rgba(255,172,51,0.04)",
                  fontSize: 12,
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                <span style={{ fontSize: 11, color: "rgba(255,172,51,0.50)" }}>{n.icon}</span>
                {n.label}
              </div>
            ))}
          </motion.div>

          <Link
            href="/platform"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "rgba(255,172,51,0.80)",
              textDecoration: "none",
              borderBottom: "1px solid rgba(255,172,51,0.30)",
              paddingBottom: 2,
            }}
          >
            Learn about Platform <span style={{ fontSize: 11 }}>→</span>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
