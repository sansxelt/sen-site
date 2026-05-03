import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { getSignInPath } from "@/lib/auth-ui";
import { ProductWorkshopVisual } from "@/components/landing/product-workshop-visual";
import { ProductComposition } from "@/components/landing/product-composition";
import { HowItConnects } from "@/components/landing/how-it-connects";
import { ModulesSection, ModuleMockStyles } from "@/components/landing/modules-section";

export const metadata: Metadata = {
  title: "Product",
  description:
    "Talk, type, drop files, generate images, search live. The AI workshop for makers.",
};

export default async function ProductPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);

  return (
    <main style={{ background: "#050507", overflowX: "hidden" }}>
      <ModuleMockStyles />

      {/* ── 1. HARDWARE HERO ─────────────────────────────────── */}
      <section style={{ background: "#050507" }}>
        <div className="landing-divider" />
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "80px 24px 40px", textAlign: "center" }}>

          {/* Eyebrow */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 20,
            padding: "4px 14px", borderRadius: 100,
            border: "1px solid rgba(168,196,255,0.18)", background: "rgba(168,196,255,0.06)",
            fontSize: 11, fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            letterSpacing: "0.14em", color: "rgba(168,196,255,0.65)",
          }}>
            ◎ product
          </div>

          <h1 style={{
            fontSize: "clamp(2.0rem, 4.5vw, 3.4rem)", fontWeight: 700,
            letterSpacing: "-0.03em", lineHeight: 1.08,
            background: "linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.68) 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            marginBottom: 12,
          }}>
            The AI workshop for makers.
          </h1>

          <p style={{ fontSize: "clamp(1.0rem, 1.6vw, 1.1rem)", fontWeight: 500, color: "rgba(255,255,255,0.52)", marginBottom: 8 }}>
            One AI. One purpose: help.
          </p>

          <p style={{ fontSize: "clamp(14px, 1.4vw, 16px)", color: "rgba(255,255,255,0.38)", lineHeight: 1.78, maxWidth: 520, margin: "0 auto 44px" }}>
            Workspace, private audio, and future visual interfaces — one context layer.
          </p>

          {/* Physical hardware — no software behind it */}
          <ProductComposition />

          {/* CTA below */}
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

      {/* ── 2. HOW IT CONNECTS ────────────────────────────────── */}
      <HowItConnects />

      {/* ── 3. WORKSHOP SOFTWARE DEEP DIVE ───────────────────── */}
      <section style={{ background: "#040406" }}>
        <div className="landing-divider" />
        <div className="landing-section" style={{ maxWidth: 1000 }}>
          <div style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 48px" }}>
            <div className="landing-kicker">workshop</div>
            <h2 className="landing-h2 landing-gradient-text">
              Talk to it. Drop into it. Ship from it.
            </h2>
            <p className="landing-body">
              Every tool you need in one workspace. Chat, voice, files, memory, creation,
              research, MCP connections, and projects — all in a single session.
            </p>
          </div>

          <ProductWorkshopVisual />

          {/* Feature grid below the visual */}
          <div
            style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(1, 1fr)", marginTop: 48 }}
            className="product-feature-grid"
          >
            {[
              { icon: "◎", title: "Talk and type, no mode switch",
                desc: "Dictate for quick captures or talk hands-free with mid-sentence interruption. VAD stops the AI the moment you speak." },
              { icon: "◻", title: "Drop anything, the UI morphs",
                desc: "Drag an image and an analysis panel slides in. Drop a PDF or code file and the right tool appears automatically." },
              { icon: "⬡", title: "Live data, not stale knowledge",
                desc: "Web search is built into chat. Ask about today's market or the latest release — Sansxel searches with citations." },
              { icon: "◈", title: "Memory that follows you",
                desc: "Every chat saves server-side, keyed to your account. Pick up on your phone where you left off on your laptop." },
              { icon: "◉", title: "MCP + integrations",
                desc: "Connect GitHub, Notion, Linear, and more via MCP. The desktop app touches your files and runs local servers." },
              { icon: "◆", title: "Image gen + multimodal",
                desc: "Generate images inline with a single prompt. Drop any image and the model sees it. Same session, same balance." },
            ].map((p) => (
              <div
                key={p.title}
                style={{
                  padding: "22px 22px",
                  borderRadius: 12,
                  border: "1px solid rgba(167,139,250,0.09)",
                  background: "rgba(167,139,250,0.02)",
                  display: "flex", gap: 16, alignItems: "flex-start",
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: "rgba(167,139,250,0.09)", border: "1px solid rgba(167,139,250,0.16)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, color: "rgba(167,139,250,0.75)",
                }}>
                  {p.icon}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#e4e4e7", marginBottom: 5 }}>{p.title}</div>
                  <div style={{ fontSize: 12.5, color: "#52525b", lineHeight: 1.65 }}>{p.desc}</div>
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

      {/* ── 4. MODULES ───────────────────────────────────────── */}
      <ModulesSection />

      {/* ── 5. FINAL CTA ─────────────────────────────────────── */}
      <section style={{ background: "#040406", paddingBottom: 80 }}>
        <div className="landing-divider" />
        <div className="landing-section" style={{ maxWidth: 680, textAlign: "center", margin: "0 auto" }}>
          <div className="landing-kicker">get started</div>
          <h2 className="landing-h2 landing-gradient-text">
            Start building today.
          </h2>
          <p className="landing-body" style={{ maxWidth: 440, margin: "0 auto 32px" }}>
            Free to start. No card required. The full Workshop opens immediately.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            <Link
              href={signedIn ? "/app" : getSignInPath("/app")}
              className="landing-cta-primary"
              style={{ display: "inline-flex" }}
            >
              {signedIn ? "Open Workshop" : "Open the Workshop — free"}
            </Link>
            <a
              href="https://discord.gg/5sxuuewf3u"
              target="_blank"
              rel="noopener noreferrer"
              className="landing-cta-ghost"
              style={{ display: "inline-flex" }}
            >
              Join Discord ↗
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
