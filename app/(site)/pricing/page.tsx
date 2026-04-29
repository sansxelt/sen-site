import type { Metadata } from "next";
import { AuroraBackground } from "@/components/aurora-background";
import { ComparePlans } from "@/components/compare-plans";
import { DotGrid } from "@/components/dot-grid";
import { HeistCard } from "@/components/heist-card";
import { PricingPacks } from "@/components/pricing-packs";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Sansxel pricing. Free for everyday use, Pro for unlimited chat / image / voice and persistent project memory, Teams for shared workspaces.",
};

export default function PricingPage() {
  return (
    <>
      <AuroraBackground />
      <section className="mx-auto max-w-[1600px] px-4 pt-4 pb-12 sm:px-6 sm:pt-6 sm:pb-16 lg:px-8 lg:pt-7 lg:pb-24">
        {/* ── Hero, DotGrid behind the headline ───────────────────── */}
        <div className="relative isolate overflow-hidden rounded-[28px] px-6 py-7 sm:px-10 sm:py-9">
          <DotGrid opacity={0.07} />
          <div className="relative max-w-3xl">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
              Pricing
            </div>
            <h1 className="hx-gradient-text mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
              Plans that grow with how much you turn into output.
            </h1>
            <p className="mt-4 text-base leading-7 text-neutral-200">
              Start free for everyday use, then scale into heavier create and build
              workflows. Every paid tier expands how far Sansxel can go with you.
            </p>

            {/* Guided comparison, sits under the hero copy, tuned to match
                the surrounding text tone (muted grey, soft underline). */}
            <div className="mt-4 text-sm text-neutral-500">
              Not sure which one? <ComparePlans />
            </div>
          </div>
        </div>

        {/* ── Full plan cards, single source of truth (Personal + Team) */}
        <div className="mt-5 sm:mt-6">
          <PricingPacks />
        </div>

        {/* ── Credit explainer, demystify how charges actually work. */}
        <div className="mt-12 sm:mt-16 rounded-[24px] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-violet-300">
            How credits work
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            One balance. Every feature. No surprise bills.
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-neutral-300 sm:text-base">
            Your plan covers a generous weekly base. When you push past it, top up with
            credits, <strong className="text-white">$1 = 100 credits</strong>, and burn them
            however fits the work. Same balance for chat, image, voice, and copilot.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            {[
              { glyph: "💬", name: "Chat", cost: "1 credit", note: "1¢ per reply" },
              { glyph: "🖼", name: "Image", cost: "5 credits", note: "5¢ per image" },
              { glyph: "🎙", name: "Voice", cost: "2 credits", note: "2¢ per minute" },
              { glyph: "✨", name: "Copilot", cost: "1 credit", note: "1¢ per ask" },
            ].map((row) => (
              <div
                key={row.name}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="text-xl">{row.glyph}</div>
                <div className="mt-1 text-sm font-semibold text-white">{row.name}</div>
                <div className="text-xs text-neutral-400">{row.note}</div>
                <div className="mt-2 text-lg font-semibold text-violet-300">{row.cost}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-neutral-400">
            <span>$5 ≈ 500 chats · 100 images · 250 voice min · 500 copilot asks</span>
            <span className="text-neutral-500">·</span>
            <span>Credits never expire</span>
            <span className="text-neutral-500">·</span>
            <span>Auto top-up optional</span>
          </div>
        </div>

        <div className="mt-16 grid gap-4 sm:mt-[4.5rem] sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {[
            [
              "Free",
              "Everyday questions, light create work, and a 7-day memory window. No card required.",
            ],
            [
              "Pro",
              "$15 / month. Unlimited chat, image, and voice; persistent project memory; Copilot Pro Pack + Power Pack included; API access.",
            ],
            [
              "Teams",
              "Shared libraries, team spaces, admin controls. Talk to us for rollout shape and seat pricing.",
            ],
          ].map(([title, description]) => (
            <HeistCard key={title} className="p-6 sm:p-7">
              <div className="text-lg font-medium text-white">{title}</div>
              <p className="mt-3 text-sm leading-6 text-neutral-300">
                {description}
              </p>
            </HeistCard>
          ))}
        </div>
      </section>
    </>
  );
}
