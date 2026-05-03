"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useScroll,
  useTransform,
  useMotionValueEvent,
} from "framer-motion";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const LAYERS = [
  { icon: "◎", label: "Chat",         desc: "Full conversations with persistent context. Not one-shot prompts. Every thread keeps the full history." },
  { icon: "◇", label: "Projects",     desc: "Group related threads, files, and memory into a single workspace. Context stays separate across projects." },
  { icon: "◻", label: "Files",        desc: "Upload PDFs, images, code, spreadsheets. Reference them inside any thread without switching apps." },
  { icon: "◈", label: "Memory",       desc: "Persistent context across every session. Sansxel knows your preferences, past work, and decisions." },
  { icon: "◆", label: "Creation",     desc: "Generate images and visuals inline. Diagrams, concepts, mockups. No separate tool required." },
  { icon: "◉", label: "Voice",        desc: "Low-latency, hands-free conversation. Works through your earbuds, headphones, or any audio device." },
  { icon: "⬡", label: "Integrations", desc: "Connect Notion, GitHub, Figma, Gmail. Act across your entire stack from one surface." },
];

// When each layer activates (fraction of scroll progress 0–1)
const LAYER_AT = [0.02, 0.18, 0.32, 0.46, 0.60, 0.74, 0.88];

function WorkshopProduct() {
  return (
    <div
      style={{
        width: "min(720px, 88vw)",
        aspectRatio: "16 / 10",
        background: "linear-gradient(155deg, #161620 0%, #0f0f14 55%, #0c0c10 100%)",
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.08)",
        overflow: "hidden",
        position: "relative",
        boxShadow:
          "0 0 0 1px rgba(255,255,255,0.035) inset, 0 70px 180px rgba(0,0,0,0.90), 0 0 100px rgba(167,139,250,0.07)",
      }}
    >
      {/* Ambient glow */}
      <div style={{
        position: "absolute", top: "-25%", left: "50%", transform: "translateX(-50%)",
        width: "70%", height: "45%",
        background: "radial-gradient(ellipse, rgba(167,139,250,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Titlebar */}
      <div style={{
        height: 36, borderBottom: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(255,255,255,0.018)",
        display: "flex", alignItems: "center", padding: "0 14px",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", gap: 5 }}>
          {[0, 1, 2].map((i) => (
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
          <div style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.17)", padding: "1px 6px 5px" }}>Projects</div>
          {[["Research", true], ["Client", false], ["Notes", false]].map(([name, active]) => (
            <div key={String(name)} style={{
              padding: "5px 7px", borderRadius: 6,
              background: active ? "rgba(167,139,250,0.08)" : "transparent",
              display: "flex", alignItems: "center", gap: 5,
            }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: active ? "rgba(167,139,250,0.22)" : "rgba(255,255,255,0.05)", flexShrink: 0 }} />
              <div style={{ height: 6, width: active ? "62%" : "50%", borderRadius: 3, background: active ? "rgba(167,139,250,0.30)" : "rgba(255,255,255,0.07)" }} />
            </div>
          ))}
          <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "7px 3px" }} />
          <div style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.17)", padding: "1px 6px 5px" }}>Files</div>
          {[68, 48, 78].map((w, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 7px" }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(168,196,255,0.10)", flexShrink: 0 }} />
              <div style={{ height: 5, width: `${w}%`, borderRadius: 3, background: "rgba(255,255,255,0.06)" }} />
            </div>
          ))}
          <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "7px 3px" }} />
          <div style={{ padding: "4px 7px", borderRadius: 5, background: "rgba(168,196,255,0.04)", border: "1px solid rgba(168,196,255,0.08)", display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(168,196,255,0.35)" }} />
            <div style={{ height: 5, width: "55%", borderRadius: 3, background: "rgba(168,196,255,0.18)" }} />
          </div>
        </div>

        {/* Chat */}
        <div style={{ flex: 1, padding: "16px 18px 12px", display: "flex", flexDirection: "column", gap: 10, justifyContent: "flex-end" }}>
          {/* User bubble */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{
              padding: "9px 13px", borderRadius: "11px 11px 3px 11px",
              background: "rgba(167,139,250,0.09)", border: "1px solid rgba(167,139,250,0.14)",
              maxWidth: "68%", display: "flex", flexDirection: "column", gap: 5,
            }}>
              <div style={{ height: 6, width: 170, borderRadius: 3, background: "rgba(167,139,250,0.32)" }} />
              <div style={{ height: 6, width: 110, borderRadius: 3, background: "rgba(167,139,250,0.18)" }} />
            </div>
          </div>
          {/* AI bubble */}
          <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(167,139,250,0.11)", border: "1px solid rgba(167,139,250,0.18)", flexShrink: 0, marginTop: 1 }} />
            <div style={{
              flex: 1, padding: "9px 12px", borderRadius: "3px 11px 11px 11px",
              background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.05)",
              display: "flex", flexDirection: "column", gap: 6,
            }}>
              <div style={{ height: 6, width: "89%", borderRadius: 3, background: "rgba(255,255,255,0.09)" }} />
              <div style={{ height: 6, width: "71%", borderRadius: 3, background: "rgba(255,255,255,0.06)" }} />
              <div style={{ height: 6, width: "80%", borderRadius: 3, background: "rgba(255,255,255,0.07)" }} />
              <div style={{ height: 6, width: "52%", borderRadius: 3, background: "rgba(255,255,255,0.05)" }} />
            </div>
          </div>
          {/* Input */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "9px 11px",
            borderRadius: 9, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", marginTop: 2,
          }}>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.055)" }} />
            <div style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(167,139,250,0.13)", border: "1px solid rgba(167,139,250,0.22)", flexShrink: 0 }} />
          </div>
        </div>
      </div>

      {/* Scanline */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.007) 2px, rgba(255,255,255,0.007) 4px)",
        pointerEvents: "none",
      }} />
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

  useMotionValueEvent(sp, "change", (v) => {
    let idx = 0;
    for (let i = LAYER_AT.length - 1; i >= 0; i--) {
      if (v >= LAYER_AT[i]) { idx = i; break; }
    }
    setActiveIdx(idx);
  });

  // Product rotates from angled → nearly face-on as user scrolls
  const rotateY  = useTransform(sp, [0, 0.6, 1], reduced ? [0, 0, 0] : [-18, -4, 5]);
  const rotateX  = useTransform(sp, [0, 0.6, 1], reduced ? [0, 0, 0] : [14, 2, -2]);
  const scale    = useTransform(sp, [0, 0.15],   reduced ? [1, 1]   : [0.90, 1]);
  const ctaOpacity = useTransform(sp, [0.85, 0.96], [0, 1]);

  const layer = LAYERS[activeIdx];

  return (
    <div style={{ background: "#050507" }}>
      <div className="landing-divider" />

      {/* ── Scroll container — product is sticky inside ── */}
      <div
        ref={containerRef}
        style={{ height: "420vh", position: "relative" }}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {/* Section label + changing feature text — top */}
          <div
            style={{
              width: "100%",
              maxWidth: 760,
              padding: "0 24px",
              marginBottom: 32,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(167,139,250,0.55)",
              }}
            >
              workshop ·{" "}
              <span style={{ color: "rgba(167,139,250,0.35)" }}>
                {String(activeIdx + 1).padStart(2, "0")} / {LAYERS.length}
              </span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={layer.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.28, ease: EASE }}
              >
                <div
                  style={{
                    fontSize: "clamp(22px, 3.5vw, 36px)",
                    fontWeight: 700,
                    color: "#f0f0f2",
                    letterSpacing: "-0.02em",
                    lineHeight: 1.15,
                    marginBottom: 6,
                  }}
                >
                  {layer.icon}{" "}
                  <span
                    style={{
                      background: "linear-gradient(90deg, #fff 0%, rgba(255,255,255,0.65) 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {layer.label}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "clamp(13px, 1.5vw, 15px)",
                    color: "rgba(255,255,255,0.38)",
                    lineHeight: 1.55,
                    maxWidth: 480,
                  }}
                >
                  {layer.desc}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Progress strip */}
            <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
              {LAYERS.map((l, i) => (
                <div
                  key={l.label}
                  style={{
                    height: 2,
                    flex: 1,
                    borderRadius: 2,
                    background: i <= activeIdx
                      ? "rgba(167,139,250,0.70)"
                      : "rgba(255,255,255,0.10)",
                    transition: "background 0.3s",
                  }}
                />
              ))}
            </div>
          </div>

          {/* The 3D product — always visible, rotates as you scroll */}
          <div style={{ perspective: "1400px" }}>
            <motion.div style={{ rotateY, rotateX, scale }}>
              <WorkshopProduct />
            </motion.div>
          </div>

          {/* Bottom CTA — fades in at end of scroll */}
          <motion.div style={{ marginTop: 24, opacity: ctaOpacity }}>
            <Link
              href="/workshop"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "rgba(167,139,250,0.75)",
                textDecoration: "none",
                borderBottom: "1px solid rgba(167,139,250,0.25)",
                paddingBottom: 2,
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
