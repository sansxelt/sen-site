import Link from "next/link";
import { auth } from "@/auth";
import { AuthFlow } from "@/components/auth-flow";
import { CopilotSection } from "@/components/landing/copilot-section";
import { EcosystemSection } from "@/components/landing/ecosystem-section";
import { FutureHintSection } from "@/components/landing/future-hint-section";
import { LandingHero } from "@/components/landing/landing-hero";
import { MemorySection } from "@/components/landing/memory-section";
import { WorkspaceSection } from "@/components/landing/workspace-section";
import { getSignInPath } from "@/lib/auth-ui";
import { getPlanActionHref, pricingPlans } from "@/lib/pricing";
import { getUserProfileByEmail } from "@/lib/user-profile";

const FEATURES = [
  {
    icon: "◎",
    title: "Deep research",
    body: "Synthesize from multiple web sources and your own files without switching tabs.",
  },
  {
    icon: "◉",
    title: "Voice mode",
    body: "Low-latency voice conversations. Talk through complex work hands-free, back and forth.",
  },
  {
    icon: "◻",
    title: "Image generation",
    body: "Create diagrams, concepts, and visual references inline. No separate tool needed.",
  },
  {
    icon: "◆",
    title: "Projects and memory",
    body: "Organize threads into projects. Memory keeps context across every session in that project.",
  },
];

export default async function HomePage() {
  const session  = await auth();
  const signedIn = Boolean(session?.user?.email);
  await getUserProfileByEmail(session?.user?.email);

  const pricingPreview = pricingPlans.filter(
    (p) => (p.key === "free" || p.key === "studio" || p.key === "pro" || p.key === "teams") && !p.hidden,
  );

  return (
    <main style={{ background: "#050507", overflowX: "hidden" }}>

      {/* 1. Hero */}
      <LandingHero signedIn={signedIn} />

      {/* 2. Product showcase: Workshop */}
      <WorkspaceSection />

      {/* 3. Memory, projects, files */}
      <MemorySection />

      {/* 4. Copilot and integrations */}
      <CopilotSection />

      {/* 5. Feature strip — 4 highlights */}
      <section style={{ background: "#040406" }}>
        <div className="landing-divider" />
        <div className="landing-section">
          <div
            style={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: "repeat(2, 1fr)",
            }}
            className="lp-features-grid"
          >
            {FEATURES.map((f) => (
              <div
                key={f.title}
                style={{
                  padding: "28px 28px",
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.05)",
                  background: "rgba(255,255,255,0.015)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 18, color: "rgba(168,196,255,0.55)" }}>{f.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#e4e4e7", marginBottom: 5 }}>
                    {f.title}
                  </div>
                  <div style={{ fontSize: 13, color: "#52525b", lineHeight: 1.6 }}>
                    {f.body}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <style>{`
          @media (min-width: 768px) { .lp-features-grid { grid-template-columns: repeat(4, 1fr) !important; } }
        `}</style>
      </section>

      {/* 6. Future ecosystem hint: Whisper + Lens */}
      <FutureHintSection />

      {/* 7. Ecosystem map */}
      <EcosystemSection signedIn={signedIn} />

      {/* 8. Community / Discord */}
      <section style={{ background: "#040406" }}>
        <div className="landing-divider" />
        <div
          className="landing-section"
          style={{ maxWidth: 720, textAlign: "center" }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              marginBottom: 20,
              padding: "4px 12px",
              borderRadius: 100,
              border: "1px solid rgba(88,101,242,0.25)",
              background: "rgba(88,101,242,0.07)",
              fontSize: 11,
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              letterSpacing: "0.12em",
              color: "rgba(148,163,255,0.75)",
            }}
          >
            ◈ discord
          </div>
          <h2
            className="landing-h2 landing-gradient-text"
            style={{ marginBottom: 14 }}
          >
            Build with the early community.
          </h2>
          <p
            className="landing-body"
            style={{ maxWidth: 440, margin: "0 auto 32px" }}
          >
            Early users, feedback loops, and direct access. The Discord is where
            the product gets shaped.
          </p>
          <a
            href="https://discord.gg/WEMgmvtDgG"
            target="_blank"
            rel="noopener noreferrer"
            className="landing-cta-primary"
            style={{ display: "inline-flex" }}
          >
            Join the Discord
          </a>
        </div>
      </section>

      {/* 9. Pricing */}
      <section id="pricing" style={{ background: "#040406" }}>
        <div className="landing-divider" />
        <div className="landing-section" style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ maxWidth: 560, marginBottom: 48 }}>
            <div className="landing-pricing-kicker">pricing</div>
            <h2 className="landing-h2 landing-gradient-text" style={{ marginBottom: 12 }}>
              Use Sansxel free. Upgrade when the work gets serious.
            </h2>
            <p className="landing-body">
              Start with the workspace today. Upgrade for more usage, deeper memory,
              creation tools, and team workflows.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(2, 1fr)",
            }}
            className="lp-pricing-grid"
          >
            {pricingPreview.map((plan) => (
              <div
                key={plan.key}
                style={{
                  borderRadius: 18,
                  border: plan.featured
                    ? "1px solid rgba(168,196,255,0.22)"
                    : "1px solid rgba(255,255,255,0.07)",
                  background: plan.featured
                    ? "rgba(168,196,255,0.04)"
                    : "rgba(255,255,255,0.02)",
                  padding: "28px 28px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: plan.featured ? "#A8C4FF" : "#e4e4e7" }}>
                      {plan.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#52525b", marginTop: 2 }}>
                      {plan.note}
                    </div>
                  </div>
                  {plan.badge && (
                    <span
                      style={{
                        fontSize: 10,
                        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                        letterSpacing: "0.10em",
                        padding: "3px 8px",
                        borderRadius: 100,
                        border: "1px solid rgba(168,196,255,0.22)",
                        color: "rgba(168,196,255,0.75)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {plan.badge}
                    </span>
                  )}
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 26, fontWeight: 600, color: "#f5f5f7", letterSpacing: "-0.02em" }}>
                    {plan.monthlyLabel.replace(" / month", "").replace(" / seat", "")}
                  </div>
                  {plan.monthlyValue !== null && plan.monthlyValue > 0 && (
                    <div style={{ fontSize: 11, color: "#52525b", marginTop: 3 }}>
                      {plan.key === "teams" ? "per seat / month" : "per month"}
                    </div>
                  )}
                </div>

                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 9 }}>
                  {plan.points.map((point) => (
                    <li key={point} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13, color: "#a1a1aa", lineHeight: 1.5 }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(168,196,255,0.40)", flexShrink: 0, marginTop: 7 }} />
                      {point}
                    </li>
                  ))}
                </ul>

                <Link
                  href={getPlanActionHref(plan)}
                  style={{
                    marginTop: "auto",
                    display: "block",
                    textAlign: "center",
                    padding: "10px 16px",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 500,
                    textDecoration: "none",
                    transition: "opacity 0.15s",
                    border: plan.featured
                      ? "none"
                      : "1px solid rgba(255,255,255,0.09)",
                    background: plan.featured
                      ? "rgba(168,196,255,0.15)"
                      : "rgba(255,255,255,0.04)",
                    color: plan.featured ? "#A8C4FF" : "#d4d4d8",
                  }}
                >
                  {plan.key === "free" ? "Start free" : plan.key === "teams" ? "Talk to us" : plan.ctaLabel}
                </Link>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <p style={{ fontSize: 12, color: "#52525b" }}>
              No card required to start. Cancel any time.
            </p>
            <Link
              href="/pricing"
              style={{ fontSize: 12, color: "#71717a", textDecoration: "underline", textUnderlineOffset: 4 }}
            >
              View all plans and add-ons →
            </Link>
          </div>
        </div>

        <style>{`
          @media (min-width: 768px)  { .lp-pricing-grid { grid-template-columns: repeat(2, 1fr) !important; } }
          @media (min-width: 1024px) { .lp-pricing-grid { grid-template-columns: repeat(4, 1fr) !important; } }
        `}</style>
      </section>

      {/* 10. Final CTA */}
      <section
        id="get-started"
        style={{ background: "#040406", paddingBottom: 80 }}
      >
        <div className="landing-divider" style={{ marginBottom: 0 }} />
        <div
          className="landing-section"
          style={{ maxWidth: 1600, margin: "0 auto", paddingTop: 64 }}
        >
          {signedIn ? (
            <div
              className="landing-glass"
              style={{ padding: "40px 40px" }}
            >
              <div className="landing-kicker landing-kicker--dim">welcome back</div>
              <h2 className="landing-h2 landing-gradient-text">
                Pick up where you left off.
              </h2>
              <p className="landing-body" style={{ marginBottom: 28 }}>
                Jump into your workspace or manage billing and account settings.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                <Link href="/app" className="landing-cta-primary" style={{ display: "inline-flex" }}>
                  Open workspace
                </Link>
                <Link
                  href="/account/billing"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "12px 22px",
                    borderRadius: 100,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.04)",
                    color: "#d4d4d8",
                    fontSize: 14,
                    textDecoration: "none",
                  }}
                >
                  Manage billing
                </Link>
              </div>
            </div>
          ) : (
            <AuthFlow initialSessionEmail={session?.user?.email ?? null} />
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 12,
              marginTop: 40,
            }}
            className="landing-quick-nav"
          >
            {[
              ["/product",  "Product",  "Workspace · Copilot · Whisper · Lens"],
              ["/pricing",  "Pricing",  "Free, Plus, Pro, Teams"],
              ["/learn",    "Learn",    "Short reads, real examples"],
              ["/contact",  "Contact",  "Talk to the team"],
            ].map(([href, label, desc]) => (
              <Link
                key={href}
                href={href}
                style={{
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.07)",
                  background: "rgba(0,0,0,0.25)",
                  padding: "14px 16px",
                  textDecoration: "none",
                  transition: "background 0.15s",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 500, color: "#e4e4e7", marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 12, color: "#52525b" }}>{desc}</div>
              </Link>
            ))}
          </div>

          <a
            href="https://discord.gg/WEMgmvtDgG"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginTop: 12,
              borderRadius: 16,
              border: "1px solid rgba(88,101,242,0.22)",
              background: "rgba(88,101,242,0.06)",
              padding: "14px 16px",
              textDecoration: "none",
              transition: "background 0.15s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>◈</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#e4e4e7", marginBottom: 2 }}>Join the Discord</div>
                <div style={{ fontSize: 12, color: "#52525b" }}>Early users, feedback, and updates</div>
              </div>
            </div>
            <span style={{ fontSize: 12, color: "rgba(88,101,242,0.75)", whiteSpace: "nowrap" }}>discord.gg →</span>
          </a>

          {!signedIn && (
            <p
              style={{
                marginTop: 32,
                textAlign: "center",
                fontSize: 12,
                color: "#52525b",
              }}
            >
              Already have an account?{" "}
              <Link
                href={getSignInPath()}
                style={{ color: "#a1a1aa", textDecoration: "underline", textUnderlineOffset: 4 }}
              >
                Sign in
              </Link>
            </p>
          )}
        </div>

        <style>{`
          @media (min-width: 640px) { .landing-quick-nav { grid-template-columns: repeat(4, 1fr) !important; } }
        `}</style>
      </section>
    </main>
  );
}
