"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { CinematicAct } from "@/components/landing/cinematic-act";
import { WaitlistForm } from "@/components/landing/waitlist-form";

// Lens product page. Hero, architecture, modes, day kit, waitlist.
// All product visuals are real PNGs (lens-hero, case-hero) so the
// surface is consistent with /home and /product. Procedural macros +
// exploded view were dropped; they only made sense when the hero was
// procedural too and the captions called out detail the photo cannot
// show.

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
  const reduce = useReducedMotion();

  return (
    <main style={{ background: "#050507", overflowX: "hidden" }}>
      {/* Hardware. Lifestyle hero, full-bleed cover so the photo
          reads edge-to-edge. Crop biased so the lens-on-fingertip
          sits left and the text reads bottom-right. */}
      <CinematicAct
        accent="#c084fc"
        anchor="bottom-right"
        imageUrl="/landing/fingertip-hero.png"
        imageObjectPosition="35% 55%"
        poster="/landing/lens-poster.svg"
        posterAlt="Lens on a fingertip"
        headline={<>Lens.<br/>Concept and R&amp;D.</>}
        body={
          <>
            A transparent contact lens with three render modes, paired
            with Workshop on your phone or PC for compute. Medical-grade
            acrylic, an electronics ring you can almost see through, an
            iris reticle that sits over the pupil.
          </>
        }
      />

      {/* Architecture. Model wearing the lens, full-bleed cover. */}
      <CinematicAct
        accent="#a8c4ff"
        anchor="bottom-left"
        imageUrl="/landing/model-hero.png"
        imageObjectPosition="65% center"
        poster="/landing/lens-poster.svg"
        posterAlt="Model wearing the Lens"
        headline={<>Lens does not run heavy AI.<br/>Workshop does.</>}
        body={
          <>
            Compute lives on your phone or PC where there is power and
            thermal headroom. Lens renders the result. That keeps the
            optic itself thin, cool, and battery-conscious.
          </>
        }
      />

      <section
        style={{
          background: "#040406",
          padding: "clamp(64px, 10vh, 120px) clamp(20px, 5vw, 80px)",
        }}
      >
        <div style={{ maxWidth: 880, margin: "0 auto", textAlign: "center" }}>
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
              { name: "LENS",       color: "#c084fc", role: "render + sense" },
              { name: "PHONE / PC", color: "#a8c4ff", role: "compute + memory" },
              { name: "WORKSHOP",   color: "#22d3ee", role: "AI + context" },
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

      {/* Three modes */}
      <section
        style={{
          background: "#040406",
          padding: "clamp(80px, 12vh, 140px) clamp(20px, 5vw, 80px)",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ maxWidth: 640, marginBottom: 56 }}>
            <h2 className="cinematic-display cinematic-display--gradient" style={{ marginBottom: 18 }}>
              Three render modes.
            </h2>
            <p className="cinematic-body" style={{ maxWidth: 540 }}>
              Lens shifts between three render modes throughout your day.
              Ambient for context, Mainframe for deep work, Minimal for
              battery and focus.
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

      {/* Day Kit */}
      <CinematicAct
        accent="#c084fc"
        anchor="bottom-left"
        imageUrl="/landing/case-hero.png"
        transparent
        poster="/landing/lens-case-poster.svg"
        posterAlt="Lens charging case"
        headline={<>Lens, audio,<br/>one case.</>}
        body={
          <>
            The case holds both your Sansxel Lens pairs and the audio
            earbuds in one piece of hardware. Quick swap between Pair A
            and Pair B; one charges while the other runs. The earbuds
            sit alongside, charging when you set them down.
          </>
        }
        cta={{ href: "#waitlist", label: "Join the waitlist" }}
        meta={
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[
              { label: "Pair A · Lens",  color: "#22d3ee", desc: "morning + afternoon" },
              { label: "Pair B · Lens",  color: "#c084fc", desc: "evening + travel" },
              { label: "Audio · earbuds", color: "#60a5fa", desc: "voice in, voice out" },
            ].map((p) => (
              <div
                key={p.label}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(0,0,0,0.30)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  minWidth: 180,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, boxShadow: `0 0 10px ${p.color}` }} />
                  <div
                    style={{
                      fontSize: 11,
                      fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                      color: "rgba(255,255,255,0.62)",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {p.label}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#a1a1aa", lineHeight: 1.4 }}>
                  {p.desc}
                </div>
              </div>
            ))}
          </div>
        }
      />

      {/* Waitlist outro */}
      <section
        id="waitlist"
        style={{
          background: "#040406",
          padding: "clamp(100px, 16vh, 200px) clamp(20px, 5vw, 80px)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse 50% 40% at 50% 50%, rgba(192,132,252,0.06) 0%, transparent 60%)",
            pointerEvents: "none",
          }}
        />
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: EASE }}
          style={{
            position: "relative",
            maxWidth: 720,
            margin: "0 auto",
            textAlign: "center",
            padding: "56px 32px",
            borderRadius: 24,
            border: "1px solid rgba(192,132,252,0.22)",
            background: "linear-gradient(180deg, rgba(192,132,252,0.06), rgba(192,132,252,0.02))",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          <h2 className="cinematic-display cinematic-display--gradient" style={{ marginBottom: 16 }}>
            Be first to try Lens.
          </h2>
          <p className="cinematic-body" style={{ maxWidth: 480, margin: "0 auto 32px" }}>
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

          <div style={{ marginTop: 32 }}>
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
        </motion.div>
      </section>
    </main>
  );
}
