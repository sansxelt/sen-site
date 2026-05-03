"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

/* ─────────────────────────────────────────────────────────
   Sansxel WORKSHOP — pseudo-3D interface panel
───────────────────────────────────────────────────────── */
function WorkshopHeroPanel() {
  return (
    <div style={{ perspective: "1100px", perspectiveOrigin: "50% 44%" }}>
      <div
        style={{
          transform: "rotateX(7deg) rotateY(-11deg)",
          transformStyle: "preserve-3d",
          position: "relative",
        }}
      >
        {/* Depth shadow */}
        <div style={{
          position: "absolute",
          bottom: -44, left: "9%", right: "9%",
          height: 64,
          background: "radial-gradient(ellipse, rgba(167,139,250,0.20) 0%, transparent 70%)",
          filter: "blur(28px)",
          pointerEvents: "none",
        }} />

        {/* Panel */}
        <div style={{
          width: "min(820px, 91vw)",
          aspectRatio: "16 / 10",
          background: "linear-gradient(148deg, #1a1a25 0%, #10101a 52%, #0d0d13 100%)",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.13)",
          overflow: "hidden",
          position: "relative",
          boxShadow: [
            "0 0 0 1px rgba(255,255,255,0.06) inset",
            "0 2px 0 rgba(255,255,255,0.10) inset",
            "0 48px 140px rgba(0,0,0,0.90)",
            "0 0 100px rgba(167,139,250,0.10)",
          ].join(","),
        }}>

          {/* Top ambient glow */}
          <div style={{
            position: "absolute", top: "-22%", left: "38%", right: 0, height: "52%",
            background: "radial-gradient(ellipse, rgba(167,139,250,0.13) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />

          {/* Titlebar */}
          <div style={{
            height: 36, borderBottom: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(255,255,255,0.022)",
            display: "flex", alignItems: "center", padding: "0 13px",
            justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", gap: 5.5 }}>
              {(["rgba(255,88,78,0.45)", "rgba(255,188,48,0.35)", "rgba(55,200,88,0.32)"] as const).map((c, i) => (
                <div key={i} style={{ width: 9.5, height: 9.5, borderRadius: "50%", background: c }} />
              ))}
            </div>
            <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.30)", fontFamily: "var(--font-geist-mono), monospace", letterSpacing: "0.07em" }}>
              sansxel workshop
            </span>
            <div style={{ width: 44 }} />
          </div>

          {/* Body */}
          <div style={{ display: "flex", height: "calc(100% - 36px)" }}>

            {/* LEFT SIDEBAR */}
            <div style={{
              width: "21%",
              borderRight: "1px solid rgba(255,255,255,0.055)",
              padding: "11px 8px",
              display: "flex", flexDirection: "column", gap: 3,
            }}>
              {/* Search */}
              <div style={{
                height: 24, borderRadius: 5,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                marginBottom: 6, display: "flex", alignItems: "center", padding: "0 7px", gap: 4,
              }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", border: "1.2px solid rgba(255,255,255,0.22)", flexShrink: 0 }} />
                <div style={{ height: 4, width: "52%", borderRadius: 2, background: "rgba(255,255,255,0.09)" }} />
              </div>

              <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.20em", textTransform: "uppercase", color: "rgba(167,139,250,0.55)", padding: "2px 5px 3px" }}>Projects</div>
              {([
                { w: 56, nameBg: "rgba(167,139,250,0.32)", rowBg: "rgba(167,139,250,0.09)", iconBg: "rgba(167,139,250,0.26)" },
                { w: 44, nameBg: "rgba(255,255,255,0.09)", rowBg: "transparent",            iconBg: "rgba(255,255,255,0.07)" },
                { w: 50, nameBg: "rgba(255,255,255,0.07)", rowBg: "transparent",            iconBg: "rgba(255,255,255,0.05)" },
              ] as const).map((r, i) => (
                <div key={i} style={{ padding: "5px 6px", borderRadius: 5, background: r.rowBg, display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 11, height: 11, borderRadius: 3, background: r.iconBg, flexShrink: 0 }} />
                  <div style={{ height: 5, width: `${r.w}%`, borderRadius: 3, background: r.nameBg }} />
                </div>
              ))}

              <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "5px 3px" }} />
              <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.20em", textTransform: "uppercase", color: "rgba(168,196,255,0.42)", padding: "2px 5px 3px" }}>Files</div>
              {([60, 46, 68, 38] as const).map((w, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 6px" }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(168,196,255,0.12)", flexShrink: 0 }} />
                  <div style={{ height: 4, width: `${w}%`, borderRadius: 3, background: "rgba(255,255,255,0.07)" }} />
                </div>
              ))}

              <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "5px 3px" }} />
              <div style={{ padding: "5px 6px", borderRadius: 5, background: "rgba(100,200,130,0.06)", border: "1px solid rgba(100,200,130,0.13)", display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(100,200,130,0.68)", flexShrink: 0 }} />
                <div style={{ height: 4.5, width: "58%", borderRadius: 3, background: "rgba(100,200,130,0.22)" }} />
              </div>
            </div>

            {/* CENTER — Chat */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              {/* Thread header */}
              <div style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "7px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ width: 13, height: 13, borderRadius: 4, background: "rgba(167,139,250,0.20)" }} />
                  <div style={{ height: 5, width: 100, borderRadius: 3, background: "rgba(255,255,255,0.17)" }} />
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  {([24, 18, 22] as const).map((w, i) => <div key={i} style={{ height: 4, width: w, borderRadius: 3, background: "rgba(255,255,255,0.07)" }} />)}
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 9, justifyContent: "flex-end" }}>
                {/* User */}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ padding: "8px 11px", borderRadius: "10px 10px 3px 10px", background: "rgba(167,139,250,0.11)", border: "1px solid rgba(167,139,250,0.17)", maxWidth: "66%", display: "flex", flexDirection: "column", gap: 4.5 }}>
                    <div style={{ height: 5, width: 130, borderRadius: 3, background: "rgba(167,139,250,0.40)" }} />
                    <div style={{ height: 5, width: 85,  borderRadius: 3, background: "rgba(167,139,250,0.24)" }} />
                  </div>
                </div>
                {/* AI */}
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ width: 21, height: 21, borderRadius: 6, background: "rgba(167,139,250,0.16)", border: "1px solid rgba(167,139,250,0.26)", flexShrink: 0, marginTop: 1 }} />
                  <div style={{ flex: 1, padding: "8px 11px", borderRadius: "3px 10px 10px 10px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ height: 5, width: "90%", borderRadius: 3, background: "rgba(255,255,255,0.16)" }} />
                    <div style={{ height: 5, width: "75%", borderRadius: 3, background: "rgba(255,255,255,0.11)" }} />
                    <div style={{ height: 5, width: "83%", borderRadius: 3, background: "rgba(255,255,255,0.13)" }} />
                    <div style={{ height: 5, width: "55%", borderRadius: 3, background: "rgba(255,255,255,0.08)" }} />
                  </div>
                </div>
                {/* File + AI */}
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ width: 21, height: 21, borderRadius: 6, background: "rgba(167,139,250,0.16)", border: "1px solid rgba(167,139,250,0.26)", flexShrink: 0, marginTop: 1 }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ padding: "6px 9px", borderRadius: 7, background: "rgba(168,196,255,0.06)", border: "1px solid rgba(168,196,255,0.14)", display: "flex", alignItems: "center", gap: 7, maxWidth: "72%" }}>
                      <div style={{ width: 18, height: 22, borderRadius: 3, background: "rgba(168,196,255,0.20)", border: "1px solid rgba(168,196,255,0.24)", flexShrink: 0 }} />
                      <div>
                        <div style={{ height: 4.5, width: 62, borderRadius: 3, background: "rgba(255,255,255,0.22)", marginBottom: 4 }} />
                        <div style={{ height: 3.5, width: 38, borderRadius: 3, background: "rgba(255,255,255,0.09)" }} />
                      </div>
                    </div>
                    <div style={{ padding: "7px 11px", borderRadius: "3px 10px 10px 10px", background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", gap: 4.5, maxWidth: "86%" }}>
                      <div style={{ height: 4.5, width: "80%", borderRadius: 3, background: "rgba(255,255,255,0.13)" }} />
                      <div style={{ height: 4.5, width: "60%", borderRadius: 3, background: "rgba(255,255,255,0.09)" }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Input */}
              <div style={{
                margin: "0 12px 10px",
                display: "flex", alignItems: "center", gap: 7, padding: "8px 11px",
                borderRadius: 9, background: "rgba(255,255,255,0.022)", border: "1px solid rgba(255,255,255,0.09)",
              }}>
                <div style={{ flex: 1, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.07)" }} />
                <div style={{ display: "flex", gap: 5 }}>
                  <div style={{ width: 21, height: 21, borderRadius: 5, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
                  <div style={{ width: 21, height: 21, borderRadius: 5, background: "rgba(167,139,250,0.17)", border: "1px solid rgba(167,139,250,0.28)" }} />
                </div>
              </div>
            </div>

            {/* RIGHT — Memory + context */}
            <div style={{
              width: "23%",
              borderLeft: "1px solid rgba(255,255,255,0.05)",
              padding: "11px 9px",
              display: "flex", flexDirection: "column", gap: 6,
            }}>
              <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.20em", textTransform: "uppercase", color: "rgba(100,200,130,0.58)", padding: "2px 3px 3px" }}>Memory</div>
              {([
                { bg: "rgba(100,200,130,0.07)", br: "rgba(100,200,130,0.15)", w1: 68, w2: 50, w3: 35 },
                { bg: "rgba(167,139,250,0.05)", br: "rgba(167,139,250,0.12)", w1: 82, w2: 55, w3: 42 },
                { bg: "rgba(168,196,255,0.04)", br: "rgba(168,196,255,0.11)", w1: 60, w2: 72, w3: 28 },
              ] as const).map((c, i) => (
                <div key={i} style={{ padding: "7px 8px", borderRadius: 7, background: c.bg, border: `1px solid ${c.br}`, display: "flex", flexDirection: "column", gap: 3.5 }}>
                  <div style={{ height: 4, width: `${c.w1}%`, borderRadius: 3, background: "rgba(255,255,255,0.22)" }} />
                  <div style={{ height: 3.5, width: `${c.w2}%`, borderRadius: 3, background: "rgba(255,255,255,0.12)" }} />
                  <div style={{ height: 3.5, width: `${c.w3}%`, borderRadius: 3, background: "rgba(255,255,255,0.08)" }} />
                </div>
              ))}
              <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "1px 0" }} />
              <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.20em", textTransform: "uppercase", color: "rgba(255,172,51,0.50)", padding: "2px 3px 3px" }}>Research</div>
              {([70, 55, 62] as const).map((w, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 4px" }}>
                  <div style={{ width: 5, height: 5, borderRadius: 2, background: "rgba(255,172,51,0.30)", flexShrink: 0 }} />
                  <div style={{ height: 3.5, width: `${w}%`, borderRadius: 3, background: "rgba(255,255,255,0.08)" }} />
                </div>
              ))}
            </div>

          </div>

          {/* Scanlines */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.004) 2px, rgba(255,255,255,0.004) 4px)",
          }} />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Hero section
───────────────────────────────────────────────────────── */
export function LandingHero({ signedIn }: { signedIn: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  const shouldReduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const panelY    = useTransform(scrollYProgress, [0, 1], [0, 64]);
  const panelOp   = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  const contentY  = useTransform(scrollYProgress, [0, 1], [0, 26]);
  const contentOp = useTransform(scrollYProgress, [0, 0.55], [1, 0]);

  return (
    <section
      ref={sectionRef}
      style={{
        position: "relative",
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingBottom: 48,
        background: "#050507",
        overflowX: "clip",
      }}
    >
      {/* Background glow */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 72% 52% at 50% 76%, rgba(167,139,250,0.09) 0%, transparent 65%)",
      }} />

      {/* Text content */}
      <motion.div
        className="landing-hero-content"
        style={shouldReduce ? {} : { y: contentY, opacity: contentOp }}
      >
        <motion.div
          className="landing-eyebrow"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.10 }}
        >
          <span className="landing-eyebrow-dot" aria-hidden />
          sansxel · workshop
        </motion.div>

        <motion.h1
          className="landing-h1 landing-gradient-text"
          style={{ display: "block", textAlign: "center" }}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.80, ease: EASE, delay: 0.22 }}
        >
          The AI workshop<br />for makers.
        </motion.h1>

        <motion.p
          style={{
            fontSize: "clamp(13px, 1.35vw, 15px)",
            color: "rgba(255,255,255,0.36)",
            letterSpacing: "0.01em",
            marginBottom: 8,
            marginTop: -10,
          }}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.70, ease: EASE, delay: 0.36 }}
        >
          One AI. One purpose: help.
        </motion.p>

        <motion.p
          className="landing-hero-sub"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.70, ease: EASE, delay: 0.48 }}
        >
          Chat, create, research, organize files, and keep project memory in one workspace.
        </motion.p>

        <motion.div
          className="landing-hero-ctas"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.70, ease: EASE, delay: 0.62 }}
        >
          <Link
            href={signedIn ? "/app" : "/signin?callbackUrl=/app"}
            className="landing-cta-primary"
          >
            Open workspace
          </Link>
          <a
            href="https://discord.gg/5sxuuewf3u"
            target="_blank"
            rel="noopener noreferrer"
            className="landing-cta-ghost"
          >
            Join Discord
            <span className="landing-cta-arrow" aria-hidden>↗</span>
          </a>
        </motion.div>
      </motion.div>

      {/* Workshop product panel */}
      <motion.div
        style={shouldReduce ? {} : { y: panelY, opacity: panelOp }}
        initial={{ opacity: 0, y: 52 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.10, ease: EASE, delay: 0.62 }}
      >
        <WorkshopHeroPanel />
      </motion.div>

      {/* Scroll hint */}
      <motion.div
        className="landing-scroll-hint"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ delay: 1.7, duration: 0.8 }}
        aria-hidden
      >
        <motion.span
          animate={shouldReduce ? {} : { y: [0, 6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >↓</motion.span>
      </motion.div>
    </section>
  );
}
