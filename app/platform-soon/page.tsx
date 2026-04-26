import type { Metadata } from "next";
import Link from "next/link";

// Placeholder served at platform.sansxel.ai/ until the real
// developer console + docs land. Plain HTML, no shell — platform
// has its own zone identity.

export const metadata: Metadata = {
  title: "sansxel platform",
  description: "API docs and developer console for sansxel — coming soon.",
};

export default function PlatformSoonPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-6 px-6 py-16 sm:px-8">
        <div className="text-xs font-medium uppercase tracking-[0.22em] text-fuchsia-300">
          sansxel · platform
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
          Build with sansxel.
        </h1>
        <p className="max-w-xl text-base leading-7 text-neutral-300 sm:text-lg sm:leading-8">
          The developer console + full API docs are landing here soon.
          Until then, you can grab an API key + read the quickstart on
          the main site.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="https://chat.sansxel.ai/account/keys"
            className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
          >
            Get an API key →
          </Link>
          <Link
            href="https://sansxel.ai/learn/sansxel-rest-api-quickstart"
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
          >
            REST API quickstart
          </Link>
        </div>
        <div className="pt-8 text-xs text-neutral-500">
          <Link href="https://sansxel.ai" className="transition hover:text-neutral-300">
            ← sansxel.ai
          </Link>
        </div>
      </div>
    </main>
  );
}
