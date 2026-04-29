import Link from "next/link";
import { auth } from "@/auth";
import { AuroraBackground } from "@/components/aurora-background";
import { AuthFlow } from "@/components/auth-flow";
import { DotGrid } from "@/components/dot-grid";
import { HeistCard } from "@/components/heist-card";
// HeroActivity removed, replaced by editorial featured-tile hero
// in sansxel's own visual language (DotGrid texture, HeistCard tilt,
// hx-gradient-text, mono kickers). Not a generic radial gradient.
import { SpotlightCard } from "@/components/spotlight-card";
import { readAccountContext } from "@/lib/account-session";
import { getSignInPath } from "@/lib/auth-ui";
import { ARTICLES, getTopic } from "@/lib/learn-content";
import { pricingPlans } from "@/lib/pricing";
import { getUserProfileByEmail } from "@/lib/user-profile";

// Hero right column features the three newest Learn articles. The
// previous version used Learn/Desktop/Pricing cards but those were
// already one-click links from the marketing nav, which the user
// flagged as "stuffr they can click on in one click" vs OpenAI's
// homepage where every card is real content (a launch, a feature,
// a product). Surfacing actual articles here matches that pattern.
const FEATURED_TINTS = [
  // [accent text class, accent dot/eyebrow class, soft radial rgba]
  ["text-sky-200", "text-sky-300", "rgba(96,165,250,0.22)"],
  ["text-pink-200", "text-pink-300", "rgba(244,114,182,0.22)"],
  ["text-amber-200", "text-amber-300", "rgba(251,191,36,0.18)"],
] as const;
const FEATURED_LEARN = [...ARTICLES]
  .sort((a, b) => (a.publishedAt > b.publishedAt ? -1 : 1))
  .slice(0, 3);

// Keep the escalation teaser, it's the single most distinctive concept
// of the product.  Everything else (transforms, why-sansxel, product
// shape) lives on /product where people come for depth.
const escalation = [
  {
    size: "Small",
    input: '"Where should I eat tonight?"',
    layers: [
      "Quick answer with a few strong picks",
      "Light visual suggestions only when they help",
    ],
  },
  {
    size: "Medium",
    input: '"Plan my day tomorrow"',
    layers: [
      "Direct answer",
      "Structured timeline with priorities",
      "Tradeoffs, adjustments, and next moves",
    ],
  },
  {
    size: "Big",
    input: '"Build me an AI app"',
    layers: [
      "Product idea and target users",
      "Homepage direction and feature set",
      "Pricing, onboarding, and system thinking",
      "Actions to refine, export, or build next",
    ],
  },
];

const workshopHighlights = [
  {
    eyebrow: "One workspace",
    title: "Chat, voice, drop, generate, all here",
    detail:
      "Talk through a problem, drop a screenshot, paste a YouTube link, generate an image inline. Same surface, no tab juggling.",
  },
  {
    eyebrow: "Threads that follow you",
    title: "Pick up on any device, mid-sentence",
    detail:
      "Conversations save server-side and sync across web and desktop. AI-titled in the sidebar so you can find them again.",
  },
  {
    eyebrow: "Built for makers",
    title: "For people shipping things, not writing emails",
    detail:
      "Indie devs, designers, students, creators, sansxel adapts to whatever you're building right now instead of being one shape for everyone.",
  },
];

export default async function HomePage() {
  const session                = await auth();
  const signedIn               = Boolean(session?.user?.email);
  const profile                = await getUserProfileByEmail(session?.user?.email);
  // initialAccountContext was passed to HeroActivity (now removed).
  // Read still here for downstream sections that depend on session.
  void readAccountContext(session, profile);
  const pricingPreview         = pricingPlans.filter(
    (plan) => plan.key === "free" || plan.key === "pro" || plan.key === "teams",
  );

  return (
    <>
      <AuroraBackground />

      {/* ── Hero, sansxel-native editorial layout. Same structure
          as the openai/anthropic 'big featured tile + side rail'
          shape but in our own visual language: DotGrid texture,
          HeistCard tilt, hx-gradient-text headline, mono kickers,
          aurora ribbon at the bottom edge. NOT a copy. ────────── */}
      <section
        id="top"
        data-stagger
        style={{ "--stagger-i": 0 } as React.CSSProperties}
        className="mx-auto grid max-w-[1600px] gap-4 px-4 pb-12 pt-6 sm:gap-5 sm:px-6 sm:pb-16 sm:pt-8 lg:grid-cols-[1.65fr_1fr] lg:gap-5 lg:px-8 lg:pb-20 lg:pt-10"
      >
        {/* Featured tile, DotGrid texture + aurora ribbon + brand
            wordmark corner badge. */}
        <HeistCard
          tilt
          className="group relative aspect-[4/3] overflow-hidden p-0 sm:aspect-[16/10] lg:aspect-auto lg:min-h-[560px]"
        >
          <Link
            href={signedIn ? "/app" : getSignInPath("/app")}
            className="block h-full w-full"
          >
            {/* Layer 1: dot grid texture */}
            <DotGrid opacity={0.09} />
            {/* Layer 2: aurora ribbon at the bottom edge */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-1/2 bg-[radial-gradient(120%_80%_at_50%_120%,rgba(167,139,250,0.35),transparent_55%),radial-gradient(80%_60%_at_15%_110%,rgba(244,114,182,0.25),transparent_60%)]" />
            {/* Layer 3: very subtle scanline overlay for texture */}
            <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,transparent_30%)]" />
            {/* Top-right corner: status pill */}
            <div className="absolute right-5 top-5 z-10 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] text-violet-200 backdrop-blur-sm sm:right-7 sm:top-7">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300 shadow-[0_0_8px_rgba(196,181,253,0.9)]" />
              memory wedge · LIVE
            </div>
            {/* Body */}
            <div className="relative z-10 flex h-full w-full flex-col justify-between p-7 sm:p-10 lg:p-12">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-violet-300">
                  ── the wedge
                </div>
                <h1 className="hx-gradient-text mt-5 text-4xl font-semibold leading-[1.02] tracking-tight sm:text-5xl lg:text-7xl">
                  Stop re-explaining<br />yourself to AI.
                </h1>
                <p className="mt-5 max-w-xl text-base leading-7 text-neutral-200 sm:text-lg sm:leading-8">
                  Every chatbot forgets you between sessions. Sansxel
                  remembers your projects, your context, your goals.
                  Every session picks up where the last one left off.
                </p>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition group-hover:opacity-90">
                  {signedIn ? "Open the workshop" : "Start free"}
                  <span aria-hidden>→</span>
                </span>
                <span className="font-mono text-[11px] text-neutral-400">
                  / no card required
                </span>
              </div>
            </div>
          </Link>
        </HeistCard>

        {/* Right column features actual Learn articles, OpenAI-style
            (each card is a real piece of content with a topic
            label, title, and read time, not a nav shortcut). The
            three newest articles auto-feature here so the column
            stays fresh as new pieces ship. */}
        <div className="flex flex-col gap-4 sm:gap-5">
          {FEATURED_LEARN.map((article, i) => {
            const tint = FEATURED_TINTS[i % FEATURED_TINTS.length];
            const topic = getTopic(article.topic);
            const radialPos = i % 2 === 0 ? "85%_20%" : "15%_20%";
            return (
              <HeistCard
                key={article.slug}
                tilt
                className="group relative flex-1 overflow-hidden p-0"
              >
                <Link href={`/learn/${article.slug}`} className="block h-full w-full">
                  <DotGrid opacity={0.07} />
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      backgroundImage: `radial-gradient(70% 50% at ${radialPos.replace("_", " ")}, ${tint[2]}, transparent 60%)`,
                    }}
                  />
                  <div className={`absolute right-5 top-5 z-10 font-mono text-[10px] uppercase tracking-[0.22em] ${tint[0]}/80`}>
                    {article.readMinutes} min
                  </div>
                  <div className="relative z-10 flex h-full w-full flex-col justify-between p-6 sm:p-7">
                    <div>
                      <div className={`font-mono text-[11px] uppercase tracking-[0.28em] ${tint[1]}`}>
                        ── {topic?.label ?? article.topic}
                      </div>
                      <h2 className="mt-3 text-xl font-semibold leading-tight tracking-tight text-white sm:text-2xl">
                        {article.title}
                      </h2>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-neutral-300">
                        {article.excerpt}
                      </p>
                    </div>
                    <div className={`mt-6 inline-flex items-center gap-1.5 text-sm font-medium ${tint[0]}`}>
                      Read article
                      <span aria-hidden>→</span>
                    </div>
                  </div>
                </Link>
              </HeistCard>
            );
          })}
        </div>
      </section>

      {/* ── Comparison: us vs the others ─────────────────────────
            Three columns calling out the wedge against the obvious
            comps. ChatGPT / Claude / Gemini own the "general AI"
            slot but reset every chat. Notion AI / Copilot own the
            "embedded AI" slot but stay generic. Sansxel sits in
            the gap: AI you can build a project on, with memory
            that survives the tab close. */}
      <section
        id="vs"
        data-stagger
        style={{ "--stagger-i": 1 } as React.CSSProperties}
        className="mx-auto max-w-[1600px] px-4 py-14 sm:px-6 sm:py-20 lg:px-8"
      >
        <div className="max-w-2xl">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-violet-300">
            Why sansxel
          </div>
          <h2 className="hx-gradient-text mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">
            Memory you can actually feel.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-neutral-200">
            Same chat models everyone else uses. Different shape of
            workspace, with project memory that compounds instead of
            resetting every tab close.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {[
            {
              title: "ChatGPT, Claude, Gemini",
              tone: "muted",
              points: [
                "Forget you between chats",
                "No project structure",
                "You re-paste the same context every session",
              ],
            },
            {
              title: "Notion AI, Copilot",
              tone: "muted",
              points: [
                "Locked to one host platform",
                "Generic outputs, no real memory of your work",
                "You bend your work to fit their box",
              ],
            },
            {
              title: "Sansxel",
              tone: "accent",
              points: [
                "Persistent project memory across sessions",
                "Description, goals, and pinned context auto-injected on every send",
                "Outputs shaped by your project, not a blank prompt",
                "Built for builders shipping real things",
              ],
            },
          ].map((col) => (
            <HeistCard
              key={col.title}
              tilt
              className={
                "h-full p-6 sm:p-7 " +
                (col.tone === "accent"
                  ? "border-violet-400/30 bg-violet-500/[0.05]"
                  : "")
              }
            >
              <div
                className={
                  "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.15em] " +
                  (col.tone === "accent"
                    ? "border-violet-400/30 bg-violet-400/[0.10] text-violet-200"
                    : "border-white/10 bg-white/[0.06] text-neutral-400")
                }
              >
                {col.tone === "accent" ? "us" : "them"}
              </div>
              <h3
                className={
                  "mt-4 text-lg font-semibold " +
                  (col.tone === "accent" ? "text-white" : "text-neutral-200")
                }
              >
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm leading-6">
                {col.points.map((p) => (
                  <li
                    key={p}
                    className={
                      "flex items-start gap-2 " +
                      (col.tone === "accent"
                        ? "text-neutral-100"
                        : "text-neutral-400")
                    }
                  >
                    <span
                      className={
                        "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full " +
                        (col.tone === "accent"
                          ? "bg-violet-300"
                          : "bg-neutral-600")
                      }
                      aria-hidden
                    />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </HeistCard>
          ))}
        </div>

        <div className="mt-10 max-w-2xl text-sm leading-7 text-neutral-400">
          <span className="font-semibold text-neutral-200">AI shouldn&apos;t have amnesia.</span>{" "}
          You explain your project. Again. And again. Important
          context lives across 40 different chats. Every output feels
          disconnected. Your work doesn&apos;t compound, it resets.
          Sansxel is one workspace where memory actually works.
        </div>
      </section>

      <section
        id="workshop"
        data-stagger
        style={{ "--stagger-i": 1 } as React.CSSProperties}
        className="mx-auto max-w-[1600px] px-4 py-14 sm:px-6 sm:py-20 lg:px-8"
      >
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-200/80">
              The workshop
            </div>
            <h2 className="hx-gradient-text mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">
              One surface that adapts to what you&apos;re building.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-neutral-200">
              Most AI is a chat box pretending to be everything. Sansxel is a workshop:
              voice, drag-drop, image gen, web search, persistent memory, all in the same
              workspace, all morphing to fit the request.
            </p>
          </div>
          <div className="rounded-3xl border border-emerald-400/10 bg-emerald-400/[0.03] px-5 py-4 text-sm leading-6 text-neutral-200 lg:max-w-sm lg:border-emerald-400/15 lg:bg-emerald-400/[0.05]">
            Open it in your browser, drop whatever you&apos;re working on, and pick up on
            your phone an hour later, same threads, same memory.
          </div>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {workshopHighlights.map((item) => (
            <HeistCard
              key={item.title}
              tilt
              className="h-full p-6 sm:p-7"
            >
              <div className="inline-flex rounded-full border border-emerald-400/15 bg-emerald-400/[0.08] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.15em] text-emerald-200">
                {item.eyebrow}
              </div>
              <h3 className="mt-4 text-lg font-medium text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-neutral-300">{item.detail}</p>
            </HeistCard>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3 text-sm">
          <Link
            href="/product"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-neutral-200 transition hover:bg-white/10"
          >
            Explore the workshop →
          </Link>
          <Link
            href={signedIn ? "/app" : "/signin"}
            className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.08] px-4 py-2 text-emerald-100 transition hover:bg-emerald-400/[0.14]"
          >
            {signedIn ? "Open workshop →" : "Start free →"}
          </Link>
        </div>
      </section>

      {/* ── Value teaser: smart escalation (single concept) ──────── */}
      <section
        id="how"
        data-stagger
        style={{ "--stagger-i": 2 } as React.CSSProperties}
        className="mx-auto max-w-[1600px] px-4 py-14 sm:px-6 sm:py-20 lg:px-8"
      >
        <div className="max-w-2xl">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            How it grows
          </div>
          <h2 className="hx-gradient-text mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">
            The response changes shape based on the request.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-neutral-200">
            Sansxel stays light when the ask is light, and expands into
            structure, visuals, and system thinking only when the prompt
            earns it. Here&apos;s what that looks like across three sizes of
            ask.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {escalation.map((level) => (
            <HeistCard
              key={level.size}
              tilt
              className="h-full p-5 sm:p-6"
            >
              <div className="inline-flex rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-400">
                {level.size}
              </div>
              <p className="mt-4 text-sm font-medium leading-snug text-white/90">
                {level.input}
              </p>
              <div className="mt-4 space-y-2">
                {level.layers.map((layer) => (
                  <div key={layer} className="flex items-start gap-2.5 text-sm text-neutral-300">
                    <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/70" />
                    <span>{layer}</span>
                  </div>
                ))}
              </div>
            </HeistCard>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3 text-sm">
          <Link
            href="/product"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-neutral-200 transition hover:bg-white/10"
          >
            Tour the workshop →
          </Link>
        </div>
      </section>

      {/* ── Pricing preview ──────────────────────────────────────── */}
      <section
        id="pricing"
        data-stagger
        style={{ "--stagger-i": 3 } as React.CSSProperties}
        className="mx-auto max-w-[1600px] px-4 py-14 sm:px-6 sm:py-20 lg:px-8"
      >
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-6">
          <div className="max-w-2xl">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
              Pricing
            </div>
            <h2 className="hx-gradient-text mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">
              Start free. Upgrade when it becomes part of how you build.
            </h2>
          </div>
          <Link
            href="/pricing"
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
          >
            View all plans
          </Link>
        </div>

        <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pricingPreview.map((plan) => (
            <SpotlightCard
              key={plan.name}
              className={`rounded-3xl border p-6 sm:p-7 h-full ${
                plan.featured
                  ? "border-white bg-white text-neutral-950"
                  : "border-white/10 bg-white/5 text-white"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-medium">{plan.name}</div>
                  <div className={`mt-1 text-sm ${plan.featured ? "text-neutral-700" : "text-neutral-300"}`}>
                    {plan.note}
                  </div>
                </div>
                {(plan.badge || plan.featured) && (
                  <div className="rounded-full bg-neutral-950 px-3 py-1 text-xs font-medium text-white">
                    {plan.badge ?? "Popular"}
                  </div>
                )}
              </div>

              <div className="mt-6 text-4xl font-semibold tracking-tight">
                {plan.monthlyLabel.replace(" / month", "").replace(" / seat", "")}
              </div>

              <div className="mt-6 space-y-3">
                {plan.points.map((point) => (
                  <div key={point} className="flex items-center gap-3 text-sm">
                    <div className={`h-2 w-2 rounded-full ${plan.featured ? "bg-neutral-950" : "bg-white"}`} />
                    <span>{point}</span>
                  </div>
                ))}
              </div>

              <Link
                href={
                  plan.key === "free"    ? "/account"
                : plan.key === "teams"   ? "/contact"
                                         : `/checkout?plan=${plan.key}&cycle=monthly`
                }
                className={`mt-8 block w-full rounded-2xl px-5 py-3 text-center text-sm font-medium transition ${
                  plan.featured
                    ? "sansxel-dark-button bg-neutral-950 text-white hover:opacity-90"
                    : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                }`}
              >
                {plan.key === "free"    ? "Start free"
               : plan.key === "teams"   ? "Talk to us"
                                        : "See plan"}
              </Link>
            </SpotlightCard>
          ))}
        </div>
      </section>

      {/* ── Final CTA, single section, not 2 ───────────────────── */}
      <section
        id="get-started"
        data-stagger
        style={{ "--stagger-i": 4 } as React.CSSProperties}
        className="mx-auto max-w-[1600px] px-4 pb-20 pt-2 sm:px-6 sm:pb-24 sm:pt-8 lg:px-8"
      >
        {signedIn ? (
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-10">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
              Welcome back
            </div>
            <h2 className="hx-gradient-text mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">
              Pick up where you left off.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-neutral-200">
              Jump into your workspace or review billing, usage, and account settings in one place.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/account"
                className="sansxel-white-button rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
              >
                Open workspace
              </Link>
              <Link
                href="/account/billing"
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Manage billing
              </Link>
            </div>
          </div>
        ) : (
          <AuthFlow initialSessionEmail={session?.user?.email ?? null} />
        )}

        {/* Compact "what's next" row, one click to each depth page */}
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["/product",   "Product",        "Ask, Explore, Create, Build"],
            ["/learn",     "Learn",          "Short reads, real code"],
            ["/pricing",   "Pricing",        "Free, Pro, Teams"],
            ["/contact",   "Contact",        "Talk to us"],
          ].map(([href, label, desc]) => (
            <Link
              key={href}
              href={href}
              className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:bg-white/5"
            >
              <div className="text-sm font-medium text-white">{label}</div>
              <div className="mt-1 text-xs text-neutral-400">{desc}</div>
            </Link>
          ))}
        </div>

        {/* Fallback sign-in path for anyone who wants to skip the auth flow */}
        {!signedIn && (
          <p className="mt-8 text-center text-xs text-neutral-500">
            Already have an account?{" "}
            <Link
              href={getSignInPath()}
              className="text-neutral-300 underline decoration-neutral-600 underline-offset-4 hover:text-white hover:decoration-white"
            >
              Sign in
            </Link>
          </p>
        )}
      </section>
    </>
  );
}
