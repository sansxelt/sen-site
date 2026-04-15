import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { getSignInPath } from "@/lib/auth-ui";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Ask, Explore, Create, and Build with a layered AI response engine that can turn one prompt into something real.",
};

const modes = [
  {
    title: "Ask",
    description:
      "Handle everyday questions, explanations, and quick help. Small asks stay quick and clear.",
  },
  {
    title: "Explore",
    description:
      "Get discovery, recommendations, news context, and ranked options that feel more like a brief than a conversation.",
  },
  {
    title: "Create",
    description:
      "Turn rough notes, screenshots, drafts, and ideas into structured outputs like plans, summaries, concepts, and systems.",
  },
  {
    title: "Build",
    description:
      "Generate fuller outputs like landing pages, pricing, product structure, and startup-ready direction from a single prompt.",
  },
];

const responseLayers = [
  {
    title: "Direct answer",
    description:
      "Every response starts with clarity. A short useful answer comes first so simple questions stay simple.",
  },
  {
    title: "Structured breakdown",
    description:
      "For larger asks, the response expands into sections, steps, comparisons, and frameworks when that structure helps.",
  },
  {
    title: "Visual output",
    description:
      "Layouts, previews, concept views, and spatial organization appear when the problem benefits from seeing it, not just reading it.",
  },
  {
    title: "System expansion",
    description:
      "Complex prompts can widen into architecture, pricing models, onboarding, feature sets, and product logic.",
  },
  {
    title: "Action layer",
    description:
      "When there is a clear next move, Sansxel can let you refine, export, expand, or build forward without restarting.",
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
    title: "Universal, not boxed in",
    description:
      "Sansxel should feel useful to anyone without feeling built only for one role, industry, or workflow.",
  },
  {
    title: "Response design over feature sprawl",
    description:
      "The real upgrade is how the answer is shaped: layered, visual when useful, and scaled to intent.",
  },
  {
    title: "Chat is the surface",
    description:
      "The interface is familiar on purpose. The product value is what the response can become from the same prompt.",
  },
  {
    title: "Refine forward",
    description:
      "Outputs improve in place and chain into the next result instead of forcing you to restart every time.",
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
          A normal AI on the surface. A response engine underneath.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-neutral-200">
          Sansxel can answer everyday questions like any assistant. The
          difference is that responses can expand into structure, visuals,
          systems, and actions when the ask is bigger.
        </p>
      </div>

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

      <div className="mt-20">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
          Response layers
        </div>
        <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight text-white sm:text-4xl">
          Every answer can grow into something more useful.
        </h2>
        <p className="mt-4 max-w-xl text-base leading-7 text-neutral-200">
          Sansxel does not force the same output every time. It stays fast for
          small prompts and expands automatically for larger requests.
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

      <div className="mt-20 grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
            What you can bring
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-4xl">
            Anything in. Not just prompts.
          </h2>
          <p className="mt-4 text-base leading-7 text-neutral-200">
            You should not have to translate your work into the perfect AI
            command. Questions, screenshots, links, notes, files, and datasets
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
