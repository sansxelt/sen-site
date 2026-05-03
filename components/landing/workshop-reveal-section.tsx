"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const LAYERS = [
  { icon: "◎", label: "Chat",         desc: "Full conversations with persistent context. Not one-shot prompts." },
  { icon: "◇", label: "Projects",     desc: "Group threads, files, and memory into one workspace per context." },
  { icon: "◻", label: "Files",        desc: "PDFs, images, code. Referenced directly inside any thread." },
  { icon: "◈", label: "Memory",       desc: "Context that carries across every session. You never repeat yourself." },
  { icon: "◆", label: "Creation",     desc: "Generate images and visuals inline. No separate tool required." },
  { icon: "◉", label: "Voice",        desc: "Low-latency, hands-free conversation through any audio device." },
  { icon: "⬡", label: "Integrations", desc: "Connect your tools. Act across your entire stack from one surface." },
];

const LAYER_AT = [0.02, 0.18, 0.32, 0.46, 0.60, 0.74, 0.88];

function WorkshopProduct() {
  return (
    <div style={{ position: "relative" }}>
      {/* Cast shadow beneath */}
      <div style={{
        position: "absolute",
        bottom: -28, left: "8%", right: "8%",
        height: 48,
        background: "radial-gradient(ellipse at 50% 0%, rgba(167,139,250,0.12) 0%, rgba(0,0,0,0) 70%)",
        filter: "blur(16px)",
        pointerEvents: "none",
      }} />

      {/* Screen edge (thickness illusion) */}
      <div style={{
        position: "absolute",
        inset: 0,
        borderRadius: 18,
        background: "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, transparent 8%, transparent 92%, rgba(0,0,0,0.5) 100%)",
        pointerEvents: "none",
        zIndex: 2,
      }} />

      {/* Product panel */}
      <div style={{
        width: "min(700px, 90vw)",
        aspectRatio: "16 / 10",
        background: "linear-gradient(155deg, #17171e 0%, #0f0f15 55%, #0c0c11 100%)",
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.10)",
        overflow: "hidden",
        position: "relative",
        boxShadow:
          "0 0 0 1px rgba(255,255,255,0.04) inset," +
          "0 2px 0 rgba(255,255,255,0.07) inset," +
          "0 80px 200px rgba(0,0,0,0.95)," +
          "0 0 120px rgba(167,139,250,0.08)",
      }}>

        {/* Top glow */}
        <div style={{
          position: "absolute", top: "-30%", left: "30%", right: "10%", height: "55%",
          background: "radial-gradient(ellipse, rgba(167,139,250,0.10) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Titlebar */}
        <div style={{
          height: 36, borderBottom: "1px solid rgba(255,255,255,0.055)",
          background: "rgba(255,255,255,0.02)",
          display: "flex", alignItems: "center", padding: "0 14px",
          justifyContent: "space-between", flexShrink: 0,
        }}>
          <div style={{ display: "flex", gap: 5 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: "rgba(255,255,255,0.09)" }} />
            ))}
          </div>
          <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.22)", fontFamily: "var(--font-geist-mono), monospace", letterSpacing: "0.06em" }}>
            sansxel · workshop
          </span>
          <div style={{ width: 38 }} />
        </div>

        {/* Body */}
        <div style={{ display: "flex", height: "calc(100% - 36px)" }}>

          {/* Rail */}
          <div style={{ width: "19%", borderRight: "1px solid rgba(255,255,255,0.04)", padding: "14px 8px", display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.16)", padding: "1px 6px 5px" }}>Projects</div>
            {[[true,62],[false,48],[false,56]].map(([active, w], i) => (
              <div key={i} style={{ padding: "5px 7px", borderRadius: 6, background: active ? "rgba(167,139,250,0.08)" : "transparent", display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 11, height: 11, borderRadius: 3, background: active ? "rgba(167,139,250,0.22)" : "rgba(255,255,255,0.05)", flexShrink: 0 }} />
                <div style={{ height: 5.5, width: `${w}%`, borderRadius: 3, background: active ? "rgba(167,139,250,0.28)" : "rgba(255,255,255,0.07)" }} />
              </div>
            ))}
            <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "7px 3px" }} />
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.16)", padding: "1px 6px 5px" }}>Files</div>
            {[68,46,76].map((w, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 7px" }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(168,196,255,0.10)", flexShrink: 0 }} />
                <div style={{ height: 5, width: `${w}%`, borderRadius: 3, background: "rgba(255,255,255,0.06)" }} />
              </div>
            ))}
            <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "7px 3px" }} />
            <div style={{ padding: "4px 7px", borderRadius: 5, background: "rgba(168,196,255,0.04)", border: "1px solid rgba(168,196,255,0.08)", display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(168,196,255,0.45)" }} />
              <div style={{ height: 5, width: "55%", borderRadius: 3, background: "rgba(168,196,255,0.15)" }} />
            </div>
          </div>

          {/* Chat area */}
          <div style={{ flex: 1, padding: "16px 18px 12px", display: "flex", flexDirection: "column", gap: 10, justifyContent: "flex-end" }}>
            {/* User message */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div style={{
                padding: "9px 13px", borderRadius: "11px 11px 3px 11px",
                background: "rgba(167,139,250,0.09)", border: "1px solid rgba(167,139,250,0.14)",
                maxWidth: "70%", display: "flex", flexDirection: "column", gap: 5,
              }}>
                <div style={{ height: 6, width: 168, borderRadius: 3, background: "rgba(167,139,250,0.30)" }} />
                <div style={{ height: 6, width: 110, borderRadius: 3, background: "rgba(167,139,250,0.17)" }} />
              </div>
            </div>
            {/* AI reply */}
            <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(167,139,250,0.11)", border: "1px solid rgba(167,139,250,0.18)", flexShrink: 0, marginTop: 1 }} />
              <div style={{
                flex: 1, padding: "9px 12px", borderRadius: "3px 11px 11px 11px",
                background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.05)",
                display: "flex", flexDirection: "column", gap: 6,
              }}>
                <div style={{ height: 6, width: "88%", borderRadius: 3, background: "rgba(255,255,255,0.09)" }} />
                <div style={{ height: 6, width: "72%", borderRadius: 3, background: "rgba(255,255,255,0.06)" }} />
                <div style={{ height: 6, width: "81%", borderRadius: 3, background: "rgba(255,255,255,0.07)" }} />
                <div style={{ height: 6, width: "54%", borderRadius: 3, background: "rgba(255,255,255,0.05)" }} />
              </div>
            </div>
            {/* Input bar */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "9px 11px",
              borderRadius: 9, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", marginTop: 2,
            }}>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.05)" }} />
              <div style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(167,139,250,0.13)", border: "1px solid rgba(167,139,250,0.22)", flexShrink: 0 }} />
            </div>
          </div>
        </div>

        {/* Scanlines */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.006) 2px, rgba(255,255,255,0.006) 4px)",
          pointerEvents: "none",
        }} />
      </div>
    </div>
  );
}

export function WorkshopRevealSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [activeIdx, setActiveIdx] = useState(0);

  const { scrollYProgress: sp } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Subscribe to scroll changes — useEffect is reliable across FM versions
  useEffect(() => {
    const unsub = sp.on("change", (v: number) => {
      let idx = 0;
      for (let i = LAYER_AT.length - 1; i >= 0; i--) {
        if (v >= LAYER_AT[i]) { idx = i; break; }
      }
      setActiveIdx(idx);
    });
    return unsub;
  }, [sp]);

  // Strong initial tilt — rotates toward face-on as user scrolls
  const rotateY      = useTransform(sp, [0, 0.7, 1], reduced ? [0,0,0] : [-22, -2, 5]);
  const rotateX      = useTransform(sp, [0, 0.7, 1], reduced ? [0,0,0] : [16,  1, -3]);
  const scale        = useTransform(sp, [0, 0.18],   reduced ? [1,1]   : [0.88, 1]);
  const ctaOpacity   = useTransform(sp, [0.88, 0.98], [0, 1]);

  const layer = LAYERS[activeIdx];

  return (
    <div style={{ background: "#050507" }}>
      <div className="landing-divider" />

      {/* 420vh scroll container — sticky viewport lives inside */}
      <div ref={containerRef} style={{ height: "420vh", position: "relative" }}>
        <div
          style={{
            position: "sticky",
            top: 0,
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 0,
          }}
        >
          {/* Feature label — above the product */}
          <div
            style={{
              width: "100%",
              maxWidth: "min(740px, 92vw)",
              padding: "0 24px 28px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(167,139,250,0.45)",
                marginBottom: 10,
              }}
            >
              workshop &nbsp;·&nbsp;{" "}
              <span style={{ color: "rgba(167,139,250,0.28)" }}>
                {String(activeIdx + 1).padStart(2, "0")} / {LAYERS.length}
              </span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={layer.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: EASE }}
              >
                <div style={{
                  fontSize: "clamp(20px, 3vw, 32px)",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.15,
                  marginBottom: 5,
                  background: "linear-gradient(90deg, #ffffff 0%, rgba(255,255,255,0.60) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}>
                  {layer.icon}&nbsp;&nbsp;{layer.label}
                </div>
                <div style={{ fontSize: "clamp(12px, 1.4vw, 14px)", color: "rgba(255,255,255,0.34)", lineHeight: 1.55, maxWidth: 440 }}>
                  {layer.desc}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Progress strip */}
            <div style={{ display: "flex", gap: 4, marginTop: 14 }}>
              {LAYERS.map((l, i) => (
                <div
                  key={l.label}
                  style={{
                    height: 2, flex: 1, borderRadius: 2,
                    background: i <= activeIdx ? "rgba(167,139,250,0.70)" : "rgba(255,255,255,0.09)",
                    transition: "background 0.35s",
                  }}
                />
              ))}
            </div>
          </div>

          {/* 3D product — perspective parent gives the depth */}
          <div style={{ perspective: "900px", perspectiveOrigin: "50% 50%" }}>
            <motion.div
              style={{
                rotateY,
                rotateX,
                scale,
                transformStyle: "preserve-3d",
              }}
            >
              <WorkshopProduct />
            </motion.div>
          </div>

          {/* CTA — fades in at end */}
          <motion.div style={{ marginTop: 28, opacity: ctaOpacity }}>
            <Link
              href="/workshop"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                fontSize: 13, color: "rgba(167,139,250,0.75)", textDecoration: "none",
                borderBottom: "1px solid rgba(167,139,250,0.25)", paddingBottom: 2,
              }}
            >
              Explore Workshop in full <span style={{ fontSize: 11 }}>→</span>
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
