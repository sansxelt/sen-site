import type { Metadata } from "next";
import { ComparePlans } from "@/components/compare-plans";
import { HeistCard } from "@/components/heist-card";
import { PricingPacks } from "@/components/pricing-packs";
import { WaitlistForm } from "@/components/landing/waitlist-form";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Vraelis pricing for Free, Core, Plus, Pro, Teams, and Enterprise plans.",
};

export default function PricingPage() {
  return (
    <>
      <section className="mx-auto max-w-[1600px] px-4 pt-10 pb-12 sm:px-6 sm:pb-16 lg:px-8 lg:pb-24" style={{ fontFamily: '"Inter Tight", -apple-system, sans-serif' }}>
        {/* ── Hero ────────────────────────────────────────────────── */}
        <div className="max-w-3xl pb-10 border-b" style={{ borderColor: "rgba(199,205,215,0.08)" }}>
          <div className="text-xs font-medium uppercase tracking-[0.18em] mb-4" style={{ color: "#5CE5D5", fontFamily: '"JetBrains Mono", monospace' }}>
            Pricing
          </div>
          <h1 className="text-4xl font-medium tracking-tight sm:text-5xl" style={{ color: "#ECEFF4", letterSpacing: "-0.03em", lineHeight: 1.05 }}>
            Plans that grow with how much you turn into output.
          </h1>
          <p className="mt-5 text-base leading-7" style={{ color: "#8B95A6" }}>
            Start free for everyday use, then scale into heavier create and build
            workflows. Every paid tier expands how far Vraelis can go with you.
          </p>
          <div className="mt-4 text-sm" style={{ color: "#5A6478" }}>
            Not sure which one? <ComparePlans />
          </div>
        </div>

        {/* ── Full plan cards ──────────────────────────────────────── */}
        <div className="mt-8 sm:mt-10">
          <PricingPacks />
        </div>

        {/* ── Credit explainer ─────────────────────────────────────── */}
        <div className="mt-14 sm:mt-16 border p-6 sm:p-8" style={{ borderColor: "rgba(199,205,215,0.10)", background: "rgba(199,205,215,0.02)" }}>
          <div className="text-xs font-medium uppercase tracking-[0.18em] mb-3" style={{ color: "#5CE5D5", fontFamily: '"JetBrains Mono", monospace' }}>
            How credits work
          </div>
          <h2 className="mt-2 text-2xl font-medium tracking-tight sm:text-3xl" style={{ color: "#ECEFF4", letterSpacing: "-0.02em" }}>
            One balance. Every feature. No surprise bills.
          </h2>
          <p className="mt-2 max-w-3xl text-sm sm:text-base" style={{ color: "#8B95A6", lineHeight: 1.6 }}>
            Your plan covers a generous weekly base. When you push past it, top up with
            credits — <span style={{ color: "#ECEFF4" }}>$1 = 100 credits</span> — and burn them
            however fits the work. Same balance for chat, image, voice, and copilot.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            {[
              { name: "Chat",    cost: "1 credit",  note: "1¢ per reply" },
              { name: "Image",   cost: "5 credits",  note: "5¢ per image" },
              { name: "Voice",   cost: "2 credits",  note: "2¢ per minute" },
              { name: "Copilot", cost: "1 credit",  note: "1¢ per ask" },
            ].map((row) => (
              <div key={row.name} className="border p-4" style={{ borderColor: "rgba(199,205,215,0.10)", background: "rgba(199,205,215,0.02)" }}>
                <div className="text-sm font-medium" style={{ color: "#ECEFF4" }}>{row.name}</div>
                <div className="text-xs mt-0.5" style={{ color: "#5A6478" }}>{row.note}</div>
                <div className="mt-3 text-lg font-medium" style={{ color: "#5CE5D5" }}>{row.cost}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs" style={{ color: "#5A6478" }}>
            <span>$5 ≈ 500 chats · 100 images · 250 voice min · 500 copilot asks</span>
            <span>·</span>
            <span>Credits never expire</span>
            <span>·</span>
            <span>Auto top-up optional</span>
          </div>
        </div>

        <div className="mt-16 grid gap-px sm:mt-[4.5rem] sm:grid-cols-2 sm:gap-4 lg:grid-cols-3" style={{ borderColor: "rgba(199,205,215,0.08)" }}>
          {[
            ["Personal plans", "Built for everyday use, deeper create work, and full personal build power without making the product feel niche."],
            ["Team plans", "For shared libraries, collaboration, admin controls, and a cleaner path from individual use to team adoption."],
            ["Enterprise rollout", "Manual by design for organizations that need more capacity, governance, onboarding help, and custom deployment shape."],
          ].map(([title, description]) => (
            <div key={title} className="p-6 sm:p-7 border" style={{ borderColor: "rgba(199,205,215,0.08)", background: "rgba(199,205,215,0.02)" }}>
              <div className="text-base font-medium" style={{ color: "#ECEFF4" }}>{title}</div>
              <p className="mt-3 text-sm leading-6" style={{ color: "#8B95A6" }}>
                {description}
              </p>
            </div>
          ))}
        </div>

        {/* Workshop compute explainer */}
        <div className="mt-16 sm:mt-20 border p-6 sm:p-8" style={{ borderColor: "rgba(199,205,215,0.10)", background: "rgba(199,205,215,0.02)" }}>
          <div className="text-xs font-medium uppercase tracking-[0.18em] mb-3" style={{ color: "#5CE5D5", fontFamily: '"JetBrains Mono", monospace' }}>
            Workshop compute
          </div>
          <h2 className="mt-2 text-2xl font-medium tracking-tight sm:text-3xl" style={{ color: "#ECEFF4", letterSpacing: "-0.02em" }}>
            What you actually pay for.
          </h2>
          <p className="mt-2 max-w-2xl text-sm sm:text-base" style={{ color: "#8B95A6", lineHeight: 1.6 }}>
            Free covers everyday use. Paid plans buy you headroom on the things
            that get expensive: long context windows, large file ingestion, deep
            research jobs, and high-volume voice.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Context",  desc: "How much memory and how many files Workshop holds active per thread." },
              { label: "Research", desc: "Multi-step web research, citations, deep crawls, document parses." },
              { label: "Creation", desc: "Image generation, voice synthesis, on-the-fly diagram generation." },
            ].map((row) => (
              <div key={row.label} className="border p-4" style={{ borderColor: "rgba(199,205,215,0.10)", background: "rgba(199,205,215,0.02)" }}>
                <div className="text-sm font-medium" style={{ color: "#ECEFF4" }}>{row.label}</div>
                <div className="mt-1 text-xs leading-relaxed" style={{ color: "#5A6478" }}>{row.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Hardware early access */}
        <div className="mt-12 sm:mt-16 border p-6 sm:p-8" style={{ borderColor: "rgba(92,229,213,0.18)", background: "rgba(92,229,213,0.03)" }}>
          <div className="text-xs font-medium uppercase tracking-[0.18em] mb-3" style={{ color: "#5CE5D5", fontFamily: '"JetBrains Mono", monospace' }}>
            Hardware · early access
          </div>
          <h2 className="mt-2 text-2xl font-medium tracking-tight sm:text-3xl" style={{ color: "#ECEFF4", letterSpacing: "-0.02em" }}>
            Lens, Whisper, Day Kit.
          </h2>
          <p className="mt-2 max-w-2xl text-sm sm:text-base" style={{ color: "#8B95A6", lineHeight: 1.6 }}>
            Future Vraelis hardware is sold separately, not bundled into a
            software plan. Join the waitlists below for early access pricing
            when each opens.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="border p-5" style={{ borderColor: "rgba(199,205,215,0.10)", background: "rgba(199,205,215,0.02)" }}>
              <div className="text-sm font-medium mb-1" style={{ color: "#ECEFF4" }}>Lens</div>
              <div className="text-xs mb-4" style={{ color: "#5A6478" }}>Visual interface · concept</div>
              <WaitlistForm product="lens" accent="#5CE5D5" cta="Join" />
            </div>
            <div className="border p-5" style={{ borderColor: "rgba(199,205,215,0.10)", background: "rgba(199,205,215,0.02)" }}>
              <div className="text-sm font-medium mb-1" style={{ color: "#ECEFF4" }}>Whisper hardware</div>
              <div className="text-xs mb-4" style={{ color: "#5A6478" }}>Dedicated voice earbud · concept</div>
              <WaitlistForm product="whisper" accent="#5CE5D5" cta="Join" />
            </div>
            <div className="border p-5" style={{ borderColor: "rgba(199,205,215,0.10)", background: "rgba(199,205,215,0.02)" }}>
              <div className="text-sm font-medium mb-1" style={{ color: "#ECEFF4" }}>Lens Day Kit</div>
              <div className="text-xs mb-4" style={{ color: "#5A6478" }}>Two pairs + smart case · concept</div>
              <WaitlistForm product="lens-day-kit" accent="#5CE5D5" cta="Join" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
