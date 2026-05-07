"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { Lazy3DScene } from "@/components/3d/lazy-scene";
import { WorkshopBrain } from "@/components/3d/workshop-brain";
import { WhisperEarbud } from "@/components/3d/whisper-earbud";
import { LensObject } from "@/components/3d/lens-object";
import { LensCase } from "@/components/3d/lens-case";
import { EcosystemConnection } from "@/components/3d/ecosystem-connection";

const EASE = [0.16, 1, 0.3, 1] as const;

// Wrapping container for any of the cinematic product sections.
// Symmetric two-column on desktop with the 3D scene on alternating
// sides, single column stacked on mobile. Scroll-driven parallax
// keeps each section feeling like its own scene.

type SectionProps = {
  kicker: string;
  title: ReactNode;
  body: ReactNode;
  cta?: { href: string; label: string };
  scene: ReactNode;
  poster: string;
  posterAlt: string;
  reverse?: boolean;
  bg?: string;
  accent?: string;
  cameraPosition?: [number, number, number];
  cameraFov?: number;
  children?: ReactNode;
};

function CinematicSection({
  kicker,
  title,
  body,
  cta,
  scene,
  poster,
  posterAlt,
  reverse,
  bg = "transparent",
  accent = "#a8c4ff",
  cameraPosition = [0, 0, 6],
  cameraFov = 45,
  children,
}: SectionProps) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const sceneY = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const copyY  = useTransform(scrollYProgress, [0, 1], [40, -40]);

  return (
    <section
      ref={ref}
      style={{
        position: "relative",
        padding: "clamp(80px, 12vh, 160px) clamp(20px, 5vw, 80px)",
        background: bg,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 60% 50% at ${reverse ? "20%" : "80%"} 40%, ${accent}14 0%, transparent 55%)`,
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
          gap: 40,
          alignItems: "center",
        }}
        className={reverse ? "cinematic-row reverse" : "cinematic-row"}
      >
        <motion.div style={reduce ? {} : { y: copyY }} className="cinematic-copy">
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
              border: `1px solid ${accent}33`,
              background: `${accent}0d`,
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: `${accent}cc`,
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              marginBottom: 22,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: accent,
                boxShadow: `0 0 8px ${accent}`,
              }}
            />
            {kicker}
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.05 }}
            style={{
              fontSize: "clamp(2rem, 4.5vw, 3.6rem)",
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
              marginBottom: 22,
              background:
                "linear-gradient(180deg, #ffffff 0%, #cdd6f4 60%, #8aa4d4 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {title}
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
            style={{
              fontSize: "clamp(1rem, 1.4vw, 1.18rem)",
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.62)",
              maxWidth: 520,
              marginBottom: 28,
              letterSpacing: "-0.005em",
            }}
          >
            {body}
          </motion.div>

          {children}

          {cta && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.3 }}
              style={{ marginTop: 18 }}
            >
              <Link
                href={cta.href}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "11px 20px",
                  borderRadius: 100,
                  border: `1px solid ${accent}40`,
                  background: `${accent}10`,
                  color: accent,
                  fontSize: 14,
                  fontWeight: 500,
                  textDecoration: "none",
                  transition: "background 200ms",
                }}
              >
                {cta.label}
                <span aria-hidden style={{ fontSize: 13 }}>→</span>
              </Link>
            </motion.div>
          )}
        </motion.div>

        <motion.div
          style={{
            position: "relative",
            aspectRatio: "1 / 1",
            maxWidth: 600,
            justifySelf: "center",
            width: "100%",
            ...(reduce ? {} : { y: sceneY }),
          }}
          className="cinematic-stage"
        >
          <Lazy3DScene
            poster={poster}
            alt={posterAlt}
            cameraPosition={cameraPosition}
            cameraFov={cameraFov}
            style={{ width: "100%", height: "100%" }}
          >
            {scene}
          </Lazy3DScene>
        </motion.div>
      </div>

      <style>{`
        @media (min-width: 980px) {
          .cinematic-row {
            grid-template-columns: 1fr 1fr !important;
            gap: 80px !important;
          }
          .cinematic-row.reverse .cinematic-copy { order: 2; }
          .cinematic-row.reverse .cinematic-stage { order: 1; }
        }
      `}</style>
    </section>
  );
}

const STAGES = ["Thinking", "Seeing", "Acting", "Remembering"];

export function CinematicWorkshopSection() {
  return (
    <CinematicSection
      kicker="workshop · the brain"
      title={<>The workspace that holds<br/>your context.</>}
      body={
        <>
          Chat, projects, files, memory, voice. Every action writes to
          one persistent context layer, so the next prompt picks up
          where the last one left off.
        </>
      }
      cta={{ href: "/workshop", label: "Open Workshop" }}
      poster="/landing/workshop-poster.svg"
      posterAlt="Workshop dashboard panels"
      accent="#a8c4ff"
      cameraPosition={[0, 0.4, 6.5]}
      cameraFov={42}
      scene={<WorkshopBrain />}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
        {STAGES.map((s, i) => (
          <span
            key={s}
            style={{
              padding: "5px 11px",
              borderRadius: 100,
              border: "1px solid rgba(168,196,255,0.18)",
              background: "rgba(168,196,255,0.05)",
              fontSize: 12,
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              color: "rgba(168,196,255,0.75)",
              letterSpacing: "0.05em",
            }}
          >
            {String(i + 1).padStart(2, "0")} · {s.toLowerCase()}
          </span>
        ))}
      </div>
    </CinematicSection>
  );
}

export function CinematicWhisperSection() {
  return (
    <CinematicSection
      reverse
      kicker="whisper · the voice"
      title={<>Speak. Listen.<br/>Stay heads-up.</>}
      body={
        <>
          Whisper is the speaking and hearing layer. Low-latency voice in
          and natural voice out. Works with your existing earbuds today;
          dedicated Sansxel hardware later.
        </>
      }
      cta={{ href: "/whisper", label: "Explore Whisper" }}
      poster="/landing/whisper-poster.svg"
      posterAlt="Whisper earbud with waveform"
      accent="#60a5fa"
      cameraPosition={[0, 0.4, 6.5]}
      cameraFov={42}
      scene={<WhisperEarbud />}
    />
  );
}

const LENS_MODES = [
  {
    name: "Ambient",
    body: "Captions, arrows, tiny answer snippets. Always-on context, never in the way.",
    accent: "#a8c4ff",
  },
  {
    name: "Mainframe",
    body: "Floating windows, dashboard, apps and widgets. Your full Workshop in your field of view.",
    accent: "#c084fc",
  },
  {
    name: "Minimal",
    body: "Reduced UI, blink-controlled. Battery-saving for long days.",
    accent: "#7ab5ff",
  },
];

export function CinematicLensSection() {
  return (
    <CinematicSection
      kicker="lens · the eye · concept"
      title={<>The visual interface<br/>direction.</>}
      body={
        <>
          Lens is our visual interface direction, currently in concept
          and R&amp;D. A transparent contact lens with three render modes,
          paired with Workshop on your phone or PC for compute.
        </>
      }
      cta={{ href: "/lens", label: "Join the Lens waitlist" }}
      poster="/landing/lens-poster.svg"
      posterAlt="Transparent contact lens with HUD"
      accent="#c084fc"
      cameraPosition={[0, 0.6, 5.5]}
      cameraFov={40}
      scene={<LensObject />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {LENS_MODES.map((m) => (
          <div
            key={m.name}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: m.accent,
                boxShadow: `0 0 10px ${m.accent}`,
                marginTop: 6,
                flexShrink: 0,
              }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#e4e4e7", marginBottom: 2 }}>
                {m.name} mode
              </div>
              <div style={{ fontSize: 12, color: "#71717a", lineHeight: 1.5 }}>
                {m.body}
              </div>
            </div>
          </div>
        ))}
      </div>
    </CinematicSection>
  );
}

export function CinematicLensCaseSection() {
  return (
    <CinematicSection
      reverse
      kicker="lens day kit · concept"
      title={<>Two pairs.<br/>One smart case.</>}
      body={
        <>
          The Day Kit pairs two Lens with a smart charging case. Quick swap
          between Pair A and Pair B; one charges while the other runs.
          Targeting a full day of usage when you alternate.
        </>
      }
      cta={{ href: "/lens#day-kit", label: "See the Day Kit" }}
      poster="/landing/lens-case-poster.svg"
      posterAlt="Lens charging case opening"
      accent="#c084fc"
      cameraPosition={[2.2, 1.6, 4]}
      cameraFov={38}
      scene={<LensCase />}
    >
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        {[
          { label: "Pair A", color: "#22d3ee" },
          { label: "Pair B", color: "#c084fc" },
        ].map((p) => (
          <div
            key={p.label}
            style={{
              flex: 1,
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.025)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: p.color,
                  boxShadow: `0 0 10px ${p.color}`,
                }}
              />
              <div style={{ fontSize: 12, fontFamily: "var(--font-geist-mono), ui-monospace, monospace", color: "rgba(255,255,255,0.55)", letterSpacing: "0.05em" }}>
                {p.label}
              </div>
            </div>
            <div style={{ fontSize: 11, color: "#71717a", lineHeight: 1.5 }}>
              swap when low.<br/>case tops it back up.
            </div>
          </div>
        ))}
      </div>
    </CinematicSection>
  );
}

export function CinematicEcosystemSection() {
  return (
    <CinematicSection
      kicker="one system"
      title={<>All of it,<br/>one memory.</>}
      body={
        <>
          Every surface writes to and reads from one persistent context.
          What you said to Whisper this morning is in Workshop tonight,
          on Lens tomorrow.
        </>
      }
      cta={{ href: "/product", label: "See the architecture" }}
      poster="/landing/ecosystem-poster.svg"
      posterAlt="Sansxel ecosystem connection diagram"
      accent="#a8c4ff"
      cameraPosition={[0, 1.2, 5.5]}
      cameraFov={45}
      scene={<EcosystemConnection />}
    />
  );
}
