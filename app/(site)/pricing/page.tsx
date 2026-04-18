import type { Metadata } from "next";
import { AuroraBackground } from "@/components/aurora-background";
import { ComparePlans } from "@/components/compare-plans";
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
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
      <div className="max-w-3xl">
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

      <PricingPacks />

      <div className="mt-20 rounded-[32px] border border-white/10 bg-white/5 p-6 sm:mt-24 sm:p-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-6">
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
            <div
              key={title}
              className="rounded-3xl border border-white/10 bg-black/20 p-5 sm:p-6"
            >
              <div className="text-lg font-medium text-white">{title}</div>
              <p className="mt-3 text-sm leading-6 text-neutral-300">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
      </section>
    </>
  );
}
