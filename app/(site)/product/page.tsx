import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { AuroraBackground } from "@/components/aurora-background";
import { DotGrid } from "@/components/dot-grid";
import { HeistCard } from "@/components/heist-card";
import { SpotlightCard } from "@/components/spotlight-card";
import { getSignInPath } from "@/lib/auth-ui";

// Combined Product page. Merges what was /features (the pillars,
// inputs, principles) with what was /function (the four-move loop
// and the persona examples). Single canonical surface; the old
// routes 308 to here from next.config.ts.

export const metadata: Metadata = {
  title: "Product",
  description:
    "Talk, type, drop files, generate images, search live. The AI workshop for makers, built for indie devs, designers, students, and creators who actually ship.",
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
      "Two voice modes that actually work. Dictate when you want a text reply you can edit; Talk for full hands-free conversation with interruption mid-sentence. No clunky push-to-talk, VAD detects when you stop, the AI starts.",
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
      "Web search is built into chat. Ask about today's market, last night's game, the latest release, sansxel-1 searches and answers with real numbers + citations. No 'I don't have access to current data' punts.",
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
      "The desktop app touches your files, runs MCP servers, and connects to your tools (GitHub, Notion, etc.). Web is the trial, desktop is where you actually ship.",
  },
  {
    title: "Image gen + multimodal in chat",
    status: "live",
    description:
      "Type 'gen an image of X' and you get one inline, no separate button. Drop an image and the model can see it. All in the same conversation, all charged from the same credit balance.",
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

const moves = [
  {
    step: "01",
    title: "Talk",
    description:
      "Hit Voice. Two modes: Dictate (speak, AI types) for quick captures; Talk (full hands-free) for working through problems out loud. VAD detects when you're done, no push-to-talk.",
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
      "Type 'gen an image of X' and you get one inline. No separate button. Same for documents, code blocks, structured plans, sansxel-1 detects intent and ships the right output.",
  },
  {
    step: "04",
    title: "Ship",
    description:
      "Conversations save server-side, AI-titled for the sidebar, synced across devices. Switch from phone to laptop, same threads, same memory. Desktop unlocks file edits + MCP for the full pipeline.",
  },
];

const personas = [
  {
    title: "Indie dev at 2am",
    description:
      "Drops a screenshot of a broken React state, voice-talks through the bug, gets a fix in markdown they can paste into their IDE. Live web search pulls the latest StackOverflow context.",
  },
  {
    title: "Designer iterating",
    description:
      "Pastes Figma screenshots, asks for color tweaks or layout critique, generates supporting imagery inline. The image panel slides in next to the chat, no app switching.",
  },
  {
    title: "Student turning notes into a project",
    description:
      "Drops PDFs and lecture notes, drafts a project plan, generates code scaffolds, talks through revisions hands-free while sketching.",
  },
  {
    title: "Content creator brainstorming",
    description:
      "Voice-dumps the loose idea, gets it humanized into a script, generates thumbnails, drops reference images for style guidance, all in one session that saves to their account.",
  },
];

const principles = [
  {
    title: "For people who make things",
    description:
      "Indie devs shipping side projects, designers iterating on Figma, students turning notes into apps, content creators sketching ideas. Not knowledge workers writing emails, makers building.",
  },
  {
    title: "Web is taste, desktop is shipping",
    description:
      "Web sansxel is a real workshop in your browser, voice, drop, generate, search. Desktop adds direct file edits and MCP server connections. Same brain, two surfaces.",
  },
  {
    title: "Pay for what you use",
    description:
      "Every plan ships with a generous weekly base, 50 chats on Free, 1500 on Plus. When you push past, top up credits ($1 = 100 credits, 1¢ per chat) or add Power Pack to lift every cap to unlimited. No surprise bills.",
  },
  {
    title: "It looks the way it should",
    description:
      "Heist-style 3D cards, neon gradient marks, drop-to-react UI, voice orb that breathes with your speech. Built so makers actually want to share it on X. Not enterprise grey.",
  },
];

export default async function ProductPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);

  return (
    <>
      <AuroraBackground />
      <section className="mx-auto max-w-[1600px] px-4 pt-6 pb-12 sm:px-6 sm:pt-8 sm:pb-16 lg:px-8 lg:pt-10 lg:pb-24">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <div className="relative isolate overflow-hidden rounded-[28px] px-6 py-10 sm:px-10 sm:py-14">
          <DotGrid opacity={0.07} />
          <div className="relative max-w-3xl">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
              Product
            </div>
            <h1 className="hx-gradient-text mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
              Talk to it. Drop into it. Ship from it.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-neutral-200">
              Most AI is a blank chat box pretending to be everything. Sansxel is a workshop:
              chat, voice, drag-drop, image gen, web search, persistent memory, MCP, all in one
              workspace that adapts to what you&apos;re building right now. Same brain on web
              and desktop, same memory across every device you sign in on.
            </p>
          </div>
        </div>

        {/* ── What's in the workshop ───────────────────────────── */}
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

        {/* ── Inputs ───────────────────────────────────────────── */}
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
              file, search the live web. The workshop accepts the input you actually
              have. No &ldquo;please format your prompt as JSON&rdquo; gymnastics.
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

        {/* ── The four moves (formerly /function) ──────────────── */}
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
            {moves.map((item) => (
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

        {/* ── Personas ─────────────────────────────────────────── */}
        <div className="mt-20">
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
            different product for each one, it just gives you the right tool for what
            you&apos;re doing in the moment.
          </p>
        </div>

        {/* ── Why it exists ────────────────────────────────────── */}
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

        {/* ── Why a workshop blurb ─────────────────────────────── */}
        <div className="mt-20 rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-10">
          <div className="max-w-2xl">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
              Why a workshop
            </div>
            <h2 className="hx-gradient-text mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">
              Because makers don&apos;t work in chat boxes.
            </h2>
            <p className="mt-4 text-base leading-7 text-neutral-200">
              A chat box assumes one rhythm, you type, it replies, repeat. That works for
              answering email. It doesn&apos;t work for shipping a thing. Building looks
              like a sketch on the side, a voice memo, a paste from another window, a quick
              search, a file dropped in, a generated mockup, all in 10 minutes. Sansxel is
              the workshop where all of that happens in one place.
            </p>
          </div>
        </div>

        {/* ── CTA ──────────────────────────────────────────────── */}
        <div className="mt-16 flex flex-col gap-3 sm:flex-row">
          <Link
            href={signedIn ? "/app" : getSignInPath("/app")}
            className="sansxel-white-button rounded-2xl bg-white px-6 py-3 text-center text-sm font-medium text-black transition hover:opacity-90"
          >
            {signedIn ? "Open Workshop" : "Open the Workshop"}
          </Link>
          <Link
            href="/pricing"
            className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10"
          >
            See pricing
          </Link>
        </div>
      </section>
    </>
  );
}
