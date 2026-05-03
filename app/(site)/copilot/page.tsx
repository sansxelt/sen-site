import Link from "next/link";
import { auth } from "@/auth";
import { getSignInPath } from "@/lib/auth-ui";

const CAPABILITIES = [
  { icon: "◎", label: "Acts in context",     desc: "Copilot reads your current thread, project, and files before doing anything. It never starts from scratch." },
  { icon: "⬡", label: "Works across tools",  desc: "Read from Notion. Push to GitHub. Draft in Gmail. Send a Slack message. One instruction, multiple tools." },
  { icon: "◇", label: "Runs multi-step",     desc: "Give it an outcome. It breaks the task into steps, executes them in order, and reports back when done." },
  { icon: "◻", label: "Uses your files",     desc: "Reference documents you have uploaded. Copilot extracts data, checks facts, and pulls context from what you have already shared." },
  { icon: "◈", label: "Remembers you",       desc: "Memory is active during Copilot tasks. It knows your preferences, past decisions, and working style without you repeating them." },
  { icon: "◆", label: "No switching",        desc: "Everything happens inside Workshop. No tab-switching. No re-explaining the context in another app. One surface." },
];

export default async function CopilotPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);

  return (
    <main style={{ background: "#050507", overflowX: "hidden" }}>

      {/* Hero */}
      <section style={{ background: "#050507" }}>
        <div className="landing-divider" />
        <div className="landing-section" style={{ maxWidth: 760, paddingTop: 80, paddingBottom: 72 }}>
          <div className="landing-kicker" style={{ color: "rgba(65,214,155,0.75)" }}>copilot</div>
          <h1
            className="landing-gradient-text"
            style={{ fontSize: "clamp(36px, 5vw, 60px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.08, marginBottom: 20 }}
          >
            Your AI acts, not just answers.
          </h1>
          <p className="landing-body" style={{ maxWidth: 520, marginBottom: 36 }}>
            Copilot is the agentic layer inside Sansxel. It reads context,
            acts across connected tools, and handles multi-step tasks. You
            describe the outcome. It handles the steps.
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

      {/* Capabilities */}
      <section style={{ background: "#040406" }}>
        <div className="landing-divider" />
        <div className="landing-section">
          <div style={{ maxWidth: 540, marginBottom: 48 }}>
            <div className="landing-kicker" style={{ color: "rgba(65,214,155,0.65)" }}>capabilities</div>
            <h2 className="landing-h2 landing-gradient-text">What Copilot can do.</h2>
          </div>
          <div
            style={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(1, 1fr)" }}
            className="copilot-grid"
          >
            {CAPABILITIES.map((c) => (
              <div
                key={c.label}
                style={{
                  padding: "28px 28px",
                  borderRadius: 14,
                  border: "1px solid rgba(65,214,155,0.08)",
                  background: "rgba(65,214,155,0.02)",
                  display: "flex",
                  gap: 18,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    background: "rgba(65,214,155,0.07)",
                    border: "1px solid rgba(65,214,155,0.14)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    color: "rgba(65,214,155,0.70)",
                    flexShrink: 0,
                  }}
                >
                  {c.icon}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#e4e4e7", marginBottom: 6 }}>{c.label}</div>
                  <div style={{ fontSize: 13, color: "#52525b", lineHeight: 1.65 }}>{c.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <style>{`
            @media (min-width: 640px)  { .copilot-grid { grid-template-columns: repeat(2, 1fr) !important; } }
            @media (min-width: 1024px) { .copilot-grid { grid-template-columns: repeat(3, 1fr) !important; } }
          `}</style>
        </div>
      </section>

      {/* How it differs */}
      <section style={{ background: "#050507" }}>
        <div className="landing-divider" />
        <div className="landing-section" style={{ maxWidth: 680 }}>
          <div className="landing-kicker" style={{ color: "rgba(65,214,155,0.65)" }}>the difference</div>
          <h2 className="landing-h2 landing-gradient-text">Not automation. Agency.</h2>
          <p className="landing-body" style={{ marginBottom: 20 }}>
            Most AI is reactive. You ask, it answers. Copilot is active.
            It understands your current project, checks what tools say, makes
            decisions, and takes action. It is not a workflow builder. You talk
            to it like you would a colleague who has full context and can get
            things done.
          </p>
          <p className="landing-body">
            Every action runs inside your connected integrations. You review
            before anything sensitive is sent.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: "#040406", paddingBottom: 80 }}>
        <div className="landing-divider" />
        <div className="landing-section" style={{ maxWidth: 600, textAlign: "center" }}>
          <h2 className="landing-h2 landing-gradient-text" style={{ marginBottom: 14 }}>
            Put Copilot to work.
          </h2>
          <p className="landing-body" style={{ marginBottom: 32 }}>
            Connect your tools and describe what you need done. Workshop handles the rest.
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
