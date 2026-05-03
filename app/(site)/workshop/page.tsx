import Link from "next/link";
import { auth } from "@/auth";
import { getSignInPath } from "@/lib/auth-ui";

const FEATURES = [
  {
    icon: "◎",
    label: "Chat",
    desc: "Conversations with full context. Every message in a thread remembers what came before. Bring files, memories, and tools into the conversation without switching surfaces.",
  },
  {
    icon: "◇",
    label: "Projects",
    desc: "Group related threads, files, and memory into a single workspace. Switch between client work, personal projects, and research without context bleeding between them.",
  },
  {
    icon: "◻",
    label: "Files",
    desc: "Upload PDFs, images, code, spreadsheets, and documents. Reference them inside any thread. Ask questions, extract data, or use them as context for any task.",
  },
  {
    icon: "◈",
    label: "Memory",
    desc: "Sansxel remembers what matters across sessions. Preferences, context, past threads, and pinned notes are available without you re-explaining them every time.",
  },
  {
    icon: "◆",
    label: "Creation",
    desc: "Generate images and visual references inline. Diagrams, concepts, mockups. No separate tool, no export step. Creation lives inside the workspace.",
  },
  {
    icon: "◉",
    label: "Voice",
    desc: "Low-latency voice conversation built into Workshop. Talk through complex problems hands-free. Works through your AirPods, headphones, or any audio device.",
  },
  {
    icon: "⬡",
    label: "Integrations",
    desc: "Connect Notion, GitHub, Figma, Gmail, and more. Copilot can read, write, and act across connected tools directly from Workshop.",
  },
];

export default async function WorkshopPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);

  return (
    <main style={{ background: "#050507", overflowX: "hidden" }}>

      {/* Hero */}
      <section style={{ background: "#050507" }}>
        <div className="landing-divider" />
        <div className="landing-section" style={{ maxWidth: 800, paddingTop: 80, paddingBottom: 72 }}>
          <div className="landing-kicker">workshop</div>
          <h1
            className="landing-gradient-text"
            style={{ fontSize: "clamp(36px, 5vw, 60px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.08, marginBottom: 20 }}
          >
            The workspace where serious work happens.
          </h1>
          <p className="landing-body" style={{ maxWidth: 520, marginBottom: 36 }}>
            Workshop is the core of Sansxel. Chat, projects, files, memory,
            creation, voice, and integrations. Everything in one surface that
            adapts to whatever you are working on.
          </p>
          <Link
            href={signedIn ? "/app" : getSignInPath()}
            className="landing-cta-primary"
            style={{ display: "inline-flex" }}
          >
            {signedIn ? "Open Workshop" : "Start free"}
          </Link>
        </div>
      </section>

      {/* Features */}
      <section style={{ background: "#040406" }}>
        <div className="landing-divider" />
        <div className="landing-section">
          <div
            style={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: "repeat(1, 1fr)",
            }}
            className="ws-page-grid"
          >
            {FEATURES.map((f) => (
              <div
                key={f.label}
                style={{
                  padding: "32px 32px",
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.05)",
                  background: "rgba(255,255,255,0.015)",
                  display: "flex",
                  gap: 20,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "rgba(167,139,250,0.08)",
                    border: "1px solid rgba(167,139,250,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    color: "rgba(167,139,250,0.75)",
                    flexShrink: 0,
                  }}
                >
                  {f.icon}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#e4e4e7", marginBottom: 8 }}>{f.label}</div>
                  <div style={{ fontSize: 14, color: "#52525b", lineHeight: 1.65 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <style>{`
          @media (min-width: 640px)  { .ws-page-grid { grid-template-columns: repeat(2, 1fr) !important; } }
          @media (min-width: 1024px) { .ws-page-grid { grid-template-columns: repeat(3, 1fr) !important; } }
        `}</style>
      </section>

      {/* CTA */}
      <section style={{ background: "#040406", paddingBottom: 80 }}>
        <div className="landing-divider" />
        <div className="landing-section" style={{ maxWidth: 600, textAlign: "center" }}>
          <h2 className="landing-h2 landing-gradient-text" style={{ marginBottom: 14 }}>
            Start with Workshop today.
          </h2>
          <p className="landing-body" style={{ marginBottom: 32 }}>
            Free to start. No card required. Everything you need is already inside.
          </p>
          <Link
            href={signedIn ? "/app" : getSignInPath()}
            className="landing-cta-primary"
            style={{ display: "inline-flex" }}
          >
            {signedIn ? "Open Workshop" : "Start free"}
          </Link>
        </div>
      </section>

    </main>
  );
}
