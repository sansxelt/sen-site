"use client";

import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { WaitlistForm } from "@/components/landing/waitlist-form";

const EASE = [0.16, 1, 0.3, 1] as const;

const TODAY_DEVICES = [
  { name: "AirPods",           desc: "Full voice mode via AirPods and AirPods Pro." },
  { name: "Headphones",        desc: "Any over-ear or on-ear headphones with mic." },
  { name: "Bluetooth earbuds", desc: "Sony, Bose, Pixel Buds, any wireless brand." },
  { name: "Wired audio",       desc: "3.5mm and USB. If it has a mic, it works." },
  { name: "Built-in mic",      desc: "Laptop or phone mic, no extra hardware." },
];

const FLOW = [
  { step: "01", label: "You speak", body: "Sub-200ms transcription, on-device when available." },
  { step: "02", label: "Workshop thinks", body: "Pulls your context, projects, files, memory." },
  { step: "03", label: "Whisper answers", body: "Natural voice out, interruptable, fast." },
];

const DETAILS = [
  {
    kicker: "driver",
    title: "Glass dome driver",
    body: "Anti-reflective transmission glass over a 12-perforation precision grille. Sized to seal at the ear canal without active noise pressure.",
    accent: "#60a5fa",
    specs: [
      { label: "DRIVER", value: "10 mm dynamic" },
      { label: "DOME",   value: "Glass IOR 1.45" },
      { label: "GRILLE", value: "12-hole CNC" },
      { label: "FREQ",   value: "20 Hz – 22 kHz" },
    ],
  },
  {
    kicker: "stem",
    title: "Capacitive touch + mic vents",
    body: "Hairline brushed band on the stem reads taps without raising surface texture. Three milled mic holes at the base sample your voice, not the room.",
    accent: "#22d3ee",
    specs: [
      { label: "STEM",   value: "Aluminum 6063" },
      { label: "FINISH", value: "Anodized matte" },
      { label: "TOUCH",  value: "Capacitive band" },
      { label: "MICS",   value: "3 × beamforming" },
    ],
  },
  {
    kicker: "grille",
    title: "Hex-pattern speaker mesh",
    body: "Thirty-five precision-cut perforations arranged in three concentric rings. Each hole is sized for a specific frequency band so the driver fires evenly across the spectrum.",
    accent: "#a8c4ff",
    specs: [
      { label: "PERFS",  value: "35 holes" },
      { label: "RINGS",  value: "4 concentric" },
      { label: "BEZEL",  value: "Stainless 316L" },
      { label: "TIP",    value: "Soft silicone" },
    ],
  },
];

export default function WhisperPage() {
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
              "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(96,165,250,0.12) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 20% 80%, rgba(168,196,255,0.07) 0%, transparent 55%)",
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
                border: "1px solid rgba(96,165,250,0.3)",
                background: "rgba(96,165,250,0.07)",
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(96,165,250,0.9)",
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                marginBottom: 28,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#60a5fa", boxShadow: "0 0 10px #60a5fa" }} />
              whisper · the voice
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, ease: EASE, delay: 0.18 }}
              style={{
                fontSize: "clamp(2.6rem, 7vw, 5.6rem)",
                fontWeight: 600,
                lineHeight: 0.95,
                letterSpacing: "-0.035em",
                marginBottom: 24,
                background:
                  "linear-gradient(180deg, #ffffff 0%, #cdd6f4 55%, #6088c4 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Speak. Listen.<br/>Stay heads-up.
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
              Whisper is the speaking and hearing layer of VRAELIS. Low-latency
              voice in, natural voice out. Works with your existing earbuds
              today. Dedicated hardware later.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.45 }}
              style={{ display: "flex", flexWrap: "wrap", gap: 12 }}
            >
              <Link href="/app" className="landing-cta-primary">
                Try voice in Workshop
              </Link>
              <Link
                href="#hardware"
                className="landing-cta-ghost"
                style={{ textDecoration: "none" }}
              >
                See the hardware roadmap
                <span className="landing-cta-arrow" aria-hidden>↓</span>
              </Link>
            </motion.div>
          </div>

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
            <img
              src="/landing/whisper-hero.png"
              alt="Whisper earbud"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
              }}
            />
          </motion.div>
        </motion.div>
      </section>

      {/* FLOW */}
      <section style={{ background: "#040406", padding: "clamp(80px, 12vh, 120px) clamp(20px, 5vw, 80px)" }}>
        <div className="landing-divider" />
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ maxWidth: 640, marginBottom: 48 }}>
            <div
              style={{
                fontSize: 11,
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(96,165,250,0.7)",
                marginBottom: 12,
              }}
            >
              the flow
            </div>
            <h2 className="landing-h2 landing-gradient-text" style={{ marginBottom: 14 }}>
              Sub-second from voice to answer.
            </h2>
            <p className="landing-body">
              Whisper rides on Workshop. You speak, your context loads, the model
              responds, and Whisper speaks the answer back. All live, no batching.
            </p>
          </div>

          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr" }} className="whisper-flow-grid">
            {FLOW.map((s) => (
              <div
                key={s.step}
                style={{
                  padding: "26px 24px",
                  borderRadius: 16,
                  border: "1px solid rgba(96,165,250,0.18)",
                  background: "linear-gradient(180deg, rgba(96,165,250,0.05), transparent 80%)",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                    letterSpacing: "0.16em",
                    color: "rgba(96,165,250,0.65)",
                    marginBottom: 10,
                  }}
                >
                  {s.step}
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "#f5f5f7", marginBottom: 8 }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 13, color: "#a1a1aa", lineHeight: 1.5 }}>
                  {s.body}
                </div>
              </div>
            ))}
          </div>
          <style>{`
            @media (min-width: 900px) { .whisper-flow-grid { grid-template-columns: repeat(3, 1fr) !important; } }
          `}</style>
        </div>
      </section>

      {/* DETAILS — three spec callouts, no procedural 3D. The earlier
          ProductMacro versions paired each block with a synthetic
          earbud render that read as placeholder; spec cards alone
          carry the same engineering story without that smell. */}
      <section style={{ background: "#040406", padding: "clamp(80px, 12vh, 120px) clamp(20px, 5vw, 80px)" }}>
        <div className="landing-divider" />
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ maxWidth: 640, marginBottom: 48 }}>
            <div
              style={{
                fontSize: 11,
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(96,165,250,0.7)",
                marginBottom: 12,
              }}
            >
              the details
            </div>
            <h2 className="landing-h2 landing-gradient-text" style={{ marginBottom: 14 }}>
              Built around the parts that matter.
            </h2>
            <p className="landing-body">
              Driver, stem, and grille — the three places where audio
              fidelity is won or lost. Each spec is chosen to make
              voice clear and sustained over hours of use.
            </p>
          </div>

          <div style={{ display: "grid", gap: 18, gridTemplateColumns: "1fr" }} className="whisper-detail-grid">
            {DETAILS.map((d) => (
              <div
                key={d.kicker}
                style={{
                  padding: "28px 26px",
                  borderRadius: 18,
                  border: `1px solid ${d.accent}28`,
                  background: `linear-gradient(180deg, ${d.accent}08, transparent 80%)`,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 10.5,
                    fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: d.accent,
                    marginBottom: 14,
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: d.accent, boxShadow: `0 0 8px ${d.accent}` }} />
                  detail · {d.kicker}
                </div>
                <h3
                  style={{
                    fontSize: 22,
                    fontWeight: 600,
                    color: "#f5f5f7",
                    letterSpacing: "-0.02em",
                    marginBottom: 12,
                    lineHeight: 1.15,
                  }}
                >
                  {d.title}
                </h3>
                <p style={{ fontSize: 13.5, color: "#a1a1aa", lineHeight: 1.55, marginBottom: 22 }}>
                  {d.body}
                </p>
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr", marginTop: "auto" }}>
                  {d.specs.map((s) => (
                    <div
                      key={s.label}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.06)",
                        background: "rgba(0,0,0,0.30)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9.5,
                          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                          letterSpacing: "0.14em",
                          color: "rgba(255,255,255,0.40)",
                          marginBottom: 3,
                        }}
                      >
                        {s.label}
                      </div>
                      <div
                        style={{
                          fontSize: 12.5,
                          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                          color: d.accent,
                          letterSpacing: "-0.005em",
                        }}
                      >
                        {s.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <style>{`
            @media (min-width: 980px) { .whisper-detail-grid { grid-template-columns: repeat(3, 1fr) !important; } }
          `}</style>
        </div>
      </section>

      {/* TODAY: works with what you own */}
      <section style={{ background: "#050507", padding: "clamp(80px, 12vh, 120px) clamp(20px, 5vw, 80px)" }}>
        <div className="landing-divider" />
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ maxWidth: 640, marginBottom: 40 }}>
            <div
              style={{
                fontSize: 11,
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(34,211,238,0.7)",
                marginBottom: 12,
              }}
            >
              today · works with your devices
            </div>
            <h2 className="landing-h2 landing-gradient-text" style={{ marginBottom: 14 }}>
              No new hardware required.
            </h2>
            <p className="landing-body">
              Whisper rides on whatever you already wear. Open Workshop, hold
              the voice key or tap the microphone, and start talking.
            </p>
          </div>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(1, 1fr)" }} className="whisper-devices-grid">
            {TODAY_DEVICES.map((d) => (
              <div
                key={d.name}
                style={{
                  padding: "16px 18px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.07)",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 500, color: "#e4e4e7", marginBottom: 4 }}>
                  {d.name}
                </div>
                <div style={{ fontSize: 12, color: "#71717a", lineHeight: 1.5 }}>
                  {d.desc}
                </div>
              </div>
            ))}
          </div>
          <style>{`
            @media (min-width: 700px) { .whisper-devices-grid { grid-template-columns: repeat(2, 1fr) !important; } }
            @media (min-width: 1000px) { .whisper-devices-grid { grid-template-columns: repeat(3, 1fr) !important; } }
          `}</style>
        </div>
      </section>

      {/* HARDWARE FUTURE */}
      <section
        id="hardware"
        style={{ background: "#040406", padding: "clamp(80px, 12vh, 140px) clamp(20px, 5vw, 80px)" }}
      >
        <div className="landing-divider" />
        <div style={{ maxWidth: 880, margin: "0 auto", textAlign: "center" }}>
          <div
            style={{
              fontSize: 11,
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(96,165,250,0.7)",
              marginBottom: 14,
            }}
          >
            future · VRAELIS hardware
          </div>
          <h2 className="landing-h2 landing-gradient-text" style={{ marginBottom: 18 }}>
            Whisper hardware,<br/>built for the system.
          </h2>
          <p className="landing-body" style={{ maxWidth: 540, margin: "0 auto 32px" }}>
            A dedicated Whisper earbud designed around how VRAELIS actually
            works. Lower latency, better wake detection, longer battery for
            voice-first use.
          </p>

          <div style={{ maxWidth: 460, margin: "0 auto" }}>
            <WaitlistForm
              product="whisper"
              accent="#60a5fa"
              cta="Join Whisper waitlist"
              size="large"
            />
          </div>
        </div>
      </section>
    </main>
  );
}
