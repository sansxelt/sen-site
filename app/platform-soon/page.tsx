import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { WaitlistForm } from "@/components/landing/waitlist-form";

// Served at platform.vraelis.ai/. Quiet developer page: the API exists,
// here is how to start, more is coming. No terminal cosplay, no eight
// status badges, no eight command cards. Three live links + one curl
// snippet + a single waitlist card. Matches the cinematic / restrained
// tone of the rest of vraelis.

export const metadata: Metadata = {
  title: "vraelis platform",
  description: "The vraelis API. Bearer auth, streaming chat, MCP-ready.",
};

export default function PlatformSoonPage() {
  return (
    <main className="min-h-screen bg-[#050507] text-neutral-200" style={{ position: "relative", overflow: "hidden" }}>
      {/* Soft ambient glow, no grid pattern */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 60% 45% at 50% 25%, rgba(168,196,255,0.06) 0%, transparent 65%)",
          pointerEvents: "none",
        }}
      />

      <header className="relative border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-6 py-4 sm:px-10">
          <Link href="https://platform.vraelis.ai" className="inline-flex shrink-0 items-center gap-2.5">
            <Image
              src="/logo-amber.svg"
              alt="vraelis"
              width={32}
              height={32}
              className="h-8 w-8 rounded-lg"
              priority
            />
            <div>
              <div className="text-sm font-semibold tracking-tight text-white">vraelis</div>
              <div className="hidden text-[11px] leading-none text-neutral-500 sm:block">
                Platform
              </div>
            </div>
          </Link>
          <Link
            href="https://vraelis.ai"
            className="text-[12px] text-neutral-500 transition hover:text-neutral-200"
          >
            vraelis.ai →
          </Link>
        </div>
      </header>

      <div className="relative mx-auto max-w-3xl px-6 pt-24 pb-32 sm:px-8 sm:pt-32 sm:pb-40">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-[11px] tracking-[0.14em] uppercase text-neutral-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
          API live
        </div>

        <h1
          className="text-5xl font-semibold leading-[0.95] tracking-tight text-white sm:text-7xl"
          style={{ letterSpacing: "-0.04em" }}
        >
          The vraelis API.
        </h1>
        <p className="mt-7 max-w-xl text-lg leading-7 text-neutral-400">
          Bearer auth, streaming chat, MCP-ready. The full developer
          console with usage dashboards, request inspector, webhooks,
          and SDK packages is in the work.
        </p>

        {/* Three live actions, no card-grid noise */}
        <div className="mt-12 flex flex-col divide-y divide-white/5 border-y border-white/5">
          {[
            {
              label: "Get an API key",
              note: "Bearer token from your account",
              href: "https://chat.vraelis.ai/account/keys",
            },
            {
              label: "Read the REST quickstart",
              note: "Auth, first request, streaming, JS + Python",
              href: "https://vraelis.ai/learn/VRAELIS-rest-api-quickstart",
            },
            {
              label: "Open Workshop",
              note: "Try the product first if you haven't",
              href: "https://chat.vraelis.ai",
            },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="group flex items-center justify-between gap-6 py-5 transition hover:bg-white/[0.02]"
            >
              <div>
                <div className="text-base font-medium text-white">{item.label}</div>
                <div className="mt-0.5 text-sm text-neutral-500">{item.note}</div>
              </div>
              <span className="text-sm text-neutral-500 transition group-hover:text-neutral-200">
                →
              </span>
            </Link>
          ))}
        </div>

        {/* Sample request, in context */}
        <div className="mt-16">
          <div className="mb-3 text-[11px] tracking-[0.18em] uppercase text-neutral-600">
            POST /api/v1/chat
          </div>
          <pre className="overflow-x-auto rounded-xl border border-white/[0.08] bg-black/60 p-5 font-mono text-[12.5px] leading-7 text-neutral-300">
{`curl https://vraelis.ai/api/v1/chat \\
  -H "Authorization: Bearer $VRAELIS_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"hello"}],"stream":true}'`}
          </pre>
        </div>

        {/* What's coming, said in one sentence */}
        <p className="mt-16 max-w-xl text-sm leading-6 text-neutral-500">
          Coming next: a hosted console for usage and key management,
          a live request inspector, project webhooks, the MCP server
          registry, and first-party SDK packages.
        </p>

        {/* Waitlist, restrained */}
        <div className="mt-12 rounded-2xl border border-white/[0.07] bg-white/[0.015] p-6 sm:p-8">
          <div className="text-[11px] tracking-[0.18em] uppercase text-neutral-500">
            Notify me
          </div>
          <h2 className="mt-2 text-xl font-medium text-white">
            Get pinged when each piece lands.
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            One email per release, no marketing. Unsubscribe at any time.
          </p>
          <div className="mt-5 max-w-md">
            <WaitlistForm
              product="platform"
              accent="#a8c4ff"
              cta="Join"
              placeholder="dev@yourdomain.com"
            />
          </div>
        </div>
      </div>

      <footer className="relative border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-5 text-[11px] text-neutral-600 sm:px-8">
          <span>platform.vraelis.ai</span>
          <span>preview</span>
        </div>
      </footer>
    </main>
  );
}
