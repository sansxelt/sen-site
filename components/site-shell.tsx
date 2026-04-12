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

      {/* ── Header — single clean row at every size ─────────────────── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08] bg-neutral-950/95 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">

            {/* Logo */}
            <Link href="/#top" className="flex shrink-0 items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] p-2">
                <Image
                  src="/icon.png"
                  alt="sansxel"
                  width={22}
                  height={22}
                  className="h-full w-full object-contain"
                  priority
                />
              </div>
              <div>
                <div className="text-sm font-semibold tracking-tight text-white sm:text-base">
                  sansxel
                </div>
                <div className="hidden text-[11px] leading-none text-neutral-500 sm:block">
                  Ambient workspace memory
                </div>
              </div>
            </Link>

            {/* Desktop nav — lg and above */}
            <nav className="hidden items-center gap-5 text-sm text-neutral-400 lg:flex">
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

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-2">
              {!signedIn && (
                <Link
                  href={getSignInPath("/account")}
                  className="hidden rounded-xl border border-white/10 px-3.5 py-2 text-sm text-neutral-300 transition hover:bg-white/5 hover:text-white sm:block"
                >
                  Sign in
                </Link>
              )}
              <Link
                href="/account"
                className="sansxel-white-button rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
              >
                {signedIn ? "My Account" : "Get started"}
              </Link>
            </div>

          </div>
        </div>
      </header>

      {/* pt-[66px] clears the ~65px fixed header */}
      <main className="relative z-10 flex-1 pt-[66px]">
        {children}
      </main>

      <footer className="border-t border-white/[0.08]">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="text-sm text-neutral-500">
              Copyright 2026 sansxel. Built for context, memory, and flow.
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm text-neutral-400">
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
        </div>
      </footer>
    </div>
  );
}
