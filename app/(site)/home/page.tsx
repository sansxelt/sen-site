import Link from "next/link";
import { auth } from "@/auth";
import { AuthFlow } from "@/components/auth-flow";
import { EarlyAccessForm } from "@/components/early-access-form";
import { readAccountContext } from "@/lib/account-session";
import { getSignInPath } from "@/lib/auth-ui";
import { pricingPlans } from "@/lib/pricing";
import { getUserProfileByEmail } from "@/lib/user-profile";

const heroOutputs = [
  {
    label: "Ask",
    title: "Answer card",
    description: "Fast explanations, comparisons, and clear takeaways.",
    tone: "from-sky-500/18 to-sky-500/6",
  },
  {
    label: "Explore",
    title: "Discovery brief",
    description: "News, recommendations, ranked options, and context.",
    tone: "from-emerald-500/18 to-emerald-500/6",
  },
  {
    label: "Create",
    title: "Structured output",
    description: "Plans, summaries, concepts, systems, and polished drafts.",
    tone: "from-amber-500/18 to-amber-500/6",
  },
  {
    label: "Build",
    title: "Full package",
    description: "Landing pages, pricing, brand direction, and product structure.",
    tone: "from-fuchsia-500/18 to-fuchsia-500/6",
  },
];

const modes = [
  {
    name: "Ask",
    description:
      "Use Sansxel like a fast everyday assistant for questions, explanations, comparisons, and quick help.",
  },
  {
    name: "Explore",
    description:
      "Discover recommendations, news, options, and context in a cleaner, more visual way than a normal chat response.",
  },
  {
    name: "Create",
    description:
      "Turn rough notes, screenshots, briefs, and ideas into structured outputs you can actually use.",
  },
  {
    name: "Build",
    description:
      "Generate startup-like packages instantly: landing pages, pricing, product structure, launch direction, and brand systems.",
  },
];

const transforms = [
  {
    input: "Where should I eat tonight?",
    output: "Ranked recommendation card with reasons and tradeoffs",
  },
  {
    input: "Turn these lecture notes into a study map",
    output: "Structured summary with a visual review outline",
  },
  {
    input: "Compare these vendors on cost, speed, and risk",
    output: "Clean comparison table with a recommended path",
  },
  {
    input: "Here is a raw startup idea",
    output: "Landing page concept, pricing, and product structure",
  },
  {
    input: "Organize these 40 research links",
    output: "Grouped insight board with categories and key takeaways",
  },
  {
    input: "Map our signup flow",
    output: "Step-by-step system view with friction points and fixes",
  },
];

const structure = [
  {
    title: "Universal input",
    description:
      "Text, links, screenshots, files, raw data, rough notes, and half-formed ideas all belong in the same input box.",
  },
  {
    title: "Result canvas",
    description:
      "Sansxel returns answers, plans, layouts, comparisons, and builds as something visual, structured, and immediately useful.",
  },
  {
    title: "Saved library",
    description:
      "Good outputs do not disappear into a chat log. Save, revisit, refine, export, and build forward from what already works.",
  },
];

const dailyUseReasons = [
  "It handles small everyday asks and larger serious work in one place.",
  "It returns progress, not just paragraphs.",
  "You can refine outputs instead of restarting prompts.",
  "The result library becomes a reusable system for your own work.",
];

export default async function HomePage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);
  const profile = await getUserProfileByEmail(session?.user?.email);
  const initialAccountContext = readAccountContext(session, profile);
  const pricingPreview = pricingPlans.filter(
    (plan) => plan.key === "free" || plan.key === "pro" || plan.key === "teams",
  );

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-20 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_.95fr] lg:items-start lg:gap-14">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Universal AI, now in early access
            </div>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
              Bring anything.
              <br />
              <span className="bg-gradient-to-r from-white to-white/55 bg-clip-text text-transparent">
                Get something real.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-200 sm:text-xl">
              Sansxel is a universal input-to-output AI. Ask questions, explore
              ideas, turn rough input into structured results, and build polished
              systems from a single starting point.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={signedIn ? "/account" : getSignInPath("/account")}
                className="sansxel-white-button rounded-2xl bg-white px-7 py-3.5 text-center text-sm font-medium text-black transition hover:opacity-90"
              >
                {signedIn ? "Open Sansxel" : "Try Sansxel"}
              </Link>
              <Link
                href="#modes"
                className="rounded-2xl border border-white/10 bg-white/5 px-7 py-3.5 text-center text-sm font-medium text-white transition hover:bg-white/10"
              >
                See what it does
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-2 text-xs text-neutral-400">
              {["questions", "notes", "links", "screenshots", "files", "ideas"].map((item) => (
                <div
                  key={item}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-white/[0.08] bg-white/[0.04] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.35)] sm:p-6">
            <div className="rounded-2xl border border-white/10 bg-neutral-950/70 p-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                Input
              </div>
              <p className="mt-3 text-sm leading-6 text-white/90 sm:text-[15px]">
                Turn this product idea into a landing page, pricing model,
                product structure, and launch plan.
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {heroOutputs.map((output) => (
                <div
                  key={output.label}
                  className={`rounded-2xl border border-white/[0.08] bg-gradient-to-br ${output.tone} p-4`}
                >
                  <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/60">
                    {output.label}
                  </div>
                  <div className="mt-3 text-sm font-semibold text-white sm:text-[15px]">
                    {output.title}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-neutral-200">
                    {output.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="modes"
        className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
      >
        <div className="max-w-2xl">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            Core modes
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-4xl">
            One simple entry. Four ways to move.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-neutral-200">
            Sansxel should feel broad enough for everyday use and sharp enough
            for serious work. Ask, Explore, Create, and Build keep the surface
            simple without making the product small.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {modes.map((mode) => (
            <div
              key={mode.name}
              className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"
            >
              <div className="text-lg font-medium text-white">{mode.name}</div>
              <p className="mt-3 text-sm leading-6 text-neutral-200">
                {mode.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="max-w-2xl">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            Universal by design
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-4xl">
            Useful for daily life, study, creation, product work, and analysis.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-neutral-200">
            The audience is not the point. The transformation is. Bring raw
            intent in any form and Sansxel turns it into something clearer,
            better, and more usable.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {transforms.map((item) => (
            <div
              key={item.input}
              className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"
            >
              <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-500">
                Bring
              </div>
              <p className="mt-3 text-sm font-medium leading-6 text-white/90">
                {item.input}
              </p>
              <div className="mt-5 text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-500">
                Get back
              </div>
              <p className="mt-3 text-sm leading-6 text-neutral-200">
                {item.output}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-10">
          <div className="max-w-2xl">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
              Product shape
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-4xl">
              Chat is the entry. Output is the product.
            </h2>
            <p className="mt-4 text-base leading-7 text-neutral-200">
              Sansxel is designed around a simple loop: bring input, get a real
              result, keep what matters, and build forward from there.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {structure.map((item) => (
              <div
                key={item.title}
                className="rounded-3xl border border-white/10 bg-black/20 p-5 sm:p-6"
              >
                <div className="text-lg font-medium text-white">{item.title}</div>
                <p className="mt-3 text-sm leading-6 text-neutral-200">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
              Daily pull
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-4xl">
              The habit is not chatting more. It is making progress faster.
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {dailyUseReasons.map((reason) => (
              <div
                key={reason}
                className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"
              >
                <p className="text-sm leading-6 text-neutral-200">{reason}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="pricing"
        className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
      >
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
              Pricing
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-4xl">
              Start free. Upgrade when Sansxel becomes part of how you work.
            </h2>
          </div>
          <Link
            href="/pricing"
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
          >
            View all plans
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
                {plan.monthlyLabel.replace(" / month", "").replace(" / seat", "")}
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
                  ? "Start free"
                  : plan.key === "teams"
                    ? "Talk to us"
                    : "See plan"}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section
        id="auth"
        className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
      >
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
              Next steps
            </div>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">
              Start with chat. Leave with something usable.
            </h3>
            <p className="mt-4 text-sm leading-6 text-neutral-200">
              Early access gives you the full Sansxel loop: universal input,
              visual outputs, saved results, and a clean path into more serious
              product and build workflows.
            </p>

            <div className="mt-6 grid gap-3">
              {[
                ["/features", "Features", "See the modes, outputs, and product principles."],
                ["/function", "How it works", "Understand the Input, Result Canvas, and Library flow."],
                ["/pricing", "Pricing", "Compare free, Pro, and team plans."],
                ["/contact", "Contact", "Talk to support or ask about teams."],
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
    </>
  );
}
