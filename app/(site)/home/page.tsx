import Link from "next/link";
import { auth } from "@/auth";
import { AuthFlow } from "@/components/auth-flow";
import { CinematicAct } from "@/components/landing/cinematic-act";
import { getSignInPath } from "@/lib/auth-ui";
import { getPlanActionHref, pricingPlans } from "@/lib/pricing";
import { getUserProfileByEmail } from "@/lib/user-profile";

// Home page. Six full-bleed product scenes, then a quiet outro
// with pricing, quick nav, and sign-in. No opening title, no
// chapter chips, no manifesto type slabs between scenes.

export default async function HomePage() {
  const session  = await auth();
  const signedIn = Boolean(session?.user?.email);
  await getUserProfileByEmail(session?.user?.email);

  const pricingPreview = pricingPlans.filter(
    (p) => (p.key === "free" || p.key === "studio" || p.key === "pro" || p.key === "teams") && !p.hidden,
  );

  return (
    <main style={{ background: "#050507" }}>
      {/* Hero — split layout. Image bleeds in from the right with a
          strong left-side dark gradient so the headline never sits on
          bright skin tones. On narrow viewports the image drops behind
          a darker scrim so text wins. */}
      <section
        style={{
          position: "relative",
          minHeight: "100vh",
          background: "#050507",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
        }}
      >
        {/* Photo, pinned right */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url(/landing/mainimage.png)",
            backgroundSize: "cover",
            backgroundPosition: "right center",
            backgroundRepeat: "no-repeat",
          }}
        />
        {/* Strong dark gradient on the left. Holds text contrast even
            when the photo's skin tones extend across most of the
            viewport. Darker on phones (right-heavy gradient narrows). */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, #050507 0%, rgba(5,5,7,0.92) 30%, rgba(5,5,7,0.55) 55%, rgba(5,5,7,0) 75%)",
            pointerEvents: "none",
          }}
        />
        {/* Soft top + bottom seal so the section dissolves into the
            page without a hard seam. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, #050507 0%, transparent 140px, transparent calc(100% - 200px), #050507 100%)",
            pointerEvents: "none",
          }}
        />

        {/* Text block — pinned left. Wide max-width so the headline
            elongates instead of stacking. */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            maxWidth: "min(1100px, 92vw)",
            padding: "clamp(40px, 8vh, 100px) clamp(24px, 6vw, 96px)",
          }}
        >
          <h1
            className="cinematic-display cinematic-display--gradient"
            style={{
              maxWidth: "min(1000px, 88vw)",
              marginBottom: 28,
            }}
          >
            One memory. Three surfaces.
          </h1>
          <p
            className="cinematic-body"
            style={{
              maxWidth: 640,
              marginBottom: 32,
              color: "rgba(245,245,247,0.82)",
            }}
          >
            A visual interface, a voice layer, and a workspace. Different
            surfaces, the same context.
          </p>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 14,
              padding: "8px 16px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              fontSize: 12,
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              letterSpacing: "0.06em",
              color: "rgba(229,231,235,0.86)",
              marginBottom: 28,
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#c084fc", boxShadow: "0 0 8px #c084fc" }} />
              Lens
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#60a5fa", boxShadow: "0 0 8px #60a5fa" }} />
              Whisper
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a8c4ff", boxShadow: "0 0 8px #a8c4ff" }} />
              Workshop
            </span>
          </div>

          <div>
            <Link
              href={signedIn ? "/app" : "/signin?callbackUrl=/app"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 22px",
                borderRadius: 100,
                border: "1px solid rgba(168,196,255,0.33)",
                background: "rgba(0,0,0,0.45)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                color: "rgba(168,196,255,0.94)",
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
                letterSpacing: "-0.005em",
              }}
            >
              Open Workshop
              <span aria-hidden style={{ fontSize: 13 }}>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Order: Lens > Audio (Whisper) > Day Kit > Workshop. Lens
          first because it is the flagship visual product; audio
          second because it is the wearable companion; case third
          because it is the accessory; workshop last because it is
          the platform / software surface. */}

      {/* Lens */}
      <CinematicAct
        accent="#c084fc"
        anchor="bottom-left"
        imageUrl="/landing/lens-hero.png"
        transparent
        poster="/landing/lens-poster.svg"
        posterAlt="Lens"
        headline={<>Lens.<br/>In concept and R&amp;D.</>}
        body={
          <>
            A transparent contact lens with three render modes, paired
            with Workshop on your phone or PC for compute. Quiet by
            default, summoned when you need it.
          </>
        }
        cta={{ href: "/lens", label: "See Lens" }}
      />

      {/* Whisper (audio) */}
      <CinematicAct
        accent="#60a5fa"
        anchor="bottom-left"
        imageUrl="/landing/whisper-hero.png"
        transparent
        poster="/landing/whisper-poster.svg"
        posterAlt="Whisper"
        headline={<>Whisper, the<br/>voice layer.</>}
        body={
          <>
            Low-latency voice in, natural voice out. Works with the
            earbuds you already wear today; dedicated Sansxel hardware
            later.
          </>
        }
        cta={{ href: "/whisper", label: "Explore Whisper" }}
      />

      {/* Day Kit case */}
      <CinematicAct
        accent="#c084fc"
        anchor="bottom-left"
        imageUrl="/landing/case-hero.png"
        transparent
        poster="/landing/lens-case-poster.svg"
        posterAlt="Lens and audio charging case"
        headline={<>Lens, audio,<br/>one case.</>}
        body={
          <>
            Charges both your Sansxel Lens pairs and the audio earbuds
            in one piece of hardware. Quick swap between pairs; one
            charges while the other runs. Targeting all-day usage when
            you alternate.
          </>
        }
        cta={{ href: "/lens#day-kit", label: "See the Day Kit" }}
      />

      {/* Workshop */}
      <CinematicAct
        accent="#a8c4ff"
        anchor="bottom-left"
        imageUrl="/landing/workshop-hero.png"
        poster="/landing/workshop-poster.svg"
        posterAlt="Workshop UI"
        headline={<>Workshop holds<br/>your context.</>}
        body={
          <>
            Chat, projects, files, memory, and voice in one workspace.
            Every action writes to the same context layer, so the next
            prompt picks up where the last one left off.
          </>
        }
        cta={{ href: "/workshop", label: "Open Workshop" }}
      />

      {/* Architecture act removed — was a duplicate of the Hero
          (both text-only, both centered on black, both leading with
          "One memory"). The single-bus story already lives in the
          Hero headline + the Day Kit body. /product carries the
          longer architecture explanation for users who want it. */}

      {/* Outro: pricing + community + final CTA */}
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
            <div style={{ maxWidth: 1200, marginBottom: 56 }}>
              <h2 className="cinematic-display cinematic-display--gradient" style={{ marginBottom: 18, maxWidth: "100%" }}>
                Free to start. Upgrade when the work gets serious.
              </h2>
              <p className="cinematic-body" style={{ maxWidth: 820 }}>
                Start with the workspace today. Upgrade for more usage,
                deeper memory, creation tools, and team workflows.
              </p>
            </div>

            <div
              style={{ display: "grid", gap: 18, gridTemplateColumns: "1fr" }}
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
                ["/workshop", "Workshop", "Chat, projects, files, memory, voice"],
                ["/whisper",  "Whisper",  "Voice in. Voice out."],
                ["/lens",     "Lens",     "Visual interface direction (R&D)"],
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
          /* Phone: stacked. Tablet: 2-up. Desktop: 4-up with more
             breathing room. Card paddings + gap together give the
             pricing block the space it was missing on mid-size
             viewports. */
          @media (min-width: 640px)  { .lp-pricing-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 20px !important; } }
          @media (min-width: 1180px) { .lp-pricing-grid { grid-template-columns: repeat(4, 1fr) !important; gap: 22px !important; } }
          @media (min-width: 640px)  { .landing-quick-nav { grid-template-columns: repeat(4, 1fr) !important; } }
        `}</style>
      </section>
    </main>
  );
}
