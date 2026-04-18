import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { AuroraBackground } from "@/components/aurora-background";
import { ScrollReveal } from "@/components/scroll-reveal";
import { SpotlightCard } from "@/components/spotlight-card";
import { getSignInPath } from "@/lib/auth-ui";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "See how Sansxel turns a normal prompt into a layered response you can refine, expand, and use.",
};

const structure = [
  {
    title: "Start simple",
    description:
      "One chat entry for questions, files, links, screenshots, notes, data, and ideas. No workflow setup first.",
  },
  {
    title: "Response engine",
    description:
      "Sansxel decides the depth of the reply: direct answer, structure, visual output, system thinking, and actions when useful.",
  },
  {
    title: "Build forward",
    description:
      "Keep what is strong, refine it in place, and turn one response into the next step instead of starting from zero.",
  },
];

const lifecycle = [
  {
    step: "01",
    title: "Ask normally",
    description:
      "Start with a simple question, rough note, screenshot, dataset, or idea. The entry should feel familiar and frictionless.",
  },
  {
    step: "02",
    title: "Sansxel reads intent",
    description:
      "It decides whether the right reply is just a fast answer or something deeper with structure, visuals, systems, and actions.",
  },
  {
    step: "03",
    title: "The response expands",
    description:
      "You get clarity first, then the next layers only when they help: sections, plans, previews, architecture, or build-ready outputs.",
  },
  {
    step: "04",
    title: "Refine or act",
    description:
      "Push the response further, export it, improve it, or turn it into the next asset without losing the thread.",
  },
];

const examples = [
  ["Question", "Quick answer with ranked options"],
  ["Screenshot", "Explained interface with suggestions"],
  ["Meeting notes", "Roadmap with owners and timing"],
  ["Research links", "Patterns, clusters, and takeaways"],
  ["Product idea", "Concept, pricing, and landing page direction"],
  ["Raw data", "Metrics summary and clear insights"],
];

export default async function FunctionPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);

  return (
    <>
      <AuroraBackground />
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
      <div className="max-w-3xl">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
          How it works
        </div>
        <h1 className="hx-gradient-text mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
          It starts like chat. The response does the heavy lifting.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-neutral-200">
          Sansxel feels familiar when you begin. The difference is the shape of
          the reply: it can stay light, or grow into something structured,
          visual, and buildable when the request needs more.
        </p>
      </div>

      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        {structure.map((item, i) => (
          <ScrollReveal key={item.title} delay={i * 70}>
            <SpotlightCard className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-7 h-full">
              <div className="text-lg font-semibold text-white">{item.title}</div>
              <p className="mt-3 text-sm leading-6 text-neutral-200">
                {item.description}
              </p>
            </SpotlightCard>
          </ScrollReveal>
        ))}
      </div>

      <div className="mt-20">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
          Response flow
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {lifecycle.map((item, i) => (
            <ScrollReveal key={item.step} delay={i * 70}>
              <SpotlightCard className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 sm:flex-row sm:p-7 h-full">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-sm font-semibold text-white">
                  {item.step}
                </div>
                <div>
                  <div className="text-lg font-medium text-white">{item.title}</div>
                  <p className="mt-2 text-sm leading-6 text-neutral-200">
                    {item.description}
                  </p>
                </div>
              </SpotlightCard>
            </ScrollReveal>
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
    </>
  );
}
