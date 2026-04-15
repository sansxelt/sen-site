import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { getSignInPath } from "@/lib/auth-ui";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "See how Sansxel moves from universal input to a result canvas and saved output library.",
};

const structure = [
  {
    title: "Input",
    description:
      "A single entry for text, files, links, screenshots, notes, data, and ideas. No prompt engineering required.",
  },
  {
    title: "Result Canvas",
    description:
      "The place where Sansxel returns answers, concepts, plans, comparisons, layouts, and builds in a visual form.",
  },
  {
    title: "Library",
    description:
      "A saved layer for results worth keeping. Revisit, refine, share, and build from what is already there.",
  },
];

const lifecycle = [
  {
    step: "01",
    title: "Bring raw intent",
    description:
      "Start with something messy. A question, a screenshot, a dataset, a note, a product idea, or a list of links.",
  },
  {
    step: "02",
    title: "Sansxel reads the shape",
    description:
      "It decides whether the right result is an answer, a comparison, a system, a concept, or a fuller build package.",
  },
  {
    step: "03",
    title: "Get a real output back",
    description:
      "The response arrives as something usable: a structured brief, visual concept, ranked table, launch plan, or operating view.",
  },
  {
    step: "04",
    title: "Refine or build forward",
    description:
      "Keep improving what is already good. Expand a summary into a plan, a plan into a system, or a system into a product package.",
  },
];

const examples = [
  ["Question", "Recommendation brief"],
  ["Screenshot", "Explained UI concept"],
  ["Meeting notes", "Roadmap and owner plan"],
  ["Research links", "Clustered insight board"],
  ["Product idea", "Landing page and pricing"],
  ["CSV data", "Metric summary and key trends"],
];

export default async function FunctionPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
      <div className="max-w-3xl">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
          How it works
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
          Start with chat. End with something usable.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-neutral-200">
          Sansxel is designed around a clean product loop: universal input,
          visual output, and a saved library of results that can keep improving
          over time.
        </p>
      </div>

      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        {structure.map((item) => (
          <div
            key={item.title}
            className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-7"
          >
            <div className="text-lg font-semibold text-white">{item.title}</div>
            <p className="mt-3 text-sm leading-6 text-neutral-200">
              {item.description}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-20">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
          Request lifecycle
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {lifecycle.map((item) => (
            <div
              key={item.step}
              className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 sm:flex-row sm:p-7"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-sm font-semibold text-white">
                {item.step}
              </div>
              <div>
                <div className="text-lg font-medium text-white">{item.title}</div>
                <p className="mt-2 text-sm leading-6 text-neutral-200">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-20">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
          Example transforms
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {examples.map(([input, output]) => (
            <div
              key={input}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="text-sm text-neutral-400">{input}</div>
              <span className="shrink-0 text-emerald-400">-&gt;</span>
              <div className="text-sm font-medium text-white">{output}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-16 flex flex-col gap-3 sm:flex-row">
        <Link
          href={signedIn ? "/account" : getSignInPath("/account")}
          className="sansxel-white-button rounded-2xl bg-white px-6 py-3 text-center text-sm font-medium text-black transition hover:opacity-90"
        >
          {signedIn ? "Open Sansxel" : "Try Sansxel"}
        </Link>
        <Link
          href="/features"
          className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10"
        >
          See all features
        </Link>
      </div>
    </section>
  );
}
