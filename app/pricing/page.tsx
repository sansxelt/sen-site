import Link from "next/link";
import type { Metadata } from "next";
import { SiteShell } from "../../components/site-shell";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Review sansxel pricing for Starter, Pro, and Teams before requesting access.",
};

const plans = [
  {
    cta: "Create account",
    href: "/#auth",
    name: "Starter",
    note: "Free during early access",
    monthly: "$0",
    yearly: "$0",
    points: [
      "Basic desktop timeline",
      "Recent activity view",
      "7-day history",
      "Simple settings",
    ],
  },
  {
    cta: "Request Pro access",
    featured: true,
    href: "/download#early-access",
    name: "Pro",
    note: "Per seat",
    monthly: "$12 / month",
    yearly: "$96 / year",
    points: [
      "AI day summaries",
      "Ask your timeline",
      "90-day memory",
      "Weekly insights",
      "Priority features",
    ],
  },
  {
    cta: "Contact sales",
    href: "/contact",
    name: "Teams",
    note: "Per seat",
    monthly: "$29 / month",
    yearly: "$290 / year",
    points: [
      "Everything in Pro",
      "Shared workspaces",
      "Admin controls",
      "Team insights",
      "Priority onboarding",
    ],
  },
];

export default function PricingPage() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
        <div className="max-w-3xl">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            Pricing
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            Simple pricing for individual focus and team continuity.
          </h1>
          <p className="mt-5 text-base leading-7 text-neutral-200">
            Start with the free early-access experience, then move into richer
            memory, summaries, and shared workflows when the product fits.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 sm:mt-12">
          {plans.map((plan) => (
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
                {plan.featured && (
                  <div className="rounded-full bg-neutral-950 px-3 py-1 text-xs font-medium text-white">
                    Popular
                  </div>
                )}
              </div>

              <div className="mt-6">
                <div className="text-3xl font-semibold tracking-tight">
                  {plan.monthly}
                </div>
                <div
                  className={`mt-2 text-sm ${
                    plan.featured ? "text-neutral-700" : "text-neutral-300"
                  }`}
                >
                  {plan.yearly}
                </div>
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
                href={plan.href}
                className={`mt-8 block rounded-2xl px-5 py-3 text-center text-sm font-medium transition ${
                  plan.featured
                    ? "sansxel-dark-button bg-neutral-950 text-white hover:opacity-90"
                    : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-[32px] border border-white/10 bg-white/5 p-6 sm:mt-12 sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 sm:gap-6">
            {[
              [
                "What changes at Pro",
                "Longer memory, AI summaries, and better context recovery across sessions.",
              ],
              [
                "What Teams adds",
                "Shared workspaces, admin controls, and guided rollout for multiple people.",
              ],
              [
                "What happens now",
                "Use early access to validate onboarding, support flow, and access readiness before wider launch.",
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
