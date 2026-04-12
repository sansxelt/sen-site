import type { Metadata } from "next";
import { SiteShell } from "../../components/site-shell";
import { PricingPacks } from "../../components/pricing-packs";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Review sansxel pricing for Free, Apprentice, Studio, Pro, Teams, and Enterprise.",
};

export default function PricingPage() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
        <div className="max-w-3xl">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            Pricing
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            Pricing that scales from limited access to full AI operations.
          </h1>
          <p className="mt-5 text-base leading-7 text-neutral-200">
            Start on a limited free tier, move into stronger personal AI plans,
            and expand into team or enterprise rollout once the workflow is
            proven.
          </p>
        </div>

        <PricingPacks />

        <div className="mt-20 rounded-[32px] border border-white/10 bg-white/5 p-6 sm:mt-24 sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 sm:gap-6">
            {[
              [
                "What changes at Pro",
                "Higher AI ceilings, personal API access, and a much more complete day-to-day AI workspace.",
              ],
              [
                "What Teams adds",
                "Shared workspaces, admin controls, seat-based billing, and a cleaner path for collaborative rollout.",
              ],
              [
                "Enterprise qualification",
                "Enterprise is manual by design. It requires verified business details and is positioned for organizations that need the highest limits and rollout support.",
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
    </SiteShell>
  );
}
