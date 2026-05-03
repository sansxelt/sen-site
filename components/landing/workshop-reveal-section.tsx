"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  type MotionValue,
} from "framer-motion";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const LAYERS = [
  { id: "chat",         icon: "◎", label: "Chat",         desc: "Full conversations with persistent context. Not one-shot prompts." },
  { id: "projects",     icon: "◇", label: "Projects",     desc: "Organize threads, files, and memory into focused workspaces." },
  { id: "files",        icon: "◻", label: "Files",        desc: "PDFs, images, code. Referenced inside any thread." },
  { id: "memory",       icon: "◈", label: "Memory",       desc: "Context that carries across every session. You never repeat yourself." },
  { id: "creation",     icon: "◆", label: "Creation",     desc: "Generate images and visuals inline. No separate tool." },
  { id: "voice",        icon: "◉", label: "Voice",        desc: "Low-latency, hands-free conversation. Back and forth." },
  { id: "integrations", icon: "⬡", label: "Integrations", desc: "Connect your tools. Act across your entire stack." },
] as const;

type LayerId = (typeof LAYERS)[number]["id"];

const BREAKS: Record<LayerId, [number, number]> = {
  chat:         [0.04, 0.13],
  projects:     [0.18, 0.27],
  files:        [0.32, 0.41],
  memory:       [0.46, 0.55],
  creation:     [0.60, 0.69],
  voice:        [0.74, 0.83],
  integrations: [0.87, 0.96],
};

type MV = MotionValue<number>;

function WorkshopMock({
  chatO, projO, projX, filesO, memO, createO, voiceO, integrO,
}: {
  chatO: MV; projO: MV; projX: MV; filesO: MV;
  memO: MV; createO: MV; voiceO: MV; integrO: MV;
}) {
  return (
    <div className="ws-mock">
      <div className="ws-titlebar">
        <div className="ws-dots"><span /><span /><span /></div>
        <span className="ws-title">sansxel · workshop</span>
        <div style={{ width: 46 }} />
      </div>

      <div className="ws-body">
        <motion.div className="ws-rail" style={{ opacity: projO, x: projX }}>
          <div className="ws-rail-label">Projects</div>
          {["Research", "Client brief", "Notes"].map((p, i) => (
            <div key={p} className={`ws-rail-item${i === 0 ? " ws-rail-item--active" : ""}`}>
              <span className="ws-rail-icon">◇</span>{p}
            </div>
          ))}
          <div className="ws-rail-div" />
          <div className="ws-rail-label">Files</div>
          <motion.div style={{ opacity: filesO }}>
            {["report.pdf", "screen.png", "notes.md"].map((f) => (
              <div key={f} className="ws-rail-item ws-rail-item--file">
                <span className="ws-rail-icon" style={{ color: "rgba(168,196,255,0.38)" }}>◻</span>
                {f}
              </div>
            ))}
          </motion.div>
          <div className="ws-rail-div" />
          <motion.div className="ws-mem-badge" style={{ opacity: memO }}>
            <span>◈</span>memory active
          </motion.div>
          <motion.div style={{ opacity: integrO }}>
            <div className="ws-rail-label" style={{ marginTop: 8 }}>Integrations</div>
            <div className="ws-integ-row">
              {["Notion", "GitHub", "Figma"].map((n) => (
                <div key={n} className="ws-integ-chip">{n}</div>
              ))}
            </div>
          </motion.div>
        </motion.div>

        <div className="ws-main">
          <motion.div className="ws-messages" style={{ opacity: chatO }}>
            <div className="ws-msg ws-msg--user">
              Summarize the market report and pull the key risks
            </div>
            <div className="ws-msg ws-msg--ai">
              <div className="ws-skel" style={{ width: "91%" }} />
              <div className="ws-skel" style={{ width: "76%" }} />
              <div className="ws-skel" style={{ width: "84%" }} />
            </div>
          </motion.div>

          <motion.div className="ws-creation-card" style={{ opacity: createO }}>
            <div className="ws-creation-label">◆ image · generating</div>
            <div className="ws-creation-canvas">
              <div className="ws-creation-shimmer" />
            </div>
          </motion.div>

          <motion.div className="ws-voice-row" style={{ opacity: voiceO }}>
            <span style={{ fontSize: 12, color: "rgba(167,139,250,0.75)" }}>◉</span>
            <div className="ws-waveform">
              {Array.from({ length: 18 }, (_, i) => (
                <div key={i} className="ws-wave-bar" style={{ animationDelay: `${i * 0.06}s` }} />
              ))}
            </div>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.28)" }}>listening</span>
          </motion.div>
        </div>
      </div>

      <div className="ws-input-row">
        <div className="ws-input-field"><span>Ask anything…</span></div>
        <div className="ws-input-send">↑</div>
      </div>
    </div>
  );
}

export function WorkshopRevealSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [activeIdx, setActiveIdx] = useState(-1);

  const { scrollYProgress: sp } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(sp, "change", (v) => {
    let idx = -1;
    for (let i = 0; i < LAYERS.length; i++) {
      if (v >= BREAKS[LAYERS[i].id][0]) idx = i;
    }
    setActiveIdx(idx);
  });

  const rotateY = useTransform(sp, [0, 0.45, 1], reduced ? [0, 0, 0] : [-12, 0, 5]);
  const rotateX = useTransform(sp, [0, 0.35, 1], reduced ? [0, 0, 0] : [5, 0, -2]);
  const scaleP  = useTransform(sp, [0, 0.12],    reduced ? [1, 1] : [0.88, 1]);

  const chatO   = useTransform(sp, BREAKS.chat,         [0, 1]);
  const projO   = useTransform(sp, BREAKS.projects,     [0, 1]);
  const projX   = useTransform(sp, BREAKS.projects,     [-48, 0]);
  const filesO  = useTransform(sp, BREAKS.files,        [0, 1]);
  const memO    = useTransform(sp, BREAKS.memory,       [0, 1]);
  const createO = useTransform(sp, BREAKS.creation,     [0, 1]);
  const voiceO  = useTransform(sp, BREAKS.voice,        [0, 1]);
  const integrO = useTransform(sp, BREAKS.integrations, [0, 1]);

  const chatLO   = useTransform(sp, [0.04, 0.13, 0.15, 0.24], [0, 1, 1, 0]);
  const projLO   = useTransform(sp, [0.18, 0.27, 0.29, 0.38], [0, 1, 1, 0]);
  const filesLO  = useTransform(sp, [0.32, 0.41, 0.43, 0.52], [0, 1, 1, 0]);
  const memLO    = useTransform(sp, [0.46, 0.55, 0.57, 0.66], [0, 1, 1, 0]);
  const createLO = useTransform(sp, [0.60, 0.69, 0.71, 0.80], [0, 1, 1, 0]);
  const voiceLO  = useTransform(sp, [0.74, 0.83, 0.85, 0.94], [0, 1, 1, 0]);
  const integrLO = useTransform(sp, [0.87, 0.96],              [0, 1]);

  const labelOps = [chatLO, projLO, filesLO, memLO, createLO, voiceLO, integrLO];

  return (
    <div style={{ background: "#050507" }}>
      <div className="landing-divider" />

      {/* Section header — scrolls normally before sticky kicks in */}
      <motion.div
        className="landing-section"
        style={{ paddingBottom: 80, maxWidth: 560 }}
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.65, ease: EASE }}
      >
        <div className="landing-kicker">workshop</div>
        <h2 className="landing-h2 landing-gradient-text">
          Everything, in one workspace.
        </h2>
        <p className="landing-body">
          Workshop is the core of Sansxel. Chat, projects, files, memory,
          creation, voice, and integrations. Scroll to see what is inside.
        </p>
      </motion.div>

      {/* Scroll-driven reveal — desktop */}
      <div
        ref={containerRef}
        className="ws-scroll-container"
        style={{ height: "500vh" }}
      >
        <div className="ws-sticky-viewport">
          {/* Label panel — left */}
          <div className="ws-label-panel">
            <div style={{ position: "relative", height: 130 }}>
              {LAYERS.map((layer, i) => (
                <motion.div
                  key={layer.id}
                  className="ws-label-item"
                  style={{ opacity: labelOps[i] }}
                >
                  <div className="ws-label-icon">{layer.icon}</div>
                  <div className="ws-label-title">{layer.label}</div>
                  <div className="ws-label-desc">{layer.desc}</div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* 3D product — center */}
          <div className="ws-stage">
            <div style={{ perspective: "1400px" }}>
              <motion.div style={{ rotateY, rotateX, scale: scaleP }}>
                <WorkshopMock
                  chatO={chatO} projO={projO} projX={projX}
                  filesO={filesO} memO={memO} createO={createO}
                  voiceO={voiceO} integrO={integrO}
                />
              </motion.div>
            </div>
          </div>

          {/* Progress dots — right */}
          <div className="ws-progress-panel">
            <div className="ws-progress-track">
              {LAYERS.map((layer, i) => (
                <div
                  key={layer.id}
                  className="ws-progress-dot"
                  style={{
                    background: i <= activeIdx
                      ? "rgba(167,139,250,0.80)"
                      : "rgba(255,255,255,0.14)",
                    transform: i === activeIdx ? "scale(1.4)" : "scale(1)",
                  }}
                  title={layer.label}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: simplified whileInView list */}
      <div className="ws-mobile-list">
        <div className="landing-section" style={{ paddingTop: 0 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              marginBottom: 40,
            }}
          >
            {LAYERS.map((layer, i) => (
              <motion.div
                key={layer.id}
                className="landing-feature-row"
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.06, ease: EASE }}
              >
                <div className="landing-feature-dot" style={{ background: "rgba(167,139,250,0.45)" }} />
                <div>
                  <div className="landing-feature-title">{layer.label}</div>
                  <div className="landing-feature-body">{layer.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Post-reveal CTA */}
      <div className="landing-section" style={{ paddingTop: 56, paddingBottom: 80 }}>
        <Link
          href="/workshop"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: "rgba(167,139,250,0.80)",
            textDecoration: "none",
            borderBottom: "1px solid rgba(167,139,250,0.25)",
            paddingBottom: 2,
          }}
        >
          Explore Workshop in full
          <span style={{ fontSize: 11 }}>→</span>
        </Link>
      </div>

      <style>{`
        /* ── scroll container ── */
        .ws-scroll-container { position: relative; }
        .ws-sticky-viewport {
          position: sticky;
          top: 0;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
          overflow: hidden;
        }

        /* ── side panels (desktop only) ── */
        .ws-label-panel {
          width: 240px;
          flex-shrink: 0;
          padding-right: 32px;
        }
        .ws-label-item {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          gap: 7px;
        }
        .ws-label-icon { font-size: 18px; color: rgba(255,255,255,0.35); }
        .ws-label-title { font-size: 16px; font-weight: 600; color: rgba(255,255,255,0.82); }
        .ws-label-desc  { font-size: 13px; color: rgba(255,255,255,0.36); line-height: 1.55; }

        .ws-stage { flex-shrink: 0; }

        .ws-progress-panel {
          width: 120px;
          flex-shrink: 0;
          padding-left: 40px;
          display: flex;
          align-items: center;
        }
        .ws-progress-track {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .ws-progress-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          transition: background 0.3s, transform 0.3s;
          flex-shrink: 0;
        }

        /* ── mobile: show list, hide scroll reveal ── */
        .ws-mobile-list { display: none; }
        @media (max-width: 1023px) {
          .ws-scroll-container { display: none; }
          .ws-mobile-list      { display: block; }
        }

        /* ── mock shell ── */
        .ws-mock {
          width: 640px;
          background: #0c0c10;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 40px 120px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.04);
        }

        /* titlebar */
        .ws-titlebar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          background: rgba(255,255,255,0.015);
        }
        .ws-dots { display: flex; gap: 5px; }
        .ws-dots span { display: block; width: 9px; height: 9px; border-radius: 50%; background: rgba(255,255,255,0.11); }
        .ws-title {
          font-size: 11px;
          color: rgba(255,255,255,0.32);
          font-family: var(--font-geist-mono), ui-monospace, monospace;
          letter-spacing: 0.06em;
        }

        /* body */
        .ws-body { display: flex; height: 336px; }

        /* rail */
        .ws-rail {
          width: 148px;
          border-right: 1px solid rgba(255,255,255,0.04);
          padding: 10px 8px;
          display: flex;
          flex-direction: column;
          gap: 1px;
          flex-shrink: 0;
          overflow: hidden;
        }
        .ws-rail-label {
          font-size: 8.5px;
          font-weight: 600;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.20);
          padding: 4px 6px 2px;
        }
        .ws-rail-item {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 6px;
          border-radius: 6px;
          font-size: 10.5px;
          color: rgba(255,255,255,0.38);
          cursor: default;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ws-rail-item--active {
          background: rgba(167,139,250,0.09);
          color: rgba(167,139,250,0.80);
        }
        .ws-rail-item--file { color: rgba(255,255,255,0.28); }
        .ws-rail-icon { font-size: 9px; flex-shrink: 0; }
        .ws-rail-div { height: 1px; background: rgba(255,255,255,0.04); margin: 5px 4px; }

        .ws-mem-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 7px;
          border-radius: 6px;
          background: rgba(168,196,255,0.05);
          border: 1px solid rgba(168,196,255,0.10);
          font-size: 9px;
          color: rgba(168,196,255,0.60);
          margin: 2px 0;
        }
        .ws-integ-row { display: flex; flex-wrap: wrap; gap: 3px; padding: 2px 4px; }
        .ws-integ-chip {
          font-size: 9px;
          padding: 2px 5px;
          border-radius: 4px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.30);
        }

        /* main area */
        .ws-main {
          flex: 1;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          overflow: hidden;
        }
        .ws-messages { display: flex; flex-direction: column; gap: 10px; }
        .ws-msg {
          padding: 9px 11px;
          border-radius: 10px;
          font-size: 11px;
          line-height: 1.5;
        }
        .ws-msg--user {
          background: rgba(167,139,250,0.08);
          border: 1px solid rgba(167,139,250,0.13);
          color: rgba(255,255,255,0.60);
          align-self: flex-end;
          max-width: 86%;
        }
        .ws-msg--ai {
          background: rgba(255,255,255,0.015);
          border: 1px solid rgba(255,255,255,0.05);
          display: flex;
          flex-direction: column;
          gap: 7px;
          padding: 10px 12px;
        }
        .ws-skel { height: 9px; border-radius: 4px; background: rgba(255,255,255,0.07); }

        /* creation */
        .ws-creation-card { border-radius: 10px; overflow: hidden; border: 1px solid rgba(255,255,255,0.06); }
        .ws-creation-label {
          font-size: 9.5px;
          color: rgba(167,139,250,0.60);
          padding: 7px 10px;
          background: rgba(255,255,255,0.02);
          border-bottom: 1px solid rgba(255,255,255,0.04);
          letter-spacing: 0.05em;
        }
        .ws-creation-canvas {
          height: 60px;
          background: linear-gradient(135deg, rgba(167,139,250,0.05) 0%, rgba(168,196,255,0.03) 50%, rgba(65,214,155,0.04) 100%);
          position: relative;
          overflow: hidden;
        }
        .ws-creation-shimmer {
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(167,139,250,0.10) 40%, transparent 80%);
          animation: ws-shimmer 2.2s ease-in-out infinite;
        }
        @keyframes ws-shimmer {
          0%, 100% { opacity: 0.3; transform: translateX(-30%); }
          50%       { opacity: 1;   transform: translateX(30%);  }
        }

        /* voice */
        .ws-voice-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 10px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
        }
        .ws-waveform { display: flex; align-items: center; gap: 2px; height: 20px; flex: 1; }
        .ws-wave-bar {
          width: 2px;
          background: rgba(167,139,250,0.50);
          border-radius: 2px;
          animation: ws-wave 0.9s ease-in-out infinite;
        }
        @keyframes ws-wave {
          0%, 100% { height: 3px;  }
          50%       { height: 14px; }
        }

        /* input */
        .ws-input-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-top: 1px solid rgba(255,255,255,0.04);
        }
        .ws-input-field {
          flex: 1;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 11px;
          color: rgba(255,255,255,0.22);
        }
        .ws-input-send {
          width: 28px;
          height: 28px;
          border-radius: 7px;
          background: rgba(167,139,250,0.12);
          border: 1px solid rgba(167,139,250,0.22);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          color: rgba(167,139,250,0.70);
          cursor: default;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
