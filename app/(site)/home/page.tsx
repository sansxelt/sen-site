import Link from "next/link";
import { auth } from "@/auth";
import { AuthFlow } from "@/components/auth-flow";
import { CinematicOpeningTitle } from "@/components/landing/cinematic-opening-title";
import { CinematicAct } from "@/components/landing/cinematic-act";
import { CinematicTypeSlab } from "@/components/landing/cinematic-type-slab";
import { EcosystemOrbit } from "@/components/3d/ecosystem-orbit";
import { WorkshopBrain } from "@/components/3d/workshop-brain";
import { WhisperEarbud } from "@/components/3d/whisper-earbud";
import { LensObject } from "@/components/3d/lens-object";
import { LensCase } from "@/components/3d/lens-case";
import { EcosystemConnection } from "@/components/3d/ecosystem-connection";
import { getSignInPath } from "@/lib/auth-ui";
import { getPlanActionHref, pricingPlans } from "@/lib/pricing";
import { getUserProfileByEmail } from "@/lib/user-profile";

// The home reel. Seven acts flanked by three quiet typography slabs
// + a quiet outro. The opening title holds before the first act.
//
// Pacing principle: loud (act) → silent (slab) → loud → silent. The
// site reads like a film, not a marketing page.

const TOTAL_ACTS = 7;

export default async function HomePage() {
  const session  = await auth();
  const signedIn = Boolean(session?.user?.email);
  await getUserProfileByEmail(session?.user?.email);

  const pricingPreview = pricingPlans.filter(
    (p) => (p.key === "free" || p.key === "studio" || p.key === "pro" || p.key === "teams") && !p.hidden,
  );

  return (
    <main style={{ background: "#000000" }}>
      {/* ─────────────  OPENING TITLE  ──────────────────────────────── */}
      <CinematicOpeningTitle kicker="an operating system" />

      {/* ─────────────  ACT 01  · the system  ───────────────────────── */}
      <CinematicAct
        index={1}
        total={TOTAL_ACTS}
        marker="THE SYSTEM"
        accent="#a8c4ff"
        anchor="bottom-left"
        cameraPosition={[0, 0.5, 8.0]}
        cameraFov={42}
        scene={<EcosystemOrbit />}
        poster="/landing/ecosystem-orbit-poster.svg"
        posterAlt="Sansxel ecosystem orbit"
        headline={<>One AI.<br/>Every surface.</>}
        body={
          <>
            Workshop is the brain. Whisper is the voice. Lens is the eye.
            One memory core, three surfaces, all connected.
          </>
        }
        cta={{
          href: signedIn ? "/app" : "/signin?callbackUrl=/app",
          label: signedIn ? "Open Workshop" : "Open Workshop",
        }}
      />

      {/* ─────────────  SLAB  · the promise  ────────────────────────── */}
      <CinematicTypeSlab
        kicker="the operating layer"
        treatment="gradient"
        align="left"
      >
        An operating system<br/>that remembers.
      </CinematicTypeSlab>

      {/* ─────────────  ACT 02  · workshop  ─────────────────────────── */}
      <CinematicAct
        index={2}
        total={TOTAL_ACTS}
        marker="WORKSHOP · THE BRAIN"
        accent="#a8c4ff"
        anchor="bottom-left"
        cameraPosition={[0, 0.4, 6.5]}
        cameraFov={40}
        scene={<WorkshopBrain />}
        poster="/landing/workshop-poster.svg"
        posterAlt="Workshop spatial dashboard"
        headline={<>The workspace<br/>that holds your context.</>}
        body={
          <>
            Chat, projects, files, memory, voice. Every action writes to
            one persistent context layer, so the next prompt picks up
            where the last one left off.
          </>
        }
        cta={{ href: "/workshop", label: "Open Workshop" }}
      />

      {/* ─────────────  SLAB  · whisper preface  ────────────────────── */}
      <CinematicTypeSlab
        kicker="the speaking layer"
        treatment="white"
        align="center"
      >
        Speak. Listen.<br/>Stay heads-up.
      </CinematicTypeSlab>

      {/* ─────────────  ACT 03  · whisper  ──────────────────────────── */}
      <CinematicAct
        index={3}
        total={TOTAL_ACTS}
        marker="WHISPER · THE VOICE"
        accent="#60a5fa"
        anchor="bottom-left"
        cameraPosition={[0, 0.4, 6.5]}
        cameraFov={40}
        scene={<WhisperEarbud />}
        poster="/landing/whisper-poster.svg"
        posterAlt="Whisper earbud"
        headline={<>Sub-second<br/>from voice to answer.</>}
        body={
          <>
            Low-latency voice in, natural voice out. Works with the earbuds
            you already wear today; dedicated Sansxel hardware later.
          </>
        }
        cta={{ href: "/whisper", label: "Explore Whisper" }}
      />

      {/* ─────────────  SLAB  · lens preface  ───────────────────────── */}
      <CinematicTypeSlab
        kicker="the visual layer · concept"
        treatment="gradient"
        align="left"
      >
        The interface,<br/>embedded.
      </CinematicTypeSlab>

      {/* ─────────────  ACT 04  · lens  ─────────────────────────────── */}
      <CinematicAct
        index={4}
        total={TOTAL_ACTS}
        marker="LENS · THE EYE · CONCEPT"
        accent="#c084fc"
        anchor="bottom-left"
        cameraPosition={[0, 0.6, 5.0]}
        cameraFov={38}
        scene={<LensObject />}
        poster="/landing/lens-poster.svg"
        posterAlt="Transparent contact lens with HUD"
        headline={<>A transparent<br/>visual interface.</>}
        body={
          <>
            Lens is our visual interface direction, currently in concept
            and R&amp;D. Three render modes — Ambient, Mainframe, Minimal —
            paired with Workshop on your phone or PC for compute.
          </>
        }
        cta={{ href: "/lens", label: "Join the Lens waitlist" }}
      />

      {/* ─────────────  ACT 05  · day kit case  ─────────────────────── */}
      <CinematicAct
        index={5}
        total={TOTAL_ACTS}
        marker="LENS DAY KIT · CONCEPT"
        accent="#c084fc"
        anchor="bottom-left"
        cameraPosition={[2.4, 1.5, 4.2]}
        cameraFov={36}
        scene={<LensCase />}
        poster="/landing/lens-case-poster.svg"
        posterAlt="Lens charging case"
        headline={<>Two pairs.<br/>One smart case.</>}
        body={
          <>
            The Day Kit pairs two Lens with a smart charging case.
            Quick swap between Pair A and Pair B; one charges while
            the other runs. Targeting all-day usage when you alternate.
          </>
        }
        cta={{ href: "/lens#day-kit", label: "See the Day Kit" }}
      />

      {/* ─────────────  SLAB  · architecture preface  ───────────────── */}
      <CinematicTypeSlab
        kicker="the architecture"
        treatment="white"
        align="center"
      >
        All of it,<br/>one memory.
      </CinematicTypeSlab>

      {/* ─────────────  ACT 06  · ecosystem  ────────────────────────── */}
      <CinematicAct
        index={6}
        total={TOTAL_ACTS}
        marker="ARCHITECTURE · ONE BUS"
        accent="#a8c4ff"
        anchor="bottom-center"
        cameraPosition={[0, 1.2, 5.5]}
        cameraFov={42}
        scene={<EcosystemConnection />}
        poster="/landing/ecosystem-poster.svg"
        posterAlt="Sansxel ecosystem architecture"
        headline={<>Every surface writes<br/>to the same memory.</>}
        body={
          <>
            What you said to Whisper this morning is in Workshop tonight,
            on Lens tomorrow. No imports, no syncs, no context loss.
          </>
        }
        cta={{ href: "/product", label: "See the architecture" }}
      />

      {/* ─────────────  ACT 07  · the platform  ─────────────────────── */}
      <CinematicAct
        index={7}
        total={TOTAL_ACTS}
        marker="THE PLATFORM"
        accent="#7ab5ff"
        anchor="bottom-left"
        cameraPosition={[0, 0.8, 9.0]}
        cameraFov={48}
        scene={<EcosystemOrbit />}
        poster="/landing/ecosystem-orbit-poster.svg"
        posterAlt="Sansxel platform"
        headline={<>An ecosystem,<br/>not a product.</>}
        body={
          <>
            Sansxel is the operating layer. Free to start, deeper memory
            and creation tools when the work gets serious. Build with the
            early community on Discord.
          </>
        }
        cta={{ href: "#pricing", label: "See pricing" }}
      />

      {/* ─────────────  QUIET OUTRO  ─ pricing + community + cta  ──── */}
      <section
        style={{
          position: "relative",
          background: "#040406",
          padding: "clamp(80px, 14vh, 180px) clamp(20px, 5vw, 80px) 100px",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(168,196,255,0.04) 0%, transparent 60%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", maxWidth: 1500, margin: "0 auto" }}>
          {/* PRICING */}
          <div id="pricing" style={{ marginBottom: 96 }}>
            <div style={{ maxWidth: 640, marginBottom: 56 }}>
              <div className="cinematic-mono" style={{ marginBottom: 16 }}>
                pricing
              </div>
              <h2 className="cinematic-display cinematic-display--gradient" style={{ marginBottom: 18 }}>
                Free to start.<br/>Upgrade when the work gets serious.
              </h2>
              <p className="cinematic-body" style={{ maxWidth: 520 }}>
                Start with the workspace today. Upgrade for more usage,
                deeper memory, creation tools, and team workflows.
              </p>
            </div>

            <div
              style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, 1fr)" }}
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
                      border: plan.featured ? "none" : "1px solid rgba(255,255,255,0.09)",
                      background: plan.featured ? "rgba(168,196,255,0.15)" : "rgba(255,255,255,0.04)",
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

          {/* COMMUNITY + FINAL CTA */}
          <div id="get-started" style={{ marginTop: 96 }}>
            {signedIn ? (
              <div className="landing-glass" style={{ padding: "40px 40px" }}>
                <div className="cinematic-mono" style={{ marginBottom: 16 }}>welcome back</div>
                <h2 className="cinematic-display cinematic-display--gradient" style={{ marginBottom: 16 }}>
                  Pick up where you left off.
                </h2>
                <p className="cinematic-body" style={{ marginBottom: 28 }}>
                  Jump into your workspace or manage billing and account settings.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  <Link href="/app" className="landing-cta-primary" style={{ display: "inline-flex" }}>
                    Open workspace
                  </Link>
                  <Link
                    href="/account/plan"
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
                    Manage plan
                  </Link>
                </div>
              </div>
            ) : (
              <AuthFlow initialSessionEmail={session?.user?.email ?? null} />
            )}

            <div
              style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginTop: 40 }}
              className="landing-quick-nav"
            >
              {[
                ["/workshop", "Workshop", "Chat · Projects · Files · Memory · Voice"],
                ["/whisper",  "Whisper",  "Speak. Listen. Heads-up."],
                ["/lens",     "Lens",     "Visual interface direction · R&D"],
                ["/pricing",  "Pricing",  "Free, Plus, Pro, Teams"],
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
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#e4e4e7", marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 12, color: "#52525b" }}>{desc}</div>
                </Link>
              ))}
            </div>

            <a
              href="https://discord.gg/5sxuuewf3u"
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
              <p style={{ marginTop: 32, textAlign: "center", fontSize: 12, color: "#52525b" }}>
                Already have an account?{" "}
                <Link href={getSignInPath()} style={{ color: "#a1a1aa", textDecoration: "underline", textUnderlineOffset: 4 }}>
                  Sign in
                </Link>
              </p>
            )}
          </div>
        </div>

        <style>{`
          @media (min-width: 768px)  { .lp-pricing-grid { grid-template-columns: repeat(2, 1fr) !important; } }
          @media (min-width: 1024px) { .lp-pricing-grid { grid-template-columns: repeat(4, 1fr) !important; } }
          @media (min-width: 640px)  { .landing-quick-nav { grid-template-columns: repeat(4, 1fr) !important; } }
        `}</style>
      </section>
    </main>
  );
}
