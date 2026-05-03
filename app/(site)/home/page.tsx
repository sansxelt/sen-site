import Link from "next/link";
import { auth } from "@/auth";
import { AuthFlow } from "@/components/auth-flow";
import { SpotlightCard } from "@/components/spotlight-card";
import { CopilotSection } from "@/components/landing/copilot-section";
import { EcosystemSection } from "@/components/landing/ecosystem-section";
import { LandingHero } from "@/components/landing/landing-hero";
import { LensSection } from "@/components/landing/lens-section";
import { WhisperSection } from "@/components/landing/whisper-section";
import { WorkspaceSection } from "@/components/landing/workspace-section";
import { getSignInPath } from "@/lib/auth-ui";
import { pricingPlans } from "@/lib/pricing";
import { getUserProfileByEmail } from "@/lib/user-profile";

export default async function HomePage() {
  const session      = await auth();
  const signedIn     = Boolean(session?.user?.email);
  await getUserProfileByEmail(session?.user?.email);

  const pricingPreview = pricingPlans.filter(
    (p) => p.key === "free" || p.key === "pro" || p.key === "teams",
  );

  return (
    <main style={{ background: "#050507", overflowX: "hidden" }}>
      {/* ── 1. Hero ───────────────────────────────────────────── */}
      <LandingHero signedIn={signedIn} />

      {/* ── 2. Web workspace ─────────────────────────────────── */}
      <WorkspaceSection />

      {/* ── 3. Copilot ───────────────────────────────────────── */}
      <CopilotSection />

      {/* ── 4. Whisper ───────────────────────────────────────── */}
      <WhisperSection />

      {/* ── 5. Lens (future) ─────────────────────────────────── */}
      <LensSection />

      {/* ── 6. Ecosystem ─────────────────────────────────────── */}
      <EcosystemSection signedIn={signedIn} />

      {/* ── 7. Pricing ───────────────────────────────────────── */}
      <section
        id="pricing"
        style={{ background: "#040406" }}
      >
        <div className="landing-divider" />
        <div
          className="landing-section"
          style={{ maxWidth: 1600, margin: "0 auto" }}
        >
          <div className="landing-pricing-kicker">── pricing</div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 40,
            }}
          >
            <div>
              <h2 className="landing-h2 landing-gradient-text" style={{ marginBottom: 8 }}>
                Start free. Upgrade when it matters.
              </h2>
              <p className="landing-body">No card required to get started.</p>
            </div>
            <Link
              href="/pricing"
              style={{
                padding: "10px 20px",
                borderRadius: 100,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.04)",
                fontSize: 13,
                color: "#d4d4d8",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              View all plans
            </Link>
          </div>

          <div
            style={{
              display: "grid",
              gap: 16,
              maxWidth: 960,
            }}
            className="landing-pricing-grid"
          >
            {pricingPreview.map((plan) => (
              <SpotlightCard
                key={plan.name}
                className={`rounded-3xl border p-6 sm:p-7 h-full ${
                  plan.featured
                    ? "border-white bg-white text-neutral-950"
                    : "border-white/10 bg-white/5 text-white"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-lg font-medium">{plan.name}</div>
                    <div
                      className={`mt-1 text-sm ${
                        plan.featured ? "text-neutral-700" : "text-neutral-300"
                      }`}
                    >
                      {plan.note}
                    </div>
                  </div>
                  {(plan.badge || plan.featured) && (
                    <div className="rounded-full bg-neutral-950 px-3 py-1 text-xs font-medium text-white">
                      {plan.badge ?? "Popular"}
                    </div>
                  )}
                </div>

                <div className="mt-6 text-4xl font-semibold tracking-tight">
                  {plan.monthlyLabel.replace(" / month", "").replace(" / seat", "")}
                </div>

                <div className="mt-6 space-y-3">
                  {plan.points.map((point) => (
                    <div key={point} className="flex items-center gap-3 text-sm">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          plan.featured ? "bg-neutral-950" : "bg-white"
                        }`}
                      />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>

                <Link
                  href={
                    plan.key === "free"  ? "/account"
                    : plan.key === "teams" ? "/contact"
                                          : `/checkout?plan=${plan.key}&cycle=monthly`
                  }
                  className={`mt-8 block w-full rounded-2xl px-5 py-3 text-center text-sm font-medium transition ${
                    plan.featured
                      ? "sansxel-dark-button bg-neutral-950 text-white hover:opacity-90"
                      : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  {plan.key === "free"   ? "Start free"
                   : plan.key === "teams" ? "Talk to us"
                                         : "See plan"}
                </Link>
              </SpotlightCard>
            ))}
          </div>
        </div>

        <style>{`
          @media (min-width: 640px)  { .landing-pricing-grid { grid-template-columns: repeat(2, 1fr); } }
          @media (min-width: 1024px) { .landing-pricing-grid { grid-template-columns: repeat(3, 1fr); } }
        `}</style>
      </section>

      {/* ── 8. Auth CTA ──────────────────────────────────────── */}
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

          {/* Quick nav row */}
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
              ["/pricing",  "Pricing",  "Free, Pro, Teams"],
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
