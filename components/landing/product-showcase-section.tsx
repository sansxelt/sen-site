"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useRef, useState } from "react";

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

/* ─── Tilt card wrapper ──────────────────────────────────────────── */

function TiltCard({ children, reduced }: { children: React.ReactNode; reduced: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  function onMove(e: React.MouseEvent) {
    if (reduced) return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setTilt({
      x: ((e.clientY - r.top)  / r.height - 0.5) * -9,
      y: ((e.clientX - r.left) / r.width  - 0.5) *  9,
    });
  }

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      style={{ perspective: 900, height: "100%" }}
    >
      <div style={{
        transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transition: "transform 0.38s cubic-bezier(0.16,1,0.3,1)",
        transformStyle: "preserve-3d",
        height: "100%",
      }}>
        {children}
      </div>
    </div>
  );
}

/* ─── Lens 3D object ─────────────────────────────────────────────── */

function LensObject({ reduced }: { reduced: boolean }) {
  return (
    <div style={{ position: "relative", width: 168, height: 168, margin: "0 auto" }}>
      {/* Radial glow */}
      <div aria-hidden style={{ position: "absolute", inset: -30, borderRadius: "50%", background: "radial-gradient(circle, rgba(125,183,255,0.20) 0%, transparent 62%)" }} />

      {/* Outer rotating ring — conic gradient gives the "light sweep" feel */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        border: "1.5px solid transparent",
        background: "linear-gradient(#040406,#040406) padding-box, conic-gradient(rgba(125,183,255,0.75) 0deg, rgba(125,183,255,0.06) 130deg, rgba(125,183,255,0.03) 210deg, rgba(125,183,255,0.07) 280deg, rgba(125,183,255,0.75) 360deg) border-box",
        animation: reduced ? "none" : "lp-lens-spin 9s linear infinite",
      }} />

      {/* Counter-rotating inner ring */}
      <div aria-hidden style={{
        position: "absolute", inset: 20, borderRadius: "50%",
        border: "1px solid rgba(125,183,255,0.10)",
        borderTopColor: "rgba(125,183,255,0.35)",
        animation: reduced ? "none" : "lp-lens-spin 16s linear infinite reverse",
      }} />

      {/* Lens body — dark glass */}
      <div aria-hidden style={{
        position: "absolute", inset: 32, borderRadius: "50%",
        background: "radial-gradient(circle at 36% 30%, rgba(180,215,255,0.15) 0%, rgba(7,13,26,0.97) 48%, rgba(3,5,16,0.99) 100%)",
        border: "1px solid rgba(125,183,255,0.15)",
        boxShadow: "inset 0 0 22px rgba(125,183,255,0.07)",
      }} />

      {/* Inner depth ring */}
      <div aria-hidden style={{ position: "absolute", inset: 48, borderRadius: "50%", border: "1px solid rgba(125,183,255,0.07)" }} />

      {/* Crosshairs */}
      <div aria-hidden style={{ position: "absolute", top: "50%", left: 36, right: 36, height: 1, background: "rgba(125,183,255,0.12)", transform: "translateY(-0.5px)" }} />
      <div aria-hidden style={{ position: "absolute", left: "50%", top: 36, bottom: 36, width: 1, background: "rgba(125,183,255,0.12)", transform: "translateX(-0.5px)" }} />

      {/* Focal point */}
      <div aria-hidden style={{
        position: "absolute", top: "50%", left: "50%",
        width: 7, height: 7, borderRadius: "50%",
        background: "#7DB7FF",
        transform: "translate(-50%,-50%)",
        boxShadow: "0 0 12px rgba(125,183,255,0.80)",
      }} />

      {/* Animated scan line */}
      {!reduced && <div aria-hidden className="lp-scan-line" style={{
        position: "absolute", left: 36, right: 36, height: 1,
        background: "linear-gradient(90deg, transparent, rgba(125,183,255,0.70), transparent)",
      }} />}

      {/* Ground shadow */}
      <div aria-hidden style={{ position: "absolute", bottom: -18, left: "50%", width: 116, height: 14, transform: "translateX(-50%)", background: "radial-gradient(ellipse, rgba(125,183,255,0.13) 0%, transparent 70%)" }} />
    </div>
  );
}

/* ─── Audio 3D object ────────────────────────────────────────────── */

const W_ANIM = ["lp-aw1","lp-aw2","lp-aw3","lp-aw4","lp-aw5","lp-aw3","lp-aw1","lp-aw4","lp-aw2","lp-aw5","lp-aw3","lp-aw1"] as const;
const W_H    = [8, 16, 22, 14, 26, 18, 10, 24, 16, 8, 20, 14];

function AudioObject({ reduced }: { reduced: boolean }) {
  return (
    <div style={{ position: "relative", width: 168, height: 168, margin: "0 auto" }}>
      {/* Glow */}
      <div aria-hidden style={{ position: "absolute", inset: -30, borderRadius: "50%", background: "radial-gradient(circle, rgba(155,124,255,0.22) 0%, transparent 62%)" }} />

      {/* Pulse rings */}
      {!reduced && [0, 1, 2].map(i => (
        <div key={i} aria-hidden style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          border: "1px solid rgba(155,124,255,0.22)",
          animation: `lp-audio-ring 3s ease-out ${i * 1.0}s infinite`,
        }} />
      ))}

      {/* Capsule body */}
      <div aria-hidden style={{
        position: "absolute",
        top: "50%", left: "50%", transform: "translate(-50%, -62%)",
        width: 52, height: 80,
        borderRadius: 26,
        background: "linear-gradient(168deg, rgba(196,181,253,0.20) 0%, rgba(46,26,76,0.90) 35%, rgba(14,7,28,0.98) 100%)",
        border: "1px solid rgba(155,124,255,0.28)",
        boxShadow: "0 0 32px rgba(155,124,255,0.12), inset 0 1px 0 rgba(255,255,255,0.11)",
      }}>
        {/* Specular highlight */}
        <div aria-hidden style={{ position: "absolute", top: 9, left: 8, right: 8, height: 13, borderRadius: 10, background: "linear-gradient(180deg, rgba(255,255,255,0.13) 0%, transparent 100%)" }} />
        {/* Capsule center dot */}
        <div aria-hidden style={{ position: "absolute", top: "50%", left: "50%", width: 8, height: 8, borderRadius: "50%", background: "rgba(155,124,255,0.80)", transform: "translate(-50%,-50%)", boxShadow: "0 0 14px rgba(155,124,255,0.60)" }} />
        {/* Mesh lines on face */}
        <div aria-hidden style={{ position: "absolute", inset: 0, borderRadius: 26, background: "repeating-linear-gradient(0deg, rgba(155,124,255,0.06) 0px, rgba(155,124,255,0.06) 1px, transparent 1px, transparent 10px)", opacity: 0.5 }} />
      </div>

      {/* Waveform bars */}
      <div aria-hidden style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "flex-end", gap: 3 }}>
        {W_H.map((h, i) => (
          <div key={i} style={{
            width: 3,
            borderRadius: 2,
            background: "rgba(155,124,255,0.42)",
            height: reduced ? h : undefined,
            animation: reduced ? "none" : `${W_ANIM[i]} ${1.4 + (i % 4) * 0.22}s ease-in-out ${i * 0.09}s infinite`,
          }} />
        ))}
      </div>

      {/* Ground shadow */}
      <div aria-hidden style={{ position: "absolute", bottom: -18, left: "50%", width: 106, height: 14, transform: "translateX(-50%)", background: "radial-gradient(ellipse, rgba(155,124,255,0.12) 0%, transparent 70%)" }} />
    </div>
  );
}

/* ─── Copilot 3D object ──────────────────────────────────────────── */

function CopilotObject({ reduced }: { reduced: boolean }) {
  const face = (t: string): React.CSSProperties => ({
    position: "absolute",
    width: 66, height: 66,
    border: "1px solid rgba(65,214,155,0.16)",
    background: "rgba(65,214,155,0.022)",
    backgroundImage: [
      "repeating-linear-gradient(0deg, rgba(65,214,155,0.07) 0px, rgba(65,214,155,0.07) 1px, transparent 1px, transparent 11px)",
      "repeating-linear-gradient(90deg, rgba(65,214,155,0.07) 0px, rgba(65,214,155,0.07) 1px, transparent 1px, transparent 11px)",
    ].join(", "),
    transform: t,
    backfaceVisibility: "hidden" as const,
  });

  return (
    <div style={{ position: "relative", width: 168, height: 168, margin: "0 auto" }}>
      {/* Glow */}
      <div aria-hidden style={{ position: "absolute", inset: -30, borderRadius: "50%", background: "radial-gradient(circle, rgba(65,214,155,0.18) 0%, transparent 62%)" }} />

      {/* Cube scene — perspective parent keeps the 3D */}
      <div style={{ position: "absolute", top: "50%", left: "50%", perspective: 640 }}>
        <div aria-hidden style={{
          width: 66, height: 66,
          marginLeft: -33, marginTop: -46,
          transformStyle: "preserve-3d",
          animation: reduced ? "none" : "lp-cube-spin 10s linear infinite",
        }}>
          <div style={face("translateZ(33px)")} />
          <div style={face("translateZ(-33px) rotateY(180deg)")} />
          <div style={face("translateX(-33px) rotateY(-90deg)")} />
          <div style={face("translateX(33px) rotateY(90deg)")} />
          <div style={face("translateY(-33px) rotateX(90deg)")} />
          <div style={face("translateY(33px) rotateX(-90deg)")} />
        </div>
      </div>

      {/* Orbiting dots */}
      {!reduced && [0, 1, 2].map(i => (
        <div key={i} aria-hidden style={{
          position: "absolute", top: "50%", left: "50%",
          marginTop: -2.5, marginLeft: -2.5,
          animation: `lp-orbit-${i} ${5.2 + i * 1.8}s linear infinite`,
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: "50%",
            background: i === 0 ? "rgba(65,214,155,0.88)" : "rgba(65,214,155,0.42)",
            boxShadow: "0 0 8px rgba(65,214,155,0.55)",
          }} />
        </div>
      ))}

      {/* Ground shadow */}
      <div aria-hidden style={{ position: "absolute", bottom: -18, left: "50%", width: 106, height: 14, transform: "translateX(-50%)", background: "radial-gradient(ellipse, rgba(65,214,155,0.12) 0%, transparent 70%)" }} />
    </div>
  );
}

/* ─── Data ───────────────────────────────────────────────────────── */

const PRODUCTS = [
  {
    id: "lens" as const,
    label: "Lens",
    desc: "Understand images, screens, files, and visual context.",
    accentColor: "#7DB7FF",
    border: "rgba(125,183,255,0.11)",
    borderHover: "rgba(125,183,255,0.24)",
    bg: "rgba(125,183,255,0.016)",
  },
  {
    id: "audio" as const,
    label: "Audio",
    desc: "Speak naturally with fast voice, transcription, and real-time listening.",
    accentColor: "#C4B5FD",
    border: "rgba(155,124,255,0.11)",
    borderHover: "rgba(155,124,255,0.24)",
    bg: "rgba(155,124,255,0.016)",
  },
  {
    id: "copilot" as const,
    label: "Copilot",
    desc: "Take action across apps, tools, storage, projects, and the web.",
    accentColor: "#41D69B",
    border: "rgba(65,214,155,0.11)",
    borderHover: "rgba(65,214,155,0.24)",
    bg: "rgba(65,214,155,0.016)",
  },
] as const;

const SUPPORT = [
  { label: "Web",      icon: "⬡" },
  { label: "App",      icon: "◼" },
  { label: "Memory",   icon: "◎" },
  { label: "Files",    icon: "◻" },
  { label: "Tools",    icon: "◆" },
  { label: "Projects", icon: "◇" },
  { label: "Storage",  icon: "◈" },
];

/* ─── Card ───────────────────────────────────────────────────────── */

function ProductCard({
  product,
  reduced,
}: {
  product: typeof PRODUCTS[number];
  reduced: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const Visual =
    product.id === "lens"    ? LensObject
    : product.id === "audio"  ? AudioObject
    :                           CopilotObject;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 22,
        border: `1px solid ${hovered ? product.borderHover : product.border}`,
        background: product.bg,
        padding: "36px 24px 28px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 22,
        height: "100%",
        boxSizing: "border-box",
        transition: "border-color 0.28s",
      }}
    >
      <Visual reduced={reduced} />
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: product.accentColor, marginBottom: 7, letterSpacing: "-0.01em" }}>
          {product.label}
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.42)", lineHeight: 1.65 }}>
          {product.desc}
        </div>
      </div>
    </div>
  );
}

/* ─── Section ────────────────────────────────────────────────────── */

export function ProductShowcaseSection() {
  const reduced = useReducedMotion() ?? false;

  return (
    <section style={{ background: "#040406", position: "relative", overflow: "hidden" }}>
      <style>{`
        /* Lens */
        @keyframes lp-lens-spin { to { transform: rotate(360deg); } }
        @keyframes lp-lens-scan {
          0%   { top: 24%; opacity: 0; }
          14%  { opacity: 0.70; }
          86%  { opacity: 0.70; }
          100% { top: 76%; opacity: 0; }
        }
        .lp-scan-line { animation: lp-lens-scan 4.2s ease-in-out infinite; }

        /* Audio */
        @keyframes lp-audio-ring { 0% { transform: scale(1); opacity: 0.30; } 100% { transform: scale(1.80); opacity: 0; } }
        @keyframes lp-aw1 { 0%,100% { height:  8px; } 50% { height: 22px; } }
        @keyframes lp-aw2 { 0%,100% { height: 16px; } 50% { height:  6px; } }
        @keyframes lp-aw3 { 0%,100% { height: 10px; } 50% { height: 26px; } }
        @keyframes lp-aw4 { 0%,100% { height: 20px; } 50% { height:  8px; } }
        @keyframes lp-aw5 { 0%,100% { height: 12px; } 50% { height: 18px; } }

        /* Copilot */
        @keyframes lp-cube-spin  { from { transform: rotateY(0deg) rotateX(10deg); } to { transform: rotateY(360deg) rotateX(10deg); } }
        @keyframes lp-orbit-0    { from { transform: rotate(0deg)   translateX(58px) rotate(0deg);    } to { transform: rotate(360deg)  translateX(58px) rotate(-360deg);  } }
        @keyframes lp-orbit-1    { from { transform: rotate(120deg) translateX(49px) rotate(-120deg); } to { transform: rotate(480deg)  translateX(49px) rotate(-480deg);  } }
        @keyframes lp-orbit-2    { from { transform: rotate(240deg) translateX(42px) rotate(-240deg); } to { transform: rotate(600deg)  translateX(42px) rotate(-600deg);  } }

        @media (prefers-reduced-motion: reduce) {
          .lp-scan-line { animation: none !important; }
        }
      `}</style>

      <div className="landing-divider" />
      <div className="landing-section">

        {/* Headline */}
        <motion.div
          style={{ textAlign: "center", marginBottom: 56 }}
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="landing-kicker" style={{ justifyContent: "center" }}>
            product modules
          </div>
          <h2 className="landing-h2 landing-gradient-text">
            Three ways Sansxel understands and acts.
          </h2>
          <p className="landing-body" style={{ maxWidth: 520, margin: "0 auto" }}>
            Lens sees. Audio listens. Copilot acts across your tools, files, apps, and memory.
          </p>
        </motion.div>

        {/* Product cards */}
        <div className="lp-showcase-grid" style={{ display: "grid", gap: 12, marginBottom: 12 }}>
          {PRODUCTS.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, ease: EASE, delay: i * 0.10 }}
              style={{ height: "100%" }}
            >
              <TiltCard reduced={reduced}>
                <ProductCard product={p} reduced={reduced} />
              </TiltCard>
            </motion.div>
          ))}
        </div>

        {/* Support systems strip */}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          paddingTop: 20,
          borderTop: "1px solid rgba(255,255,255,0.045)",
        }}>
          <span style={{
            fontSize: 9,
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.18)",
            marginRight: 4,
          }}>
            built on
          </span>
          {SUPPORT.map((s) => (
            <div key={s.label} style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "4px 11px",
              borderRadius: 100,
              border: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.018)",
              fontSize: 11,
              color: "rgba(255,255,255,0.32)",
            }}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.20)" }}>{s.icon}</span>
              {s.label}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (min-width: 540px) { .lp-showcase-grid { grid-template-columns: repeat(3, 1fr) !important; } }
      `}</style>
    </section>
  );
}
