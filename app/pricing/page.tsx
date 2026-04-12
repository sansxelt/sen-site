import Link from "next/link";
import type { Metadata } from "next";
import { SiteShell } from "../../components/site-shell";
import { getPlanActionHref, pricingPlans } from "../../lib/pricing";

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

        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 sm:mt-12">
          {pricingPlans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-3xl border p-6 sm:p-7 ${
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

              <div className="mt-6">
                <div className="text-3xl font-semibold tracking-tight">
                  {plan.monthlyLabel}
                </div>
                <div
                  className={`mt-2 text-sm ${
                    plan.featured ? "text-neutral-700" : "text-neutral-300"
                  }`}
                >
                  {plan.yearlyLabel ?? plan.description}
                </div>
              </div>

              <p
                className={`mt-4 text-sm leading-6 ${
                  plan.featured ? "text-neutral-700" : "text-neutral-300"
                }`}
              >
                {plan.description}
              </p>

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
                href={getPlanActionHref(plan)}
                className={`mt-8 block rounded-2xl px-5 py-3 text-center text-sm font-medium transition ${
                  plan.featured
                    ? "sansxel-dark-button bg-neutral-950 text-white hover:opacity-90"
                    : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                }`}
              >
                {plan.ctaLabel}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-[32px] border border-white/10 bg-white/5 p-6 sm:mt-12 sm:p-8">
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
