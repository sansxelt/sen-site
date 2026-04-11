import Link from "next/link";
import type { ReactNode } from "react";

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

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-neutral-950 text-neutral-100">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(96,165,250,0.12),transparent_22%)]" />

      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-neutral-950/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div>
              <div className="text-lg font-semibold tracking-tight text-white">
                sen
              </div>
              <div className="text-xs text-neutral-200">
                Ambient workspace memory
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-neutral-200 md:flex">
            {primaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/#auth"
              className="hidden rounded-xl border border-white/10 px-4 py-2 text-sm text-neutral-100 transition hover:bg-white/5 sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/account"
              className="sen-white-button rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
            >
              Open workspace
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 pt-20 md:pt-24">{children}</main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-8 text-sm text-neutral-200 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div>Copyright 2026 sen. Built for context, memory, and flow.</div>
          <div className="flex flex-wrap gap-5">
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
              href="mailto:hello@sen.app"
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
