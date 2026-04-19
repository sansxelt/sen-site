import type { Metadata } from "next";
import Link from "next/link";
import { AuroraBackground } from "@/components/aurora-background";
import { ComparePlans } from "@/components/compare-plans";
import { DotGrid } from "@/components/dot-grid";
import { HeistCard } from "@/components/heist-card";
import { PricingPacks } from "@/components/pricing-packs";
import { pricingPlanMap } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Sansxel pricing for Free, Core, Plus, Pro, Teams, and Enterprise plans.",
};

// Three-tier headline row — Free / Plus / Pro.  Pro is the highlighted
// pick (tilt + stronger border).  All copy comes from the canonical
// pricing source so we never drift from billing.
const headlineTiers = [
  { plan: pricingPlanMap.free,   highlighted: false },
  { plan: pricingPlanMap.studio, highlighted: false }, // "Plus"
  { plan: pricingPlanMap.pro,    highlighted: true  },
] as const;

function tierHref(key: string) {
  if (key === "free") return "/account";
  return `/checkout?plan=${key}&cycle=monthly`;
}

export default function PricingPage() {
  return (
    <>
      <AuroraBackground />
      <section className="mx-auto max-w-[1600px] px-4 pt-6 pb-12 sm:px-6 sm:pt-8 sm:pb-16 lg:px-8 lg:pt-10 lg:pb-24">
        {/* ── Hero — DotGrid behind the headline ───────────────────── */}
        <div className="relative isolate overflow-hidden rounded-[28px] px-6 py-10 sm:px-10 sm:py-14">
          <DotGrid opacity={0.07} />
          <div className="relative max-w-3xl">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
              Pricing
            </div>
            <h1 className="hx-gradient-text mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
              Plans that grow with how much you turn into output.
            </h1>
            <p className="mt-5 text-base leading-7 text-neutral-200">
              Start free for everyday use, then scale into heavier create and build
              workflows. Every paid tier expands how far Sansxel can go with you.
            </p>

            {/* Guided comparison — sits under the hero copy, tuned to match
                the surrounding text tone (muted grey, soft underline). */}
            <div className="mt-5 text-sm text-neutral-500">
              Not sure which one? <ComparePlans />
            </div>
          </div>
        </div>

        {/* ── Three-tier headline row — Free / Plus / Pro ──────────── */}
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {headlineTiers.map(({ plan, highlighted }) => (
            <HeistCard
              key={plan.key}
              tilt={highlighted}
              highlighted={highlighted}
              className="flex h-full flex-col p-7"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-white">
                    {plan.name}
                  </div>
                  <div className="mt-1 text-xs text-neutral-400">
                    {plan.note}
                  </div>
                </div>
                {highlighted && (
                  <span className="shrink-0 rounded-full border border-violet-300/30 bg-violet-300/[0.10] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-200">
                    Recommended
                  </span>
                )}
              </div>

              <div className="mt-6 text-3xl font-semibold tracking-tight text-white">
                {plan.monthlyLabel.replace(" / month", "")}
              </div>
              {plan.yearlyLabel && (
                <div className="mt-1 text-xs text-neutral-500">
                  or {plan.yearlyLabel}
                </div>
              )}

              <p className="mt-5 text-sm leading-6 text-neutral-300">
                {plan.description}
              </p>

              <ul className="mt-5 space-y-2.5">
                {plan.points.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-2.5 text-sm text-neutral-200"
                  >
                    <span
                      className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${
                        highlighted ? "bg-violet-300" : "bg-white/40"
                      }`}
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={tierHref(plan.key)}
                className={`mt-auto block rounded-2xl px-5 py-3 text-center text-sm font-medium transition ${
                  highlighted
                    ? "bg-violet-300 text-neutral-950 hover:bg-violet-200"
                    : "border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                }`}
                style={{ marginTop: "1.75rem" }}
              >
                {plan.key === "free" ? "Start free" : `Choose ${plan.name}`}
              </Link>
            </HeistCard>
          ))}
        </div>

        {/* ── Full pack of all six plans ────────────────────────────── */}
        <PricingPacks />

        <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-6 sm:mt-24">
          {[
            [
              "Personal plans",
              "Built for everyday use, deeper create work, and full personal build power without making the product feel niche.",
            ],
            [
              "Team plans",
              "For shared libraries, collaboration, admin controls, and a cleaner path from individual use to team adoption.",
            ],
            [
              "Enterprise rollout",
              "Manual by design for organizations that need more capacity, governance, onboarding help, and custom deployment shape.",
            ],
          ].map(([title, description]) => (
            <HeistCard key={title} className="p-6 sm:p-7">
              <div className="text-lg font-medium text-white">{title}</div>
              <p className="mt-3 text-sm leading-6 text-neutral-300">
                {description}
              </p>
            </HeistCard>
          ))}
        </div>
      </section>
    </>
  );
}
