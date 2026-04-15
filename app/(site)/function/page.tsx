import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { getSignInPath } from "@/lib/auth-ui";

export const metadata: Metadata = {
  title: "Function",
  description:
    "How sansxel works — from raw input to polished visual output in one step.",
};

const steps = [
  {
    number: "01",
    title: "You bring the input",
    description:
      "A rough idea, a question, raw data, a screenshot, a half-written doc — anything. sansxel doesn't need clean prompts. It takes what you have.",
  },
  {
    number: "02",
    title: "sansxel understands the shape",
    description:
      "The AI reads your intent and selects the right output format — table, flow, grid, card, metric — based on what you're actually trying to do.",
  },
  {
    number: "03",
    title: "Output materializes instantly",
    description:
      "A polished, structured visual block appears. Not a paragraph of text. Not a draft. A finished output you can use, export, or chain into the next step.",
  },
  {
    number: "04",
    title: "Refine or chain forward",
    description:
      "Adjust any output in place. Or feed it into the next request — a table becomes a flow, a flow becomes a checklist, a checklist becomes a deck.",
  },
];

const transforms = [
  {
    input: "Meeting notes",
    output: "Action items + owner grid",
    arrow: "→",
  },
  {
    input: "Competitor URLs",
    output: "Feature comparison table",
    arrow: "→",
  },
  {
    input: "Product idea",
    output: "Pitch deck outline",
    arrow: "→",
  },
  {
    input: "CSV data",
    output: "Metric dashboard cards",
    arrow: "→",
  },
  {
    input: "User feedback",
    output: "Theme cluster grid",
    arrow: "→",
  },
  {
    input: "Process description",
    output: "Step-by-step flow",
    arrow: "→",
  },
];

export default async function FunctionPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
      <div className="max-w-3xl">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
          Function
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
          Input in. Output out. That&apos;s it.
        </h1>
        <p className="mt-5 text-base leading-7 text-neutral-200">
          sansxel is a single-step materializer. You give it something rough — it
          gives you back something finished and visual. No prompt engineering. No
          iteration loops. No conversation.
        </p>
      </div>

      {/* Steps */}
      <div className="mt-12 grid gap-5 lg:grid-cols-2">
        {steps.map((step) => (
          <div
            key={step.number}
            className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 sm:flex-row sm:p-7"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-sm font-semibold text-white">
              {step.number}
            </div>
            <div>
              <div className="text-lg font-medium text-white">{step.title}</div>
              <p className="mt-2 text-sm leading-6 text-neutral-200">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Transform examples */}
      <div className="mt-20">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
          Example transforms
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {transforms.map((t) => (
            <div
              key={t.input}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="text-sm text-neutral-400">{t.input}</div>
              <span className="shrink-0 text-emerald-400">{t.arrow}</span>
              <div className="text-sm font-medium text-white">{t.output}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-16 flex flex-col gap-3 sm:flex-row">
        <Link
          href={signedIn ? "/account" : getSignInPath("/account")}
          className="sansxel-white-button rounded-2xl bg-white px-6 py-3 text-center text-sm font-medium text-black transition hover:opacity-90"
        >
          {signedIn ? "Open workspace" : "Get started free"}
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
