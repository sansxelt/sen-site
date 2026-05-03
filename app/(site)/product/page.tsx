import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { getSignInPath } from "@/lib/auth-ui";
import { ProductWorkshopVisual } from "@/components/landing/product-workshop-visual";

export const metadata: Metadata = {
  title: "Product",
  description:
    "Talk, type, drop files, generate images, search live. The AI workshop for makers.",
};

const pillars = [
  {
    icon: "◎",
    title: "Talk and type, no mode switch",
    desc: "Two voice modes that actually work. Dictate for quick captures; Talk for full hands-free conversation with interruption mid-sentence. VAD detects when you stop, the AI starts.",
  },
  {
    icon: "◻",
    title: "Drop anything, the UI morphs",
    desc: "Drag an image and an analysis panel slides in. Drop a PDF or code file and the right tool appears. Paste images straight from screenshots. The workshop reacts to what you're working on.",
  },
  {
    icon: "⬡",
    title: "Live data, not stale knowledge",
    desc: "Web search is built into chat. Ask about today's market, the latest release — sansxel searches and answers with real numbers and citations.",
  },
  {
    icon: "◈",
    title: "Memory that follows you",
    desc: "Every chat saves server-side, keyed to your account. Open the workshop on your phone and pick up exactly where you left off on your laptop.",
  },
  {
    icon: "◉",
    title: "MCP + file edits on desktop",
    desc: "The desktop app touches your files, runs MCP servers, and connects to your tools (GitHub, Notion, etc.). Web is the trial, desktop is where you ship.",
  },
  {
    icon: "◆",
    title: "Image gen + multimodal in chat",
    desc: "Type 'gen an image of X' and you get one inline, no separate button. Drop an image and the model can see it. Same conversation, same credit balance.",
  },
];

export default async function ProductPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);

  return (
    <main style={{ background: "#050507", overflowX: "hidden" }}>

      {/* Hero + Workshop visual */}
      <section style={{ background: "#050507" }}>
        <div className="landing-divider" />
        <div style={{ maxWidth: 1600, margin: "0 auto", padding: "72px 24px 32px", textAlign: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 20,
            padding: "4px 14px", borderRadius: 100,
            border: "1px solid rgba(167,139,250,0.22)", background: "rgba(167,139,250,0.07)",
            fontSize: 11, fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            letterSpacing: "0.14em", color: "rgba(167,139,250,0.75)",
          }}>
            ◎ workshop
          </div>
          <h1 style={{
            fontSize: "clamp(28px, 4.5vw, 56px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.08,
            background: "linear-gradient(90deg, #ffffff 0%, rgba(255,255,255,0.70) 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            marginBottom: 16,
          }}>
            Talk to it. Drop into it.<br />Ship from it.
          </h1>
          <p style={{ fontSize: "clamp(14px, 1.5vw, 17px)", color: "rgba(255,255,255,0.45)", lineHeight: 1.75, maxWidth: 560, margin: "0 auto 44px" }}>
            Chat, voice, drag-drop, image gen, web search, persistent memory, MCP — all in one workspace
            that adapts to what you&apos;re building right now.
          </p>

          {/* THE VISUAL — product as the star */}
          <ProductWorkshopVisual />

          {/* CTAs below the visual */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 36 }}>
            <Link
              href={signedIn ? "/app" : getSignInPath("/app")}
              className="landing-cta-primary"
              style={{ display: "inline-flex" }}
            >
              {signedIn ? "Open Workshop" : "Open the Workshop"}
            </Link>
            <Link
              href="/pricing"
              style={{
                display: "inline-flex", alignItems: "center", padding: "12px 22px",
                borderRadius: 100, border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.03)", color: "#d4d4d8",
                fontSize: 14, textDecoration: "none",
              }}
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>

      {/* What's in the Workshop — feature cards */}
      <section style={{ background: "#040406" }}>
        <div className="landing-divider" />
        <div className="landing-section">
          <div style={{ maxWidth: 520, marginBottom: 48 }}>
            <div className="landing-kicker">what&apos;s in the workshop</div>
            <h2 className="landing-h2 landing-gradient-text">Everything you need to ship.</h2>
          </div>
          <div
            style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(1, 1fr)" }}
            className="product-feature-grid"
          >
            {pillars.map((p) => (
              <div
                key={p.title}
                style={{
                  padding: "24px 24px",
                  borderRadius: 14,
                  border: "1px solid rgba(167,139,250,0.09)",
                  background: "rgba(167,139,250,0.02)",
                  display: "flex", gap: 16, alignItems: "flex-start",
                }}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  background: "rgba(167,139,250,0.09)", border: "1px solid rgba(167,139,250,0.16)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, color: "rgba(167,139,250,0.75)",
                }}>
                  {p.icon}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#e4e4e7", marginBottom: 6 }}>{p.title}</div>
                  <div style={{ fontSize: 13, color: "#52525b", lineHeight: 1.65 }}>{p.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <style>{`
            @media (min-width: 640px)  { .product-feature-grid { grid-template-columns: repeat(2, 1fr) !important; } }
            @media (min-width: 1024px) { .product-feature-grid { grid-template-columns: repeat(3, 1fr) !important; } }
          `}</style>
        </div>
      </section>

      {/* Who uses it */}
      <section style={{ background: "#050507" }}>
        <div className="landing-divider" />
        <div className="landing-section" style={{ maxWidth: 900 }}>
          <div className="landing-kicker">who uses it</div>
          <h2 className="landing-h2 landing-gradient-text">Built for makers who ship.</h2>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2, 1fr)", marginTop: 32 }} className="product-persona-grid">
            {[
              { title: "Indie dev at 2am", desc: "Drops a screenshot of a broken React state, voice-talks through the bug, gets a fix in markdown they can paste into their IDE." },
              { title: "Designer iterating", desc: "Pastes Figma screenshots, asks for color tweaks or layout critique, generates supporting imagery inline." },
              { title: "Student shipping a project", desc: "Drops PDFs and lecture notes, drafts a project plan, generates code scaffolds, talks through revisions hands-free." },
              { title: "Creator brainstorming", desc: "Voice-dumps the loose idea, gets it into a script, generates thumbnails, drops reference images for style guidance." },
            ].map((p) => (
              <div key={p.title} style={{ padding: "22px 22px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#e4e4e7", marginBottom: 8 }}>{p.title}</div>
                <div style={{ fontSize: 13, color: "#52525b", lineHeight: 1.65 }}>{p.desc}</div>
              </div>
            ))}
          </div>
          <style>{`@media (min-width: 768px) { .product-persona-grid { grid-template-columns: repeat(2, 1fr) !important; } }`}</style>
        </div>
      </section>

      <div style={{ height: 80 }} />
    </main>
  );
}
