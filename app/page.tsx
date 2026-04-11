import Link from "next/link";
import { AuthPanel } from "../components/auth-panel";
import { EarlyAccessForm } from "../components/early-access-form";
import { SiteShell } from "../components/site-shell";

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
      "Use email and password inside sansxel's own UI or choose a provider only when you are ready.",
  },
  {
    number: "02",
    title: "Set up your workspace",
    description:
      "Save how you work, what you want sansxel to remember, and which release track fits you best.",
  },
  {
    number: "03",
    title: "Request access when ready",
    description:
      "Keep invite requests, support, and launch status attached to the same account instead of bouncing between dead ends.",
  },
];

const pricingPreview = [
  {
    cta: "Open workspace",
    href: "/account",
    name: "Starter",
    note: "Free while early access is limited",
    price: "$0",
    points: [
      "Basic desktop timeline",
      "Recent activity history",
      "7-day searchable memory",
    ],
  },
  {
    cta: "Request Pro access",
    featured: true,
    href: "/download#early-access",
    name: "Pro",
    note: "Premium memory and AI features",
    price: "$12",
    points: [
      "AI day summaries",
      "Ask your timeline",
      "90-day memory",
    ],
  },
  {
    cta: "Contact support",
    href: "/contact",
    name: "Teams",
    note: "Private rollout for shared workspaces",
    price: "$29",
    points: [
      "Shared workspaces",
      "Admin controls",
      "Priority onboarding",
    ],
  },
];

export default function HomePage() {
  return (
    <SiteShell>
      <section className="mx-auto grid max-w-7xl gap-16 px-6 pb-20 pt-16 lg:grid-cols-[1.1fr_.9fr] lg:px-8 lg:pb-28 lg:pt-24">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-200">
            <span className="h-2 w-2 rounded-full bg-white/80" />
            Premium workspace memory for focused work
          </div>

          <h1 className="mt-6 text-5xl font-semibold leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-7xl">
            The AI that remembers what you were doing.
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-neutral-200 sm:text-lg">
            sansxel quietly captures work context, keeps it organized, and
            gives you a calm way to resume, reflect, and move forward without
            losing the thread.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/account"
              className="sansxel-white-button rounded-2xl bg-white px-6 py-3 text-sm font-medium text-black transition hover:opacity-90"
            >
              Open workspace
            </Link>
            <Link
              href="/#auth"
              className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Create account
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              ["Fast", "Resume work instantly with a lightweight desktop feel."],
              ["Private", "Clear controls for pause, export, and deletion."],
              ["Useful", "Built around context, not generic busywork."],
            ].map(([title, text]) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div className="text-sm font-medium text-white">{title}</div>
                <div className="mt-1 text-sm leading-6 text-neutral-200">
                  {text}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="rounded-[24px] border border-white/10 bg-neutral-900/90 p-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <div className="text-sm font-medium text-white">Today</div>
                  <div className="text-xs text-neutral-200">
                    Thursday - 4h 18m tracked
                  </div>
                </div>
                <Link
                  href="/account"
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300 transition hover:bg-white/10"
                >
                  Workspace
                </Link>
              </div>

              <div className="mt-5 space-y-3">
                {[
                  [
                    "Roblox Studio",
                    "1h 42m",
                    "Working on gameplay systems and UI polish.",
                  ],
                  ["Browser", "56m", "Research, docs, and references."],
                  ["Discord", "34m", "Team messages and updates."],
                ].map(([app, time, description]) => (
                  <div
                    key={app}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-white">{app}</div>
                      <div className="text-xs text-neutral-200">{time}</div>
                    </div>
                    <div className="mt-2 text-sm leading-6 text-neutral-200">
                      {description}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-sky-200">
                  sansxel summary
                </div>
                <p className="mt-2 text-sm leading-6 text-neutral-200">
                  You spent most of your time building, with your strongest
                  focus block in the first half of the session. Recent activity
                  suggests you left off while refining systems and checking
                  references.
                </p>
              </div>

              <Link
                href="/account"
                className="mt-5 block rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:bg-white/5"
              >
                <div className="text-xs text-neutral-300">Ask sansxel</div>
                <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-neutral-200">
                  What was I doing before Discord?
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="max-w-2xl">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            Features
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Context first. Friction low.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-neutral-200">
            sansxel is designed to stay out of the way until you need memory,
            continuity, and fast re-entry into real work.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6"
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

      <section id="how" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
              How it works
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              A simpler way to recover your work context.
            </h2>
          </div>

          <div className="grid gap-5">
            {steps.map((step) => (
              <div
                key={step.number}
                className="flex gap-4 rounded-3xl border border-white/10 bg-white/5 p-6"
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

      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 sm:p-12">
          <div className="grid gap-10 lg:grid-cols-[1fr_.8fr] lg:items-center">
            <div>
              <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
                Early access
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
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

            <div className="rounded-3xl border border-white/10 bg-neutral-900/70 p-6">
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

      <section id="pricing" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
              Pricing
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Start free. Upgrade when you want deeper memory.
            </h2>
          </div>
          <Link
            href="/pricing"
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Open full pricing
          </Link>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-3">
          {pricingPreview.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-3xl border p-7 ${
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

              <div className="mt-6 text-4xl font-semibold tracking-tight">
                {plan.price}
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
                className={`mt-8 block w-full rounded-2xl px-5 py-3 text-center text-sm font-medium transition ${
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
      </section>

      <section id="auth" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="grid gap-8 xl:grid-cols-[1.08fr_.92fr] xl:items-start">
          <AuthPanel />

          <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 sm:p-10 xl:mt-6">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
              Trust
            </div>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">
              Credibility has to be visible.
            </h3>
            <div className="mt-6 space-y-3 text-sm text-neutral-200">
              {[
                "Email and password auth stays inside sansxel's own UI.",
                "Additional sign-in options only go live when they are ready.",
                "Privacy, terms, pricing, and support all have real routes.",
                "Invite requests stay attached to the same account path.",
                "Secure account handling stays visible throughout the journey.",
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
      </section>

      <section
        id="early-access"
        className="mx-auto max-w-7xl px-6 pb-24 pt-8 lg:px-8"
      >
        <div className="grid gap-8 lg:grid-cols-[1fr_.95fr]">
          <EarlyAccessForm />

          <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 sm:p-10">
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
