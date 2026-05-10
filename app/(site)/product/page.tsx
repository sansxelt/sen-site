"use client";

import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import { WhisperEarbud } from "@/components/3d/whisper-earbud";
import { LensObject } from "@/components/3d/lens-object";
import { LensCase } from "@/components/3d/lens-case";

const EASE = [0.16, 1, 0.3, 1] as const;

type Feature = {
  icon: string;
  label: string;
  desc: string;
  // Optional: when present, the feature card is clickable and expands
  // inline to show this longer copy + an optional image. Cards
  // without details remain static.
  details?: string;
  imageUrl?: string;
};

type ProductDef = {
  key: string;
  kicker: string;
  name: string;
  tagline: string;
  body: string;
  features: Feature[];
  cta: { href: string; label: string };
  poster: string;
  posterAlt: string;
  scene: React.ReactNode;
  // When present, render a real product PNG instead of the procedural
  // R3F scene. The page's CinematicAct equivalent will object-fit:
  // contain so the dark page background reads through transparency.
  imageUrl?: string;
  // "contain" (default) for transparent product PNGs — preserves
  // aspect, dark page bg shows through. "cover" for rectangular UI
  // screenshots that should fill the frame.
  imageFit?: "contain" | "cover";
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
      {
        icon: "◎", label: "Chat", desc: "Threads with full context, file references, memory pulls.",
        details: "Every thread carries the full context of your project: the files you have referenced, the facts memory has stored, the project you are working in. Drop a PDF, paste a screenshot, mention a URL. The model has access to all of it without you re-explaining.",
      },
      {
        icon: "◇", label: "Projects", desc: "Group work into focused workspaces with their own memory.",
        details: "Projects scope memory and context. The chat that lives in your Q3 launch project never bleeds into your side hustle project. Each project has its own files, its own goals, its own facts the AI remembers.",
      },
      {
        icon: "◈", label: "Memory", desc: "Preferences and facts persist; you don't re-explain yourself.",
        details: "Sansxel learns your name, your role, the tools you use, and the way you write. After a few sessions you stop introducing yourself. Memory is editable from the settings page; nothing is hidden, everything is reversible.",
      },
      {
        icon: "◬", label: "Research", desc: "Web search, citations, deep multi-step research jobs.",
        details: "Ask for a deep dive and the model spawns a research job: searches the web, reads sources, follows links, returns a structured answer with citations. Cancel any time. Saved to the project for future reference.",
      },
    ],
    cta: { href: "/workshop", label: "Open Workshop" },
    poster: "/landing/workshop-poster.svg",
    posterAlt: "Workshop UI",
    scene: null,
    imageUrl: "/landing/workshop-hero.png",
    imageFit: "cover",
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
      {
        icon: "◉", label: "Voice in", desc: "Sub-200ms transcription, on-device when available.",
        details: "Voice in uses on-device transcription on Mac and iPhone, falling back to cloud for older devices. Sub-200ms is target latency for the first word, end-to-end. Background noise suppression is automatic.",
      },
      {
        icon: "◐", label: "Voice out", desc: "Natural TTS, interruptable mid-sentence.",
        details: "When the model speaks back, you can interrupt mid-sentence. Talk over it; it stops, listens, picks up the new thread. The voice is consistent across sessions; pick from a small palette in settings.",
      },
      {
        icon: "◫", label: "Any device", desc: "AirPods, headphones, built-in mic, all supported now.",
        details: "Whisper runs through whatever you already wear. AirPods, Bose, Sony, wired earbuds, even the laptop's built-in mic. No special hardware required to start. Open Workshop, hold the voice key, talk.",
      },
      {
        icon: "◆", label: "Future hardware", desc: "Sansxel-built earbud designed around how the AI works.",
        details: "We are designing a dedicated Sansxel earbud (matte black aluminum, brushed steel accent ring) that lives in the Day Kit case alongside your Lens. Concept and R&D, no ship date yet. Joining the waitlist gets you the dev kit when one exists.",
      },
    ],
    cta: { href: "/whisper", label: "Explore Whisper" },
    poster: "/landing/whisper-poster.svg",
    posterAlt: "Whisper earbud with voice waveform",
    scene: <WhisperEarbud />,
    imageUrl: "/landing/whisper-hero.png",
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
      {
        icon: "◎", label: "Ambient", desc: "Captions, arrows, tiny answer snippets, always-on.",
        details: "Ambient mode is the default daily view. Captions for live speech in your environment. Subtle navigation arrows when you are walking somewhere. Small answer cards from Workshop when you ask. Nothing in the centre of your view; everything in the periphery.",
      },
      {
        icon: "▣", label: "Mainframe", desc: "Floating windows and dashboards in your field of view.",
        details: "Mainframe is for deep work. Floating windows you place around the room: chat thread on the left, file viewer on the right, code in the centre. Pinned panels stay where you put them. Designed for sit-down sessions, not walking around.",
      },
      {
        icon: "◌", label: "Minimal", desc: "Reduced UI, blink-controlled, battery-saving.",
        details: "Minimal pares Lens down to a single pinpoint indicator. Battery target: hours of additional uptime per pair. Summon the next answer with a deliberate double blink; everything else stays silent. For long days where you want presence, not interface.",
      },
      {
        icon: "◈", label: "Workshop", desc: "Heavy compute lives on your phone or PC, not the lens.",
        details: "Lens is the render and sensing layer; the heavy AI lives in Workshop on your phone or PC. That keeps the optic itself thin, cool, and battery-conscious. The phone or PC is the bridge; Lens shows the result.",
      },
    ],
    cta: { href: "/lens", label: "Join Lens waitlist" },
    poster: "/landing/lens-poster.svg",
    posterAlt: "Transparent contact lens",
    scene: <LensObject />,
    imageUrl: "/landing/lens-hero.png",
    accent: "#c084fc",
    cameraPosition: [0, 0.6, 5.5],
    cameraFov: 40,
  },
  {
    key: "lens-day-kit",
    kicker: "lens day kit · concept",
    name: "Lens Day Kit",
    tagline: "Lens, audio, one case.",
    body: "The Day Kit case holds both your Sansxel Lens pairs and the audio earbuds. Quick swap between Pair A and Pair B; one charges while the other runs. The earbuds sit alongside, charging when you set them down.",
    features: [
      {
        icon: "◇", label: "Two Lens", desc: "Pair A and Pair B, alternate through the day.",
        details: "The Day Kit ships with two Lens. Wear Pair A in the morning, swap to Pair B at the gym or before dinner; the first pair tops up while the second runs. Targeting a full day of usage when you alternate.",
      },
      {
        icon: "◐", label: "Audio earbuds", desc: "Whisper voice in / voice out, charging in the same case.",
        details: "The case has dedicated wells for the Sansxel audio earbuds alongside the contact lens slots. One piece of hardware to carry, two product lines charging in parallel.",
      },
      {
        icon: "▢", label: "Smart case", desc: "Tops up in minutes, status LED on the base.",
        details: "USB-C in, fast-charge in. A small status LED on the base shows charge level: green for full, amber for mid, red for low. Anodized matte black aluminum body with chamfered edges.",
      },
      {
        icon: "↻", label: "Hot swap", desc: "Pull one out, slot the other in, conversation continues.",
        details: "Pair A and Pair B share the same paired session. Pull one out, slot the other in; whatever the model was saying continues without re-handshake. The swap is instant from the wearer's perspective.",
      },
    ],
    cta: { href: "/lens#day-kit", label: "See the Day Kit" },
    poster: "/landing/lens-case-poster.svg",
    posterAlt: "Lens charging case",
    scene: <LensCase />,
    imageUrl: "/landing/case-hero.png",
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
      {
        icon: "✦", label: "Cross-tool", desc: "Notion, GitHub, Figma, Gmail, Stripe, more.",
        details: "Copilot acts across the tools you already pay for. First-party connectors for Notion, GitHub, Figma, Gmail, Stripe, Linear, Slack. New ones added monthly based on what users ask for in Discord.",
      },
      {
        icon: "✧", label: "Confirm-first", desc: "Reads first, asks before writing or sending.",
        details: "Copilot defaults to read-only. Any write action (sending an email, posting a message, deleting a row) prompts you for confirmation with a diff of what will change. Approve once or set a per-tool whitelist.",
      },
      {
        icon: "✺", label: "MCP", desc: "Connect any MCP server, your own tools and data.",
        details: "If a tool does not have a first-party connector, you can connect it via MCP (Model Context Protocol). Run an MCP server locally or self-hosted; Copilot picks up its tools the same way it uses ours.",
      },
      {
        icon: "✷", label: "Audited", desc: "Every action logged, replayable, undoable.",
        details: "Every Copilot action writes to an audit log: what tool, what input, what output, what time. Replayable from the audit page; most actions are undoable for 24 hours after they happen.",
      },
    ],
    cta: { href: "/copilot", label: "See Copilot" },
    poster: "/landing/ecosystem-orbit-poster.svg",
    posterAlt: "Copilot acting across tools",
    scene: null,
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
      {
        icon: "⚡", label: "API", desc: "OpenAI-compatible chat + tool use endpoints.",
        details: "The Sansxel API mirrors the OpenAI chat completions schema, plus tool use, streaming, and our own context fields. Drop-in replacement for openai-sdk in JavaScript and Python. Bearer-token auth, no special middleware needed.",
      },
      {
        icon: "⌗", label: "Keys + usage", desc: "Per-key limits, per-project usage, real-time tail.",
        details: "Generate per-project API keys from the console. Set per-key spend limits, request rate limits, expiry dates. The dashboard shows real-time usage per key, per project, per endpoint, with token-level cost breakdown.",
      },
      {
        icon: "⊕", label: "Webhooks", desc: "Per-project webhooks for events and completions.",
        details: "Subscribe to events: completion finished, tool call invoked, key used, project usage exceeded. Webhooks deliver to your endpoint with HMAC signatures and configurable retry policy.",
      },
      {
        icon: "✧", label: "MCP", desc: "First-class MCP server registry and runtime.",
        details: "Connect MCP servers to your project from the registry, or publish your own. The runtime handles auth, rate limiting, and tool discovery. Supported in both Workshop and via the API.",
      },
    ],
    cta: { href: "https://platform.sansxel.ai", label: "Open Platform" },
    poster: "/landing/ecosystem-poster.svg",
    posterAlt: "Sansxel platform connection diagram",
    scene: null,
    accent: "#fbbf24",
    cameraPosition: [0, 1.2, 5.5],
    cameraFov: 45,
  },
];

// Clickable expandable feature card. Click to reveal extended copy +
// optional image. Cards without `details` are static (no click target,
// no chevron). One card open at a time within a section is enforced by
// the parent ProductSection's openIdx state.
function FeatureCard({
  feature,
  accent,
  open,
  onToggle,
}: {
  feature: Feature;
  accent: string;
  open: boolean;
  onToggle: () => void;
}) {
  const expandable = Boolean(feature.details || feature.imageUrl);

  return (
    <div
      style={{
        borderRadius: 12,
        border: open
          ? `1px solid ${accent}55`
          : "1px solid rgba(255,255,255,0.06)",
        background: open
          ? `${accent}0c`
          : "rgba(255,255,255,0.02)",
        transition: "background 200ms, border-color 200ms",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={expandable ? onToggle : undefined}
        disabled={!expandable}
        style={{
          all: "unset",
          width: "100%",
          padding: "12px 14px",
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          cursor: expandable ? "pointer" : "default",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: `${accent}12`,
            border: `1px solid ${accent}26`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            color: `${accent}cc`,
            flexShrink: 0,
          }}
        >
          {feature.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: "#e4e4e7", marginBottom: 2 }}>
            {feature.label}
          </div>
          <div style={{ fontSize: 11.5, color: "#71717a", lineHeight: 1.45 }}>
            {feature.desc}
          </div>
        </div>
        {expandable && (
          <span
            aria-hidden
            style={{
              fontSize: 11,
              color: open ? accent : "rgba(255,255,255,0.35)",
              flexShrink: 0,
              marginTop: 4,
              transition: "transform 220ms, color 200ms",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              display: "inline-block",
            }}
          >
            ▾
          </span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && expandable && (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "0 14px 14px 50px" }}>
              {feature.imageUrl && (
                <img
                  src={feature.imageUrl}
                  alt={feature.label}
                  style={{
                    width: "100%",
                    maxWidth: 480,
                    aspectRatio: "16 / 9",
                    objectFit: "cover",
                    borderRadius: 10,
                    marginBottom: 12,
                    border: `1px solid ${accent}1a`,
                    background: "rgba(0,0,0,0.30)",
                  }}
                />
              )}
              {feature.details && (
                <p style={{ fontSize: 12.5, color: "#a1a1aa", lineHeight: 1.6, margin: 0 }}>
                  {feature.details}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProductSection({ product, reverse }: { product: ProductDef; reverse: boolean }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
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
        className={`product-row${reverse ? " reverse" : ""}${product.imageUrl ? "" : " product-row--solo"}`}
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
            {product.features.map((f, i) => (
              <FeatureCard
                key={f.label}
                feature={f}
                accent={product.accent}
                open={openIdx === i}
                onToggle={() => setOpenIdx(openIdx === i ? null : i)}
              />
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

        {product.imageUrl && (
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
            <img
              src={product.imageUrl}
              alt={product.posterAlt}
              style={{
                width: "100%",
                height: "100%",
                objectFit: product.imageFit ?? "contain",
                borderRadius: product.imageFit === "cover" ? 14 : 0,
                border: product.imageFit === "cover" ? "1px solid rgba(255,255,255,0.06)" : "none",
                display: "block",
              }}
            />
          </motion.div>
        )}
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
            Lens is the eye. Whisper is the voice. Workshop is the brain.
            Copilot acts. Platform builds. All on one persistent memory layer.
          </motion.p>
        </div>
      </section>

      {/* Render order: hardware first (Lens, Whisper, Day Kit),
          then platform / software surfaces (Workshop, Copilot,
          Platform). Lens leads because it is the flagship visual
          product. */}
      {(["lens", "whisper", "lens-day-kit", "workshop", "copilot", "platform"] as const)
        .map((key) => PRODUCTS.find((p) => p.key === key))
        .filter((p): p is ProductDef => Boolean(p))
        .map((p, i) => (
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
          /* Solo (no image): single column, copy centered with a
             reasonable max-width so it doesn't sprawl across the
             full 1500px container. */
          .product-row--solo {
            grid-template-columns: minmax(0, 720px) !important;
            justify-content: center !important;
          }
        }
      `}</style>
    </main>
  );
}
