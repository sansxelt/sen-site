import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { auth } from "../auth";
import { getSignInPath } from "../lib/auth-ui";

const primaryLinks = [
  { href: "/#features", label: "Features" },
  { href: "/#how", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/account", label: "Account" },
  { href: "/download", label: "Access" },
];

const footerLinks = [
  { href: "/account", label: "Account" },
  { href: "/download", label: "Access" },
  { href: "/pricing", label: "Pricing" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
];

export async function SiteShell({ children }: { children: ReactNode }) {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-neutral-950 text-neutral-100">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(96,165,250,0.12),transparent_22%)]" />

      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-neutral-950/88 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-start justify-between gap-4 md:items-center">
            <Link href="/" className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] p-2">
                <Image
                  src="/icon.png"
                  alt="sansxel"
                  width={28}
                  height={28}
                  className="h-7 w-7 object-contain"
                  priority
                />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-semibold tracking-tight text-white">
                  sansxel
                </div>
                <div className="truncate text-xs text-neutral-200">
                  Ambient workspace memory
                </div>
              </div>
            </Link>

            <nav className="hidden items-center gap-6 text-sm text-neutral-200 md:flex">
              {primaryLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="whitespace-nowrap transition hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="hidden items-center gap-3 sm:flex">
              {!signedIn && (
                <Link
                  href={getSignInPath("/account")}
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm text-neutral-100 transition hover:bg-white/5"
                >
                  Sign in
                </Link>
              )}
              <Link
                href="/account"
                className="sansxel-white-button rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
              >
                {signedIn ? "Account" : "Open workspace"}
              </Link>
            </div>
          </div>

          <div className="mt-3 flex gap-3 sm:hidden">
            {!signedIn && (
              <Link
                href={getSignInPath("/account")}
                className="flex-1 rounded-xl border border-white/10 px-4 py-2 text-center text-sm text-neutral-100 transition hover:bg-white/5"
              >
                Sign in
              </Link>
            )}
            <Link
              href="/account"
              className={`sansxel-white-button rounded-xl bg-white px-4 py-2 text-center text-sm font-medium text-black transition hover:opacity-90 ${signedIn ? "flex-none" : "flex-1"}`}
            >
              {signedIn ? "Account" : "Open workspace"}
            </Link>
          </div>

          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 text-sm text-neutral-200 md:hidden">
            {primaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="whitespace-nowrap rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 transition hover:bg-white/10 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="relative z-10 flex-1 pt-32 sm:pt-24 md:pt-24">
        {children}
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 text-sm text-neutral-200 sm:px-6 lg:px-8">
          <div className="max-w-xl">
            Copyright 2026 sansxel. Built for context, memory, and flow.
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:gap-5">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            <a
              href="mailto:hello@sansxel.app"
              className="transition hover:text-white"
            >
              Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
