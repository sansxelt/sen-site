"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/landing/reveal";

// /product is the builder-facing catalog. The consumer story lives on
// the home page (cinematic walkthrough of Lens, Whisper, Day Kit,
// Workshop). This page tells the same audience what is shipping today
// vs what is in concept, what surface API exposes which surface, and
// how to integrate. No marketing rephrasing of the home page.

const EASE = [0.16, 1, 0.3, 1] as const;

type Status = "live" | "beta" | "alpha" | "concept" | "rnd";

const STATUS_META: Record<Status, { label: string; color: string }> = {
  live:    { label: "LIVE",    color: "#34d399" },
  beta:    { label: "BETA",    color: "#a8c4ff" },
  alpha:   { label: "ALPHA",   color: "#c084fc" },
  concept: { label: "CONCEPT", color: "#fbbf24" },
  rnd:     { label: "R&D",     color: "#71717a" },
};

type Surface = {
  key: string;
  name: string;
  category: "Workspace" | "Voice" | "Optics" | "Hardware" | "Actions" | "Developer";
  status: Status;
  version?: string;
  oneLine: string;
  // Which surfaces of the system back this. Populates the dependency
  // chip strip beneath each row.
  depends: string[];
  // Where to read more (consumer-facing page or external).
  href: string;
};

const SURFACES: Surface[] = [
  {
    key: "workshop",
    name: "Workshop",
    category: "Workspace",
    status: "live",
    version: "v0.1.15",
    oneLine: "Chat, projects, files, memory, voice. Web only.",
    depends: ["Chat API", "Memory API", "Files API", "MCP runtime"],
    href: "/workshop",
  },
  {
    key: "copilot-desktop",
    name: "Copilot (desktop)",
    category: "Actions",
    status: "alpha",
    oneLine: "Floating bar, hotkey, screen-aware. Not yet publicly available.",
    depends: ["Workshop session", "Tool use API", "Screen capture"],
    href: "/desktop",
  },
  {
    key: "whisper",
    name: "Whisper",
    category: "Voice",
    status: "beta",
    oneLine: "Voice in / voice out, sub-200ms target. Browser + desktop.",
    depends: ["WebRTC", "STT (whisper-large-v3)", "TTS"],
    href: "/whisper",
  },
  {
    key: "memory",
    name: "Memory",
    category: "Workspace",
    status: "beta",
    oneLine: "Persistent facts and preferences scoped per project.",
    depends: ["Memory API", "Vector store"],
    href: "/workshop#memory",
  },
  {
    key: "platform",
    name: "Platform",
    category: "Developer",
    status: "alpha",
    oneLine: "API keys, request inspector, usage dashboard, webhooks.",
    depends: ["Chat API", "MCP registry", "Webhooks"],
    href: "https://platform.sansxel.ai",
  },
  {
    key: "lens",
    name: "Lens",
    category: "Optics",
    status: "concept",
    oneLine: "Transparent contact lens. Three render modes, off-board compute.",
    depends: ["Workshop bridge", "Render protocol", "Optical stack"],
    href: "/lens",
  },
  {
    key: "lens-day-kit",
    name: "Lens Day Kit",
    category: "Hardware",
    status: "concept",
    oneLine: "Charges two Lens pairs and the Whisper earbuds in one case.",
    depends: ["Lens pairing", "Whisper hardware"],
    href: "/lens#day-kit",
  },
  {
    key: "whisper-hw",
    name: "Whisper hardware",
    category: "Hardware",
    status: "rnd",
    oneLine: "Sansxel-built earbud, lives in the Day Kit case.",
    depends: ["Whisper protocol", "Lens Day Kit"],
    href: "/whisper#hardware",
  },
];

type Endpoint = {
  method: "GET" | "POST" | "DELETE";
  path: string;
  desc: string;
  status: Status;
};

const ENDPOINTS: Endpoint[] = [
  { method: "POST", path: "/v1/chat/completions",      desc: "Streaming chat with tool use. OpenAI-compatible.", status: "alpha" },
  { method: "POST", path: "/v1/projects",              desc: "Create a project (scopes memory + files).",        status: "alpha" },
  { method: "GET",  path: "/v1/projects/{id}/memory",  desc: "List facts the model has stored.",                  status: "alpha" },
  { method: "POST", path: "/v1/projects/{id}/files",   desc: "Upload a file referenced by chat.",                 status: "alpha" },
  { method: "POST", path: "/v1/voice/transcribe",      desc: "Streaming STT, sub-200ms first-word target.",       status: "beta"  },
  { method: "POST", path: "/v1/voice/speak",           desc: "Streaming TTS, interruptable.",                     status: "beta"  },
  { method: "POST", path: "/v1/mcp/servers",           desc: "Register an MCP server with your project.",         status: "alpha" },
  { method: "POST", path: "/v1/webhooks",              desc: "Subscribe to events (HMAC-signed delivery).",       status: "alpha" },
  { method: "POST", path: "/v1/lens/render",           desc: "Push a render frame to a paired Lens session.",     status: "concept" },
];

type Integration = { name: string; status: Status; via: "first-party" | "MCP" };

const INTEGRATIONS: Integration[] = [
  { name: "GitHub",   status: "beta",    via: "first-party" },
  { name: "Notion",   status: "beta",    via: "first-party" },
  { name: "Linear",   status: "alpha",   via: "first-party" },
  { name: "Slack",    status: "alpha",   via: "first-party" },
  { name: "Gmail",    status: "alpha",   via: "first-party" },
  { name: "Figma",    status: "concept", via: "first-party" },
  { name: "Stripe",   status: "concept", via: "first-party" },
  { name: "Filesystem", status: "live",  via: "MCP" },
  { name: "Postgres",   status: "live",  via: "MCP" },
  { name: "Custom MCP", status: "live",  via: "MCP" },
];

const SDK_SNIPPET = `import Sansxel from "@sansxel/sdk";

const sx = new Sansxel({ apiKey: process.env.SANSXEL_API_KEY });

const stream = await sx.chat.completions.create({
  model: "sansxel-1",
  project: "proj_5g7",
  stream: true,
  messages: [{ role: "user", content: "summarize my open PRs" }],
  tools: [{ type: "mcp", server: "github" }],
});

for await (const chunk of stream) {
  process.stdout.write(chunk.delta.text ?? "");
}`;

function StatusPill({ status, small = false }: { status: Status; small?: boolean }) {
  const meta = STATUS_META[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: small ? "2px 7px" : "3px 9px",
        borderRadius: 100,
        border: `1px solid ${meta.color}40`,
        background: `${meta.color}12`,
        fontSize: small ? 9.5 : 10,
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        letterSpacing: "0.10em",
        color: meta.color,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: meta.color, boxShadow: `0 0 6px ${meta.color}` }} />
      {meta.label}
    </span>
  );
}

export default function ProductPage() {
  const reduce = useReducedMotion();

  return (
    <main style={{ background: "#050507", overflowX: "hidden" }}>
      {/* HERO — builder framing, separate from home's consumer hero */}
      <section style={{ position: "relative", padding: "clamp(80px, 14vh, 160px) clamp(20px, 5vw, 80px) 60px" }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 70% 50% at 50% 30%, rgba(168,196,255,0.10) 0%, transparent 55%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", maxWidth: 880, margin: "0 auto", textAlign: "center" }}>
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 12px",
              borderRadius: 100,
              border: "1px solid rgba(168,196,255,0.3)",
              background: "rgba(168,196,255,0.07)",
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(168,196,255,0.9)",
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              marginBottom: 24,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a8c4ff", boxShadow: "0 0 10px #a8c4ff" }} />
            for builders
          </motion.div>
          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.85, ease: EASE, delay: 0.15 }}
            style={{
              fontSize: "clamp(2.4rem, 6.5vw, 4.6rem)",
              fontWeight: 600,
              lineHeight: 1.0,
              letterSpacing: "-0.035em",
              marginBottom: 22,
              background: "linear-gradient(180deg, #ffffff 0%, #cdd6f4 55%, #8aa4d4 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            What ships, what's next, and what to integrate against.
          </motion.h1>
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.3 }}
            style={{ fontSize: "clamp(1rem, 1.5vw, 1.2rem)", color: "rgba(255,255,255,0.62)", maxWidth: 600, margin: "0 auto", lineHeight: 1.55 }}
          >
            The technical view of every Sansxel surface. Status, version,
            what it depends on, and how the API exposes it. For the
            consumer walkthrough, see the home page.
          </motion.p>

          <div style={{ marginTop: 28, display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <Link
              href="https://platform.sansxel.ai"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "10px 18px", borderRadius: 100,
                border: "1px solid rgba(168,196,255,0.55)",
                background: "rgba(168,196,255,0.18)",
                color: "rgba(168,196,255,0.96)",
                fontSize: 13, fontWeight: 500, textDecoration: "none",
              }}
            >
              Open Platform
              <span aria-hidden style={{ fontSize: 13 }}>→</span>
            </Link>
            <Link
              href="#api"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "10px 18px", borderRadius: 100,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.03)",
                color: "#d4d4d8",
                fontSize: 13, fontWeight: 500, textDecoration: "none",
              }}
            >
              Jump to API
            </Link>
          </div>
        </div>
      </section>

      {/* SURFACE STATUS MATRIX */}
      <section id="surfaces" style={{ position: "relative", padding: "60px clamp(20px, 5vw, 80px) 80px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ marginBottom: 32, display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", fontWeight: 600, color: "#f5f5f7", letterSpacing: "-0.02em" }}>
              Surfaces
            </h2>
            <div style={{ display: "inline-flex", gap: 10, flexWrap: "wrap" }}>
              {(["live","beta","alpha","concept","rnd"] as const).map((s) => (
                <StatusPill key={s} status={s} small />
              ))}
            </div>
          </div>

          <div
            style={{
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.015)",
              overflow: "hidden",
            }}
          >
            {/* Column headers */}
            <div
              className="surface-row surface-row--head"
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                fontSize: 10.5,
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.4)",
              }}
            >
              <div>Surface</div>
              <div>Category</div>
              <div>Status</div>
              <div>Depends on</div>
              <div />
            </div>
            {SURFACES.map((s, i) => (
              <Reveal
                key={s.key}
                delay={i * 0.04}
                amount={0.05}
                y={10}
                className="surface-row"
                style={{
                  padding: "16px",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#e4e4e7" }}>
                    {s.name}
                    {s.version && (
                      <span style={{ marginLeft: 8, fontSize: 11, fontFamily: "var(--font-geist-mono), ui-monospace, monospace", color: "#52525b" }}>
                        {s.version}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "#71717a", marginTop: 2 }}>{s.oneLine}</div>
                </div>
                <div style={{ fontSize: 12, color: "#a1a1aa" }}>{s.category}</div>
                <div><StatusPill status={s.status} /></div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {s.depends.map((d) => (
                    <span
                      key={d}
                      style={{
                        fontSize: 10.5,
                        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                        padding: "2px 7px",
                        borderRadius: 4,
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.05)",
                        color: "#a1a1aa",
                      }}
                    >
                      {d}
                    </span>
                  ))}
                </div>
                <div style={{ textAlign: "right" }}>
                  <Link
                    href={s.href}
                    style={{
                      fontSize: 12,
                      color: "#a1a1aa",
                      textDecoration: "none",
                      borderBottom: "1px solid rgba(255,255,255,0.10)",
                      paddingBottom: 1,
                    }}
                  >
                    open →
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* API SURFACE */}
      <section id="api" style={{ position: "relative", padding: "80px clamp(20px, 5vw, 80px)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 56 }} className="api-grid">
          <div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "3px 10px", borderRadius: 100,
              border: "1px solid rgba(168,196,255,0.25)",
              background: "rgba(168,196,255,0.06)",
              fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
              color: "rgba(168,196,255,0.8)",
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              marginBottom: 16,
            }}>API</div>

            <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", fontWeight: 600, color: "#f5f5f7", letterSpacing: "-0.02em", marginBottom: 16 }}>
              OpenAI-compatible chat, plus the parts that aren't OpenAI.
            </h2>
            <p style={{ fontSize: 14.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, marginBottom: 24, maxWidth: 520 }}>
              Drop-in replacement for the OpenAI SDK. Chat, streaming,
              tool use, function calling — same shape. Beyond that:
              project-scoped memory, file uploads, voice in / out, and
              an MCP runtime that picks up any server you point at it.
            </p>

            <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
              {ENDPOINTS.map((e, i) => (
                <Reveal
                  key={e.path}
                  delay={i * 0.035}
                  amount={0.05}
                  y={8}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    gap: 14,
                    alignItems: "center",
                    padding: "10px 14px",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    background: "rgba(0,0,0,0.20)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 10.5,
                      fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                      padding: "2px 8px",
                      borderRadius: 4,
                      background:
                        e.method === "POST"   ? "rgba(96,165,250,0.12)" :
                        e.method === "DELETE" ? "rgba(248,113,113,0.12)" :
                                                "rgba(52,211,153,0.12)",
                      color:
                        e.method === "POST"   ? "#60a5fa" :
                        e.method === "DELETE" ? "#f87171" :
                                                "#34d399",
                      fontWeight: 600,
                      letterSpacing: "0.05em",
                      width: 50, textAlign: "center",
                    }}
                  >
                    {e.method}
                  </span>
                  <div>
                    <code style={{ fontSize: 12.5, color: "#e4e4e7", fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}>
                      {e.path}
                    </code>
                    <div style={{ fontSize: 11.5, color: "#71717a", marginTop: 2 }}>{e.desc}</div>
                  </div>
                  <StatusPill status={e.status} small />
                </Reveal>
              ))}
            </div>
          </div>

          <div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "3px 10px", borderRadius: 100,
              border: "1px solid rgba(168,196,255,0.25)",
              background: "rgba(168,196,255,0.06)",
              fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
              color: "rgba(168,196,255,0.8)",
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              marginBottom: 16,
            }}>SDK</div>

            <h3 style={{ fontSize: 18, fontWeight: 500, color: "#f5f5f7", marginBottom: 16 }}>
              TypeScript / Python, identical surface
            </h3>

            <pre
              style={{
                background: "rgba(0,0,0,0.45)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12,
                padding: 18,
                fontSize: 12.5,
                lineHeight: 1.6,
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                color: "#cbd5e1",
                overflow: "auto",
                margin: 0,
              }}
            >
              <code>{SDK_SNIPPET}</code>
            </pre>

            <div style={{ marginTop: 16, fontSize: 12, color: "#71717a", lineHeight: 1.6 }}>
              Bearer-token auth. Per-project keys with spend caps and
              rate limits set in the Platform console. Streaming uses
              SSE; the Python SDK exposes the same async iterator
              shape.
            </div>
          </div>
        </div>
      </section>

      {/* INTEGRATIONS / MCP */}
      <section id="integrations" style={{ padding: "80px clamp(20px, 5vw, 80px)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "3px 10px", borderRadius: 100,
              border: "1px solid rgba(168,196,255,0.25)",
              background: "rgba(168,196,255,0.06)",
              fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
              color: "rgba(168,196,255,0.8)",
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              marginBottom: 16,
            }}>Integrations</div>
            <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", fontWeight: 600, color: "#f5f5f7", letterSpacing: "-0.02em", marginBottom: 8 }}>
              First-party connectors and any MCP server.
            </h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", maxWidth: 560 }}>
              First-party connectors handle auth + rate limiting for the
              tools we ship. Anything else, point at an MCP server and
              the runtime picks it up automatically.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
            {INTEGRATIONS.map((integration, idx) => (
              <Reveal
                key={integration.name}
                delay={idx * 0.04}
                amount={0.1}
                y={10}
                style={{
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: "rgba(255,255,255,0.02)",
                  padding: "14px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#e4e4e7" }}>{integration.name}</div>
                  <StatusPill status={integration.status} small />
                </div>
                <div style={{
                  fontSize: 10,
                  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                  color: integration.via === "MCP" ? "rgba(192,132,252,0.7)" : "rgba(255,255,255,0.4)",
                  letterSpacing: "0.10em",
                }}>
                  {integration.via === "MCP" ? "VIA MCP" : "FIRST-PARTY"}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* WEBHOOKS + AUDIT */}
      <section style={{ padding: "80px clamp(20px, 5vw, 80px)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr", gap: 24 }} className="ops-grid">
          {[
            {
              kicker: "Webhooks",
              title: "Subscribe to anything that happens.",
              body: "Completion finished, tool call invoked, key spend exceeded, project usage cap hit. HMAC-signed delivery, configurable retry, per-project endpoints.",
            },
            {
              kicker: "Audit log",
              title: "Every Copilot action, replayable.",
              body: "What tool, what input, what output, what time. Replayable from the audit page. Most write actions are reversible for 24 hours.",
            },
            {
              kicker: "Console",
              title: "Keys, usage, rate limits.",
              body: "Per-project keys with spend caps, request rate limits, expiry dates. Real-time tail of every request the model is handling for you.",
            },
          ].map((b, idx) => (
            <Reveal
              key={b.kicker}
              delay={idx * 0.08}
              style={{
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(255,255,255,0.02)",
                padding: "28px 26px",
              }}
            >
              <div style={{
                fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase",
                color: "rgba(168,196,255,0.7)",
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                marginBottom: 12,
              }}>{b.kicker}</div>
              <div style={{ fontSize: 17, fontWeight: 500, color: "#f5f5f7", marginBottom: 10, letterSpacing: "-0.01em" }}>
                {b.title}
              </div>
              <p style={{ fontSize: 13, color: "#a1a1aa", lineHeight: 1.55, margin: 0 }}>
                {b.body}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FOOTER CTA */}
      <section style={{ padding: "80px clamp(20px, 5vw, 80px) 120px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <h3 style={{ fontSize: "clamp(1.4rem, 2.6vw, 2rem)", fontWeight: 500, color: "#f5f5f7", letterSpacing: "-0.02em", marginBottom: 16 }}>
            Build on it before it ships everywhere.
          </h3>
          <p style={{ fontSize: 14, color: "#71717a", marginBottom: 24, lineHeight: 1.6 }}>
            The Platform is alpha. API surface is stable enough to
            integrate against; behavior may shift before v1. Get a key
            and start.
          </p>
          <div style={{ display: "inline-flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <Link
              href="https://platform.sansxel.ai"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "12px 22px", borderRadius: 100,
                border: "1px solid rgba(168,196,255,0.55)",
                background: "rgba(168,196,255,0.18)",
                color: "rgba(168,196,255,0.96)",
                fontSize: 14, fontWeight: 500, textDecoration: "none",
              }}
            >
              Get an API key
              <span aria-hidden style={{ fontSize: 13 }}>→</span>
            </Link>
            <Link
              href="/"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "12px 22px", borderRadius: 100,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.03)",
                color: "#d4d4d8",
                fontSize: 14, fontWeight: 500, textDecoration: "none",
              }}
            >
              See the consumer story
            </Link>
          </div>
        </div>
      </section>

      <style>{`
        .surface-row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }
        .surface-row--head { display: none; }
        @media (min-width: 980px) {
          .surface-row {
            grid-template-columns: 2fr 1fr 0.7fr 2fr 0.6fr;
            gap: 18px;
          }
          .surface-row--head { display: grid; }
          .api-grid { grid-template-columns: 1.3fr 1fr; gap: 64px; }
          .ops-grid { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>
    </main>
  );
}
