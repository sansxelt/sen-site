import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { getSignInPath } from "@/lib/auth-ui";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Ask, Explore, Create, and Build with a universal AI that turns raw input into structured, visual output.",
};

const modes = [
  {
    title: "Ask",
    description:
      "Handle everyday questions, explanations, and quick help with clear, visual-first responses instead of long chat walls.",
  },
  {
    title: "Explore",
    description:
      "Discover news, recommendations, ranked options, and context with results that feel closer to a research brief than a conversation.",
  },
  {
    title: "Create",
    description:
      "Turn rough notes, screenshots, drafts, and ideas into polished outputs such as plans, summaries, concepts, and systems.",
  },
  {
    title: "Build",
    description:
      "Generate full startup-like packages instantly: landing pages, pricing, product structure, launch shape, and brand direction.",
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

const outputs = [
  {
    title: "Answer cards",
    description: "Fast answers that arrive cleanly packaged instead of buried in paragraphs.",
  },
  {
    title: "Comparison tables",
    description: "Vendors, products, choices, and ranked tradeoffs presented in a way you can act on.",
  },
  {
    title: "Plans and systems",
    description: "Roadmaps, frameworks, workflows, operating models, and structured next steps.",
  },
  {
    title: "Visual concepts",
    description: "Landing page directions, UI ideas, brand frames, and product presentation layers.",
  },
  {
    title: "Build packages",
    description: "Startup-like outputs with naming, pricing, messaging, product structure, and launch shape.",
  },
  {
    title: "Saved results",
    description: "Outputs you can refine, reuse, export, and chain into what comes next.",
  },
];

const principles = [
  {
    title: "Universal, not niche",
    description:
      "Sansxel is designed to feel useful to anyone without being branded for one narrow audience or workflow.",
  },
  {
    title: "Output over response",
    description:
      "The unit of value is not the answer. It is the usable thing you leave with after the answer.",
  },
  {
    title: "Visual by default",
    description:
      "Results should feel seen, not decoded. Structure, layout, and hierarchy matter as much as raw intelligence.",
  },
  {
    title: "Refine forward",
    description:
      "Outputs should improve in place and chain naturally into the next result instead of forcing prompt restarts.",
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
          A universal AI that turns input into output.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-neutral-200">
          Sansxel handles everyday asks like a normal assistant, but its real
          strength is transforming rough input into something structured, visual,
          improved, and usable.
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
              <div className="text-lg font-semibold text-white">{mode.title}</div>
              <p className="mt-3 text-sm leading-6 text-neutral-200">
                {mode.description}
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
            Anything in, not just prompts.
          </h2>
          <p className="mt-4 text-base leading-7 text-neutral-200">
            Users should not have to translate their work into the perfect AI
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

      <div className="mt-20">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
          What comes back
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {outputs.map((output) => (
            <div
              key={output.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6"
            >
              <div className="text-lg font-semibold text-white">{output.title}</div>
              <p className="mt-3 text-sm leading-6 text-neutral-200">
                {output.description}
              </p>
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
              <div className="text-xl font-semibold text-white">{item.title}</div>
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
