import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { auth } from "../auth";
import { getSignInPath } from "../lib/auth-ui";

const footerGroups = [
  {
    label: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/function", label: "Function" },
      { href: "/pricing", label: "Pricing" },
      { href: "/download", label: "Download" },
    ],
  },
  {
    label: "Account",
    links: [
      { href: "/account", label: "Dashboard" },
      { href: "/account/updates", label: "Updates" },
      { href: "/account/integrations", label: "Integrations" },
      { href: "/account/usage", label: "Usage" },
    ],
  },
  {
    label: "Company",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/contact", label: "Contact" },
    ],
  },
];

type SiteNavLink = {
  href: string;
  label: string;
  authOnly?: boolean;
};

const primaryLinks: SiteNavLink[] = [
  { href: "/home", label: "Home" },
  { href: "/features", label: "Features" },
  { href: "/function", label: "Function" },
  { href: "/pricing", label: "Pricing" },
  { href: "/download", label: "Download", authOnly: true },
];


export async function SiteShell({ children }: { children: ReactNode }) {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-neutral-950 text-neutral-100">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(96,165,250,0.12),transparent_22%)]" />

      {/* ── Header — single clean row at every size ─────────────────── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08] bg-neutral-950/95 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="relative flex items-center justify-between gap-4">

            {/* Logo */}
            <Link href="/home" className="flex shrink-0 items-center gap-2.5">
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

            {/* Desktop nav — absolutely centered */}
            <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-5 text-sm text-neutral-400 lg:flex">
              {primaryLinks.filter((link) => !link.authOnly || signedIn).map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="whitespace-nowrap transition hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/contact"
                className="whitespace-nowrap transition hover:text-white"
              >
                Contact
              </Link>
            </nav>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={signedIn ? "/account" : getSignInPath()}
                className="sansxel-white-button rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
              >
                {signedIn ? "My Account" : "Access"}
              </Link>
            </div>

          </div>
        </div>
      </header>

      {/* pt-[66px] clears the ~65px fixed header */}
      <main className="relative z-10 flex-1 pt-[66px]">
        {children}
      </main>

      <footer className="mt-auto border-t border-white/[0.08]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          {/* Top row: brand + link groups */}
          <div className="grid gap-10 sm:grid-cols-[1fr_auto] lg:grid-cols-[1.4fr_repeat(3,auto)] lg:gap-16">
            {/* Brand */}
            <div className="flex flex-col gap-4">
              <Link href="/home" className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] p-1.5">
                  <Image src="/icon.png" alt="sansxel" width={18} height={18} className="h-full w-full object-contain" />
                </div>
                <span className="text-sm font-semibold text-white">sansxel</span>
              </Link>
              <p className="max-w-xs text-xs leading-relaxed text-neutral-500">
                Ambient workspace memory that keeps context between sessions, so resuming work feels instant.
              </p>
            </div>

            {/* Link groups */}
            {footerGroups.map((group) => (
              <div key={group.label} className="flex flex-col gap-3">
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-600">
                  {group.label}
                </div>
                <div className="flex flex-col gap-2.5">
                  {group.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="text-sm text-neutral-400 transition hover:text-white"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom row: copyright */}
          <div className="mt-10 border-t border-white/[0.06] pt-6 text-xs text-neutral-600">
            Copyright 2026 sansxel. Built for context, memory, and flow.
          </div>
        </div>
      </footer>
    </div>
  );
}
