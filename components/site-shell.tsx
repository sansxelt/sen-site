import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { auth } from "../auth";
import { isAdminEmail } from "../lib/admin";
import { getSignInPath } from "../lib/auth-ui";
import { getZone } from "../lib/zone";
import { AccountDropdown } from "./account-dropdown";
import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";
import { ZoneDropdown } from "./zone-dropdown";

// Pinwheel mark per host. Same geometry, different accent triangle.
// next/image auto-applies `unoptimized` for .svg sources in v16.
const ZONE_LOGO: Record<"apex" | "chat" | "platform", string> = {
  apex: "/logo-violet.svg",
  chat: "/logo-cyan.svg",
  platform: "/logo-amber.svg",
};

const footerGroups = [
  {
    label: "Product",
    links: [
      { href: "/product", label: "Product" },
      { href: "/learn", label: "Learn" },
      { href: "/pricing", label: "Pricing" },
      { href: "/download", label: "Download" },
    ],
  },
  {
    label: "Account",
    links: [
      { href: "/account", label: "Dashboard" },
      { href: "/account/download", label: "Download" },
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

// 'Features' and 'How it works' merged into a single Product page;
// 'Download' hidden from primary nav (still in footer + mobile
// drawer for signed-in users). Contact is back in the row by user
// request.
const primaryLinks: SiteNavLink[] = [
  { href: "/product", label: "Product" },
  { href: "/learn", label: "Learn" },
  { href: "/pricing", label: "Pricing" },
  { href: "/download", label: "Desktop", authOnly: true },
  { href: "/contact", label: "Contact" },
];

export async function SiteShell({ children }: { children: ReactNode }) {
  const [session, zone] = await Promise.all([auth(), getZone()]);
  const userEmail = session?.user?.email ?? "";
  const signedIn = Boolean(userEmail);
  const isAdmin = isAdminEmail(userEmail || null);
  const logoSrc = ZONE_LOGO[zone];

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-neutral-950 text-neutral-100">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(96,165,250,0.12),transparent_22%)]" />

      <header className="fixed inset-x-0 top-0 z-50 bg-neutral-950">
        <div className="px-4 py-3 sm:px-6 lg:px-10 xl:px-14 2xl:px-20">
          <div className="flex items-center justify-between gap-4">
            <div className="flex lg:flex-1 lg:justify-start">
              <Link href="/home" className="inline-flex shrink-0 items-center gap-2.5">
                <Image
                  src={logoSrc}
                  alt="sansxel"
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-xl"
                  priority
                />
                <div>
                  <div className="text-sm font-semibold tracking-tight text-white sm:text-base">
                    sansxel
                  </div>
                  <div className="hidden text-[11px] leading-none text-neutral-500 sm:block">
                    The AI workshop for makers
                  </div>
                </div>
              </Link>
            </div>

            <nav className="hidden items-center gap-6 text-sm text-neutral-300 lg:flex">
              {primaryLinks.filter((link) => !link.authOnly || signedIn).map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md whitespace-nowrap px-1 py-0.5 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="flex shrink-0 items-center gap-3 lg:flex-1 lg:justify-end">
              {/* Mobile drawer trigger, only renders on <lg screens */}
              <MobileNav
                links={primaryLinks.filter((l) => !l.authOnly || signedIn)}
                signedIn={signedIn}
                isAdmin={isAdmin}
                accessHref={signedIn ? "/app" : getSignInPath()}
              />

              <ThemeToggle />

              {/* Dropdown splits the primary CTA into the two real
                  product surfaces (workshop + platform) so users can
                  pick instead of being forced to one. */}
              <ZoneDropdown signedIn={signedIn} />

              {/* Account avatar pinned to the absolute right (signed-in
                  only). "Manage me" lives at the edge of the chrome,
                  past the primary CTA. */}
              {signedIn && (
                <AccountDropdown email={userEmail} isAdmin={isAdmin} />
              )}
            </div>
          </div>
        </div>
      </header>

      <main data-page-content className="relative z-10 flex-1 pt-[66px]">
        {children}
      </main>

      <footer className="mt-auto border-t border-white/[0.08]">
        <div className="mx-auto max-w-[1600px] px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-10 sm:grid-cols-[1fr_auto] lg:grid-cols-[1.4fr_repeat(3,auto)] lg:gap-16">
            <div className="flex flex-col gap-4">
              <Link href="/home" className="flex items-center gap-2.5">
                <Image
                  src={logoSrc}
                  alt="sansxel"
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-lg"
                />
                <span className="text-sm font-semibold text-white">sansxel</span>
              </Link>
              <p className="max-w-xs text-xs leading-relaxed text-neutral-500">
                The adaptive AI platform. One AI, infinite shapes, a contextual
                interface that reshapes itself around how you actually work.
              </p>
            </div>

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

          <div className="mt-10 border-t border-white/[0.06] pt-6 text-xs text-neutral-600">
            © 2026 sansxel. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
