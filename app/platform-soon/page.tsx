import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

// Placeholder served at platform.sansxel.ai/ until the real
// developer console + docs land. Distinct visual identity from
// sansxel.ai (marketing) and chat.sansxel.ai (workshop), terminal/
// console aesthetic, mono type, amber accent (matches the platform
// pinwheel favicon). Each subdomain feels like its own surface,
// not the same site three times.

export const metadata: Metadata = {
  title: "sansxel platform",
  description: "API docs and developer console for sansxel, coming soon.",
};

export default function PlatformSoonPage() {
  return (
    <main className="min-h-screen bg-[#070a10] text-neutral-200">
      {/* Top zone bar matches the marketing site nav: pinwheel +
          wordmark + tagline on the left edge, back link on the
          right edge. Scaling padding so the chrome rhythm is the
          same on every surface (apex, chat workshop, this). */}
      <header className="border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 lg:px-10 xl:px-14 2xl:px-20">
          <Link
            href="https://platform.sansxel.ai"
            className="inline-flex shrink-0 items-center gap-2.5"
          >
            <Image
              src="/logo-amber.svg"
              alt="sansxel"
              width={36}
              height={36}
              className="h-9 w-9 rounded-xl"
              priority
            />
            <div>
              <div className="font-mono text-sm font-semibold tracking-tight text-white sm:text-base">
                sansxel
              </div>
              <div className="hidden font-mono text-[11px] leading-none text-neutral-500 sm:block">
                Platform · developer console
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="https://sansxel.ai"
              className="font-mono text-[11px] text-neutral-500 transition hover:text-neutral-200"
            >
              ← sansxel.ai
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-20 sm:px-8 sm:py-28">
        {/* Terminal-style status block */}
        <div className="mb-10 inline-flex items-center gap-3 rounded-md border border-amber-400/20 bg-amber-400/[0.04] px-3 py-1.5 font-mono text-[11px] text-amber-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
          status: building
        </div>

        <h1 className="font-mono text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-6xl">
          $ sansxel build
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-400 sm:text-lg sm:leading-8">
          Developer console + full API docs land here. SDKs, quickstarts,
          live request inspector, usage dashboards, key management. Until
          then, grab a key + read the REST quickstart on the main site.
        </p>

        {/* Two-column action grid that reads like a CLI menu */}
        <div className="mt-12 grid gap-3 sm:grid-cols-2 sm:gap-4">
          <Link
            href="https://chat.sansxel.ai/account/keys"
            className="group flex items-start gap-3 rounded-md border border-white/10 bg-white/[0.02] px-5 py-4 transition hover:border-amber-400/30 hover:bg-amber-400/[0.03]"
          >
            <span className="mt-0.5 font-mono text-xs text-amber-400">$</span>
            <div className="flex-1">
              <div className="font-mono text-sm text-white">get-api-key</div>
              <div className="mt-1 text-xs text-neutral-500">
                Generate a bearer token for the REST API.
              </div>
            </div>
            <span className="font-mono text-xs text-neutral-600 transition group-hover:text-amber-300">→</span>
          </Link>
          <Link
            href="https://sansxel.ai/learn/sansxel-rest-api-quickstart"
            className="group flex items-start gap-3 rounded-md border border-white/10 bg-white/[0.02] px-5 py-4 transition hover:border-amber-400/30 hover:bg-amber-400/[0.03]"
          >
            <span className="mt-0.5 font-mono text-xs text-amber-400">$</span>
            <div className="flex-1">
              <div className="font-mono text-sm text-white">read-quickstart</div>
              <div className="mt-1 text-xs text-neutral-500">
                Auth + first request + streaming, in JS &amp; Python.
              </div>
            </div>
            <span className="font-mono text-xs text-neutral-600 transition group-hover:text-amber-300">→</span>
          </Link>
          <Link
            href="https://chat.sansxel.ai"
            className="group flex items-start gap-3 rounded-md border border-white/10 bg-white/[0.02] px-5 py-4 transition hover:border-amber-400/30 hover:bg-amber-400/[0.03]"
          >
            <span className="mt-0.5 font-mono text-xs text-amber-400">$</span>
            <div className="flex-1">
              <div className="font-mono text-sm text-white">open-workshop</div>
              <div className="mt-1 text-xs text-neutral-500">
                Try the product first if you haven&apos;t already.
              </div>
            </div>
            <span className="font-mono text-xs text-neutral-600 transition group-hover:text-amber-300">→</span>
          </Link>
          <div className="flex items-start gap-3 rounded-md border border-white/[0.06] bg-white/[0.01] px-5 py-4 opacity-60">
            <span className="mt-0.5 font-mono text-xs text-neutral-600">$</span>
            <div className="flex-1">
              <div className="font-mono text-sm text-neutral-400">view-docs</div>
              <div className="mt-1 text-xs text-neutral-600">
                Coming soon. Full API surface + SDK reference.
              </div>
            </div>
            <span className="font-mono text-xs text-neutral-700">—</span>
          </div>
        </div>

        {/* Quick code preview, sets developer tone */}
        <div className="mt-14">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-600">
            preview · POST /api/v1/chat
          </div>
          <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/60 p-4 font-mono text-[12px] leading-6 text-neutral-200">
{`curl https://sansxel.ai/api/v1/chat \\
  -H "Authorization: Bearer $SANSXEL_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"hello"}],"stream":true}'`}
          </pre>
        </div>
      </div>

      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-5 font-mono text-[11px] text-neutral-600 sm:px-8">
          <span>platform.sansxel.ai</span>
          <span>v0 · placeholder</span>
        </div>
      </footer>
    </main>
  );
}
