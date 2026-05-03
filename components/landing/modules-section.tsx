"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* ─────────────────────────────────────────────────────────────────
   AUDIO — Physical earbud product render
──────────────────────────────────────────────────────────────────── */
function EarbudObject() {
  return (
    <div style={{ position: "relative", width: 320, height: 320, display: "flex", alignItems: "center", justifyContent: "center" }}>

      {/* Ambient glow behind */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(circle at 50% 55%, rgba(100,160,255,0.09) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />

      {/* Pulse rings */}
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          position: "absolute",
          width: 100 + i * 64,
          height: 100 + i * 64,
          borderRadius: "50%",
          border: `1px solid rgba(100,180,255,${0.18 - i * 0.05})`,
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          animation: `ebd-pulse 2.4s ease-out ${i * 0.7}s infinite`,
        }} />
      ))}

      {/* Earbud body group */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center" }}>

        {/* Head / capsule */}
        <div style={{
          width: 80,
          height: 96,
          borderRadius: "50% 50% 44% 44% / 46% 46% 54% 54%",
          background: "radial-gradient(ellipse at 34% 26%, #2e2e3c 0%, #1d1d28 40%, #111118 100%)",
          position: "relative",
          boxShadow: [
            "0 24px 60px rgba(0,0,0,0.90)",
            "inset 0 1.5px 0 rgba(255,255,255,0.11)",
            "inset 0 -2px 3px rgba(0,0,0,0.55)",
            "inset 2px 0 0 rgba(255,255,255,0.04)",
          ].join(","),
        }}>
          {/* Specular highlight */}
          <div style={{
            position: "absolute", top: "10%", left: "16%",
            width: "34%", height: "26%",
            background: "radial-gradient(ellipse, rgba(255,255,255,0.20) 0%, transparent 70%)",
            borderRadius: "50%",
            filter: "blur(2px)",
          }} />

          {/* Driver mesh area */}
          <div style={{
            position: "absolute",
            top: "32%", left: "18%", right: "18%", bottom: "22%",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0,0,0,0.65) 0%, rgba(18,18,24,0.50) 100%)",
            border: "1px solid rgba(255,255,255,0.04)",
          }} />

          {/* Edge rim light — right side */}
          <div style={{
            position: "absolute", top: "15%", right: 0, bottom: "15%",
            width: 2,
            background: "linear-gradient(to bottom, transparent, rgba(100,180,255,0.30) 40%, rgba(100,180,255,0.15) 70%, transparent)",
            borderRadius: 1,
          }} />

          {/* Status LED */}
          <div style={{
            position: "absolute", bottom: "18%", right: "20%",
            width: 7, height: 7, borderRadius: "50%",
            background: "rgba(130,210,255,0.95)",
            boxShadow: "0 0 10px rgba(120,200,255,0.85), 0 0 22px rgba(100,180,255,0.45)",
          }} />
        </div>

        {/* Stem */}
        <div style={{
          width: 24, height: 68,
          borderRadius: "0 0 12px 12px",
          background: "linear-gradient(180deg, #1d1d28 0%, #111118 100%)",
          position: "relative",
          boxShadow: [
            "inset -1.5px 0 0 rgba(255,255,255,0.05)",
            "inset 1.5px 0 0 rgba(0,0,0,0.5)",
            "0 16px 40px rgba(0,0,0,0.70)",
          ].join(","),
        }}>
          {/* Stem groove */}
          {[28, 44].map(top => (
            <div key={top} style={{
              position: "absolute", top, left: 4, right: 4, height: 1,
              background: "rgba(255,255,255,0.04)",
              borderRadius: 1,
            }} />
          ))}
        </div>
      </div>

      {/* Waveform — right of earbud */}
      <div style={{
        position: "absolute", right: 16, top: "50%",
        transform: "translateY(-60%)",
        display: "flex", alignItems: "center", gap: 3,
      }}>
        {[10, 22, 34, 28, 18, 26, 14].map((h, i) => (
          <div key={i} style={{
            width: 2.5, height: h, borderRadius: 2,
            background: "rgba(100,180,255,0.42)",
            animation: `ebd-wave 0.9s ease-in-out ${i * 0.08}s infinite`,
          }} />
        ))}
      </div>

      {/* Compatible device chips */}
      <div style={{
        position: "absolute", bottom: 8, left: 0, right: 0,
        display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap",
      }}>
        {["AirPods", "Headphones", "Bluetooth", "Any device"].map(d => (
          <div key={d} style={{
            fontSize: 9, padding: "2px 9px", borderRadius: 100,
            border: "1px solid rgba(100,180,255,0.14)",
            background: "rgba(100,180,255,0.04)",
            color: "rgba(100,180,255,0.50)",
            letterSpacing: "0.05em", whiteSpace: "nowrap",
          }}>
            {d}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   LENS — Physical contact lens concept render
──────────────────────────────────────────────────────────────────── */
const LENS_CHIPS = [
  { label: "Translate",  angle: 330 },
  { label: "Navigate",   angle:  40 },
  { label: "Remember",   angle: 145 },
  { label: "Identify",   angle: 215 },
];

function LensObject() {
  const CX = 160, CY = 160, R = 100;

  return (
    <div style={{ position: "relative", width: 320, height: 320 }}>
      <svg
        width="320"
        height="320"
        viewBox="0 0 320 320"
        style={{ position: "absolute", inset: 0 }}
        aria-hidden
      >
        {/* Outer glow */}
        <defs>
          <radialGradient id="lens-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="rgba(140,200,255,0.10)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <radialGradient id="lens-body" cx="38%" cy="32%" r="65%">
            <stop offset="0%"   stopColor="rgba(180,220,255,0.09)" />
            <stop offset="50%"  stopColor="rgba(100,160,255,0.04)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>

        {/* Ambient glow disc */}
        <circle cx={CX} cy={CY} r={R + 40} fill="url(#lens-glow)" />

        {/* Lens body fill */}
        <circle cx={CX} cy={CY} r={R} fill="url(#lens-body)" />

        {/* Outer rim — full circle */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(160,210,255,0.20)" strokeWidth="1" />

        {/* Rim lighting arc — upper left, bright highlight */}
        <path
          d={`M ${CX - R * 0.82},${CY - R * 0.41} A ${R},${R} 0 0,1 ${CX - R * 0.15},${CY - R * 0.98}`}
          fill="none"
          stroke="rgba(220,240,255,0.55)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Secondary rim — lower right, dimmer */}
        <path
          d={`M ${CX + R * 0.55},${CY + R * 0.82} A ${R},${R} 0 0,1 ${CX + R * 0.96},${CY + R * 0.16}`}
          fill="none"
          stroke="rgba(180,210,255,0.15)"
          strokeWidth="1"
          strokeLinecap="round"
        />

        {/* Inner micro-HUD ring — dashed */}
        <circle cx={CX} cy={CY} r={R * 0.65} fill="none" stroke="rgba(120,180,255,0.14)" strokeWidth="0.8" strokeDasharray="4 8" />

        {/* Pupil ring */}
        <circle cx={CX} cy={CY} r={R * 0.22} fill="none" stroke="rgba(120,180,255,0.22)" strokeWidth="0.8" />

        {/* Center iris detail */}
        <circle cx={CX} cy={CY} r={R * 0.12} fill="none" stroke="rgba(140,200,255,0.18)" strokeWidth="0.6" />
        <circle cx={CX} cy={CY} r={3}         fill="rgba(140,200,255,0.45)" />

        {/* Refraction highlight inside — curved bright ellipse */}
        <ellipse
          cx={CX - R * 0.28}
          cy={CY - R * 0.30}
          rx={R * 0.30}
          ry={R * 0.14}
          fill="rgba(255,255,255,0.07)"
          style={{ filter: "blur(3px)" }}
          transform={`rotate(-28, ${CX - R * 0.28}, ${CY - R * 0.30})`}
        />

        {/* HUD tick marks on inner ring */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => {
          const rad = (deg * Math.PI) / 180;
          const r1 = R * 0.58, r2 = R * 0.70;
          return (
            <line key={deg}
              x1={CX + r1 * Math.cos(rad)} y1={CY + r1 * Math.sin(rad)}
              x2={CX + r2 * Math.cos(rad)} y2={CY + r2 * Math.sin(rad)}
              stroke="rgba(120,180,255,0.18)" strokeWidth="0.8"
            />
          );
        })}

        {/* Connector lines to chips */}
        {LENS_CHIPS.map(({ label, angle }) => {
          const rad = (angle * Math.PI) / 180;
          const x1 = CX + R * Math.cos(rad);
          const y1 = CY + R * Math.sin(rad);
          const x2 = CX + (R + 44) * Math.cos(rad);
          const y2 = CY + (R + 44) * Math.sin(rad);
          return (
            <line key={label}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="rgba(120,180,255,0.12)" strokeWidth="0.8" strokeDasharray="2 4"
            />
          );
        })}
      </svg>

      {/* Floating chips around the lens */}
      {LENS_CHIPS.map(({ label, angle }) => {
        const rad = (angle * Math.PI) / 180;
        const dist = R + 60;
        const x = CX + dist * Math.cos(rad);
        const y = CY + dist * Math.sin(rad);
        return (
          <div key={label} style={{
            position: "absolute",
            left: x, top: y,
            transform: "translate(-50%, -50%)",
            padding: "3px 9px",
            borderRadius: 100,
            border: "1px solid rgba(120,180,255,0.18)",
            background: "rgba(120,180,255,0.05)",
            fontSize: 9.5, color: "rgba(140,200,255,0.60)",
            letterSpacing: "0.08em", whiteSpace: "nowrap",
            fontFamily: "var(--font-geist-mono), monospace",
          }}>
            {label}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   COPILOT — Software action layer
──────────────────────────────────────────────────────────────────── */
function CopilotObject() {
  const steps = [
    { icon: "◻", label: "Reading context",    done: true  },
    { icon: "⬡", label: "Checking Notion",    done: true  },
    { icon: "◆", label: "Drafting reply",     done: false },
    { icon: "↑", label: "Sending to inbox",   done: false },
  ];
  return (
    <div style={{ width: 320 }}>
      <div style={{
        background: "#0c0c10", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14, overflow: "hidden",
        boxShadow: "0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "9px 13px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(255,255,255,0.015)",
        }}>
          <div style={{ display: "flex", gap: 5 }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.10)" }} />)}
          </div>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", fontFamily: "var(--font-geist-mono), monospace", letterSpacing: "0.06em" }}>copilot · running</span>
          <div style={{ width: 38 }} />
        </div>
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", marginBottom: 4 }}>
            Task: follow up on open contracts
          </div>
          {steps.map(s => (
            <div key={s.label} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 10px", borderRadius: 8,
              background: s.done ? "rgba(65,214,155,0.04)" : "rgba(255,255,255,0.02)",
              border: `1px solid ${s.done ? "rgba(65,214,155,0.10)" : "rgba(255,255,255,0.05)"}`,
            }}>
              <span style={{ fontSize: 11, color: s.done ? "rgba(65,214,155,0.65)" : "rgba(255,255,255,0.25)" }}>{s.done ? "✓" : s.icon}</span>
              <span style={{ fontSize: 11, color: s.done ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.28)" }}>{s.label}</span>
            </div>
          ))}
          <div style={{ marginTop: 4, padding: "7px 10px", borderRadius: 8, background: "rgba(65,214,155,0.05)", border: "1px solid rgba(65,214,155,0.12)", fontSize: 10, color: "rgba(65,214,155,0.55)", letterSpacing: "0.04em" }}>
            ◆ copilot is acting on your behalf
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Module block layout
──────────────────────────────────────────────────────────────────── */
interface ModuleProps {
  kicker: string;
  headline: string;
  body: React.ReactNode;
  chips?: string[];
  badge?: string;
  cta: string;
  ctaHref: string;
  accent: string;
  visual: React.ReactNode;
  flip?: boolean;
}

function ModuleBlock({ kicker, headline, body, chips, badge, cta, ctaHref, accent, visual, flip }: ModuleProps) {
  return (
    <div className="landing-section-dark">
      <div className="landing-divider" />
      <div className="landing-section lp-module-grid" style={{ display: "grid", gap: 64, alignItems: "center" }}>

        <motion.div
          className={flip ? "lp-mod-visual" : "lp-mod-text"}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.65, ease: EASE }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div className="landing-kicker" style={{ color: accent, margin: 0 }}>{kicker}</div>
            {badge && (
              <span style={{
                fontSize: 9, padding: "2px 8px", borderRadius: 100,
                border: `1px solid ${accent}30`,
                color: accent,
                opacity: 0.7,
                fontFamily: "var(--font-geist-mono), monospace",
                letterSpacing: "0.12em",
              }}>
                {badge}
              </span>
            )}
          </div>
          <h2 className="landing-h2 landing-gradient-text">{headline}</h2>
          <div className="landing-body" style={{ marginBottom: chips ? 20 : 28 }}>{body}</div>
          {chips && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 28 }}>
              {chips.map(c => (
                <span key={c} style={{
                  fontSize: 11, padding: "3px 10px", borderRadius: 100,
                  border: `1px solid ${accent}33`, color: accent,
                  background: `${accent}0a`, letterSpacing: "0.05em",
                }}>
                  {c}
                </span>
              ))}
            </div>
          )}
          <Link href={ctaHref} style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            fontSize: 13, color: accent, textDecoration: "none",
            borderBottom: `1px solid ${accent}40`, paddingBottom: 2,
          }}>
            {cta} <span style={{ fontSize: 11 }}>→</span>
          </Link>
        </motion.div>

        <motion.div
          className={flip ? "lp-mod-text" : "lp-mod-visual"}
          style={{ display: "flex", justifyContent: "center" }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
        >
          {visual}
        </motion.div>
      </div>
      <style>{`
        @media (min-width: 1024px) {
          .lp-module-grid { grid-template-columns: 1fr 1fr !important; }
          .lp-module-grid .lp-mod-visual { order: ${flip ? -1 : 1}; }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Exports
──────────────────────────────────────────────────────────────────── */
export function ModulesSection() {
  return (
    <>
      <ModuleBlock
        kicker="copilot"
        headline="Your AI acts, not just answers."
        body={<>Copilot works in context across your tools. It reads your threads, checks connected apps, drafts, sends, and follows up. You describe the outcome. It handles the steps.</>}
        cta="Learn about Copilot"
        ctaHref="/copilot"
        accent="rgba(65,214,155,0.85)"
        visual={<CopilotObject />}
      />

      <ModuleBlock
        kicker="audio"
        headline="Sansxel in your ear."
        body={<>Use Sansxel through your AirPods, headphones, or any audio device you already own. Voice is a first-class interface in Workshop today. Sansxel Audio is the direction: purpose-built hardware designed around how the AI actually works.</>}
        chips={["AirPods", "Headphones", "Bluetooth", "Third-party audio", "Future hardware"]}
        cta="Learn about Audio"
        ctaHref="/audio"
        accent="rgba(100,180,255,0.85)"
        visual={<EarbudObject />}
        flip
      />

      <ModuleBlock
        kicker="lens"
        badge="future direction"
        headline="Vision that sees your context."
        body={<>Lens is the visual layer. A transparent interface that overlays context onto the real world. Not shipping today. This is the direction Sansxel is building toward.</>}
        chips={["Translate", "Navigate", "Remember", "Identify"]}
        cta="Learn about Lens"
        ctaHref="/lens"
        accent="rgba(255,172,51,0.85)"
        visual={<LensObject />}
      />

      <style>{`
        @keyframes ebd-pulse {
          0%   { transform: translate(-50%,-50%) scale(0.75); opacity: 0.7; }
          100% { transform: translate(-50%,-50%) scale(1.40); opacity: 0;   }
        }
        @keyframes ebd-wave {
          0%,100% { transform: scaleY(0.4); }
          50%     { transform: scaleY(1.0); }
        }
      `}</style>
    </>
  );
}

export function ModuleMockStyles() {
  return null;
}
