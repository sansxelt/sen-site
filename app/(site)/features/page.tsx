import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { AuroraBackground } from "@/components/aurora-background";
import { DotGrid } from "@/components/dot-grid";
import { HeistCard } from "@/components/heist-card";
import { getSignInPath } from "@/lib/auth-ui";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Talk, type, drop files, generate images, search live. The AI workshop for makers — built for indie devs, designers, students, and creators who actually ship.",
};

type Pillar = {
  title: string;
  status: "live" | "future";
  description: string;
};

const pillars: Pillar[] = [
  {
    title: "Talk and type, no mode switch",
    status: "live",
    description:
      "Two voice modes that actually work. Dictate when you want a text reply you can edit; Talk for full hands-free conversation with interruption mid-sentence. No clunky push-to-talk — VAD detects when you stop, the AI starts.",
  },
  {
    title: "Drop anything, the UI morphs",
    status: "live",
    description:
      "Drag an image and an analysis panel slides in. Drop a video and you get a timeline. Drop a PDF or code file and the right tool appears. Paste images straight from screenshots. The workshop reacts to what you're working on instead of making you find the right button.",
  },
  {
    title: "Live data, not stale knowledge",
    status: "live",
    description:
      "Web search is built into chat. Ask about today's market, last night's game, the latest release — sansxel-1 searches and answers with real numbers + citations. No 'I don't have access to current data' punts.",
  },
  {
    title: "Memory that follows you",
    status: "live",
    description:
      "Every chat saves server-side, keyed to your account. Open the workshop on your phone at 2am and pick up exactly where you left off on your laptop. AI-generated thread titles so the sidebar isn't a wall of 'yo' and 'hi'.",
  },
  {
    title: "MCP + file edits on desktop",
    status: "live",
    description:
      "The desktop app touches your files, runs MCP servers, and connects to your tools (GitHub, Notion, etc.). Web is the trial — desktop is where you actually ship.",
  },
  {
    title: "Image gen + multimodal in chat",
    status: "live",
    description:
      "Type 'gen an image of X' and you get one inline — no separate button. Drop an image and the model can see it (Claude vision). All in the same conversation, all charged from the same credit balance.",
  },
];

const inputs = [
  "Voice (talk or dictate)",
  "Drag-and-drop files",
  "Pasted screenshots",
  "Code snippets",
  "PDFs",
  "Live web search",
  "GitHub + integrations",
  "MCP tools (desktop)",
];

const principles = [
  {
    title: "For people who make things",
    description:
      "Indie devs shipping side projects, designers iterating on Figma, students turning notes into apps, content creators sketching ideas. Not knowledge workers writing emails — makers building.",
  },
  {
    title: "Web is taste, desktop is shipping",
    description:
      "Web sansxel is a real workshop in your browser — voice, drop, generate, search. Desktop is the same workshop with file edits, MCP, and the always-on voice loop. Same brain, two surfaces.",
  },
  {
    title: "Pay for what you use",
    description:
      "1 USD = 100 credits. Chat costs 1, image costs 5, voice 2/min, copilot 1. Same balance covers everything. Pro tiers bypass credits for normal use; only burn credits past your weekly cap. No surprise bills.",
  },
  {
    title: "It looks the way it should",
    description:
      "Heist-style 3D cards, neon gradient marks, drop-to-react UI, voice orb that breathes with your speech. Built so makers actually want to share it on X. Not enterprise grey.",
  },
];

export default async function FeaturesPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);

  return (
    <>
      <AuroraBackground />
      <section className="mx-auto max-w-[1600px] px-4 pt-6 pb-12 sm:px-6 sm:pt-8 sm:pb-16 lg:px-8 lg:pt-10 lg:pb-24">
        {/* ── Hero — DotGrid sits behind the headline copy ─────────── */}
        <div className="relative isolate overflow-hidden rounded-[28px] px-6 py-10 sm:px-10 sm:py-14">
          <DotGrid opacity={0.07} />
          <div className="relative max-w-3xl">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
              Features
            </div>
            <h1 className="hx-gradient-text mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
              Talk to it. Drop into it. Ship from it.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-neutral-200">
              Most AI is a blank chat box that pretends to be everything. Sansxel is a workshop:
              chat, voice, drag-drop, image gen, web search, persistent memory, MCP — all in one
              workspace that adapts to what you&apos;re building right now.
            </p>
          </div>
        </div>

        <div className="mt-16">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
            What&apos;s in the workshop
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {pillars.map((pillar) => (
              <HeistCard
                key={pillar.title}
                tilt
                className="h-full p-6 sm:p-7"
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
              </HeistCard>
            ))}
          </div>
        </div>

        <div className="mt-20 grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
              Inputs that actually work
            </div>
            <h2 className="hx-gradient-text mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">
              Anything in. Not just prompts.
            </h2>
            <p className="mt-4 text-base leading-7 text-neutral-200">
              Drop screenshots, paste from clipboard, talk through a problem, drag a
              file, search the live web. The workshop accepts the input you actually have
              — no &ldquo;please format your prompt as JSON&rdquo; gymnastics.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {inputs.map((input) => (
              <HeistCard
                key={input}
                className="px-4 py-4 text-sm text-white"
              >
                {input}
              </HeistCard>
            ))}
          </div>
        </div>

        <div className="mt-20">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
            Why it exists
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {principles.map((item) => (
              <HeistCard
                key={item.title}
                tilt
                className="h-full p-6 sm:p-7"
              >
                <div className="text-xl font-semibold text-white">
                  {item.title}
                </div>
                <p className="mt-4 text-base leading-7 text-neutral-100/85">
                  {item.description}
                </p>
              </HeistCard>
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
          href={signedIn ? "/app" : getSignInPath("/app")}
          className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10"
        >
          {signedIn ? "Open Workshop" : "Open the Workshop"}
          </Link>
        </div>
      </section>
    </>
  );
}
