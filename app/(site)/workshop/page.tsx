"use client";

import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { Lazy3DScene } from "@/components/3d/lazy-scene";
import { WorkshopBrain } from "@/components/3d/workshop-brain";

const EASE = [0.16, 1, 0.3, 1] as const;

const STAGES = [
  { name: "Thinking", body: "Reasoning across your context, projects, and memory.",         color: "#a8c4ff" },
  { name: "Seeing",   body: "Pulling in screenshots, files, and pasted material.",          color: "#22d3ee" },
  { name: "Acting",   body: "Calling tools, running searches, posting to integrations.",     color: "#60a5fa" },
  { name: "Remembering", body: "Writing the result back to persistent memory for next time.", color: "#c084fc" },
];

const FEATURES = [
  { icon: "◎", label: "Chat",         desc: "Conversations with full context. Threads remember everything." },
  { icon: "◇", label: "Projects",     desc: "Group threads, files, and memory into focused workspaces." },
  { icon: "◻", label: "Files",        desc: "PDFs, images, code, spreadsheets. Reference inside any thread." },
  { icon: "◈", label: "Memory",       desc: "Preferences, facts, past threads, available without re-explaining." },
  { icon: "◆", label: "Creation",     desc: "Inline image and visual generation. No separate tool, no export." },
  { icon: "◉", label: "Voice",        desc: "Low-latency voice in and out. Hands-free, always-on optional." },
  { icon: "⬡", label: "Integrations", desc: "Notion, GitHub, Figma, Gmail. Read, write, act from one surface." },
  { icon: "◬", label: "Research",     desc: "Web search, citations, deep multi-step research jobs." },
  { icon: "△", label: "MCP",          desc: "Connect any MCP server. Custom tools, your own data, your own actions." },
];

function StageRotator() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % STAGES.length), 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        marginBottom: 28,
      }}
    >
      {STAGES.map((s, idx) => {
        const active = i === idx;
        return (
          <div
            key={s.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              borderRadius: 12,
              border: `1px solid ${active ? `${s.color}50` : "rgba(255,255,255,0.06)"}`,
              background: active ? `${s.color}0d` : "transparent",
              transition: "background 250ms, border-color 250ms",
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: active ? s.color : "rgba(255,255,255,0.2)",
                boxShadow: active ? `0 0 12px ${s.color}` : undefined,
                transition: "box-shadow 250ms, background 250ms",
              }}
            />
            <div
              style={{
                fontSize: 13,
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                color: active ? s.color : "rgba(255,255,255,0.4)",
                width: 110,
                letterSpacing: "0.05em",
              }}
            >
              {String(idx + 1).padStart(2, "0")} · {s.name.toLowerCase()}
            </div>
            <div style={{ fontSize: 12, color: active ? "#cbd5e1" : "#52525b", lineHeight: 1.4 }}>
              {s.body}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function WorkshopPage() {
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
              "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(168,196,255,0.10) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 80% 30%, rgba(34,211,238,0.06) 0%, transparent 55%)",
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
                border: "1px solid rgba(168,196,255,0.3)",
                background: "rgba(168,196,255,0.07)",
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(168,196,255,0.9)",
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                marginBottom: 28,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a8c4ff", boxShadow: "0 0 10px #a8c4ff" }} />
              workshop · the brain
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
                background: "linear-gradient(180deg, #ffffff 0%, #cdd6f4 55%, #8aa4d4 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              The workspace<br/>that remembers.
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
              Workshop is the brain. Chat, projects, files, memory, creation,
              voice, integrations. Every action writes to one persistent context.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.45 }}
              style={{ display: "flex", flexWrap: "wrap", gap: 12 }}
            >
              <Link href="/chat" className="landing-cta-primary">
                Open Workshop
              </Link>
              <Link
                href="/whisper"
                className="landing-cta-ghost"
                style={{ textDecoration: "none" }}
              >
                See Whisper
                <span className="landing-cta-arrow" aria-hidden>↗</span>
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
              src="/landing/workshop-hero.png"
              alt="Workshop UI"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.06)",
                display: "block",
              }}
            />
          </motion.div>
        </motion.div>
      </section>

      {/* STAGES */}
      <section style={{ background: "#040406", padding: "clamp(80px, 12vh, 130px) clamp(20px, 5vw, 80px)" }}>
        <div className="landing-divider" />
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div style={{ maxWidth: 640, marginBottom: 40 }}>
            <div
              style={{
                fontSize: 11,
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(168,196,255,0.7)",
                marginBottom: 12,
              }}
            >
              the loop
            </div>
            <h2 className="landing-h2 landing-gradient-text" style={{ marginBottom: 14 }}>
              Thinking. Seeing. Acting.<br/>Remembering.
            </h2>
            <p className="landing-body">
              Workshop runs the same loop every interaction. The remembering
              step is what changes the next interaction. That is the difference
              between a chat tool and a workspace.
            </p>
          </div>
          <StageRotator />
        </div>
      </section>

      {/* FEATURES GRID */}
      <section style={{ background: "#050507", padding: "clamp(80px, 12vh, 120px) clamp(20px, 5vw, 80px)" }}>
        <div className="landing-divider" />
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ maxWidth: 640, marginBottom: 40 }}>
            <div
              style={{
                fontSize: 11,
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(168,196,255,0.7)",
                marginBottom: 12,
              }}
            >
              what's inside
            </div>
            <h2 className="landing-h2 landing-gradient-text" style={{ marginBottom: 14 }}>
              Everything in one surface.
            </h2>
          </div>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr" }} className="ws-features-grid">
            {FEATURES.map((f) => (
              <div
                key={f.label}
                style={{
                  padding: "20px 22px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: "rgba(255,255,255,0.02)",
                  display: "flex",
                  gap: 14,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "rgba(168,196,255,0.08)",
                    border: "1px solid rgba(168,196,255,0.18)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    color: "rgba(168,196,255,0.85)",
                    flexShrink: 0,
                  }}
                >
                  {f.icon}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#e4e4e7", marginBottom: 4 }}>{f.label}</div>
                  <div style={{ fontSize: 12.5, color: "#71717a", lineHeight: 1.55 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <style>{`
            @media (min-width: 700px)  { .ws-features-grid { grid-template-columns: repeat(2, 1fr) !important; } }
            @media (min-width: 1100px) { .ws-features-grid { grid-template-columns: repeat(3, 1fr) !important; } }
          `}</style>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: "#040406", padding: "100px clamp(20px, 5vw, 80px)" }}>
        <div className="landing-divider" />
        <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
          <h2 className="landing-h2 landing-gradient-text" style={{ marginBottom: 14 }}>
            Open the Workshop.
          </h2>
          <p className="landing-body" style={{ marginBottom: 28 }}>
            Free to start. No card required. Everything you need is already
            inside.
          </p>
          <Link
            href="/chat"
            className="landing-cta-primary"
            style={{ display: "inline-flex" }}
          >
            Open Workshop
          </Link>
        </div>
      </section>
    </main>
  );
}
