"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

type NavGroup = {
  label: string;
  items: NavItem[];
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

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M8 2v7M5 6l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 11v1a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function UpdatesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M4 3.5h5l3 3v6A1.5 1.5 0 0 1 10.5 14h-6A1.5 1.5 0 0 1 3 12.5v-7A2 2 0 0 1 5 3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 3.5v3h3M5.5 9h5M5.5 11.5h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Note: chat history moved to <ChatHistoryRail /> on the right side
// of the workshop. The function below is now unused inside the left
// sidebar but kept for the file's exports staying stable; deletion
// can happen in the cleanup pass.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _RecentChats({ compact = false }: { compact?: boolean }) {
  const [threads, setThreads] = useState<Array<{ id: string; title: string }> | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/threads", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) { setThreads([]); setLoading(false); }
          return;
        }
        const data = (await res.json()) as { threads?: Array<{ id: string; title: string }> };
        if (!cancelled) { setThreads(data.threads ?? []); setLoading(false); }
      } catch {
        if (!cancelled) { setThreads([]); setLoading(false); }
      }
    };
    void load();

    // Refresh signals: chat sends fire 'sansxel:threads:changed';
    // tab focus picks up threads created on another device.
    const onChanged = () => { void load(); };
    const onFocus = () => { void load(); };
    if (typeof window !== "undefined") {
      window.addEventListener("sansxel:threads:changed", onChanged);
      window.addEventListener("focus", onFocus);
    }
    return () => {
      cancelled = true;
      if (typeof window !== "undefined") {
        window.removeEventListener("sansxel:threads:changed", onChanged);
        window.removeEventListener("focus", onFocus);
      }
    };
  }, [pathname]);

  const handleNew = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/app?new=1";
    }
  };

  // In the compact (account routes) mode, just render a small + New
  // chat button — the big history list is reserved for /app where
  // it's actually useful.
  if (compact) {
    return (
      <button
        type="button"
        onClick={handleNew}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-400 transition hover:bg-white/5 hover:text-neutral-100"
      >
        <span aria-hidden className="text-base">＋</span>
        <span>New chat</span>
      </button>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        onClick={handleNew}
        className="mb-2 flex items-center gap-2 rounded-lg border border-violet-400/30 bg-violet-400/5 px-3 py-2 text-xs font-semibold text-violet-200 transition hover:border-violet-400/60 hover:bg-violet-400/10"
      >
        <span aria-hidden>＋</span>
        <span>New chat</span>
      </button>
      <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
        History
      </div>
      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1">
        {loading && (
          <div className="px-3 py-1 text-[11px] text-neutral-600">Loading…</div>
        )}
        {!loading && (!threads || threads.length === 0) && (
          <div className="px-3 py-1 text-[11px] text-neutral-600">
            Nothing yet — start a chat below.
          </div>
        )}
        {!loading && threads && threads.map((t) => (
          <Link
            key={t.id}
            href={`/app?thread=${t.id}`}
            className="truncate rounded-lg px-3 py-1.5 text-xs text-neutral-400 transition hover:bg-white/5 hover:text-neutral-100"
            title={t.title}
          >
            {t.title}
          </Link>
        ))}
      </div>
    </div>
  );
}

function MobileThreadList({ onNavigate }: { onNavigate: () => void }) {
  const [threads, setThreads] = useState<Array<{ id: string; title: string }> | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/threads", { cache: "no-store" });
        if (!res.ok) { if (!cancelled) { setThreads([]); setLoading(false); } return; }
        const data = (await res.json()) as { threads?: Array<{ id: string; title: string }> };
        if (!cancelled) { setThreads(data.threads ?? []); setLoading(false); }
      } catch {
        if (!cancelled) { setThreads([]); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="px-3 py-2 text-xs text-neutral-500">Loading…</div>;
  if (!threads || threads.length === 0) {
    return <div className="px-3 py-2 text-xs text-neutral-500">No chats yet — start one below.</div>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      {threads.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => { router.replace(`/app?thread=${t.id}`); onNavigate(); }}
          className="truncate rounded-lg px-3 py-2 text-left text-sm text-neutral-300 transition hover:bg-white/5 hover:text-white"
          title={t.title}
        >
          {t.title}
        </button>
      ))}
    </div>
  );
}

function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M2.5 3.5h11a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H6L3 14V11.5H2.5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function BillingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1.5 6.5h13" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 9.5h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// Workshop stations. Chat moved out — it lives in the dedicated
// right-side history rail next to the canvas. Make group dropped
// because it had only one item that no longer belongs here.
const navGroups: NavGroup[] = [
  {
    label: "Brain",
    items: [
      { href: "/account/memory",       label: "Memory",       icon: <MemoryIcon /> },
      { href: "/account/integrations", label: "Integrations", icon: <IntegrationsIcon /> },
      { href: "/account/keys",         label: "API Keys",     icon: <KeyIcon /> },
    ],
  },
  {
    label: "Shop",
    items: [
      { href: "/account",              label: "Overview",     icon: <OverviewIcon /> },
      { href: "/account/billing",      label: "Billing",      icon: <BillingIcon /> },
      { href: "/account/usage",        label: "Usage",        icon: <UsageIcon /> },
    ],
  },
  {
    label: "Bench",
    items: [
      { href: "/account/settings",     label: "Settings",     icon: <SettingsIcon /> },
      { href: "/account/updates",      label: "Updates",      icon: <UpdatesIcon /> },
      { href: "/account/download",     label: "Desktop",      icon: <DownloadIcon /> },
    ],
  },
];

export function DashboardNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const inWorkshop = pathname === "/app" || pathname.startsWith("/app/");
  // ChatGPT-style mobile drawer for chat history.
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Close the drawer whenever the route changes (user navigated).
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  const handleNewChat = () => {
    // Clear canvas only — don't pre-create a thread (was polluting
    // the rail with empty placeholder entries on every click). The
    // chat route creates the thread server-side on first send.
    router.replace("/app?new=1");
  };

  function isActive(href: string) {
    if (href === "/account") return pathname === "/account";
    if (href === "/app") return pathname === "/app";
    return pathname.startsWith(href);
  }

  // Mobile bottom bar — one item per conceptual area so the slots
  // don't waste space on redundant pages (Overview + Billing both
  // being Shop items felt like duplicates on portrait phones).
  const mobileBarItems: NavItem[] = [
    { href: "/app",                  label: "Chat",     icon: <ChatIcon /> },
    navGroups[0].items[0],          // Brain  → Memory
    navGroups[1].items[1],          // Shop   → Billing
    navGroups[2].items[0],          // Bench  → Settings
    navGroups[2].items[2],          // Bench  → Desktop (primary CTA)
  ];

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
      {/* ── Desktop sidebar (Workshop shell) ─────────────────────── */}
      {/* No outer overflow on the aside — child .flex-1 chat-history
          column owns its own scroll so the brand + new-chat stay
          pinned at top and the desktop CTA + footer stay pinned at
          bottom, ChatGPT-style. */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-white/10 px-4 lg:flex">
        <Link href="/app" className="flex items-center gap-2.5 py-6">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] p-1.5">
            <Image src="/icon.png" alt="sansxel" width={20} height={20} className="h-5 w-5 object-contain" priority />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-white">sansxel</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-violet-300/70">Workshop</span>
          </div>
        </Link>

        {/* Chat link always visible regardless of route. + New chat
            button sits right below it — primary action for starting
            fresh, easy to spot under the Chat link no matter which
            workshop page the user is on. */}
        <Link
          href="/app"
          className={`mb-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            isActive("/app")
              ? "bg-white/10 text-white"
              : "text-neutral-200 hover:bg-white/5 hover:text-white"
          }`}
        >
          <ChatIcon />
          Chat
        </Link>

        <nav className="flex flex-col gap-3">
          {navGroups.map((group) => (
            <div key={group.label} className="flex flex-col gap-0.5">
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                {group.label}
              </div>
              {group.items.map(navLink)}
            </div>
          ))}
        </nav>

        {/* Get-Desktop CTA — pinned, always visible, the workshop's
            primary upgrade path. Web is the trial, desktop is the
            real shop. */}
        <Link
          href="/download"
          className="mt-4 rounded-xl border border-violet-400/30 bg-gradient-to-br from-violet-500/[0.12] to-fuchsia-500/[0.08] p-3 text-xs transition hover:border-violet-400/60 hover:from-violet-500/[0.18] hover:to-fuchsia-500/[0.12]"
        >
          <div className="mb-1 flex items-center gap-1.5 font-semibold text-violet-100">
            <span aria-hidden>🖥</span>
            <span>Workshop on desktop</span>
          </div>
          <div className="text-[11px] leading-snug text-neutral-300">
            Files, MCP, full voice loop. The real shop lives outside the browser.
          </div>
          <div className="mt-1.5 text-[11px] font-medium text-violet-300">Get desktop →</div>
        </Link>

        <div className="mt-auto pb-6 pt-4">
          <div className="mb-2 truncate px-3 text-xs text-neutral-500">{userEmail}</div>

          <Link
            href="/home"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-400 transition hover:bg-white/5 hover:text-neutral-100"
          >
            <HomeIcon />
            Marketing site
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

      {/* ── Mobile: sticky top bar (hamburger + brand + home + sign out) */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/[0.08] bg-neutral-950/95 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-2">
          {/* Hamburger only matters on /app where chats live —
              elsewhere there's no chat history to surface. */}
          {inWorkshop && (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-neutral-200 transition hover:bg-white/10"
              aria-label="Open chat history"
            >
              <HamburgerIcon />
            </button>
          )}
          <Link href="/app" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] p-1">
              <Image src="/icon.png" alt="sansxel" width={18} height={18} className="h-full w-full object-contain" priority />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-white">sansxel</span>
              <span className="text-[8.5px] uppercase tracking-[0.18em] text-violet-300/70">Workshop</span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          {userEmail && (
            <span className="hidden max-w-[140px] truncate text-xs text-neutral-500 sm:block">
              {userEmail}
            </span>
          )}
          <Link
            href="/home"
            className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-neutral-300 transition hover:bg-white/10 hover:text-white"
            title="Return to home"
          >
            <HomeIcon />
            <span className="hidden xs:inline sm:inline">Home</span>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-neutral-400 transition hover:bg-white/10 hover:text-white"
          >
            <SignOutIcon />
            <span className="hidden xs:inline sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* ── Mobile: chat history drawer (slides in from left) ───── */}
      {drawerOpen && (
        <>
          <button
            type="button"
            aria-label="Close chat history"
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
          />
          <aside className="fixed inset-y-0 left-0 z-[55] flex w-[82vw] max-w-[320px] flex-col border-r border-white/[0.08] bg-neutral-950/98 lg:hidden chat-drawer-in">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-300/85">
                Chat history
              </span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-md px-2 py-1 text-sm text-neutral-400 hover:bg-white/5 hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <button
              type="button"
              onClick={() => { handleNewChat(); setDrawerOpen(false); }}
              className="m-3 flex items-center gap-2 rounded-lg border border-violet-400/30 bg-violet-400/[0.08] px-3 py-2.5 text-sm font-semibold text-violet-200 transition hover:border-violet-400/60 hover:bg-violet-400/[0.16]"
            >
              <span aria-hidden className="text-base leading-none">＋</span>
              <span>New chat</span>
            </button>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-4">
              <MobileThreadList onNavigate={() => setDrawerOpen(false)} />
            </div>
          </aside>
        </>
      )}

      {/* ── Mobile: fixed bottom nav bar ─────────────────────────────── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 overflow-x-auto border-t border-white/[0.08] bg-neutral-950/95 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex min-w-full items-stretch">
          {mobileBarItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-[68px] flex-1 flex-col items-center justify-center gap-1 py-2.5 text-center transition-colors ${
                isActive(item.href)
                  ? "text-white"
                  : "text-neutral-600 hover:text-neutral-300"
              }`}
            >
              {item.icon}
              <span className="text-[9px] leading-none">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
