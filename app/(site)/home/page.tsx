import Link from "next/link";
import { auth } from "@/auth";
import { AuthFlow } from "@/components/auth-flow";
import { EarlyAccessForm } from "@/components/early-access-form";
import { readAccountContext } from "@/lib/account-session";
import { getSignInPath } from "@/lib/auth-ui";
import { pricingPlans } from "@/lib/pricing";
import { getUserProfileByEmail } from "@/lib/user-profile";

const outputBlocks = [
  {
    label: "Card",
    preview: (
      <div className="space-y-2.5">
        <div className="h-20 rounded-xl bg-gradient-to-br from-white/10 to-white/[0.03]" />
        <div className="h-2.5 w-3/4 rounded bg-white/10" />
        <div className="h-2 w-1/2 rounded bg-white/[0.06]" />
      </div>
    ),
  },
  {
    label: "Grid",
    preview: (
      <div className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-lg bg-gradient-to-br from-white/10 to-white/[0.03]"
          />
        ))}
      </div>
    ),
  },
  {
    label: "Table",
    preview: (
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <div className="h-2.5 w-1/4 rounded bg-white/15" />
          <div className="h-2.5 w-1/4 rounded bg-white/15" />
          <div className="h-2.5 w-1/4 rounded bg-white/15" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-2">
            <div className="h-2 w-1/4 rounded bg-white/[0.06]" />
            <div className="h-2 w-1/4 rounded bg-white/[0.06]" />
            <div className="h-2 w-1/4 rounded bg-white/[0.06]" />
          </div>
        ))}
      </div>
    ),
  },
  {
    label: "Flow",
    preview: (
      <div className="flex items-center justify-between gap-2">
        {["from-blue-500/20 to-blue-500/5", "from-violet-500/20 to-violet-500/5", "from-emerald-500/20 to-emerald-500/5"].map(
          (gradient, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${gradient}`} />
              {i < 2 && <div className="h-px w-4 bg-white/10" />}
            </div>
          ),
        )}
      </div>
    ),
  },
  {
    label: "Metrics",
    preview: (
      <div className="grid grid-cols-2 gap-2">
        {["92%", "1.4k", "↑ 23", "3.2s"].map((val) => (
          <div
            key={val}
            className="rounded-lg bg-white/[0.04] p-2 text-center text-xs font-medium text-white/60"
          >
            {val}
          </div>
        ))}
      </div>
    ),
  },
  {
    label: "Canvas",
    preview: (
      <div className="relative h-20">
        <div className="absolute left-1 top-1 h-8 w-12 rounded-lg border border-white/10 bg-white/[0.04]" />
        <div className="absolute bottom-2 right-2 h-6 w-10 rounded-lg border border-white/10 bg-white/[0.04]" />
        <div className="absolute left-8 top-8 h-5 w-14 rounded-lg border border-white/10 bg-white/[0.04]" />
      </div>
    ),
  },
];

const capabilities = [
  {
    title: "Visual output, not text walls",
    description:
      "Every response is a polished block — cards, grids, tables, flows, metrics. You see structure, not paragraphs.",
  },
  {
    title: "Bring anything",
    description:
      "A half-formed idea, a screenshot, a question, raw data. sansxel takes whatever you give it and returns something you can actually use.",
  },
  {
    title: "Instant materialization",
    description:
      "No prompting chains. No waiting for iterations. Describe what you need and watch it appear as a finished visual output.",
  },
  {
    title: "Not a chatbot",
    description:
      "sansxel doesn't converse — it produces. The interface is built around outputs, not conversation threads.",
  },
  {
    title: "Every block is actionable",
    description:
      "Copy, export, refine, or chain outputs together. Everything sansxel creates is designed to go somewhere next.",
  },
  {
    title: "Your formats, your way",
    description:
      "Presentations, dashboards, reports, comparisons, flows — sansxel adapts the output format to the shape of your thinking.",
  },
];

const useCases = [
  {
    input: '"Compare these three vendors on price, speed, and support"',
    output: "Comparison table with ranked highlights",
    type: "Table",
  },
  {
    input: '"Turn my meeting notes into a project roadmap"',
    output: "Visual flow with phases, milestones, owners",
    type: "Flow",
  },
  {
    input: '"Show me how our metrics changed this quarter"',
    output: "Metric cards with trend indicators",
    type: "Metrics",
  },
  {
    input: '"Draft a pitch deck outline for this idea"',
    output: "Slide-by-slide card grid with key points",
    type: "Grid",
  },
  {
    input: '"Organize these 40 bookmarks by topic"',
    output: "Categorized card layout with previews",
    type: "Card",
  },
  {
    input: '"Map out the user flow for our signup"',
    output: "Step-by-step flow diagram with branches",
    type: "Canvas",
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
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Now in early access
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
            From thought
            <br />
            <span className="bg-gradient-to-r from-white to-white/50 bg-clip-text text-transparent">
              to thing.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-200 sm:text-xl">
            sansxel is the AI that materializes your ideas into polished, visual
            outputs. Bring anything — get something better back.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={signedIn ? "/account" : getSignInPath("/account")}
              className="sansxel-white-button rounded-2xl bg-white px-7 py-3.5 text-center text-sm font-medium text-black transition hover:opacity-90"
            >
              {signedIn ? "Open workspace" : "Get started free"}
            </Link>
            <Link
              href="#how"
              className="rounded-2xl border border-white/10 bg-white/5 px-7 py-3.5 text-center text-sm font-medium text-white transition hover:bg-white/10"
            >
              See how it works
            </Link>
          </div>
        </div>

        {/* Output block previews */}
        <div className="mt-16 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {outputBlocks.map((block) => (
            <div
              key={block.label}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"
            >
              <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.15em] text-neutral-500">
                {block.label}
              </div>
              {block.preview}
            </div>
          ))}
        </div>
      </section>

      {/* ── Capabilities ─────────────────────────────────────────── */}
      <section
        id="features"
        className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
      >
        <div className="max-w-2xl">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            Capabilities
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-4xl">
            Not another chatbot. An AI that produces.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-neutral-200">
            sansxel doesn&apos;t talk at you — it builds for you. Every
            interaction ends with a visual output you can use immediately.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {capabilities.map((cap) => (
            <div
              key={cap.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"
            >
              <div className="text-lg font-medium text-white">{cap.title}</div>
              <p className="mt-3 text-sm leading-6 text-neutral-200">
                {cap.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works — input → output examples ───────────────── */}
      <section
        id="how"
        className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
      >
        <div className="max-w-2xl">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            How it works
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-4xl">
            You bring the idea. sansxel builds the output.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-neutral-200">
            Describe what you need in plain language. sansxel instantly
            materializes it as a structured, visual block you can use, export,
            or refine.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {useCases.map((uc) => (
            <div
              key={uc.input}
              className="flex flex-col rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"
            >
              <div className="text-xs font-medium uppercase tracking-[0.15em] text-neutral-500">
                {uc.type}
              </div>
              <p className="mt-3 text-sm font-medium leading-snug text-white/90">
                {uc.input}
              </p>
              <div className="mt-auto pt-4">
                <div className="flex items-center gap-2 text-sm text-neutral-300">
                  <span className="text-emerald-400">→</span>
                  {uc.output}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── The output system ────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-12">
          <div className="grid gap-10 lg:grid-cols-[1fr_.8fr] lg:items-center">
            <div>
              <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
                The output system
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-4xl">
                Everything comes back as something real.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-200">
                sansxel doesn&apos;t just answer — it materializes. Every
                response is a structured visual block designed to be useful on
                its own: cards, grids, tables, previews, flows, metrics,
                checklists, and canvases.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {signedIn ? (
                  <Link
                    href="/account"
                    className="sansxel-white-button rounded-2xl bg-white px-6 py-3 text-sm font-medium text-black transition hover:opacity-90"
                  >
                    Open workspace
                  </Link>
                ) : (
                  <>
                    <Link
                      href={getSignInPath("/account")}
                      className="sansxel-white-button rounded-2xl bg-white px-6 py-3 text-sm font-medium text-black transition hover:opacity-90"
                    >
                      Try it free
                    </Link>
                    <Link
                      href="/features"
                      className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                    >
                      Explore features
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Card", color: "from-blue-500/15 to-blue-500/5" },
                { label: "Grid", color: "from-violet-500/15 to-violet-500/5" },
                { label: "Table", color: "from-amber-500/15 to-amber-500/5" },
                { label: "Flow", color: "from-emerald-500/15 to-emerald-500/5" },
                { label: "Metric", color: "from-rose-500/15 to-rose-500/5" },
                { label: "Canvas", color: "from-cyan-500/15 to-cyan-500/5" },
              ].map((block) => (
                <div
                  key={block.label}
                  className={`rounded-2xl bg-gradient-to-br ${block.color} border border-white/[0.08] p-4`}
                >
                  <div className="text-xs font-medium text-white/70">
                    {block.label}
                  </div>
                  <div className="mt-2 h-8 rounded-lg bg-white/[0.06]" />
                </div>
              ))}
            </div>
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
              Start free. Scale when your output needs grow.
            </h2>
          </div>
          <Link
            href="/pricing"
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
          >
            See all plans
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
                    ? "Contact us"
                    : "Go Pro"}
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

      {/* ── Early access + support ───────────────────────────────── */}
      <section
        id="early-access"
        className="mx-auto max-w-7xl px-4 pb-20 pt-2 sm:px-6 sm:pb-24 sm:pt-8 lg:px-8"
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_.95fr]">
          <EarlyAccessForm initialAccountContext={initialAccountContext} />

          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-10">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
              Links
            </div>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">
              Everything connects somewhere.
            </h3>
            <p className="mt-4 text-sm leading-6 text-neutral-200">
              Pricing, account, features, and support — no dead ends.
            </p>

            <div className="mt-6 grid gap-3">
              {[
                ["/features", "Features", "See every capability and output type."],
                ["/pricing", "Pricing", "Compare free, Pro, and Teams plans."],
                ["/privacy", "Privacy", "What sansxel collects and why."],
                ["/contact", "Contact", "Reach support directly."],
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
