import Link from "next/link";
import { auth } from "@/auth";
import { getSignInPath } from "@/lib/auth-ui";
import { Reveal } from "@/components/landing/reveal";

const FEATURES = [
  { icon: "◎", label: "Team memory",       desc: "Shared memory libraries that all team members can reference. Context does not live in one person's chat history." },
  { icon: "◇", label: "Shared projects",   desc: "Projects that belong to the team, not an individual. Threads, files, and outputs all accessible to anyone on the workspace." },
  { icon: "◆", label: "Admin controls",    desc: "Manage members, set access levels, review usage. Full visibility into how the team is using the workspace." },
  { icon: "⬡", label: "Shared billing",    desc: "One invoice. Add or remove seats without contacting support. Usage tracked per seat." },
  { icon: "◈", label: "Shared integrations", desc: "Integrations set up once for the whole team. Everyone connects to the same Notion workspace, GitHub org, or Slack." },
  { icon: "◉", label: "Priority support",  desc: "Dedicated support channel and faster response times for Platform teams." },
];

export default async function PlatformPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);

  return (
    <main style={{ background: "#050507", overflowX: "hidden" }}>

      {/* Hero */}
      <section style={{ background: "#050507" }}>
        <div className="landing-divider" />
        <div className="landing-section" style={{ maxWidth: 760, paddingTop: 80, paddingBottom: 72 }}>
          <Reveal>
            <div className="landing-kicker" style={{ color: "rgba(255,172,51,0.70)" }}>platform</div>
            <h1
              className="landing-gradient-text"
              style={{ fontSize: "clamp(36px, 5vw, 60px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.08, marginBottom: 20 }}
            >
              Sansxel for teams.
            </h1>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="landing-body" style={{ maxWidth: 520, marginBottom: 36 }}>
              Platform brings Workshop to your whole team. Shared workspaces,
              team memory, admin controls, and billing built for organizations.
              Everyone gets access to the same context.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link
              href="/contact"
              className="landing-cta-primary"
              style={{ display: "inline-flex" }}
            >
              Talk to us
            </Link>
            <Link
              href={signedIn ? "/app" : getSignInPath()}
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
              {signedIn ? "Open Workshop" : "Start with personal plan"}
            </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Features */}
      <section style={{ background: "#040406" }}>
        <div className="landing-divider" />
        <div className="landing-section">
          <Reveal>
            <div style={{ maxWidth: 540, marginBottom: 48 }}>
              <div className="landing-kicker" style={{ color: "rgba(255,172,51,0.65)" }}>what you get</div>
              <h2 className="landing-h2 landing-gradient-text">Built for how teams actually work.</h2>
            </div>
          </Reveal>
          <div
            style={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(1, 1fr)" }}
            className="platform-grid"
          >
            {FEATURES.map((f, i) => (
              <Reveal
                key={f.label}
                delay={i * 0.06}
                style={{
                  padding: "28px 28px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,172,51,0.08)",
                  background: "rgba(255,172,51,0.02)",
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
                    background: "rgba(255,172,51,0.07)",
                    border: "1px solid rgba(255,172,51,0.14)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    color: "rgba(255,172,51,0.70)",
                    flexShrink: 0,
                  }}
                >
                  {f.icon}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#e4e4e7", marginBottom: 6 }}>{f.label}</div>
                  <div style={{ fontSize: 13, color: "#52525b", lineHeight: 1.65 }}>{f.desc}</div>
                </div>
              </Reveal>
            ))}
          </div>
          <style>{`
            @media (min-width: 640px)  { .platform-grid { grid-template-columns: repeat(2, 1fr) !important; } }
            @media (min-width: 1024px) { .platform-grid { grid-template-columns: repeat(3, 1fr) !important; } }
          `}</style>
        </div>
      </section>

      {/* Pricing note */}
      <section style={{ background: "#050507" }}>
        <div className="landing-divider" />
        <div className="landing-section" style={{ maxWidth: 680 }}>
          <Reveal>
            <div className="landing-kicker" style={{ color: "rgba(255,172,51,0.65)" }}>pricing</div>
            <h2 className="landing-h2 landing-gradient-text">Teams plan.</h2>
            <p className="landing-body" style={{ marginBottom: 16 }}>
              Platform is available on the Teams plan. Pricing is per seat, billed
              monthly or annually. Talk to us for larger deployments or custom
              requirements.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 28 }}>
            <Link href="/pricing" style={{ fontSize: 13, color: "rgba(255,172,51,0.75)", textDecoration: "none", borderBottom: "1px solid rgba(255,172,51,0.28)", paddingBottom: 2 }}>
              View pricing details →
            </Link>
            <Link href="/contact" style={{ fontSize: 13, color: "rgba(255,172,51,0.75)", textDecoration: "none", borderBottom: "1px solid rgba(255,172,51,0.28)", paddingBottom: 2 }}>
              Talk to the team →
            </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <div style={{ height: 80 }} />
    </main>
  );
}
