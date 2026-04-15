import type { Metadata } from "next";
import { PricingPacks } from "@/components/pricing-packs";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "sansxel pricing — start free, scale to Pro, Teams, or Enterprise as your output needs grow.",
};

export default function PricingPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
        <div className="max-w-3xl">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            Pricing
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            Start free. Scale when your output needs grow.
          </h1>
          <p className="mt-5 text-base leading-7 text-neutral-200">
            Every plan gives you the full visual output system. Higher tiers
            unlock more capacity, stronger AI, and team features.
          </p>
        </div>

        <PricingPacks />

        <div className="mt-20 rounded-[32px] border border-white/10 bg-white/5 p-6 sm:mt-24 sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 sm:gap-6">
            {[
              [
                "What changes at Pro",
                "Higher output capacity, personal API access, and the strongest individual AI tier for daily production work.",
              ],
              [
                "What Teams adds",
                "Shared workspaces, admin controls, seat-based billing, and a clean path for collaborative output at scale.",
              ],
              [
                "Enterprise qualification",
                "Enterprise is manual by design. Verified business details required — built for organizations that need unlimited output capacity and custom rollout.",
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
  );
}
