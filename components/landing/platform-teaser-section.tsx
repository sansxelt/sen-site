"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* Mini developer terminal mockup */
function PlatformVisual() {
  const lines = [
    { label: "key",    val: "sk-vrl-••••••••••••4f9a", color: "rgba(255,172,51,0.70)" },
    { label: "model",  val: "VRAELIS-workshop-v1",      color: "rgba(100,200,255,0.65)" },
    { label: "stream", val: "true",                     color: "rgba(100,200,130,0.65)" },
    { label: "prompt", val: '"Build the scaffold for…"', color: "rgba(210,210,210,0.45)" },
  ];

  return (
    <div style={{ maxWidth: 460, width: "100%" }}>
      {/* Terminal window */}
      <div
        style={{
          background: "#0a0a0e",
          border: "1px solid rgba(255,172,51,0.14)",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.03), 0 0 60px rgba(255,172,51,0.05)",
        }}
      >
        {/* Titlebar */}
        <div
          style={{
            height: 32,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.02)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 12px",
          }}
        >
          <div style={{ display: "flex", gap: 5 }}>
            {["rgba(255,88,78,0.38)", "rgba(255,188,48,0.30)", "rgba(55,200,88,0.28)"].map((c, i) => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
            ))}
          </div>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.24)", fontFamily: "var(--font-geist-mono), monospace", letterSpacing: "0.06em" }}>
            VRAELIS api · v1
          </span>
          <div style={{ width: 44 }} />
        </div>

        {/* Code body */}
        <div style={{ padding: "16px 18px", fontFamily: "var(--font-geist-mono), monospace" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.20)", marginBottom: 12 }}>
            POST /v1/chat/completions
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {lines.map(({ label, val, color }) => (
              <div key={label} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", minWidth: 52, flexShrink: 0 }}>{label}:</span>
                <span style={{ fontSize: 11, color }}>{val}</span>
              </div>
            ))}
          </div>

          {/* Response block */}
          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(255,172,51,0.05)",
              border: "1px solid rgba(255,172,51,0.12)",
              display: "flex", flexDirection: "column", gap: 5,
            }}
          >
            <div style={{ fontSize: 9, color: "rgba(255,172,51,0.52)", letterSpacing: "0.12em", marginBottom: 3 }}>RESPONSE STREAM</div>
            <div style={{ height: 4, width: "88%", borderRadius: 2, background: "rgba(255,255,255,0.22)" }} />
            <div style={{ height: 4, width: "73%", borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
            <div style={{ height: 4, width: "81%", borderRadius: 2, background: "rgba(255,255,255,0.18)" }} />
            <div style={{ height: 4, width: "55%", borderRadius: 2, background: "rgba(255,255,255,0.10)" }} />
          </div>
        </div>
      </div>

      {/* Feature pill row */}
      <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 7 }}>
        {[
          "API keys",
          "SDKs",
          "Request inspector",
          "Usage dashboard",
          "Webhooks",
          "Integrations",
        ].map((f) => (
          <span
            key={f}
            style={{
              fontSize: 11, padding: "3px 10px", borderRadius: 100,
              border: "1px solid rgba(255,172,51,0.14)",
              background: "rgba(255,172,51,0.04)",
              color: "rgba(255,172,51,0.60)",
              letterSpacing: "0.04em",
            }}
          >
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}

export function PlatformTeaserSection() {
  return (
    <div className="landing-section-dark">
      <div className="landing-divider" />
      <div
        className="landing-section lp-platform-grid"
        style={{ display: "grid", gap: 64, alignItems: "center" }}
      >
        {/* Text */}
        <motion.div
          className="lp-platform-text"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.65, ease: EASE }}
        >
          <div
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              marginBottom: 16, padding: "4px 12px", borderRadius: 100,
              border: "1px solid rgba(255,172,51,0.22)",
              background: "rgba(255,172,51,0.06)",
              fontSize: 11,
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              letterSpacing: "0.12em", color: "rgba(255,172,51,0.72)",
            }}
          >
            ◈ platform
          </div>

          <h2 className="landing-h2 landing-gradient-text">
            Build on VRAELIS.
          </h2>
          <p className="landing-body" style={{ marginBottom: 22 }}>
            Full API access. Request inspector, usage dashboard, API keys,
            and webhooks. Build integrations, extend the Workshop, or
            embed AI into your own products.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
            {[
              { icon: "◎", label: "REST API + streaming completions" },
              { icon: "◇", label: "SDKs for TypeScript, Python, Swift" },
              { icon: "◆", label: "MCP server connections" },
              { icon: "⬡", label: "Team workspaces + admin controls" },
            ].map(({ icon, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, color: "rgba(255,172,51,0.55)", width: 14, flexShrink: 0 }}>{icon}</span>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.48)" }}>{label}</span>
              </div>
            ))}
          </div>

          <Link
            href="/platform"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              fontSize: 13, color: "rgba(255,172,51,0.82)",
              textDecoration: "none",
              borderBottom: "1px solid rgba(255,172,51,0.30)",
              paddingBottom: 2,
            }}
          >
            View Platform docs <span style={{ fontSize: 11 }}>→</span>
          </Link>
        </motion.div>

        {/* Visual */}
        <motion.div
          className="lp-platform-visual"
          style={{ display: "flex", justifyContent: "center" }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.70, ease: EASE, delay: 0.12 }}
        >
          <PlatformVisual />
        </motion.div>
      </div>
      <style>{`
        @media (min-width: 1024px) {
          .lp-platform-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}
