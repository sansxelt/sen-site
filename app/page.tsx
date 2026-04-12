import Link from "next/link";
import { auth } from "../auth";
import { AuthFlow } from "../components/auth-flow";
import { EarlyAccessForm } from "../components/early-access-form";
import { HeroActivity } from "../components/hero-activity";
import { SiteShell } from "../components/site-shell";
import { readAccountContext } from "../lib/account-session";
import { pricingPlans } from "../lib/pricing";
import { getUserProfileByEmail } from "../lib/user-profile";

const features = [
  {
    title: "Automatic context",
    description:
      "sansxel quietly understands what you were doing across desktop sessions so resuming work feels instant instead of reconstructive.",
  },
  {
    title: "Ask your timeline",
    description:
      "Search, summarize, and recover momentum from your own activity history without digging through tabs and chat threads.",
  },
  {
    title: "Built for privacy",
    description:
      "Clear controls, visible tracking, and product language that treats sensitive context like a responsibility.",
  },
];

const steps = [
  {
    number: "01",
    title: "Create your account",
    description:
      "Start on sansxel and continue with email, Google, or GitHub through the branded app-hosted flow.",
  },
  {
    number: "02",
    title: "Set up your workspace",
    description:
      "Save how you work, what you want sansxel to remember, and which release track fits you best.",
  },
  {
    number: "03",
    title: "Pick your tier when ready",
    description:
      "Move from the limited free tier into stronger personal or team plans without rebuilding your account path.",
  },
];

export default async function HomePage() {
  const session = await auth();
  const profile = await getUserProfileByEmail(session?.user?.email);
  const initialAccountContext = readAccountContext(session, profile);
  const pricingPreview = pricingPlans.filter(
    (plan) => plan.key === "free" || plan.key === "pro" || plan.key === "teams",
  );

  return (
    <SiteShell>
      <section
        id="top"
        className="mx-auto grid max-w-7xl gap-10 px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-12 lg:grid-cols-[1.1fr_.9fr] lg:gap-16 lg:px-8 lg:pb-28 lg:pt-20"
      >
        <HeroActivity isSignedIn={Boolean(initialAccountContext)} />
      </section>

      <section id="features" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="max-w-2xl">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            Features
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-4xl">
            Context first. Friction low.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-neutral-200">
            sansxel is designed to stay out of the way until you need memory,
            continuity, and fast re-entry into real work.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"
            >
              <div className="text-lg font-medium text-white">
                {feature.title}
              </div>
              <p className="mt-3 text-sm leading-6 text-neutral-200">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
              How it works
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-4xl">
              A simpler way to recover your work context.
            </h2>
          </div>

          <div className="grid gap-5">
            {steps.map((step) => (
              <div
                key={step.number}
                className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 sm:flex-row sm:p-6"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-sm font-semibold text-white">
                  {step.number}
                </div>
                <div>
                  <div className="text-lg font-medium text-white">
                    {step.title}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-neutral-200">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-12">
          <div className="grid gap-10 lg:grid-cols-[1fr_.8fr] lg:items-center">
            <div>
              <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
                Early access
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-4xl">
                Early access should feel trustworthy before it feels flashy.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-200">
                Keep the path explicit: account creation, workspace setup,
                clear release status, privacy details, and a visible support
                route all in one place.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/download#early-access"
                  className="sansxel-white-button rounded-2xl bg-white px-6 py-3 text-sm font-medium text-black transition hover:opacity-90"
                >
                  Request invite
                </Link>
                <Link
                  href="/account"
                  className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Open workspace
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-neutral-900/70 p-5 sm:p-6">
              <div className="text-sm font-medium text-white">
                Launch checklist
              </div>
              <div className="mt-4 space-y-3 text-sm text-neutral-200">
                {[
                  "Signed Windows installer",
                  "Versioned release notes",
                  "Privacy policy and terms",
                  "Account and billing flow",
                  "Pause, delete, and export controls",
                  "Support contact and bug reporting",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                  >
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-white" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
              Pricing
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-4xl">
              Start free. Upgrade when you want stronger AI and more headroom.
            </h2>
          </div>
          <Link
            href="/pricing"
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Open full pricing
          </Link>
        </div>

        <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pricingPreview.map((plan) => (
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

              <div className="mt-6 text-4xl font-semibold tracking-tight">
                {plan.monthlyLabel.replace(" / month", "")}
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
                href={
                  plan.key === "free"
                    ? "/account"
                    : plan.key === "teams"
                      ? "/contact"
                      : "/pricing"
                }
                className={`mt-8 block w-full rounded-2xl px-5 py-3 text-center text-sm font-medium transition ${
                  plan.featured
                    ? "sansxel-dark-button bg-neutral-950 text-white hover:opacity-90"
                    : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                }`}
              >
                {plan.key === "free"
                  ? "Open workspace"
                  : plan.key === "teams"
                    ? "Contact support"
                    : "Review Pro"}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section id="auth" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <AuthFlow initialSessionEmail={session?.user?.email ?? null} />
      </section>

      <section
        id="early-access"
        className="mx-auto max-w-7xl px-4 pb-20 pt-2 sm:px-6 sm:pb-24 sm:pt-8 lg:px-8"
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_.95fr]">
          <EarlyAccessForm initialAccountContext={initialAccountContext} />

          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-10">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
              Support
            </div>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">
              Real routes. Real next steps.
            </h3>
            <p className="mt-4 text-sm leading-6 text-neutral-200">
              Nothing on the site should dead-end. Pricing, account, access,
              policy, and support routes all exist so people can decide with
              context.
            </p>

            <div className="mt-6 grid gap-3">
              {[
                [
                  "/download",
                  "Launch Status",
                  "See rollout status and request invite access.",
                ],
                ["/pricing", "Pricing", "Review free, Pro, and Teams plans."],
                [
                  "/privacy",
                  "Privacy Policy",
                  "Explain what sansxel collects and why.",
                ],
                ["/contact", "Contact / Support", "Reach support directly."],
              ].map(([href, label, description]) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:bg-white/5"
                >
                  <div className="text-sm font-medium text-white">{label}</div>
                  <div className="mt-1 text-sm text-neutral-200">
                    {description}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
