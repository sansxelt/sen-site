"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* ── Copilot mock ──────────────────────────────────────────────── */
function CopilotMock() {
  const steps = [
    { icon: "◻", label: "Reading context",    done: true  },
    { icon: "⬡", label: "Checking Notion",    done: true  },
    { icon: "◆", label: "Drafting reply",     done: false },
    { icon: "↑", label: "Sending to inbox",   done: false },
  ];
  return (
    <div className="lp-mod-mock">
      <div className="lp-mod-mock-bar">
        <div className="lp-mod-mock-dots"><span /><span /><span /></div>
        <span className="lp-mod-mock-title">copilot · running</span>
        <div style={{ width: 40 }} />
      </div>
      <div className="lp-mod-mock-body" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", marginBottom: 4 }}>
          Task: follow up on open contracts
        </div>
        {steps.map((s) => (
          <div
            key={s.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              borderRadius: 8,
              background: s.done ? "rgba(65,214,155,0.04)" : "rgba(255,255,255,0.02)",
              border: `1px solid ${s.done ? "rgba(65,214,155,0.10)" : "rgba(255,255,255,0.05)"}`,
            }}
          >
            <span style={{ fontSize: 11, color: s.done ? "rgba(65,214,155,0.65)" : "rgba(255,255,255,0.25)" }}>
              {s.done ? "✓" : s.icon}
            </span>
            <span style={{ fontSize: 11, color: s.done ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.28)" }}>
              {s.label}
            </span>
          </div>
        ))}
        <div style={{ marginTop: 4, padding: "7px 10px", borderRadius: 8, background: "rgba(65,214,155,0.05)", border: "1px solid rgba(65,214,155,0.12)", fontSize: 10, color: "rgba(65,214,155,0.55)", letterSpacing: "0.04em" }}>
          ◆ copilot is acting on your behalf
        </div>
      </div>
    </div>
  );
}

/* ── Audio mock ────────────────────────────────────────────────── */
function AudioMock() {
  return (
    <div className="lp-mod-mock">
      <div className="lp-mod-mock-bar">
        <div className="lp-mod-mock-dots"><span /><span /><span /></div>
        <span className="lp-mod-mock-title">audio · active</span>
        <div style={{ width: 40 }} />
      </div>
      <div className="lp-mod-mock-body" style={{ padding: "20px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <div style={{ position: "relative", width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  borderRadius: "50%",
                  border: "1px solid rgba(167,139,250,0.20)",
                  animation: `lp-audio-ring 2s ease-out ${i * 0.6}s infinite`,
                  width: `${40 + i * 20}px`,
                  height: `${40 + i * 20}px`,
                }}
              />
            ))}
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.30)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "rgba(167,139,250,0.80)" }}>
              ◉
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 2, alignItems: "flex-end", height: 28 }}>
          {Array.from({ length: 22 }, (_, i) => (
            <div
              key={i}
              style={{
                width: 2,
                background: "rgba(167,139,250,0.45)",
                borderRadius: 2,
                animation: `lp-aw${(i % 5) + 1} 0.8s ease-in-out ${i * 0.05}s infinite`,
              }}
            />
          ))}
        </div>
        <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center" }}>
          {["AirPods", "Headphones", "Bluetooth", "Any device"].map((d) => (
            <div key={d} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 100, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.32)", letterSpacing: "0.05em" }}>
              {d}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Lens mock ─────────────────────────────────────────────────── */
function LensMock() {
  return (
    <div className="lp-mod-mock">
      <div className="lp-mod-mock-bar">
        <div className="lp-mod-mock-dots"><span /><span /><span /></div>
        <span className="lp-mod-mock-title">lens · preview</span>
        <div style={{ width: 40 }} />
      </div>
      <div
        className="lp-mod-mock-body"
        style={{
          height: 200,
          position: "relative",
          overflow: "hidden",
          background: "rgba(255,172,51,0.02)",
        }}
      >
        {/* Faux camera feed */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(145deg, rgba(255,172,51,0.04) 0%, transparent 60%, rgba(168,196,255,0.04) 100%)" }} />
        <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gridTemplateRows: "repeat(3,1fr)", opacity: 0.12 }}>
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} style={{ border: "0.5px solid rgba(255,255,255,0.3)" }} />
          ))}
        </div>
        {/* Crosshair */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 48, height: 48, border: "1px solid rgba(255,172,51,0.50)", borderRadius: 4 }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 4, height: 4, background: "rgba(255,172,51,0.80)", borderRadius: "50%" }} />
        {/* Overlay label */}
        <div style={{ position: "absolute", bottom: 10, left: 10, right: 10, padding: "6px 9px", borderRadius: 6, background: "rgba(0,0,0,0.50)", backdropFilter: "blur(8px)", fontSize: 9.5, color: "rgba(255,172,51,0.70)", letterSpacing: "0.06em" }}>
          ○ lens · visual context layer · future direction
        </div>
        <div style={{ position: "absolute", top: 10, right: 10, fontSize: 9, padding: "2px 7px", borderRadius: 100, background: "rgba(255,172,51,0.08)", border: "1px solid rgba(255,172,51,0.18)", color: "rgba(255,172,51,0.55)", letterSpacing: "0.08em" }}>
          coming
        </div>
      </div>
    </div>
  );
}

/* ── Module item ───────────────────────────────────────────────── */
interface ModuleProps {
  kicker: string;
  headline: string;
  body: React.ReactNode;
  chips?: string[];
  cta: string;
  ctaHref: string;
  accent: string;
  visual: React.ReactNode;
  flip?: boolean;
}

function ModuleBlock({ kicker, headline, body, chips, cta, ctaHref, accent, visual, flip }: ModuleProps) {
  return (
    <div className="landing-section-dark">
      <div className="landing-divider" />
      <div
        className="landing-section lp-module-grid"
        style={{ display: "grid", gap: 64, alignItems: "center" }}
      >
        <motion.div
          className={flip ? "lp-module-visual" : "lp-module-text"}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.65, ease: EASE }}
        >
          <div className="landing-kicker" style={{ color: accent }}>{kicker}</div>
          <h2 className="landing-h2 landing-gradient-text">{headline}</h2>
          <div className="landing-body" style={{ marginBottom: chips ? 20 : 28 }}>{body}</div>
          {chips && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 28 }}>
              {chips.map((c) => (
                <span
                  key={c}
                  style={{
                    fontSize: 11,
                    padding: "3px 10px",
                    borderRadius: 100,
                    border: `1px solid ${accent}33`,
                    color: accent,
                    background: `${accent}0a`,
                    letterSpacing: "0.05em",
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
          )}
          <Link
            href={ctaHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              fontSize: 13,
              color: accent,
              textDecoration: "none",
              borderBottom: `1px solid ${accent}40`,
              paddingBottom: 2,
            }}
          >
            {cta} <span style={{ fontSize: 11 }}>→</span>
          </Link>
        </motion.div>

        <motion.div
          className={flip ? "lp-module-text" : "lp-module-visual"}
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
          .lp-module-grid .lp-module-visual { order: ${flip ? -1 : 1}; }
        }
      `}</style>
    </div>
  );
}

/* ── Section export ─────────────────────────────────────────────── */
export function ModulesSection() {
  return (
    <>
      {/* Copilot */}
      <ModuleBlock
        kicker="copilot"
        headline="Your AI acts, not just answers."
        body={
          <>
            Copilot works in context across your tools. It reads your threads,
            checks connected apps, drafts, sends, and follows up. You describe
            the outcome. It handles the steps.
          </>
        }
        cta="Learn about Copilot"
        ctaHref="/copilot"
        accent="rgba(65,214,155,0.85)"
        visual={<CopilotMock />}
      />

      {/* Audio */}
      <ModuleBlock
        kicker="audio"
        headline="Sansxel in your ear."
        body={
          <>
            Use Sansxel through your AirPods, headphones, or any audio device
            you already own. Voice is a first-class interface in Workshop today.
            Sansxel Audio is the direction: purpose-built hardware designed
            around how the AI actually works.
          </>
        }
        chips={["AirPods", "Headphones", "Bluetooth", "Third-party audio", "Future hardware"]}
        cta="Learn about Audio"
        ctaHref="/audio"
        accent="rgba(167,139,250,0.85)"
        visual={<AudioMock />}
        flip
      />

      {/* Lens */}
      <ModuleBlock
        kicker="lens"
        headline="Vision that sees your context."
        body={
          <>
            Lens is the visual layer. It will let Sansxel see what you see,
            understand your environment, and respond to context that goes
            beyond text. This is the direction.
          </>
        }
        chips={["Future direction", "Not shipping today"]}
        cta="Learn about Lens"
        ctaHref="/lens"
        accent="rgba(255,172,51,0.85)"
        visual={<LensMock />}
      />

      <style>{`
        @keyframes lp-audio-ring {
          0%   { transform: scale(0.7); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0;   }
        }
        @keyframes lp-aw1 { 0%,100%{height:4px} 50%{height:18px} }
        @keyframes lp-aw2 { 0%,100%{height:8px} 50%{height:22px} }
        @keyframes lp-aw3 { 0%,100%{height:6px} 50%{height:26px} }
        @keyframes lp-aw4 { 0%,100%{height:12px}50%{height:18px} }
        @keyframes lp-aw5 { 0%,100%{height:5px} 50%{height:14px} }
      `}</style>
    </>
  );
}

/* ── Shared mock chrome CSS ─────────────────────────────────────── */
export function ModuleMockStyles() {
  return (
    <style>{`
      .lp-mod-mock {
        background: #0c0c10;
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 14px;
        overflow: hidden;
        box-shadow: 0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03);
      }
      .lp-mod-mock-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 9px 13px;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        background: rgba(255,255,255,0.015);
      }
      .lp-mod-mock-dots { display: flex; gap: 5px; }
      .lp-mod-mock-dots span { display: block; width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.10); }
      .lp-mod-mock-title {
        font-size: 10px;
        color: rgba(255,255,255,0.28);
        font-family: var(--font-geist-mono), ui-monospace, monospace;
        letter-spacing: 0.06em;
      }
      .lp-mod-mock-body { min-height: 140px; }
    `}</style>
  );
}
