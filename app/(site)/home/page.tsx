import Link from "next/link";
import { auth } from "@/auth";
import { AuthFlow } from "@/components/auth-flow";
import { EarlyAccessForm } from "@/components/early-access-form";
import { readAccountContext } from "@/lib/account-session";
import { getSignInPath } from "@/lib/auth-ui";
import { pricingPlans } from "@/lib/pricing";
import { getUserProfileByEmail } from "@/lib/user-profile";

/* ── Response escalation examples ────────────────────────────── */

const escalation = [
  {
    size: "Small",
    input: '"Where should I eat tonight?"',
    layers: ["Quick answer with top picks", "Visual suggestions with reasons"],
  },
  {
    size: "Medium",
    input: '"Plan my day tomorrow"',
    layers: [
      "Direct answer",
      "Structured time-blocked plan",
      "Priorities and tradeoffs",
    ],
  },
  {
    size: "Big",
    input: '"Build me an AI app"',
    layers: [
      "Product concept and target users",
      "Homepage layout and feature sections",
      "Pricing tiers and onboarding flow",
      "Architecture and next steps",
    ],
  },
];

const transforms = [
  {
    input: "A question",
    output: "A clear answer with structured context — not a paragraph",
  },
  {
    input: "Meeting notes",
    output: "Roadmap with owners, priorities, and next steps",
  },
  {
    input: "A startup idea",
    output: "Landing page, pricing, product structure, launch plan",
  },
  {
    input: "Research links",
    output: "Grouped insights with categories and key takeaways",
  },
  {
    input: "A screenshot",
    output: "Explained UI concept with suggestions",
  },
  {
    input: "Raw CSV data",
    output: "Key metrics, trends, and a summary you can act on",
  },
];

const whySansxel = [
  {
    title: "Looks like chat. Works like a production tool.",
    description:
      "The interface is a text box. The output is whatever your intent actually needs — from a quick answer to a full system.",
  },
  {
    title: "Responses that escalate with intent",
    description:
      "Small questions get fast answers. Bigger requests get structured breakdowns, visuals, systems, and actions. The AI decides the depth.",
  },
  {
    title: "One prompt can spawn a mini-product",
    description:
      "Say \"build me an AI app\" and get a product concept, homepage layout, pricing tiers, architecture, and next steps — not just a paragraph.",
  },
  {
    title: "Refine in place, not from scratch",
    description:
      "Outputs are designed to be edited and expanded — not regenerated. Build on what's already good instead of restarting.",
  },
];

const structure = [
  {
    title: "Universal input",
    description:
      "Text, links, screenshots, files, raw data, rough notes, and half-formed ideas. All in one text box.",
  },
  {
    title: "Layered response",
    description:
      "Every response can include a direct answer, structured breakdown, visual output, system expansion, and actions — depending on what you asked.",
  },
  {
    title: "Saved library",
    description:
      "Good outputs don't disappear into a chat log. Save, revisit, refine, export, and build forward from what already works.",
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
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-20 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_.95fr] lg:items-start lg:gap-14">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Now in early access
            </div>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
              Bring anything.
              <br />
              <span className="bg-gradient-to-r from-white to-white/55 bg-clip-text text-transparent">
                Get something real.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-200 sm:text-xl">
              Sansxel looks like a normal AI chat. But every response can
              escalate into something structured, visual, and usable — from a
              quick answer to a full product system.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={signedIn ? "/account" : getSignInPath("/account")}
                className="sansxel-white-button rounded-2xl bg-white px-7 py-3.5 text-center text-sm font-medium text-black transition hover:opacity-90"
              >
                {signedIn ? "Open Sansxel" : "Try Sansxel"}
              </Link>
              <Link
                href="#how"
                className="rounded-2xl border border-white/10 bg-white/5 px-7 py-3.5 text-center text-sm font-medium text-white transition hover:bg-white/10"
              >
                See how it works
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-2 text-xs text-neutral-400">
              {["questions", "notes", "links", "screenshots", "files", "ideas"].map(
                (item) => (
                  <div
                    key={item}
                    className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5"
                  >
                    {item}
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Hero demo — shows a layered response, not a dashboard */}
          <div className="rounded-[32px] border border-white/[0.08] bg-white/[0.04] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.35)] sm:p-6">
            <div className="rounded-2xl border border-white/10 bg-neutral-950/70 p-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                You
              </div>
              <p className="mt-2 text-sm leading-6 text-white/90 sm:text-[15px]">
                Build me an AI app for personal finance
              </p>
            </div>

            <div className="mt-3 space-y-2.5">
              {/* Layer 1: Quick answer */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-emerald-400/70">
                  Answer
                </div>
                <p className="mt-2 text-sm leading-6 text-neutral-200">
                  Here&apos;s a strong concept — an AI-powered spending
                  coach that learns your habits and flags what matters.
                </p>
              </div>

              {/* Layer 2: Structured breakdown */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-sky-400/70">
                  Structure
                </div>
                <div className="mt-2 space-y-1.5 text-sm text-neutral-300">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-white/30" />
                    Product concept and target users
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-white/30" />
                    Core features and differentiators
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-white/30" />
                    Pricing tiers and monetization
                  </div>
                </div>
              </div>

              {/* Layer 3: Visual + system */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-violet-400/70">
                  Visual + System
                </div>
                <div className="mt-2 space-y-1.5 text-sm text-neutral-300">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-white/30" />
                    Homepage layout preview
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-white/30" />
                    Onboarding flow and architecture
                  </div>
                </div>
              </div>

              {/* Layer 4: Actions */}
              <div className="flex gap-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-neutral-300">
                  Export
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-neutral-300">
                  Refine UI
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-neutral-300">
                  Build frontend
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Smart escalation ─────────────────────────────────────── */}
      <section
        id="how"
        className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
      >
        <div className="max-w-2xl">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            Smart escalation
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-4xl">
            The AI decides the depth. You just ask.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-neutral-200">
            Small question? Quick answer. Bigger request? Structured breakdown
            with visuals, systems, and actions. Sansxel scales the response to
            match the intent.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {escalation.map((level) => (
            <div
              key={level.size}
              className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"
            >
              <div className="inline-flex rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-400">
                {level.size}
              </div>
              <p className="mt-4 text-sm font-medium leading-snug text-white/90">
                {level.input}
              </p>
              <div className="mt-4 space-y-2">
                {level.layers.map((layer, i) => (
                  <div
                    key={layer}
                    className="flex items-start gap-2.5 text-sm text-neutral-300"
                  >
                    <span className="mt-0.5 shrink-0 text-emerald-400/70">
                      {i === level.layers.length - 1 ? "└" : "├"}
                    </span>
                    {layer}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Transforms ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="max-w-2xl">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            What goes in, what comes out
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-4xl">
            One prompt can turn into a lot more than a paragraph.
          </h2>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {transforms.map((t) => (
            <div
              key={t.input}
              className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"
            >
              <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-500">
                Bring
              </div>
              <p className="mt-2 text-sm font-medium text-white/90">
                {t.input}
              </p>
              <div className="mt-4 text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-500">
                Get back
              </div>
              <p className="mt-2 text-sm leading-6 text-neutral-200">
                {t.output}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why Sansxel ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="max-w-2xl">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            Why this is different
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-4xl">
            ChatGPT on the surface. Way more powerful underneath.
          </h2>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {whySansxel.map((item) => (
            <div
              key={item.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"
            >
              <div className="text-lg font-medium text-white">{item.title}</div>
              <p className="mt-3 text-sm leading-6 text-neutral-200">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Product shape ────────────────────────────────────────── */}
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
              Sansxel is a simple loop: bring input, get a layered result, keep
              what matters, and build forward from there.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {structure.map((item) => (
              <div
                key={item.title}
                className="rounded-3xl border border-white/10 bg-black/20 p-5 sm:p-6"
              >
                <div className="text-lg font-medium text-white">
                  {item.title}
                </div>
                <p className="mt-3 text-sm leading-6 text-neutral-200">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing preview ──────────────────────────────────────── */}
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

      {/* ── Auth ─────────────────────────────────────────────────── */}
      <section
        id="auth"
        className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
      >
        <AuthFlow initialSessionEmail={session?.user?.email ?? null} />
      </section>

      {/* ── Early access + links ─────────────────────────────────── */}
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
              Early access gives you the full Sansxel experience — a normal
              chat interface where every response can escalate into structured,
              visual, actionable output.
            </p>

            <div className="mt-6 grid gap-3">
              {[
                ["/features", "Features", "See what Sansxel can do across Ask, Explore, Create, and Build."],
                ["/function", "How it works", "Understand the input → layered response → library loop."],
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
