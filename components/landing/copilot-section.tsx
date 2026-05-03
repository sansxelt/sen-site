"use client";

import { motion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

const ACTIONS = [
  { label: "Reading current file",        active: true  },
  { label: "Suggesting refactor",         active: true  },
  { label: "Opening terminal",            active: false },
  { label: "Running type check",          active: false },
];

const MCP_NODES = [
  { label: "filesystem",  lit: true  },
  { label: "browser",     lit: true  },
  { label: "github",      lit: false },
  { label: "terminal",    lit: false },
  { label: "figma",       lit: false },
];

const FEATURES = [
  { title: "Screen + context awareness", body: "Copilot sees what you're working on and responds in context. No pasting, no re-explaining." },
  { title: "MCP tool integrations",      body: "Connect files, browsers, code editors, and external services. Copilot acts across them, not just inside a chat box." },
  { title: "Workflow automation",        body: "Chain multi-step actions across apps. Research, write, commit, and send without switching surfaces." },
  { title: "Coding, design, and files",  body: "Inline suggestions for code, design feedback from your canvas, and file operations without a terminal." },
];

function DesktopMock() {
  return (
    <div className="landing-desktop-mock" role="img" aria-label="Sansxel Copilot interface preview">
      <div className="landing-desktop-grid" aria-hidden />

      {/* Floating copilot panel */}
      <motion.div
        className="landing-copilot-panel"
        initial={{ opacity: 0, x: 20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.25 }}
      >
        <div className="landing-copilot-panel-hdr">
          <span style={{ color: "rgba(168,196,255,0.45)", fontSize: 9 }}>◆</span>
          Copilot
        </div>
        {ACTIONS.map((a, i) => (
          <motion.div
            key={a.label}
            className={`landing-copilot-action${a.active ? " landing-copilot-action--active" : ""}`}
            initial={{ opacity: 0, x: 8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.35 + i * 0.08 }}
          >
            <span className="landing-copilot-action-arrow">→</span>
            {a.label}
          </motion.div>
        ))}
      </motion.div>

      {/* Fake editor content in background */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 60,
          left: 20,
          right: 220,
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          fontSize: 10,
          lineHeight: 1.9,
          color: "rgba(255,255,255,0.15)",
          paddingLeft: 12,
        }}
      >
        <div style={{ color: "rgba(168,196,255,0.20)" }}>// middleware/auth.ts</div>
        <div>export async function validateSession(</div>
        <div>{"  "}req: NextRequest</div>
        <div>{") {"}</div>
        <div>{"  "}const token = req.cookies.get("token")</div>
        <div>{"  "}if (!token) return null</div>
        <div>{"  "}return verifyJWT(token.value)</div>
        <div>{"}"}</div>
      </div>

      {/* MCP tool nodes at bottom */}
      <div className="landing-mcp-row">
        {MCP_NODES.map((n) => (
          <div
            key={n.label}
            className={`landing-mcp-node${n.lit ? " landing-mcp-node--lit" : ""}`}
          >
            {n.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CopilotSection() {
  return (
    <div className="landing-section-dark" id="copilot">
      <div className="landing-divider" />
      <div className="landing-section">
        <div
          style={{
            display: "grid",
            gap: 64,
            alignItems: "center",
          }}
          className="landing-copilot-grid"
        >
          {/* Text left */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.65, ease: EASE }}
          >
            <div className="landing-kicker">── sansxel copilot</div>
            <h2 className="landing-h2 landing-gradient-text">
              From answers to action.
            </h2>
            <p className="landing-body">
              Copilot brings AI from the chat window into your desktop, your
              files, and your tools. Context-aware. MCP-connected. Acts across
              apps, not just inside a box.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 32 }}>
              {FEATURES.map((f) => (
                <div key={f.title} className="landing-feature-row">
                  <div className="landing-feature-dot" />
                  <div>
                    <div className="landing-feature-title">{f.title}</div>
                    <div className="landing-feature-body">{f.body}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="landing-chip-row">
              <span className="landing-chip landing-chip--accent">Desktop</span>
              <span className="landing-chip landing-chip--accent">MCP tools</span>
              <span className="landing-chip">Workflows</span>
              <span className="landing-chip">File ops</span>
            </div>
          </motion.div>

          {/* Visual right */}
          <motion.div
            initial={{ opacity: 0, x: 28 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <DesktopMock />
          </motion.div>
        </div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .landing-copilot-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}
