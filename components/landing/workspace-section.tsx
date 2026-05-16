"use client";

import { motion } from "framer-motion";
import { DotGrid } from "@/components/dot-grid";

const FEATURES = [
  {
    title: "Stop re-explaining yourself to AI.",
    body: "Projects remember your context, goals, and pinned notes. Every session picks up where the last one left off.",
  },
  {
    title: "Chat that adapts to the ask.",
    body: "Drop a file, paste a link, send a voice note. The workspace reshapes itself to fit what you're working on.",
  },
  {
    title: "Generate inside the conversation.",
    body: "Images, diagrams, and structured outputs appear inline. No switching tabs or tools.",
  },
  {
    title: "Web research, built in.",
    body: "Search the web and pull live data directly into your reply, with sources you can inspect.",
  },
  {
    title: "Voice, two ways.",
    body: "Dictate your message or go full voice conversation. Low-latency, back-and-forth, hands-free.",
  },
  {
    title: "Threads that follow you.",
    body: "Conversations save server-side and sync across every device. Titled automatically so you can find them again.",
  },
];

const EASE = [0.16, 1, 0.3, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE, delay: i * 0.07 },
  }),
};

function WorkspaceMock() {
  return (
    <div className="landing-mock" role="img" aria-label="vraelis workspace interface preview">
      {/* Title bar */}
      <div className="landing-mock-titlebar">
        <div className="landing-mock-dots">
          <div className="landing-mock-dot" />
          <div className="landing-mock-dot" />
          <div className="landing-mock-dot" />
        </div>
        <span className="landing-mock-title">vraelis · workspace</span>
        <div style={{ width: 46 }} />
      </div>

      <div className="landing-mock-body">
        {/* Left rail */}
        <div className="landing-mock-rail">
          <div className="landing-mock-rail-hdr">
            <span>History</span>
            <span className="landing-mock-new">+ New</span>
          </div>

          <div className="landing-mock-section">
            <span className="landing-mock-proj-icon">◇</span>
            Main App
          </div>
          <div className="landing-mock-thread landing-mock-thread--active">
            Auth system refactor
          </div>
          <div className="landing-mock-thread">Landing page copy</div>

          <div className="landing-mock-divider" />

          <div className="landing-mock-section">All chats</div>
          <div className="landing-mock-thread">Product roadmap</div>
          <div className="landing-mock-thread">API rate limits</div>
          <div className="landing-mock-thread">Design feedback</div>
        </div>

        {/* Chat area */}
        <div className="landing-mock-chat">
          <div className="landing-mock-bubble landing-mock-bubble--user">
            Help me refactor the auth middleware, it's getting messy
          </div>

          <div className="landing-mock-bubble landing-mock-bubble--ai">
            <div>Sure. The issue is that session validation and role checks are co-located. Split them:</div>
            <div className="landing-mock-code">
              {`// middleware/auth.ts\nexport const validateSession = ...\nexport const requireRole = ...\n\n// compose in route handlers`}
            </div>
          </div>

          {/* Composer */}
          <div className="landing-mock-composer">
            <span className="landing-mock-chip">◇ Main App</span>
            <span className="landing-mock-input-hint">Reply…</span>
            <div className="landing-mock-send-btn">↑</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WorkspaceSection() {
  return (
    <div className="landing-section-dark" id="workspace">
      <div className="landing-section">
        <DotGrid opacity={0.035} />

        <div
          className="landing-workspace"
          style={{
            display: "grid",
            gap: 64,
          }}
        >
          {/* Left — sticky on desktop */}
          <motion.div
            className="landing-workspace-sticky"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            style={{ position: "sticky", top: 120 }}
            variants={{ hidden: {}, visible: {} }}
          >
            <motion.div
              className="landing-kicker"
              custom={0}
              variants={fadeUp}
            >
              ── today
            </motion.div>
            <motion.h2
              className="landing-h2 landing-gradient-text"
              custom={1}
              variants={fadeUp}
            >
              Start with the workspace.
            </motion.h2>
            <motion.p
              className="landing-body"
              custom={2}
              variants={fadeUp}
            >
              Everything you need to think, create, and ship. One surface
              that adapts to the work, not the other way around.
            </motion.p>

            <div
              style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 36 }}
            >
              {FEATURES.map((f, i) => (
                <motion.div
                  key={f.title}
                  className="landing-feature-row"
                  custom={3 + i}
                  variants={fadeUp}
                >
                  <div className="landing-feature-dot" />
                  <div>
                    <div className="landing-feature-title">{f.title}</div>
                    <div className="landing-feature-body">{f.body}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right — mock UI */}
          <motion.div
            initial={{ opacity: 0, x: 32 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          >
            <WorkspaceMock />
          </motion.div>
        </div>
      </div>

      {/* Responsive: desktop gets 2-col, mobile is single col */}
      <style>{`
        @media (min-width: 1024px) {
          #workspace .landing-section > div {
            grid-template-columns: 400px 1fr;
            align-items: start;
          }
        }
      `}</style>
    </div>
  );
}
