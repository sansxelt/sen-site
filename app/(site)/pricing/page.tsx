import type { Metadata } from "next";
import { AuroraBackground } from "@/components/aurora-background";
import { ComparePlans } from "@/components/compare-plans";
import { DotGrid } from "@/components/dot-grid";
import { HeistCard } from "@/components/heist-card";
import { PricingPacks } from "@/components/pricing-packs";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Sansxel pricing for Free, Core, Plus, Pro, Teams, and Enterprise plans.",
};

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

        {/* ── Full plan cards — single source of truth (Personal + Team) */}
        <div className="mt-12">
          <PricingPacks />
        </div>

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
