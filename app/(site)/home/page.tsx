import Link from "next/link";
import { auth } from "@/auth";
import { AuroraBackground } from "@/components/aurora-background";
import { AuthFlow } from "@/components/auth-flow";
import { EarlyAccessForm } from "@/components/early-access-form";
import { HeroActivity } from "@/components/hero-activity";
import { ScrollReveal } from "@/components/scroll-reveal";
import { SpotlightCard } from "@/components/spotlight-card";
import { readAccountContext } from "@/lib/account-session";
import { getSignInPath } from "@/lib/auth-ui";
import { pricingPlans } from "@/lib/pricing";
import { getUserProfileByEmail } from "@/lib/user-profile";

const escalation = [
  {
    size: "Small",
    input: '"Where should I eat tonight?"',
    layers: [
      "Quick answer with a few strong picks",
      "Light visual suggestions only when they help",
    ],
  },
  {
    size: "Medium",
    input: '"Plan my day tomorrow"',
    layers: [
      "Direct answer",
      "Structured timeline with priorities",
      "Tradeoffs, adjustments, and next moves",
    ],
  },
  {
    size: "Big",
    input: '"Build me an AI app"',
    layers: [
      "Product idea and target users",
      "Homepage direction and feature set",
      "Pricing, onboarding, and system thinking",
      "Actions to refine, export, or build next",
    ],
  },
];

const transforms = [
  {
    input: "A question",
    output: "A clear answer with the right structure instead of a long wall of text",
  },
  {
    input: "Meeting notes",
    output: "A roadmap with priorities, owners, and next steps",
  },
  {
    input: "A startup idea",
    output: "A product concept, landing page direction, pricing, and launch plan",
  },
  {
    input: "Research links",
    output: "Grouped insights, patterns, and takeaways you can use",
  },
  {
    input: "A screenshot",
    output: "An explained interface with feedback and improvement ideas",
  },
  {
    input: "Raw data",
    output: "Key metrics, trends, and a usable summary",
  },
];

const whySansxel = [
  {
    title: "Simple when you start",
    description:
      "It feels like normal AI at the beginning: one box, one question, one response. No setup, no workflow, no friction.",
  },
  {
    title: "More depth only when it is earned",
    description:
      "Small requests stay fast. Bigger prompts expand into structure, visuals, system thinking, and next actions when they are useful.",
  },
  {
    title: "One response can become real output",
    description:
      "Instead of stopping at explanation, Sansxel can turn a prompt into a product concept, plan, layout, system, or polished starting point.",
  },
  {
    title: "You build forward, not from zero",
    description:
      "Good work should not disappear into chat history. Keep refining what already works and push it further from the same thread.",
  },
];

const productShape = [
  {
    title: "Universal input",
    description:
      "Questions, links, screenshots, files, notes, raw data, and rough ideas all start in the same place.",
  },
  {
    title: "Layered responses",
    description:
      "Replies can include a direct answer, structure, visual output, system expansion, and actions depending on the size of the request.",
  },
  {
    title: "Build forward",
    description:
      "Refine, save, export, and expand from what is already strong instead of regenerating from scratch.",
  },
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
      <AuroraBackground />

      <section
        id="top"
        className="mx-auto grid max-w-7xl gap-10 px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-12 lg:grid-cols-[1.1fr_.9fr] lg:items-start lg:gap-16 lg:px-8 lg:pb-16 lg:pt-16"
      >
        <HeroActivity isSignedIn={Boolean(initialAccountContext)} />
      </section>

      <section
        id="how"
        className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
      >
        <div className="max-w-2xl">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            Smart escalation
          </div>
          <h2 className="hx-gradient-text mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">
            The response changes shape based on the request.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-neutral-200">
            Sansxel does not overbuild every answer. It stays light when the ask
            is light, and expands into deeper output only when the prompt needs
            it.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {escalation.map((level, i) => (
            <ScrollReveal key={level.size} delay={i * 80}>
              <SpotlightCard className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6 h-full">
                <div className="inline-flex rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-400">
                  {level.size}
                </div>
                <p className="mt-4 text-sm font-medium leading-snug text-white/90">
                  {level.input}
                </p>
                <div className="mt-4 space-y-2">
                  {level.layers.map((layer) => (
                    <div
                      key={layer}
                      className="flex items-start gap-2.5 text-sm text-neutral-300"
                    >
                      <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/70" />
                      <span>{layer}</span>
                    </div>
                  ))}
                </div>
              </SpotlightCard>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="max-w-2xl">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            What goes in, what comes out
          </div>
          <h2 className="hx-gradient-text mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">
            The point is not more text. It is better output.
          </h2>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {transforms.map((transform, i) => (
            <ScrollReveal key={transform.input} delay={i * 60}>
              <SpotlightCard className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6 h-full">
                <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-500">
                  Bring
                </div>
                <p className="mt-2 text-sm font-medium text-white/90">
                  {transform.input}
                </p>
                <div className="mt-4 text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-500">
                  Get back
                </div>
                <p className="mt-2 text-sm leading-6 text-neutral-200">
                  {transform.output}
                </p>
              </SpotlightCard>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="max-w-2xl">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            Why this is different
          </div>
          <h2 className="hx-gradient-text mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">
            Chat on the surface. A response engine underneath.
          </h2>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {whySansxel.map((item, i) => (
            <ScrollReveal key={item.title} delay={i * 70}>
              <SpotlightCard className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6 h-full">
                <div className="text-lg font-medium text-white">{item.title}</div>
                <p className="mt-3 text-sm leading-6 text-neutral-200">
                  {item.description}
                </p>
              </SpotlightCard>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-10">
          <div className="max-w-2xl">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
              Product shape
            </div>
            <h2 className="hx-gradient-text mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">
              One chat box in front. Real output behind it.
            </h2>
            <p className="mt-4 text-base leading-7 text-neutral-200">
              Sansxel stays simple to start, then expands answers into something
              clearer, more visual, and more usable when the request deserves
              it.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {productShape.map((item, i) => (
              <ScrollReveal key={item.title} delay={i * 70}>
                <SpotlightCard className="rounded-3xl border border-white/10 bg-black/20 p-5 sm:p-6 h-full">
                  <div className="text-lg font-medium text-white">
                    {item.title}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-neutral-200">
                    {item.description}
                  </p>
                </SpotlightCard>
              </ScrollReveal>
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
            <h2 className="hx-gradient-text mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">
              Start free. Upgrade when Sansxel becomes part of how you think and build.
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
                {plan.monthlyLabel
                  .replace(" / month", "")
                  .replace(" / seat", "")}
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
              Early access gives you the real Sansxel experience: a simple chat
              interface where responses can expand into structure, visuals,
              systems, and actions when the request deserves it.
            </p>

            <div className="mt-6 grid gap-3">
              {[
                [
                  "/features",
                  "Features",
                  "See how Ask, Explore, Create, and Build work inside the same product.",
                ],
                [
                  "/function",
                  "How it works",
                  "See how Sansxel grows one response from quick answer to real output.",
                ],
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
