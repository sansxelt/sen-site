"use client";

import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Lazy3DScene } from "@/components/landing/three/lazy-scene";
import { EcosystemOrbit } from "@/components/landing/three/ecosystem-orbit";
import { WorkshopBrain } from "@/components/landing/three/workshop-brain";
import { WhisperEarbud } from "@/components/landing/three/whisper-earbud";
import { LensObject } from "@/components/landing/three/lens-object";
import { LensCase } from "@/components/landing/three/lens-case";
import { EcosystemConnection } from "@/components/landing/three/ecosystem-connection";

const EASE = [0.16, 1, 0.3, 1] as const;

type ProductDef = {
  key: string;
  kicker: string;
  name: string;
  tagline: string;
  body: string;
  features: { icon: string; label: string; desc: string }[];
  cta: { href: string; label: string };
  poster: string;
  posterAlt: string;
  scene: React.ReactNode;
  accent: string;
  cameraPosition?: [number, number, number];
  cameraFov?: number;
};

const PRODUCTS: ProductDef[] = [
  {
    key: "workshop",
    kicker: "the brain",
    name: "Workshop",
    tagline: "The AI workspace.",
    body: "Chat, projects, files, memory, voice, creation, integrations. Workshop is where the work actually happens, with persistent context across every session.",
    features: [
      { icon: "◎", label: "Chat",       desc: "Threads with full context, file references, memory pulls." },
      { icon: "◇", label: "Projects",   desc: "Group work into focused workspaces with their own memory." },
      { icon: "◈", label: "Memory",     desc: "Preferences and facts persist; you don't re-explain yourself." },
      { icon: "◬", label: "Research",   desc: "Web search, citations, deep multi-step research jobs." },
    ],
    cta: { href: "/workshop", label: "Open Workshop" },
    poster: "/landing/workshop-poster.svg",
    posterAlt: "Workshop dashboard panels",
    scene: <WorkshopBrain />,
    accent: "#a8c4ff",
    cameraPosition: [0, 0.4, 6.5],
    cameraFov: 42,
  },
  {
    key: "whisper",
    kicker: "the voice",
    name: "Whisper",
    tagline: "Speak. Listen. Stay heads-up.",
    body: "Voice in and voice out, low latency, interruptable. Works with your existing earbuds today; dedicated Sansxel hardware later.",
    features: [
      { icon: "◉", label: "Voice in",      desc: "Sub-200ms transcription, on-device when available." },
      { icon: "◐", label: "Voice out",     desc: "Natural TTS, interruptable mid-sentence." },
      { icon: "◫", label: "Any device",    desc: "AirPods, headphones, built-in mic, all supported now." },
      { icon: "◆", label: "Future hardware", desc: "Sansxel-built earbud designed around how the AI works." },
    ],
    cta: { href: "/whisper", label: "Explore Whisper" },
    poster: "/landing/whisper-poster.svg",
    posterAlt: "Whisper earbud with voice waveform",
    scene: <WhisperEarbud />,
    accent: "#60a5fa",
    cameraPosition: [0, 0.4, 6.5],
    cameraFov: 42,
  },
  {
    key: "lens",
    kicker: "the eye · concept",
    name: "Lens",
    tagline: "The visual interface direction.",
    body: "A transparent contact lens with three render modes (Ambient, Mainframe, Minimal), paired with Workshop on your phone or PC for compute. Currently in concept and R&D.",
    features: [
      { icon: "◎", label: "Ambient",   desc: "Captions, arrows, tiny answer snippets, always-on." },
      { icon: "▣", label: "Mainframe", desc: "Floating windows and dashboards in your field of view." },
      { icon: "◌", label: "Minimal",   desc: "Reduced UI, blink-controlled, battery-saving." },
      { icon: "◈", label: "Workshop",  desc: "Heavy compute lives on your phone or PC, not the lens." },
    ],
    cta: { href: "/lens", label: "Join Lens waitlist" },
    poster: "/landing/lens-poster.svg",
    posterAlt: "Transparent contact lens",
    scene: <LensObject />,
    accent: "#c084fc",
    cameraPosition: [0, 0.6, 5.5],
    cameraFov: 40,
  },
  {
    key: "lens-day-kit",
    kicker: "lens day kit · concept",
    name: "Lens Day Kit",
    tagline: "Two pairs. One smart case.",
    body: "Two Lens with a smart charging case for all-day usage. Quick swap between Pair A and Pair B; one charges while the other runs.",
    features: [
      { icon: "◇", label: "Pair A + B",   desc: "Swap pairs without taking off your day." },
      { icon: "▢", label: "Smart case",   desc: "Tops up in minutes, status LED on the base." },
      { icon: "◔", label: "Day target",   desc: "All-day usage when you alternate pairs." },
      { icon: "↻", label: "Hot swap",     desc: "Pull one out, slot the other in, conversation continues." },
    ],
    cta: { href: "/lens#day-kit", label: "See the Day Kit" },
    poster: "/landing/lens-case-poster.svg",
    posterAlt: "Lens charging case",
    scene: <LensCase />,
    accent: "#c084fc",
    cameraPosition: [2.2, 1.6, 4],
    cameraFov: 38,
  },
  {
    key: "copilot",
    kicker: "actions",
    name: "Copilot",
    tagline: "The AI that takes action.",
    body: "Copilot acts across your tools. Compose, schedule, post, refactor, analyze. From Workshop, with your context, on your behalf.",
    features: [
      { icon: "✦", label: "Cross-tool",   desc: "Notion, GitHub, Figma, Gmail, Stripe, more." },
      { icon: "✧", label: "Confirm-first", desc: "Reads first, asks before writing or sending." },
      { icon: "✺", label: "MCP",          desc: "Connect any MCP server, your own tools and data." },
      { icon: "✷", label: "Audited",      desc: "Every action logged, replayable, undoable." },
    ],
    cta: { href: "/copilot", label: "See Copilot" },
    poster: "/landing/ecosystem-orbit-poster.svg",
    posterAlt: "Copilot acting across tools",
    scene: <EcosystemOrbit />,
    accent: "#22d3ee",
    cameraPosition: [0, 0.5, 7.5],
    cameraFov: 42,
  },
  {
    key: "platform",
    kicker: "developers",
    name: "Platform",
    tagline: "API, SDKs, console.",
    body: "Build with Sansxel. API keys, request inspector, usage dashboard, webhooks, SDKs, MCP connections.",
    features: [
      { icon: "⚡", label: "API",          desc: "OpenAI-compatible chat + tool use endpoints." },
      { icon: "⌗", label: "Keys + usage", desc: "Per-key limits, per-project usage, real-time tail." },
      { icon: "⊕", label: "Webhooks",     desc: "Per-project webhooks for events and completions." },
      { icon: "✧", label: "MCP",          desc: "First-class MCP server registry and runtime." },
    ],
    cta: { href: "https://platform.sansxel.ai", label: "Open Platform" },
    poster: "/landing/ecosystem-poster.svg",
    posterAlt: "Sansxel platform connection diagram",
    scene: <EcosystemConnection />,
    accent: "#fbbf24",
    cameraPosition: [0, 1.2, 5.5],
    cameraFov: 45,
  },
];

function ProductSection({ product, reverse }: { product: ProductDef; reverse: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const sceneY = useTransform(scrollYProgress, [0, 1], [60, -60]);

  return (
    <section
      ref={ref}
      style={{
        position: "relative",
        padding: "clamp(80px, 12vh, 140px) clamp(20px, 5vw, 80px)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 60% 50% at ${reverse ? "20%" : "80%"} 50%, ${product.accent}14 0%, transparent 55%)`,
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
          gap: 56,
          alignItems: "center",
        }}
        className={reverse ? "product-row reverse" : "product-row"}
      >
        <div className="product-copy">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, ease: EASE }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 11px",
              borderRadius: 100,
              border: `1px solid ${product.accent}33`,
              background: `${product.accent}0d`,
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: `${product.accent}cc`,
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              marginBottom: 18,
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: product.accent, boxShadow: `0 0 8px ${product.accent}` }} />
            {product.kicker}
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.05 }}
            style={{
              fontSize: "clamp(2rem, 4.5vw, 3.4rem)",
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
              marginBottom: 8,
              color: "#f5f5f7",
            }}
          >
            {product.name}
          </motion.h2>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
            style={{
              fontSize: "clamp(1.1rem, 1.5vw, 1.4rem)",
              color: product.accent,
              marginBottom: 18,
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
          >
            {product.tagline}
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}
            style={{
              fontSize: 15,
              color: "rgba(255,255,255,0.6)",
              lineHeight: 1.6,
              maxWidth: 520,
              marginBottom: 28,
            }}
          >
            {product.body}
          </motion.p>

          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr", marginBottom: 28 }}>
            {product.features.map((f) => (
              <div
                key={f.label}
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: "rgba(255,255,255,0.02)",
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    background: `${product.accent}12`,
                    border: `1px solid ${product.accent}26`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    color: `${product.accent}cc`,
                    flexShrink: 0,
                  }}
                >
                  {f.icon}
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: "#e4e4e7", marginBottom: 2 }}>{f.label}</div>
                  <div style={{ fontSize: 11.5, color: "#71717a", lineHeight: 1.45 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <Link
            href={product.cta.href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "11px 20px",
              borderRadius: 100,
              border: `1px solid ${product.accent}55`,
              background: `${product.accent}18`,
              color: product.accent,
              fontSize: 14,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            {product.cta.label}
            <span aria-hidden style={{ fontSize: 13 }}>→</span>
          </Link>
        </div>

        <motion.div
          style={{
            position: "relative",
            aspectRatio: "1 / 1",
            maxWidth: 560,
            justifySelf: "center",
            width: "100%",
            ...(reduce ? {} : { y: sceneY }),
          }}
          className="product-stage"
        >
          <Lazy3DScene
            poster={product.poster}
            alt={product.posterAlt}
            cameraPosition={product.cameraPosition || [0, 0, 6]}
            cameraFov={product.cameraFov || 45}
            style={{ width: "100%", height: "100%" }}
          >
            {product.scene}
          </Lazy3DScene>
        </motion.div>
      </div>
    </section>
  );
}

export default function ProductPage() {
  return (
    <main style={{ background: "#050507", overflowX: "hidden" }}>
      {/* HERO */}
      <section style={{ position: "relative", padding: "clamp(80px, 14vh, 160px) clamp(20px, 5vw, 80px) 60px" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 70% 50% at 50% 30%, rgba(168,196,255,0.10) 0%, transparent 55%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", maxWidth: 880, margin: "0 auto", textAlign: "center" }}>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
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
              marginBottom: 24,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a8c4ff", boxShadow: "0 0 10px #a8c4ff" }} />
            the system
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, ease: EASE, delay: 0.15 }}
            style={{
              fontSize: "clamp(2.4rem, 6.5vw, 4.8rem)",
              fontWeight: 600,
              lineHeight: 1.0,
              letterSpacing: "-0.035em",
              marginBottom: 22,
              background: "linear-gradient(180deg, #ffffff 0%, #cdd6f4 55%, #8aa4d4 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            One AI. Six surfaces.<br/>One memory.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.3 }}
            style={{ fontSize: "clamp(1rem, 1.5vw, 1.25rem)", color: "rgba(255,255,255,0.62)", maxWidth: 580, margin: "0 auto", lineHeight: 1.55 }}
          >
            Workshop is the brain. Whisper is the voice. Lens is the eye.
            Copilot acts. Platform builds. All on one persistent memory layer.
          </motion.p>
        </div>
      </section>

      {PRODUCTS.map((p, i) => (
        <ProductSection key={p.key} product={p} reverse={i % 2 === 1} />
      ))}

      <style>{`
        @media (min-width: 980px) {
          .product-row {
            grid-template-columns: 1fr 1fr !important;
            gap: 80px !important;
          }
          .product-row.reverse .product-copy { order: 2; }
          .product-row.reverse .product-stage { order: 1; }
        }
      `}</style>
    </main>
  );
}
