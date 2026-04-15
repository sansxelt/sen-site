import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { getSignInPath } from "@/lib/auth-ui";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Visual output blocks, instant materialization, and a production-grade AI that builds instead of talks.",
};

const outputTypes = [
  {
    title: "Card",
    description:
      "Rich previews, summaries, and standalone content blocks. The default when sansxel needs to present a single idea clearly.",
  },
  {
    title: "Grid",
    description:
      "Side-by-side layouts for collections, galleries, comparisons, and multi-item overviews.",
  },
  {
    title: "Table",
    description:
      "Structured data with sortable columns. Comparisons, inventories, ranked lists, and analysis results.",
  },
  {
    title: "Flow",
    description:
      "Step-by-step processes, user journeys, decision trees, and any sequence with direction.",
  },
  {
    title: "Metric",
    description:
      "Numbers that matter — KPIs, scores, trends, and change indicators presented with visual weight.",
  },
  {
    title: "Canvas",
    description:
      "Freeform spatial layouts for brainstorming, mind maps, architecture diagrams, and relationship mapping.",
  },
  {
    title: "Checklist",
    description:
      "Actionable task lists, launch checklists, audit trails, and anything with completion state.",
  },
  {
    title: "Preview",
    description:
      "Rich link previews, document summaries, and content cards that show you what something is before you open it.",
  },
];

const principles = [
  {
    title: "Output over conversation",
    description:
      "sansxel is built to produce, not to chat. Every interaction ends with something visual and usable — not a paragraph.",
  },
  {
    title: "Structure by default",
    description:
      "Responses are never raw text dumps. sansxel automatically selects the right block type for what you asked.",
  },
  {
    title: "Refinement, not regeneration",
    description:
      "Outputs are designed to be edited, not rerolled. Adjust what's there instead of starting from scratch.",
  },
  {
    title: "Composable blocks",
    description:
      "Chain outputs together. A table can feed a flow, a flow can produce a checklist, a checklist can become a card.",
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
          An AI that builds, not talks.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-neutral-100 sm:text-xl">
          sansxel materializes your thinking into structured visual outputs.
          Cards, grids, tables, flows — every response is something you can
          actually use.
        </p>
      </div>

      {/* Output block types */}
      <div className="mt-16">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
          Output types
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {outputTypes.map((type) => (
            <div
              key={type.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6"
            >
              <div className="text-lg font-semibold text-white">
                {type.title}
              </div>
              <p className="mt-3 text-sm leading-6 text-neutral-200">
                {type.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Design principles */}
      <div className="mt-20">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
          Design principles
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {principles.map((p) => (
            <div
              key={p.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-7"
            >
              <div className="text-xl font-semibold text-white">{p.title}</div>
              <p className="mt-4 text-base leading-7 text-neutral-100/85">
                {p.description}
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
          {signedIn ? "Open workspace" : "Get started free"}
        </Link>
      </div>
    </section>
  );
}
