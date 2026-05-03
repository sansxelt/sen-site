"use client";

import { motion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

const FEATURES = [
  {
    icon: "◇",
    title: "Projects",
    body: "Group threads, files, and outputs into focused workspaces. Each project keeps context separate and organized across sessions.",
  },
  {
    icon: "◎",
    title: "Memory",
    body: "Sansxel references past conversations and pinned context as you work. You don't repeat yourself — it already knows.",
  },
  {
    icon: "◻",
    title: "Files",
    body: "Upload PDFs, images, code, and documents. Analyze, summarize, or reference them inside any thread.",
  },
];

const MOCK_PROJECTS = [
  { name: "Product research", threads: 14, active: true },
  { name: "Client brief",     threads: 6,  active: false },
  { name: "Learning notes",   threads: 9,  active: false },
];

const MOCK_FILES = ["market-analysis.pdf", "brief-v2.docx", "comp-screenshots.zip"];

function ProjectMock() {
  return (
    <div className="landing-mock" role="img" aria-label="Sansxel projects panel preview">
      <div className="landing-mock-titlebar">
        <div className="landing-mock-dots">
          <div className="landing-mock-dot" />
          <div className="landing-mock-dot" />
          <div className="landing-mock-dot" />
        </div>
        <span className="landing-mock-title">sansxel · projects</span>
        <div style={{ width: 46 }} />
      </div>

      <div className="landing-mock-body" style={{ height: 380 }}>
        {/* Left rail */}
        <div className="landing-mock-rail" style={{ width: 160 }}>
          <div className="landing-mock-rail-hdr">Projects</div>
          {MOCK_PROJECTS.map((p) => (
            <div
              key={p.name}
              className={`landing-mock-thread${p.active ? " landing-mock-thread--active" : ""}`}
            >
              <span className="landing-mock-proj-icon">◇</span>
              <span style={{ flex: 1, fontSize: 11 }}>{p.name}</span>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.22)" }}>{p.threads}</span>
            </div>
          ))}
          <div className="landing-mock-divider" />
          <div className="landing-mock-rail-hdr">Files</div>
          {MOCK_FILES.map((f) => (
            <div key={f} className="landing-mock-thread" style={{ gap: 5 }}>
              <span style={{ fontSize: 9, color: "rgba(168,196,255,0.45)" }}>◻</span>
              <span style={{ flex: 1, fontSize: 10, color: "rgba(255,255,255,0.42)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {f}
              </span>
            </div>
          ))}
        </div>

        {/* Right panel */}
        <div className="landing-mock-chat" style={{ flex: 1 }}>
          <div style={{ padding: "12px 14px 8px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.80)" }}>
              Product research
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", marginTop: 2 }}>
              14 threads · 3 files · memory active
            </div>
          </div>
          <div style={{ padding: "14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "AI landscape overview", time: "today" },
              { label: "Competitor deep dive",  time: "yesterday" },
              { label: "User interview summary", time: "2d ago" },
              { label: "Positioning draft v2",   time: "3d ago" },
            ].map((t) => (
              <div
                key={t.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  cursor: "default",
                }}
              >
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>{t.label}</span>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.22)" }}>{t.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MemorySection() {
  return (
    <div className="landing-section-dark">
      <div className="landing-divider" />
      <div
        className="landing-section lp-memory-grid"
        style={{
          display: "grid",
          gap: 64,
          alignItems: "center",
        }}
      >
        {/* Text left */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.65, ease: EASE }}
        >
          <div className="landing-kicker">organize</div>
          <h2 className="landing-h2 landing-gradient-text">
            Projects, memory, and files.
          </h2>
          <p className="landing-body">
            Everything you work on can live in a project. Threads stay grouped.
            Files stay accessible. Memory connects it across sessions.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 32 }}>
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                className="landing-feature-row"
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.07, ease: EASE }}
              >
                <div
                  className="landing-feature-dot"
                  style={{ background: "rgba(168,196,255,0.40)" }}
                />
                <div>
                  <div className="landing-feature-title">{f.title}</div>
                  <div className="landing-feature-body">{f.body}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Visual right */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
        >
          <ProjectMock />
        </motion.div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .lp-memory-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}
