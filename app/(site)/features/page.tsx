import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { getSignInPath } from "@/lib/auth-ui";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Ask, Explore, Create, and Build — a universal AI where every response can escalate into something structured, visual, and usable.",
};

const modes = [
  {
    title: "Ask",
    description:
      "Handle everyday questions, explanations, and quick help. Small questions get fast answers — not long chat walls.",
  },
  {
    title: "Explore",
    description:
      "Discover news, recommendations, ranked options, and context. Results feel like a research brief, not a conversation.",
  },
  {
    title: "Create",
    description:
      "Turn rough notes, screenshots, drafts, and ideas into structured outputs — plans, summaries, concepts, and systems.",
  },
  {
    title: "Build",
    description:
      "Generate full packages: landing pages, pricing, product structure, brand direction. One prompt can spawn a mini-product.",
  },
];

const responseLayers = [
  {
    title: "Direct answer",
    description:
      "Every response starts with clarity. A short, useful answer before anything else — so small questions stay small.",
  },
  {
    title: "Structured breakdown",
    description:
      "For bigger requests, the answer expands into sections, steps, comparisons, or frameworks. Structure appears when it's needed.",
  },
  {
    title: "Visual output",
    description:
      "When the intent calls for it — layouts, previews, concept mockups, and spatial organization. Not every time. Only when useful.",
  },
  {
    title: "System expansion",
    description:
      "Complex prompts get system-level thinking: architecture, pricing models, onboarding flows, product structure. The response becomes a build.",
  },
  {
    title: "Action layer",
    description:
      "Export, refine, expand, chain into the next step. Every response that warrants it includes clear actions — not just text.",
  },
];

const inputs = [
  "Questions",
  "Links",
  "Screenshots",
  "Files",
  "Raw notes",
  "Spreadsheets",
  "Product ideas",
  "Research dumps",
];

const principles = [
  {
    title: "Universal, not niche",
    description:
      "Sansxel is designed to feel useful to anyone without being branded for one narrow audience or workflow.",
  },
  {
    title: "Better response design, not more features",
    description:
      "The real upgrade is how responses are structured — layered, visual when useful, and scaled to intent.",
  },
  {
    title: "Chat is the surface, not the product",
    description:
      "The interface is a text box. The product is what comes back — and how far it can go with a single prompt.",
  },
  {
    title: "Refine forward",
    description:
      "Outputs improve in place and chain naturally into the next result instead of forcing prompt restarts.",
  },
];

export default async function FeaturesPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
      <div className="max-w-3xl">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
          Features
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
          A normal AI on the surface. Way more powerful underneath.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-neutral-200">
          Sansxel handles everyday asks like any assistant. But its real strength
          is that every response can escalate — from a quick answer into
          something structured, visual, and usable.
        </p>
      </div>

      {/* Modes */}
      <div className="mt-16">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
          Core modes
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {modes.map((mode) => (
            <div
              key={mode.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6"
            >
              <div className="text-lg font-semibold text-white">
                {mode.title}
              </div>
              <p className="mt-3 text-sm leading-6 text-neutral-200">
                {mode.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Response layers */}
      <div className="mt-20">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
          Response layers
        </div>
        <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight text-white sm:text-4xl">
          Every response is layered. The AI decides the depth.
        </h2>
        <p className="mt-4 max-w-xl text-base leading-7 text-neutral-200">
          Small questions stay fast. Bigger requests expand into structured
          breakdowns, visuals, systems, and actions — automatically.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {responseLayers.map((layer) => (
            <div
              key={layer.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6"
            >
              <div className="text-lg font-semibold text-white">
                {layer.title}
              </div>
              <p className="mt-3 text-sm leading-6 text-neutral-200">
                {layer.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Input types */}
      <div className="mt-20 grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
            What you can bring
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-4xl">
            Anything in. Not just prompts.
          </h2>
          <p className="mt-4 text-base leading-7 text-neutral-200">
            You shouldn&apos;t have to translate your work into the perfect AI
            request. Questions, screenshots, links, notes, files, and datasets
            all belong here.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {inputs.map((input) => (
            <div
              key={input}
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-white"
            >
              {input}
            </div>
          ))}
        </div>
      </div>

      {/* Principles */}
      <div className="mt-20">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
          Product principles
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {principles.map((item) => (
            <div
              key={item.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-7"
            >
              <div className="text-xl font-semibold text-white">
                {item.title}
              </div>
              <p className="mt-4 text-base leading-7 text-neutral-100/85">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-16 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/pricing"
          className="sansxel-white-button rounded-2xl bg-white px-6 py-3 text-center text-sm font-medium text-black transition hover:opacity-90"
        >
          See pricing
        </Link>
        <Link
          href={signedIn ? "/account" : getSignInPath("/account")}
          className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10"
        >
          {signedIn ? "Open Sansxel" : "Try Sansxel"}
        </Link>
      </div>
    </section>
  );
}
