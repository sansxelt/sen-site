import Link from "next/link";
import { auth } from "@/auth";
import { AuroraBackground } from "@/components/aurora-background";
import { AuthFlow } from "@/components/auth-flow";
import { HeroActivity } from "@/components/hero-activity";
import { SpotlightCard } from "@/components/spotlight-card";
import { readAccountContext } from "@/lib/account-session";
import { getSignInPath } from "@/lib/auth-ui";
import { pricingPlans } from "@/lib/pricing";
import { getUserProfileByEmail } from "@/lib/user-profile";

// Keep the escalation teaser — it's the single most distinctive concept
// of the product.  Everything else (transforms, why-sansxel, product
// shape) lives on /features and /function where people come for depth.
const escalation = [
  {
    size: "Small",
    input: '"Where should I eat tonight?"',
    layers: [
      "Quick answer with a few strong picks",
      "Light visual suggestions only when they help",
    ],
  },
  {
    size: "Medium",
    input: '"Plan my day tomorrow"',
    layers: [
      "Direct answer",
      "Structured timeline with priorities",
      "Tradeoffs, adjustments, and next moves",
    ],
  },
  {
    size: "Big",
    input: '"Build me an AI app"',
    layers: [
      "Product idea and target users",
      "Homepage direction and feature set",
      "Pricing, onboarding, and system thinking",
      "Actions to refine, export, or build next",
    ],
  },
];

export default async function HomePage() {
  const session                = await auth();
  const signedIn               = Boolean(session?.user?.email);
  const profile                = await getUserProfileByEmail(session?.user?.email);
  const initialAccountContext  = readAccountContext(session, profile);
  const pricingPreview         = pricingPlans.filter(
    (plan) => plan.key === "free" || plan.key === "pro" || plan.key === "teams",
  );

  return (
    <>
      <AuroraBackground />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section
        id="top"
        data-stagger
        style={{ "--stagger-i": 0 } as React.CSSProperties}
        className="mx-auto grid max-w-7xl gap-10 px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-12 lg:grid-cols-[1.1fr_.9fr] lg:items-start lg:gap-16 lg:px-8 lg:pb-16 lg:pt-16"
      >
        <HeroActivity isSignedIn={Boolean(initialAccountContext)} />
      </section>

      {/* ── Value teaser: smart escalation (single concept) ──────── */}
      <section
        id="how"
        data-stagger
        style={{ "--stagger-i": 1 } as React.CSSProperties}
        className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8"
      >
        <div className="max-w-2xl">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            How it grows
          </div>
          <h2 className="hx-gradient-text mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">
            The response changes shape based on the request.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-neutral-200">
            Sansxel stays light when the ask is light, and expands into
            structure, visuals, and system thinking only when the prompt
            earns it. Here&apos;s what that looks like across three sizes of
            ask.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {escalation.map((level) => (
            <SpotlightCard
              key={level.size}
              className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6 h-full"
            >
              <div className="inline-flex rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-400">
                {level.size}
              </div>
              <p className="mt-4 text-sm font-medium leading-snug text-white/90">
                {level.input}
              </p>
              <div className="mt-4 space-y-2">
                {level.layers.map((layer) => (
                  <div key={layer} className="flex items-start gap-2.5 text-sm text-neutral-300">
                    <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/70" />
                    <span>{layer}</span>
                  </div>
                ))}
              </div>
            </SpotlightCard>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3 text-sm">
          <Link
            href="/function"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-neutral-200 transition hover:bg-white/10"
          >
            See how it works →
          </Link>
          <Link
            href="/features"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-neutral-200 transition hover:bg-white/10"
          >
            Full feature set →
          </Link>
        </div>
      </section>

      {/* ── Pricing preview ──────────────────────────────────────── */}
      <section
        id="pricing"
        data-stagger
        style={{ "--stagger-i": 2 } as React.CSSProperties}
        className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8"
      >
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
              Pricing
            </div>
            <h2 className="hx-gradient-text mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">
              Start free. Upgrade when it becomes part of how you build.
            </h2>
          </div>
          <Link
            href="/pricing"
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
          >
            View all plans
          </Link>
        </div>

        <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  <div className={`mt-1 text-sm ${plan.featured ? "text-neutral-700" : "text-neutral-300"}`}>
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
                    <div className={`h-2 w-2 rounded-full ${plan.featured ? "bg-neutral-950" : "bg-white"}`} />
                    <span>{point}</span>
                  </div>
                ))}
              </div>

              <Link
                href={
                  plan.key === "free"    ? "/account"
                : plan.key === "teams"   ? "/contact"
                                         : `/checkout?plan=${plan.key}&cycle=monthly`
                }
                className={`mt-8 block w-full rounded-2xl px-5 py-3 text-center text-sm font-medium transition ${
                  plan.featured
                    ? "sansxel-dark-button bg-neutral-950 text-white hover:opacity-90"
                    : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                }`}
              >
                {plan.key === "free"    ? "Start free"
               : plan.key === "teams"   ? "Talk to us"
                                        : "See plan"}
              </Link>
            </SpotlightCard>
          ))}
        </div>
      </section>

      {/* ── Final CTA — single section, not 2 ───────────────────── */}
      <section
        id="get-started"
        data-stagger
        style={{ "--stagger-i": 3 } as React.CSSProperties}
        className="mx-auto max-w-7xl px-4 pb-20 pt-2 sm:px-6 sm:pb-24 sm:pt-8 lg:px-8"
      >
        {signedIn ? (
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-10">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
              Welcome back
            </div>
            <h2 className="hx-gradient-text mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">
              Pick up where you left off.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-neutral-200">
              Jump into your workspace or review billing, API keys, and team settings in one place.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/account"
                className="sansxel-white-button rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
              >
                Open workspace
              </Link>
              <Link
                href="/account/billing"
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Manage billing
              </Link>
            </div>
          </div>
        ) : (
          <AuthFlow initialSessionEmail={session?.user?.email ?? null} />
        )}

        {/* Compact "what's next" row — one click to each depth page */}
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["/features",  "Features",       "Ask, Explore, Create, Build"],
            ["/function",  "How it works",   "One prompt → real output"],
            ["/pricing",   "Pricing",        "Free, Pro, Teams"],
            ["/contact",   "Contact",        "Talk to us"],
          ].map(([href, label, desc]) => (
            <Link
              key={href}
              href={href}
              className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:bg-white/5"
            >
              <div className="text-sm font-medium text-white">{label}</div>
              <div className="mt-1 text-xs text-neutral-400">{desc}</div>
            </Link>
          ))}
        </div>

        {/* Fallback sign-in path for anyone who wants to skip the auth flow */}
        {!signedIn && (
          <p className="mt-8 text-center text-xs text-neutral-500">
            Already have an account?{" "}
            <Link
              href={getSignInPath()}
              className="text-neutral-300 underline decoration-neutral-600 underline-offset-4 hover:text-white hover:decoration-white"
            >
              Sign in
            </Link>
          </p>
        )}
      </section>
    </>
  );
}
