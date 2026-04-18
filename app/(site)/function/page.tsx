import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { AuroraBackground } from "@/components/aurora-background";
import { SpotlightCard } from "@/components/spotlight-card";
import { getSignInPath } from "@/lib/auth-ui";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "The interface should adapt to you, not force you to adapt to it. Here's how the same Sansxel becomes a different experience for every kind of work.",
};

const personas = [
  {
    title: "Student",
    description:
      "A focused workspace surfaces research, citations, an outline view, and a writing area that grows with the draft.",
  },
  {
    title: "Developer",
    description:
      "A code canvas with file tree, live terminal, and contextual documentation tucked into the right margins.",
  },
  {
    title: "Writer",
    description:
      "A clean prose interface with character notes and chapter structure pushed into the edges, so the words stay centered.",
  },
  {
    title: "Researcher",
    description:
      "Linked source snippets, side-by-side comparisons, and a ranked takeaways panel that updates as the question evolves.",
  },
];

const whatShifts = [
  {
    step: "01",
    title: "Panels",
    description:
      "What lives on screen, and where. Research, terminals, outlines, canvases — surfaced only when they help.",
  },
  {
    step: "02",
    title: "Priority",
    description:
      "What Sansxel leads with: a quick answer, a visual, a plan, or a build-ready outline — based on the shape of the request.",
  },
  {
    step: "03",
    title: "Memory",
    description:
      "What it carries forward. Previous drafts, file context, and the direction you seem to be going.",
  },
  {
    step: "04",
    title: "Actions",
    description:
      "In the future, the platform will execute tools in real time — so the next step isn't copy-pasting between windows.",
  },
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
          The interface becomes what each person needs.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-neutral-200">
          The same Sansxel that helps a high schooler outline an essay also
          helps a senior engineer architect a system. Not because it&apos;s
          pretending to be two products — because the interface itself
          responds to what you&apos;re working on.
        </p>
      </div>

      <div className="mt-14">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
          Example shapes
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {personas.map((p) => (
            <SpotlightCard
              key={p.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-7 h-full"
            >
              <div className="text-lg font-semibold text-white">{p.title}</div>
              <p className="mt-3 text-sm leading-6 text-neutral-200">
                {p.description}
              </p>
            </SpotlightCard>
          ))}
        </div>
        <p className="mt-6 max-w-2xl text-sm leading-6 text-neutral-400">
          The platform isn&apos;t switching between templates. It&apos;s
          responding — to what you&apos;re working on, what you&apos;ve worked
          on before, and where you seem to be going next.
        </p>
      </div>

      <div className="mt-20">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
          What actually shifts
        </div>
        <h2 className="hx-gradient-text mt-3 max-w-2xl text-2xl font-semibold tracking-tight sm:text-4xl">
          Not a settings menu with a few themes.
        </h2>
        <p className="mt-4 max-w-xl text-base leading-7 text-neutral-200">
          &quot;Adaptive&quot; doesn&apos;t mean a color toggle. It means an
          interface that thinks alongside you — and four specific things change
          as you work.
        </p>
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {whatShifts.map((item) => (
            <SpotlightCard
              key={item.step}
              className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 sm:flex-row sm:p-7 h-full"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-sm font-semibold text-white">
                {item.step}
              </div>
              <div>
                <div className="text-lg font-medium text-white">
                  {item.title}
                </div>
                <p className="mt-2 text-sm leading-6 text-neutral-200">
                  {item.description}
                </p>
              </div>
            </SpotlightCard>
          ))}
        </div>
      </div>

      <div className="mt-20 rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-10">
        <div className="max-w-2xl">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
            Why this matters
          </div>
          <h2 className="hx-gradient-text mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">
            The interface is the product.
          </h2>
          <p className="mt-4 text-base leading-7 text-neutral-200">
            A great model wrapped in a bad interface is a bad product. The
            chat box isn&apos;t neutral — it&apos;s a constraint. It assumes
            you&apos;ll type, wait, read, and repeat, and that one mode fits
            everyone. Sansxel is built around the opposite assumption.
          </p>
        </div>
      </div>

      <div className="mt-16 flex flex-col gap-3 sm:flex-row">
        <Link
          href={signedIn ? "/account" : getSignInPath("/account/updates")}
          className="sansxel-white-button rounded-2xl bg-white px-6 py-3 text-center text-sm font-medium text-black transition hover:opacity-90"
        >
          {signedIn ? "Open workspace" : "Check your access"}
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
