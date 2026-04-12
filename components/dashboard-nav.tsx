"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

function OverviewIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="6" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9.5 8h5M13 6.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function UsageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M2 12 L5 8 L8 10 L11 5 L14 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 1.5V3M8 13v1.5M1.5 8H3M13 8h1.5M3.2 3.2l1.06 1.06M11.74 11.74l1.06 1.06M3.2 12.8l1.06-1.06M11.74 4.26l1.06-1.06" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10.5 11 14 8l-3.5-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M2 7l6-5 6 5v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 14V9h4v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M2 4h12M5 4V2.5A.5.5 0 0 1 5.5 2h5a.5.5 0 0 1 .5.5V4M6 7v5M10 7v5M3 4l1 9.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5L13 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MemoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M8 2C5.24 2 3 4.02 3 6.5c0 1.3.57 2.48 1.5 3.3V12a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5V9.8A4.43 4.43 0 0 0 13 6.5C13 4.02 10.76 2 8 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 12.5V14M10 12.5V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IntegrationsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <rect x="1" y="5" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="10" y="5" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 7.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 3v2M8 11v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function UpdatesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M8 2v7M5 6l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 11v1a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const navItems: NavItem[] = [
  { href: "/account",              label: "Overview",     icon: <OverviewIcon /> },
  { href: "/account/memory",       label: "Memory",       icon: <MemoryIcon /> },
  { href: "/account/keys",         label: "API Keys",     icon: <KeyIcon /> },
  { href: "/account/integrations", label: "Integrations", icon: <IntegrationsIcon /> },
  { href: "/account/updates",      label: "Updates",      icon: <UpdatesIcon /> },
  { href: "/account/usage",        label: "Usage",        icon: <UsageIcon /> },
  { href: "/account/settings",     label: "Settings",     icon: <SettingsIcon /> },
];

export function DashboardNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/account") return pathname === "/account";
    return pathname.startsWith(href);
  }

  const navLink = (item: NavItem) => (
    <Link
      key={item.href}
      href={item.href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        isActive(item.href)
          ? "bg-white/10 text-white"
          : "text-neutral-400 hover:bg-white/5 hover:text-neutral-100"
      }`}
    >
      {item.icon}
      {item.label}
    </Link>
  );

  return (
    <>
      {/* ── Desktop sidebar ──────────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-white/10 px-4 lg:flex">
        <Link href="/#top" className="flex items-center gap-2.5 py-6">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] p-1.5">
            <Image src="/icon.png" alt="sansxel" width={20} height={20} className="h-5 w-5 object-contain" priority />
          </div>
          <span className="text-sm font-semibold text-white">sansxel</span>
        </Link>

        <nav className="flex flex-col gap-0.5">
          {navItems.map(navLink)}
        </nav>

        <div className="mt-auto pb-6 pt-4">
          <div className="mb-2 truncate px-3 text-xs text-neutral-500">{userEmail}</div>

          <Link
            href="/#top"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-400 transition hover:bg-white/5 hover:text-neutral-100"
          >
            <HomeIcon />
            Return to home
          </Link>

          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-400 transition hover:bg-white/5 hover:text-neutral-100"
          >
            <SignOutIcon />
            Sign out
          </button>

          <div className="my-2 border-t border-white/[0.06]" />

          <Link
            href="/account/settings#danger"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-500/70 transition hover:bg-red-500/5 hover:text-red-400"
          >
            <TrashIcon />
            Delete account
          </Link>
        </div>
      </aside>

      {/* ── Mobile: sticky top bar (logo + sign out only) ────────────── */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/[0.08] bg-neutral-950/95 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Link href="/#top" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] p-1">
            <Image src="/icon.png" alt="sansxel" width={18} height={18} className="h-full w-full object-contain" priority />
          </div>
          <span className="text-sm font-semibold text-white">sansxel</span>
        </Link>

        <div className="flex items-center gap-2">
          {userEmail && (
            <span className="hidden max-w-[160px] truncate text-xs text-neutral-500 sm:block">
              {userEmail}
            </span>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-neutral-400 transition hover:bg-white/10 hover:text-white"
          >
            <SignOutIcon />
            Sign out
          </button>
        </div>
      </header>

      {/* ── Mobile: fixed bottom nav bar ─────────────────────────────── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 flex items-stretch border-t border-white/[0.08] bg-neutral-950/95 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-center transition-colors ${
              isActive(item.href)
                ? "text-white"
                : "text-neutral-600 hover:text-neutral-300"
            }`}
          >
            {item.icon}
            <span className="text-[9px] leading-none">{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
