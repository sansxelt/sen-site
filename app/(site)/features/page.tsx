import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { AuroraBackground } from "@/components/aurora-background";
import { SpotlightCard } from "@/components/spotlight-card";
import { getSignInPath } from "@/lib/auth-ui";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Sansxel is an adaptive AI platform. The interface reshapes itself around who you are and what you're working on — not a generic chat box for everyone.",
};

type Pillar = {
  title: string;
  status: "live" | "future";
  description: string;
};

const pillars: Pillar[] = [
  {
    title: "Contextual UI",
    status: "live",
    description:
      "The interface adapts to you. Students, developers, writers, researchers, and creators each get an experience shaped around their workflow — not a generic chat window with their name on top. As you work, Sansxel learns the shape of what you're doing and reshapes itself in real time.",
  },
  {
    title: "Real-time tool execution",
    status: "future",
    description:
      "In the future, Sansxel won't just talk about your tools — it will use them. Through an MCP-style tool layer, the platform takes action across your workflow as it reasons. No waiting for batched responses. No copy-pasting between windows.",
  },
  {
    title: "Open extension ecosystem",
    status: "future",
    description:
      "In the future, anyone will be able to build extensions that plug into Sansxel — new tools, new integrations, new contextual modes. The ecosystem is designed to evolve with the people who use it, not gate-kept around a single team's roadmap.",
  },
  {
    title: "Our own infrastructure",
    status: "future",
    description:
      "In the future, Sansxel will run on our own backend — efficient inference, model flexibility, and the freedom to evolve on our own terms. That means broad access, sustainable costs, and features that aren't possible when you're renting someone else's stack.",
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
    title: "Access matters",
    description:
      "AI shouldn't be a luxury good. Sansxel is designed so that powerful AI is available broadly — not gated behind enterprise pricing or hidden behind feature walls.",
  },
  {
    title: "The interface is the product",
    description:
      "A great model wrapped in a bad interface is a bad product. We obsess over the interface because that's where the value actually lands.",
  },
  {
    title: "Safety isn't an afterthought",
    description:
      "Broad access only works with thoughtful safeguards. Protection is designed into the backend, not bolted on after the fact.",
  },
  {
    title: "Independence matters",
    description:
      "Building on our own infrastructure means controlling the roadmap — not at the mercy of upstream pricing changes, deprecations, or policy shifts.",
  },
];

export default async function FeaturesPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);

  return (
    <>
      <AuroraBackground />
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
      <div className="max-w-3xl">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
          Features
        </div>
        <h1 className="hx-gradient-text mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
          One AI. Infinite shapes.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-neutral-200">
          Most AI tools give everyone the same blank chat box. Sansxel doesn&apos;t.
          The interface is contextual — it reshapes based on who you are, what
          you&apos;re working on, and what the moment calls for.
        </p>
      </div>

      <div className="mt-16">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
          Four pillars
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {pillars.map((pillar) => (
            <SpotlightCard
              key={pillar.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-7 h-full"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-xl font-semibold text-white">
                  {pillar.title}
                </div>
                <span
                  className={
                    pillar.status === "live"
                      ? "shrink-0 rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-300"
                      : "shrink-0 rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-amber-200/90"
                  }
                >
                  {pillar.status === "live" ? "Live" : "In the future"}
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-neutral-200">
                {pillar.description}
              </p>
            </SpotlightCard>
          ))}
        </div>
      </div>

      <div className="mt-20 grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
            What you can bring
          </div>
          <h2 className="hx-gradient-text mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">
            Anything in. Not just prompts.
          </h2>
          <p className="mt-4 text-base leading-7 text-neutral-200">
            You shouldn&apos;t have to translate your work into the perfect AI
            command. Questions, screenshots, links, notes, files, and datasets
            all belong here.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          Built for the people who actually use it
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {principles.map((item) => (
            <SpotlightCard
              key={item.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-7 h-full"
            >
              <div className="text-xl font-semibold text-white">
                {item.title}
              </div>
              <p className="mt-4 text-base leading-7 text-neutral-100/85">
                {item.description}
              </p>
            </SpotlightCard>
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
          href={signedIn ? "/account" : getSignInPath("/account/updates")}
          className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10"
        >
          {signedIn ? "Open workspace" : "Check your access"}
        </Link>
      </div>
    </section>
    </>
  );
}
