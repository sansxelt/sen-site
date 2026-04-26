import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { AuroraBackground } from "@/components/aurora-background";
import { SpotlightCard } from "@/components/spotlight-card";
import { getSignInPath } from "@/lib/auth-ui";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "Open the workshop. Talk, drop, type. Generate, search, ship. How a maker actually uses sansxel from idea to output.",
};

const personas = [
  {
    title: "Indie dev at 2am",
    description:
      "Drops a screenshot of a broken React state, voice-talks through the bug, gets a fix in markdown they can paste into their IDE. Live web search pulls the latest StackOverflow context.",
  },
  {
    title: "Designer iterating",
    description:
      "Pastes Figma screenshots, asks for color tweaks or layout critique, generates supporting imagery inline. The image panel slides in next to the chat — no app switching.",
  },
  {
    title: "Student turning notes into a project",
    description:
      "Drops PDFs and lecture notes, drafts a project plan, generates code scaffolds, talks through revisions hands-free while sketching.",
  },
  {
    title: "Content creator brainstorming",
    description:
      "Voice-dumps the loose idea, gets it humanized into a script, generates thumbnails, drops reference images for style guidance — all in one session that saves to their account.",
  },
];

const whatShifts = [
  {
    step: "01",
    title: "Talk",
    description:
      "Hit Voice. Two modes: Dictate (speak, AI types) for quick captures; Talk (full hands-free) for working through problems out loud. VAD detects when you're done — no push-to-talk.",
  },
  {
    step: "02",
    title: "Drop",
    description:
      "Drag a file or paste a screenshot. The right panel morphs to fit it: image analysis, file breakdown, code preview, document parse. The chat stays in the center; the tool comes to you.",
  },
  {
    step: "03",
    title: "Generate",
    description:
      "Type 'gen an image of X' and you get one inline. No separate button. Same for documents, code blocks, structured plans — sansxel-1 detects intent and ships the right output.",
  },
  {
    step: "04",
    title: "Ship",
    description:
      "Conversations save server-side, AI-titled for the sidebar, synced across devices. Switch from phone to laptop — same threads, same memory. Desktop unlocks file edits + MCP for the full pipeline.",
  },
];

export default async function FunctionPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);

  return (
    <>
      <AuroraBackground />
    <section className="mx-auto max-w-[1600px] px-4 pt-6 pb-12 sm:px-6 sm:pt-8 sm:pb-16 lg:px-8 lg:pt-10 lg:pb-24">
      <div className="max-w-3xl">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
          How it works
        </div>
        <h1 className="hx-gradient-text mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
          Talk. Drop. Generate. Ship.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-neutral-200">
          A workshop, not a chat box. Open it on your laptop or your phone, throw whatever
          you&apos;re working on at it — voice, files, screenshots, code, half-formed ideas —
          and the workspace rearranges itself to fit. Same brain on web and desktop, same
          memory across every device you sign in on.
        </p>
      </div>

      <div className="mt-14">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
          Who actually uses it
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
          Different makers, same workshop. Sansxel doesn&apos;t pretend to be a
          different product for each one — it just gives you the right tool for what
          you&apos;re doing in the moment.
        </p>
      </div>

      <div className="mt-20">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
          The four moves
        </div>
        <h2 className="hx-gradient-text mt-3 max-w-2xl text-2xl font-semibold tracking-tight sm:text-4xl">
          Every session is a loop of these.
        </h2>
        <p className="mt-4 max-w-xl text-base leading-7 text-neutral-200">
          Not a settings menu with themes. An actual workflow: talk through it,
          drop the inputs, generate the output, ship the result. Repeat as needed.
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
            Why a workshop
          </div>
          <h2 className="hx-gradient-text mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">
            Because makers don&apos;t work in chat boxes.
          </h2>
          <p className="mt-4 text-base leading-7 text-neutral-200">
            A chat box assumes one rhythm — you type, it replies, repeat. That works for
            answering email. It doesn&apos;t work for shipping a thing. Building looks
            like a sketch on the side, a voice memo, a paste from another window, a quick
            search, a file dropped in, a generated mockup — all in 10 minutes. Sansxel is
            the workshop where all of that happens in one place.
          </p>
        </div>
      </div>

      <div className="mt-16 flex flex-col gap-3 sm:flex-row">
        <Link
          href={signedIn ? "/app" : getSignInPath("/app")}
          className="sansxel-white-button rounded-2xl bg-white px-6 py-3 text-center text-sm font-medium text-black transition hover:opacity-90"
        >
          {signedIn ? "Open Workshop" : "Open the Workshop"}
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
