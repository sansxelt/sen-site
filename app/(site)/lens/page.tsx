"use client";

import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Lazy3DScene } from "@/components/landing/three/lazy-scene";
import { LensObject } from "@/components/landing/three/lens-object";
import { LensCase } from "@/components/landing/three/lens-case";
import { WaitlistForm } from "@/components/landing/waitlist-form";

const EASE = [0.16, 1, 0.3, 1] as const;

const MODES = [
  {
    name: "Ambient",
    accent: "#a8c4ff",
    body:
      "Captions, arrows, tiny answer snippets. Always-on context that stays out of the way.",
    bullets: [
      "Real-time captions for audio in your environment",
      "Subtle navigation arrows, never blocking your view",
      "One-glance answer cards from Workshop",
    ],
  },
  {
    name: "Mainframe",
    accent: "#c084fc",
    body:
      "Floating windows, dashboards, apps and widgets. Your full Workshop in your field of view.",
    bullets: [
      "Pinned panels you place around the room",
      "Browse, code, write, sketch in mid-air",
      "Multitask without losing the room",
    ],
  },
  {
    name: "Minimal",
    accent: "#7ab5ff",
    body:
      "Reduced UI, blink-controlled. Battery-saving for long days when you only need the essentials.",
    bullets: [
      "One persistent indicator and silence otherwise",
      "Blink twice to summon the next answer",
      "Hours of additional uptime per pair",
    ],
  },
];

export default function LensPage() {
  const heroRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY  = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const sceneY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const heroOp = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <main style={{ background: "#050507", overflowX: "hidden" }}>
      {/* HERO */}
      <section
        ref={heroRef}
        style={{
          position: "relative",
          minHeight: "100vh",
          padding: "clamp(80px, 12vh, 140px) clamp(20px, 5vw, 80px) 80px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(192,132,252,0.12) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 80% 80%, rgba(168,196,255,0.07) 0%, transparent 55%)",
            pointerEvents: "none",
          }}
        />

        <motion.div
          style={{
            position: "relative",
            maxWidth: 1500,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 40,
            alignItems: "center",
            ...(reduce ? {} : { y: heroY, opacity: heroOp }),
          }}
          className="cinematic-hero-grid"
        >
          {/* Copy */}
          <div>
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
                border: "1px solid rgba(192,132,252,0.3)",
                background: "rgba(192,132,252,0.07)",
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(192,132,252,0.9)",
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                marginBottom: 28,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#c084fc",
                  boxShadow: "0 0 10px #c084fc",
                }}
              />
              concept · R&amp;D
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, ease: EASE, delay: 0.18 }}
              style={{
                fontSize: "clamp(4rem, 14vw, 11rem)",
                fontWeight: 700,
                lineHeight: 0.85,
                letterSpacing: "-0.06em",
                marginBottom: 28,
                background:
                  "linear-gradient(180deg, #ffffff 0%, #cdb6f5 60%, #6b3fa0 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              LENS
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.32 }}
              style={{
                fontSize: "clamp(1.05rem, 1.6vw, 1.3rem)",
                lineHeight: 1.55,
                color: "rgba(255,255,255,0.62)",
                maxWidth: 540,
                marginBottom: 34,
              }}
            >
              Lens is our visual interface direction. A transparent contact lens
              with three render modes, paired with Workshop on your phone or PC
              for compute.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.45 }}
            >
              <WaitlistForm
                product="lens"
                accent="#c084fc"
                cta="Join Lens waitlist"
                size="large"
              />
            </motion.div>
          </div>

          {/* 3D scene */}
          <motion.div
            style={{
              position: "relative",
              aspectRatio: "1 / 1",
              maxWidth: 640,
              justifySelf: "center",
              width: "100%",
              ...(reduce ? {} : { y: sceneY }),
            }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease: EASE, delay: 0.4 }}
          >
            <Lazy3DScene
              poster="/landing/lens-poster.svg"
              alt="Transparent contact lens"
              cameraPosition={[0, 0.6, 5.5]}
              cameraFov={40}
              style={{ width: "100%", height: "100%" }}
            >
              <LensObject />
            </Lazy3DScene>
          </motion.div>
        </motion.div>
      </section>

      {/* MODES */}
      <section
        style={{
          background: "#040406",
          padding: "clamp(80px, 12vh, 140px) clamp(20px, 5vw, 80px)",
        }}
      >
        <div className="landing-divider" />
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ maxWidth: 640, marginBottom: 56 }}>
            <div
              style={{
                fontSize: 11,
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(192,132,252,0.7)",
                marginBottom: 12,
              }}
            >
              three modes
            </div>
            <h2 className="landing-h2 landing-gradient-text" style={{ marginBottom: 14 }}>
              Quiet by default.<br/>Powerful when summoned.
            </h2>
            <p className="landing-body">
              Lens shifts between three render modes throughout your day. Ambient
              for context, Mainframe for deep work, Minimal for battery and focus.
            </p>
          </div>

          <div style={{ display: "grid", gap: 18, gridTemplateColumns: "1fr" }} className="lens-modes-grid">
            {MODES.map((m) => (
              <div
                key={m.name}
                style={{
                  borderRadius: 18,
                  border: `1px solid ${m.accent}33`,
                  background: `linear-gradient(180deg, ${m.accent}08, transparent 80%)`,
                  padding: "28px 28px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: m.accent,
                      boxShadow: `0 0 12px ${m.accent}`,
                    }}
                  />
                  <div
                    style={{
                      fontSize: 11,
                      fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: m.accent,
                      opacity: 0.85,
                    }}
                  >
                    mode
                  </div>
                </div>
                <h3
                  style={{
                    fontSize: 28,
                    fontWeight: 600,
                    color: "#f5f5f7",
                    letterSpacing: "-0.02em",
                    marginBottom: 12,
                  }}
                >
                  {m.name}
                </h3>
                <p style={{ color: "#a1a1aa", lineHeight: 1.55, fontSize: 14, marginBottom: 18 }}>
                  {m.body}
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {m.bullets.map((b) => (
                    <li key={b} style={{ display: "flex", gap: 9, fontSize: 13, color: "#71717a", lineHeight: 1.5 }}>
                      <span style={{ width: 4, height: 4, borderRadius: "50%", background: `${m.accent}88`, marginTop: 8, flexShrink: 0 }} />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <style>{`
            @media (min-width: 900px) { .lens-modes-grid { grid-template-columns: repeat(3, 1fr) !important; } }
          `}</style>
        </div>
      </section>

      {/* DAY KIT */}
      <section
        id="day-kit"
        style={{
          background: "#050507",
          padding: "clamp(80px, 12vh, 140px) clamp(20px, 5vw, 80px)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 60% 50% at 30% 50%, rgba(192,132,252,0.10) 0%, transparent 55%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "relative",
            maxWidth: 1500,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 60,
            alignItems: "center",
          }}
          className="lens-day-grid"
        >
          <div
            style={{
              position: "relative",
              aspectRatio: "1 / 1",
              maxWidth: 560,
              width: "100%",
              justifySelf: "center",
            }}
          >
            <Lazy3DScene
              poster="/landing/lens-case-poster.svg"
              alt="Lens charging case"
              cameraPosition={[2.2, 1.6, 4]}
              cameraFov={38}
              style={{ width: "100%", height: "100%" }}
            >
              <LensCase />
            </Lazy3DScene>
          </div>

          <div>
            <div
              style={{
                fontSize: 11,
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(192,132,252,0.7)",
                marginBottom: 14,
              }}
            >
              lens day kit
            </div>
            <h2 className="landing-h2 landing-gradient-text" style={{ marginBottom: 18 }}>
              Two pairs.<br/>One smart case.
            </h2>
            <p className="landing-body" style={{ maxWidth: 480, marginBottom: 26 }}>
              The Day Kit pairs two Lens with a smart charging case. Quick swap
              between Pair A and Pair B; one charges while the other runs.
              Targeting all-day usage when you alternate.
            </p>

            <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
              {[
                { label: "Pair A", color: "#22d3ee", desc: "morning + afternoon" },
                { label: "Pair B", color: "#c084fc", desc: "evening + travel" },
              ].map((p) => (
                <div
                  key={p.label}
                  style={{
                    flex: 1,
                    padding: "14px 16px",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.07)",
                    background: "rgba(255,255,255,0.025)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: p.color, boxShadow: `0 0 12px ${p.color}` }} />
                    <div
                      style={{
                        fontSize: 12,
                        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                        color: "rgba(255,255,255,0.6)",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {p.label}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "#71717a", lineHeight: 1.5 }}>
                    {p.desc}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                fontSize: 12,
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              <span style={chip()}>quick swap</span>
              <span style={chip()}>case tops up in minutes</span>
              <span style={chip()}>battery target: full day alternating</span>
            </div>
          </div>
        </div>
        <style>{`
          @media (min-width: 980px) { .lens-day-grid { grid-template-columns: 1fr 1fr !important; } }
        `}</style>
      </section>

      {/* WORKSHOP CONNECTION */}
      <section
        style={{
          background: "#040406",
          padding: "clamp(80px, 12vh, 140px) clamp(20px, 5vw, 80px)",
        }}
      >
        <div className="landing-divider" />
        <div style={{ maxWidth: 880, margin: "0 auto", textAlign: "center" }}>
          <div
            style={{
              fontSize: 11,
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(168,196,255,0.7)",
              marginBottom: 14,
            }}
          >
            architecture
          </div>
          <h2 className="landing-h2 landing-gradient-text" style={{ marginBottom: 18 }}>
            Lens does not run heavy AI.<br/>Workshop does.
          </h2>
          <p className="landing-body" style={{ maxWidth: 620, margin: "0 auto 32px" }}>
            Compute lives on your phone or PC where there is power and thermal
            headroom. Lens renders the result. That keeps the lens itself thin,
            cool, and battery-conscious.
          </p>

          <div
            style={{
              display: "grid",
              gap: 14,
              gridTemplateColumns: "repeat(3, 1fr)",
              maxWidth: 720,
              margin: "0 auto",
            }}
            className="lens-arch-grid"
          >
            {[
              { name: "LENS", color: "#c084fc", role: "render + sense" },
              { name: "PHONE / PC", color: "#a8c4ff", role: "compute + memory" },
              { name: "WORKSHOP", color: "#22d3ee", role: "AI + context" },
            ].map((n) => (
              <div
                key={n.name}
                style={{
                  padding: "18px 14px",
                  borderRadius: 14,
                  border: `1px solid ${n.color}30`,
                  background: `linear-gradient(180deg, ${n.color}08, transparent)`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: n.color, boxShadow: `0 0 8px ${n.color}` }} />
                  <div style={{ fontSize: 11, fontFamily: "var(--font-geist-mono), ui-monospace, monospace", letterSpacing: "0.1em", color: n.color }}>
                    {n.name}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#71717a", textAlign: "center" }}>{n.role}</div>
              </div>
            ))}
          </div>
          <style>{`
            @media (max-width: 720px) { .lens-arch-grid { grid-template-columns: 1fr !important; } }
          `}</style>
        </div>
      </section>

      {/* WAITLIST FOOTER */}
      <section
        style={{
          background: "#050507",
          padding: "100px clamp(20px, 5vw, 80px) 100px",
        }}
      >
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            textAlign: "center",
            padding: "48px 32px",
            borderRadius: 24,
            border: "1px solid rgba(192,132,252,0.22)",
            background: "linear-gradient(180deg, rgba(192,132,252,0.06), rgba(192,132,252,0.02))",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(192,132,252,0.75)",
              marginBottom: 14,
            }}
          >
            join the waitlist
          </div>
          <h2 className="landing-h2 landing-gradient-text" style={{ marginBottom: 14 }}>
            Be first to try Lens.
          </h2>
          <p className="landing-body" style={{ maxWidth: 480, margin: "0 auto 28px" }}>
            We will email when there is an early-access window or
            development-kit signup. No spam, no marketing pollution.
          </p>
          <div style={{ maxWidth: 460, margin: "0 auto" }}>
            <WaitlistForm
              product="lens"
              accent="#c084fc"
              cta="Join Lens waitlist"
              size="large"
            />
          </div>

          <div style={{ marginTop: 28, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/product"
              style={{
                fontSize: 12,
                color: "#71717a",
                textDecoration: "underline",
                textUnderlineOffset: 4,
              }}
            >
              See the full ecosystem →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

const chip = (): React.CSSProperties => ({
  padding: "5px 11px",
  borderRadius: 100,
  border: "1px solid rgba(192,132,252,0.18)",
  background: "rgba(192,132,252,0.05)",
});
