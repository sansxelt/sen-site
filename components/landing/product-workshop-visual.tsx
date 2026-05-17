"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const TABS = [
  {
    label: "Chat + Voice",
    accent: [167, 139, 250] as const,
    zone: "center" as const,
    desc: "Full conversations with persistent context and voice input. Not one-shot prompts.",
  },
  {
    label: "Files",
    accent: [168, 196, 255] as const,
    zone: "center" as const,
    desc: "Drop PDFs, images, code, and screenshots into the thread. Vraelis routes the right tool automatically.",
  },
  {
    label: "Memory",
    accent: [100, 200, 130] as const,
    zone: "right" as const,
    desc: "Context that carries across every session. You never repeat yourself.",
  },
  {
    label: "Creation",
    accent: [200, 130, 255] as const,
    zone: "center" as const,
    desc: "Generate images and visuals inline. No separate tool required.",
  },
  {
    label: "Research",
    accent: [255, 172, 51] as const,
    zone: "center" as const,
    desc: "Search the web, read papers, and pull live data — all inside the workspace.",
  },
  {
    label: "MCP",
    accent: [100, 210, 255] as const,
    zone: "center" as const,
    desc: "Connect tools. Act across your entire stack from one surface.",
  },
  {
    label: "Projects",
    accent: [130, 160, 255] as const,
    zone: "left" as const,
    desc: "Group threads, files, and memory into one workspace per context.",
  },
];

function TabContent({ tab }: { tab: number }) {
  const [r, g, b] = TABS[tab].accent;
  const ac = `rgba(${r},${g},${b}`;

  if (tab === 0) return (
    <div style={{ flex: 1, padding: "11px 13px", display: "flex", flexDirection: "column", gap: 8, justifyContent: "flex-end" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ padding: "8px 11px", borderRadius: "10px 10px 3px 10px", background: `${ac},0.11)`, border: `1px solid ${ac},0.18)`, maxWidth: "68%", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ height: 5, width: 132, borderRadius: 3, background: `${ac},0.42)` }} />
          <div style={{ height: 5, width: 88,  borderRadius: 3, background: `${ac},0.24)` }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <div style={{ width: 20, height: 20, borderRadius: 6, background: `${ac},0.17)`, border: `1px solid ${ac},0.28)`, flexShrink: 0, marginTop: 1 }} />
        <div style={{ flex: 1, padding: "8px 11px", borderRadius: "3px 10px 10px 10px", background: "rgba(255,255,255,0.026)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 4.5 }}>
          <div style={{ height: 5, width: "90%", borderRadius: 3, background: "rgba(255,255,255,0.17)" }} />
          <div style={{ height: 5, width: "74%", borderRadius: 3, background: "rgba(255,255,255,0.12)" }} />
          <div style={{ height: 5, width: "83%", borderRadius: 3, background: "rgba(255,255,255,0.14)" }} />
          <div style={{ height: 5, width: "55%", borderRadius: 3, background: "rgba(255,255,255,0.08)" }} />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: `${ac},0.07)`, border: `1px solid ${ac},0.14)`, alignSelf: "flex-start" }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: `${ac},0.85)`, boxShadow: `0 0 8px ${ac},0.55)`, flexShrink: 0 }} />
        <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
          {[4, 7, 5, 9, 6, 8, 4, 7, 5, 6].map((h, i) => (
            <div key={i} style={{ width: 2, height: h, borderRadius: 1, background: `${ac},${0.28 + (i % 3) * 0.14})` }} />
          ))}
        </div>
        <div style={{ height: 4, width: 62, borderRadius: 3, background: `${ac},0.20)` }} />
      </div>
    </div>
  );

  if (tab === 1) return (
    <div style={{ flex: 1, padding: "11px 13px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: `${ac},0.60)`, marginBottom: 2 }}>Dropped in this thread</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5 }}>
        {[
          { type: "PDF", c: "rgba(255,100,80," },
          { type: "IMG", c: "rgba(100,200,130," },
          { type: "JS",  c: `${ac},` },
          { type: "CSV", c: "rgba(255,172,51," },
          { type: "PNG", c: "rgba(100,200,130," },
          { type: "PDF", c: "rgba(255,100,80," },
        ].map((f, i) => (
          <div key={i} style={{ padding: "8px 7px", borderRadius: 8, background: `${f.c}0.07)`, border: `1px solid ${f.c}0.16)`, display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
            <div style={{ width: 22, height: 28, borderRadius: 4, background: `${f.c}0.12)`, border: `1px solid ${f.c}0.20)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 5.5, fontWeight: 700, color: `${f.c}0.80)`, fontFamily: "monospace" }}>{f.type}</span>
            </div>
            <div style={{ height: 3.5, width: "75%", borderRadius: 2, background: "rgba(255,255,255,0.10)" }} />
            <div style={{ height: 3, width: "52%", borderRadius: 2, background: "rgba(255,255,255,0.06)" }} />
          </div>
        ))}
      </div>
      <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.022)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ height: 4.5, width: "86%", borderRadius: 3, background: "rgba(255,255,255,0.15)" }} />
        <div style={{ height: 4.5, width: "68%", borderRadius: 3, background: "rgba(255,255,255,0.10)" }} />
        <div style={{ height: 4.5, width: "58%", borderRadius: 3, background: "rgba(255,255,255,0.07)" }} />
      </div>
    </div>
  );

  if (tab === 2) return (
    <div style={{ flex: 1, padding: "11px 13px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: `${ac},0.60)`, marginBottom: 2 }}>Active context</div>
      {["Working on", "Preferences", "Last session", "Ongoing"].map((label, i) => (
        <div key={i} style={{ padding: "8px 10px", borderRadius: 8, background: `${ac},0.06)`, border: `1px solid ${ac},0.15)`, display: "flex", gap: 8 }}>
          <div style={{ width: 2.5, borderRadius: 2, background: `${ac},0.55)`, flexShrink: 0 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ fontSize: 6, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: `${ac},0.65)` }}>{label}</div>
            <div style={{ height: 4, width: `${[68, 80, 62, 55][i]}%`, borderRadius: 3, background: "rgba(255,255,255,0.17)" }} />
            <div style={{ height: 3.5, width: `${[50, 60, 72, 44][i]}%`, borderRadius: 3, background: "rgba(255,255,255,0.10)" }} />
          </div>
        </div>
      ))}
    </div>
  );

  if (tab === 3) return (
    <div style={{ flex: 1, padding: "11px 13px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: `${ac},0.60)`, marginBottom: 2 }}>Image generation</div>
      <div style={{ padding: "7px 10px", borderRadius: 7, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 7 }}>
        <div style={{ width: 5, height: 5, borderRadius: "50%", background: `${ac},0.75)`, flexShrink: 0 }} />
        <div style={{ height: 4, width: "72%", borderRadius: 3, background: "rgba(255,255,255,0.13)" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5 }}>
        {[{ done: true, op: 0.95 }, { done: true, op: 0.80 }, { done: false, op: 0.45 }].map((img, i) => (
          <div key={i} style={{ aspectRatio: "1", borderRadius: 8, opacity: img.op, background: img.done ? `linear-gradient(135deg, ${ac},0.20) 0%, ${ac},0.08) 100%)` : "rgba(255,255,255,0.04)", border: `1px solid ${ac},${img.done ? 0.24 : 0.08})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {!img.done ? (
              <div style={{ display: "flex", gap: 2.5 }}>{[0, 1, 2].map(j => <div key={j} style={{ width: 3, height: 3, borderRadius: "50%", background: `${ac},0.55)` }} />)}</div>
            ) : (
              <div style={{ width: "60%", height: "55%", borderRadius: 4, background: `${ac},0.18)` }} />
            )}
          </div>
        ))}
      </div>
      <div style={{ padding: "7px 10px", borderRadius: 8, background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ height: 4.5, width: "80%", borderRadius: 3, background: "rgba(255,255,255,0.14)" }} />
        <div style={{ height: 4, width: "58%", borderRadius: 3, background: "rgba(255,255,255,0.09)" }} />
      </div>
    </div>
  );

  if (tab === 4) return (
    <div style={{ flex: 1, padding: "11px 13px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: `${ac},0.60)`, marginBottom: 2 }}>Live research</div>
      <div style={{ padding: "7px 10px", borderRadius: 7, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 7 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", border: `1.5px solid ${ac},0.60)`, flexShrink: 0 }} />
        <div style={{ height: 4, width: "68%", borderRadius: 3, background: "rgba(255,255,255,0.13)" }} />
        <div style={{ height: 16, width: 22, borderRadius: 4, background: `${ac},0.16)`, marginLeft: "auto" }} />
      </div>
      {[{ d: "72%", t: "80%", s1: "88%", s2: "60%" }, { d: "58%", t: "70%", s1: "82%", s2: "52%" }, { d: "65%", t: "75%", s1: "78%", s2: "46%" }].map((res, i) => (
        <div key={i} style={{ padding: "8px 10px", borderRadius: 8, background: `${ac},0.05)`, border: `1px solid ${ac},0.13)`, display: "flex", flexDirection: "column", gap: 3.5 }}>
          <div style={{ height: 3.5, width: res.d, borderRadius: 2, background: `${ac},0.38)` }} />
          <div style={{ height: 4.5, width: res.t, borderRadius: 3, background: "rgba(255,255,255,0.17)" }} />
          <div style={{ height: 3.5, width: res.s1, borderRadius: 3, background: "rgba(255,255,255,0.09)" }} />
          <div style={{ height: 3.5, width: res.s2, borderRadius: 3, background: "rgba(255,255,255,0.06)" }} />
        </div>
      ))}
    </div>
  );

  if (tab === 5) return (
    <div style={{ flex: 1, padding: "11px 13px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: `${ac},0.60)`, marginBottom: 2 }}>Connected tools</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 5 }}>
        {[{ w: 48, on: true }, { w: 42, on: true }, { w: 54, on: true }, { w: 62, on: false }, { w: 44, on: true }, { w: 38, on: false }].map((t, i) => (
          <div key={i} style={{ padding: "8px 9px", borderRadius: 8, background: t.on ? `${ac},0.07)` : "rgba(255,255,255,0.025)", border: `1px solid ${t.on ? `${ac},0.18)` : "rgba(255,255,255,0.07)"}`, display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 16, height: 16, borderRadius: 4, background: t.on ? `${ac},0.20)` : "rgba(255,255,255,0.07)", flexShrink: 0 }} />
            <div>
              <div style={{ height: 4.5, width: `${t.w}%`, borderRadius: 3, background: "rgba(255,255,255,0.16)", marginBottom: 3 }} />
              <div style={{ height: 3, width: t.on ? 34 : 26, borderRadius: 2, background: t.on ? `${ac},0.45)` : "rgba(255,255,255,0.08)" }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ height: 4.5, width: "76%", borderRadius: 3, background: "rgba(255,255,255,0.14)" }} />
        <div style={{ height: 4, width: "52%", borderRadius: 3, background: "rgba(255,255,255,0.09)" }} />
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, padding: "11px 13px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: `${ac},0.60)`, marginBottom: 2 }}>Your projects</div>
      {[{ w: 64, progress: 72 }, { w: 52, progress: 40 }, { w: 70, progress: 88 }].map((p, i) => (
        <div key={i} style={{ padding: "9px 10px", borderRadius: 8, background: `${ac},0.07)`, border: `1px solid ${ac},0.17)`, display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 13, height: 13, borderRadius: 4, background: `${ac},0.25)`, flexShrink: 0 }} />
            <div style={{ height: 5, width: `${p.w}%`, borderRadius: 3, background: "rgba(255,255,255,0.20)" }} />
          </div>
          <div style={{ height: 2.5, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${p.progress}%`, borderRadius: 2, background: `${ac},0.55)` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function WorkshopPanel({ activeTab }: { activeTab: number }) {
  const [r, g, b] = TABS[activeTab].accent;
  const ac = `rgba(${r},${g},${b}`;
  const zone = TABS[activeTab].zone;

  return (
    <div style={{ position: "relative" }}>
      <div style={{
        position: "absolute", bottom: -40, left: "9%", right: "9%", height: 56,
        background: `radial-gradient(ellipse, ${ac},0.20) 0%, transparent 70%)`,
        filter: "blur(24px)", pointerEvents: "none",
      }} />
      <div style={{
        width: "min(900px, 94vw)",
        aspectRatio: "16 / 10",
        background: "linear-gradient(148deg, #181824 0%, #0f0f1a 50%, #0c0c13 100%)",
        borderRadius: 16,
        border: `1px solid ${ac},0.22)`,
        overflow: "hidden",
        position: "relative",
        transition: "border-color 0.40s, box-shadow 0.40s",
        boxShadow: [`0 0 0 1px ${ac},0.07) inset`, "0 2px 0 rgba(255,255,255,0.09) inset", "0 48px 140px rgba(0,0,0,0.85)", `0 0 80px ${ac},0.12)`].join(","),
      }}>
        <div style={{ position: "absolute", top: "-20%", left: "38%", right: 0, height: "50%", background: `radial-gradient(ellipse, ${ac},0.12) 0%, transparent 70%)`, pointerEvents: "none", transition: "background 0.4s" }} />

        {/* Titlebar */}
        <div style={{ height: 36, borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.022)", display: "flex", alignItems: "center", padding: "0 13px", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 5.5 }}>
            {(["rgba(255,88,78,0.42)", "rgba(255,188,48,0.32)", "rgba(55,200,88,0.30)"] as const).map((c, i) => (
              <div key={i} style={{ width: 9.5, height: 9.5, borderRadius: "50%", background: c }} />
            ))}
          </div>
          <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.30)", fontFamily: "var(--font-geist-mono), monospace", letterSpacing: "0.07em" }}>Vraelis workshop</span>
          <div style={{ display: "flex", gap: 4 }}>
            {TABS.slice(0, 4).map((t, i) => (
              <div key={i} style={{ height: 18, padding: "0 7px", borderRadius: 5, display: "flex", alignItems: "center", background: i === activeTab ? `${ac},0.14)` : "rgba(255,255,255,0.03)", border: `1px solid ${i === activeTab ? `${ac},0.26)` : "rgba(255,255,255,0.06)"}`, transition: "all 0.35s" }}>
                <div style={{ height: 3.5, width: 18, borderRadius: 2, background: "rgba(255,255,255,0.14)" }} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", height: "calc(100% - 36px)" }}>
          {/* LEFT SIDEBAR */}
          <div style={{ width: "21%", borderRight: "1px solid rgba(255,255,255,0.055)", padding: "11px 8px", display: "flex", flexDirection: "column", gap: 3, boxShadow: zone === "left" ? `inset 0 0 0 1px ${ac},0.22), 3px 0 20px ${ac},0.07)` : "none", transition: "box-shadow 0.40s" }}>
            <div style={{ height: 24, borderRadius: 5, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 6, display: "flex", alignItems: "center", padding: "0 7px", gap: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", border: "1.2px solid rgba(255,255,255,0.22)", flexShrink: 0 }} />
              <div style={{ height: 4, width: "52%", borderRadius: 2, background: "rgba(255,255,255,0.09)" }} />
            </div>
            <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.20em", textTransform: "uppercase", color: zone === "left" ? `${ac},0.72)` : "rgba(167,139,250,0.52)", padding: "2px 5px 3px", transition: "color 0.35s" }}>Projects</div>
            {([56, 44, 50] as const).map((w, i) => (
              <div key={i} style={{ padding: "5px 6px", borderRadius: 5, background: i === 0 && zone === "left" ? `${ac},0.11)` : i === 0 ? "rgba(167,139,250,0.08)" : "transparent", display: "flex", alignItems: "center", gap: 5, transition: "background 0.35s" }}>
                <div style={{ width: 11, height: 11, borderRadius: 3, background: i === 0 && zone === "left" ? `${ac},0.30)` : i === 0 ? "rgba(167,139,250,0.22)" : "rgba(255,255,255,0.06)", flexShrink: 0, transition: "background 0.35s" }} />
                <div style={{ height: 5, width: `${w}%`, borderRadius: 3, background: i === 0 && zone === "left" ? `${ac},0.38)` : i === 0 ? "rgba(167,139,250,0.30)" : "rgba(255,255,255,0.08)", transition: "background 0.35s" }} />
              </div>
            ))}
            <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "5px 3px" }} />
            <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.20em", textTransform: "uppercase", color: "rgba(168,196,255,0.42)", padding: "2px 5px 3px" }}>Files</div>
            {([60, 46, 68] as const).map((w, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 6px" }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(168,196,255,0.12)", flexShrink: 0 }} />
                <div style={{ height: 4, width: `${w}%`, borderRadius: 3, background: "rgba(255,255,255,0.07)" }} />
              </div>
            ))}
            <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "5px 3px" }} />
            <div style={{ padding: "5px 6px", borderRadius: 5, background: "rgba(100,200,130,0.06)", border: "1px solid rgba(100,200,130,0.13)", display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(100,200,130,0.70)", flexShrink: 0 }} />
              <div style={{ height: 4.5, width: "58%", borderRadius: 3, background: "rgba(100,200,130,0.22)" }} />
            </div>
          </div>

          {/* CENTER */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", boxShadow: zone === "center" ? `inset 0 0 0 1px ${ac},0.16)` : "none", transition: "box-shadow 0.40s" }}>
            <div style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "7px 13px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 13, height: 13, borderRadius: 4, background: `${ac},0.22)`, transition: "background 0.35s" }} />
                <div style={{ height: 5, width: 100, borderRadius: 3, background: "rgba(255,255,255,0.17)" }} />
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {([24, 18, 22] as const).map((w, i) => <div key={i} style={{ height: 4, width: w, borderRadius: 3, background: "rgba(255,255,255,0.07)" }} />)}
              </div>
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} style={{ flex: 1, display: "flex", flexDirection: "column" }} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -7 }} transition={{ duration: 0.20, ease: EASE }}>
                <TabContent tab={activeTab} />
              </motion.div>
            </AnimatePresence>
            <div style={{ margin: "0 12px 10px", display: "flex", alignItems: "center", gap: 7, padding: "8px 11px", borderRadius: 9, background: "rgba(255,255,255,0.022)", border: "1px solid rgba(255,255,255,0.09)" }}>
              <div style={{ flex: 1, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.07)" }} />
              <div style={{ display: "flex", gap: 5 }}>
                <div style={{ width: 21, height: 21, borderRadius: 5, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
                <div style={{ width: 21, height: 21, borderRadius: 5, background: `${ac},0.18)`, border: `1px solid ${ac},0.28)`, transition: "background 0.35s, border-color 0.35s" }} />
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div style={{ width: "23%", borderLeft: "1px solid rgba(255,255,255,0.05)", padding: "11px 9px", display: "flex", flexDirection: "column", gap: 6, boxShadow: zone === "right" ? `inset 0 0 0 1px ${ac},0.22), -3px 0 20px ${ac},0.07)` : "none", transition: "box-shadow 0.40s" }}>
            <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.20em", textTransform: "uppercase", color: zone === "right" ? `${ac},0.75)` : "rgba(100,200,130,0.55)", padding: "2px 3px 3px", transition: "color 0.35s" }}>Memory</div>
            {([
              { bg: "rgba(100,200,130,0.07)", br: "rgba(100,200,130,0.15)", w1: 68, w2: 50, w3: 35 },
              { bg: "rgba(167,139,250,0.05)", br: "rgba(167,139,250,0.12)", w1: 82, w2: 55, w3: 42 },
              { bg: "rgba(168,196,255,0.04)", br: "rgba(168,196,255,0.11)", w1: 60, w2: 72, w3: 28 },
            ] as const).map((c, i) => (
              <div key={i} style={{ padding: "7px 8px", borderRadius: 7, background: zone === "right" ? `${ac},0.08)` : c.bg, border: `1px solid ${zone === "right" ? `${ac},0.20)` : c.br}`, display: "flex", flexDirection: "column", gap: 3.5, transition: "all 0.40s" }}>
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

        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.004) 2px, rgba(255,255,255,0.004) 4px)" }} />
      </div>
    </div>
  );
}

export function ProductWorkshopVisual() {
  const [activeTab, setActiveTab] = useState(0);
  const tab = TABS[activeTab];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
      {/* 3D-tilted panel */}
      <div style={{ perspective: "1100px", perspectiveOrigin: "50% 44%" }}>
        <div style={{ transform: "rotateX(5deg) rotateY(-9deg)", transformStyle: "preserve-3d" }}>
          <WorkshopPanel activeTab={activeTab} />
        </div>
      </div>

      {/* Feature tabs */}
      <div style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", maxWidth: "min(900px, 94vw)", padding: "0 16px" }}>
        {TABS.map((t, i) => {
          const isActive = i === activeTab;
          const [tr, tg, tb] = t.accent;
          return (
            <button
              key={t.label}
              onClick={() => setActiveTab(i)}
              style={{
                padding: "7px 15px", borderRadius: 100, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 500,
                background: isActive ? `rgba(${tr},${tg},${tb},0.14)` : "rgba(255,255,255,0.05)",
                color: isActive ? `rgba(${tr},${tg},${tb},0.90)` : "rgba(255,255,255,0.40)",
                boxShadow: isActive ? `0 0 0 1px rgba(${tr},${tg},${tb},0.32), 0 0 14px rgba(${tr},${tg},${tb},0.10)` : "0 0 0 1px rgba(255,255,255,0.07)",
                transition: "all 0.25s",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab description */}
      <AnimatePresence mode="wait">
        <motion.p
          key={activeTab}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.18, ease: EASE }}
          style={{ marginTop: 14, fontSize: 14, color: "rgba(255,255,255,0.40)", textAlign: "center", maxWidth: 520, lineHeight: 1.65, padding: "0 20px" }}
        >
          {tab.desc}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
