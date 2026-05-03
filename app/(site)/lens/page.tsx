import Link from "next/link";

export default function LensPage() {
  return (
    <main style={{ background: "#050507", overflowX: "hidden" }}>

      {/* Hero */}
      <section style={{ background: "#050507" }}>
        <div className="landing-divider" />
        <div className="landing-section" style={{ maxWidth: 760, paddingTop: 80, paddingBottom: 72 }}>
          <div className="landing-kicker" style={{ color: "rgba(255,172,51,0.70)" }}>lens</div>
          <h1
            className="landing-gradient-text"
            style={{ fontSize: "clamp(36px, 5vw, 60px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.08, marginBottom: 20 }}
          >
            Vision that sees your context.
          </h1>
          <p className="landing-body" style={{ maxWidth: 520, marginBottom: 24 }}>
            Lens is the visual layer of Sansxel. It will let the AI see what
            you see, understand your physical and digital environment, and
            respond to context that goes beyond text.
          </p>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "5px 14px",
              borderRadius: 100,
              border: "1px solid rgba(255,172,51,0.20)",
              background: "rgba(255,172,51,0.06)",
              fontSize: 11,
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              letterSpacing: "0.12em",
              color: "rgba(255,172,51,0.60)",
            }}
          >
            future direction — not shipping today
          </div>
        </div>
      </section>

      {/* What it will be */}
      <section style={{ background: "#040406" }}>
        <div className="landing-divider" />
        <div className="landing-section" style={{ maxWidth: 720 }}>
          <div className="landing-kicker" style={{ color: "rgba(255,172,51,0.65)" }}>the direction</div>
          <h2 className="landing-h2 landing-gradient-text">What Lens will do.</h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 32, marginTop: 8 }}>
            {[
              {
                title: "See your environment",
                body: "Lens will let Sansxel understand what is on your screen, in your camera frame, or in your physical space. Describe it less. Show it more.",
              },
              {
                title: "Visual context, not just text",
                body: "Current AI interfaces are text-in, text-out. Lens changes the input layer. You can point at something and ask a question. The AI sees what you point at.",
              },
              {
                title: "Connected to Workshop",
                body: "When Lens sees something, Workshop understands it. Files, projects, and memory are all connected. Visual context becomes part of the thread.",
              },
              {
                title: "Not a camera app",
                body: "Lens is not a standalone product. It is a layer that makes the rest of Sansxel more capable. The AI understands more about what you are doing without you describing it.",
              },
            ].map((item) => (
              <div key={item.title} style={{ borderLeft: "2px solid rgba(255,172,51,0.20)", paddingLeft: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#e4e4e7", marginBottom: 8 }}>{item.title}</div>
                <div style={{ fontSize: 14, color: "#52525b", lineHeight: 1.65 }}>{item.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline / honesty */}
      <section style={{ background: "#050507" }}>
        <div className="landing-divider" />
        <div className="landing-section" style={{ maxWidth: 680 }}>
          <div className="landing-kicker" style={{ color: "rgba(255,172,51,0.65)" }}>honesty</div>
          <h2 className="landing-h2 landing-gradient-text">Where we are.</h2>
          <p className="landing-body" style={{ marginBottom: 16 }}>
            Lens is the direction, not a product you can use today. Workshop
            is the focus right now. When Lens is close, the Discord will
            know first.
          </p>
          <p className="landing-body">
            If you are building something with vision and AI and want to share
            what you are working on, get in touch.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
            <a
              href="https://discord.gg/WEMgmvtDgG"
              target="_blank"
              rel="noopener noreferrer"
              className="landing-cta-primary"
              style={{ display: "inline-flex" }}
            >
              Join the Discord
            </a>
            <Link
              href="/contact"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "12px 22px",
                borderRadius: 100,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.03)",
                color: "#d4d4d8",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Contact us
            </Link>
          </div>
        </div>
      </section>

      {/* Footer spacer */}
      <div style={{ height: 80 }} />
    </main>
  );
}
