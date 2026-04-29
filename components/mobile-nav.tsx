"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Link = { href: string; label: string };

type Props = {
  links:       Link[];
  secondary?:  Link[];
  signedIn:    boolean;
  isAdmin?:    boolean;
  accessHref:  string;
};

/**
 * Mobile-only nav drawer for viewports below `lg`.  The desktop nav in
 * SiteShell already has `lg:flex` so it disappears below 1024px, this
 * component fills that gap: a hamburger button in the header that opens
 * a right-hand drawer with all primary + contact links and the
 * account / access CTA.
 *
 * Uses the same PageTransition click interceptor the rest of the site
 * does, so tapping a link triggers the blackout transition automatically
 * and the drawer stays open just long enough for the user to see their
 * tap register before the new page fades in.  We close the drawer on
 * every pathname change to keep state tidy.
 */
export function MobileNav({ links, secondary, signedIn, isAdmin = false, accessHref }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // Esc to close + scroll lock while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {/* Hamburger, only visible below lg, sits before the Access button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-neutral-200 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-[9995] bg-black/70 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => setOpen(false)}
              aria-hidden
            />

            {/* Drawer, slides from the right */}
            <motion.nav
              key="drawer"
              className="fixed inset-y-0 right-0 z-[9996] flex w-[84vw] max-w-sm flex-col border-l border-white/10 bg-neutral-950 lg:hidden"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              aria-label="Mobile menu"
            >
              {/* Drawer header, close button + label */}
              <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
                <span className="text-sm font-semibold text-white">Menu</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-neutral-300 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* Primary links */}
              <div className="flex-1 overflow-y-auto overscroll-contain px-2 py-3">
                {links.map((link) => {
                  const active = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`block rounded-xl px-3 py-3 text-[15px] font-medium transition ${
                        active
                          ? "bg-white/10 text-white"
                          : "text-neutral-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}

                {secondary && secondary.length > 0 && (
                  <>
                    <div className="mx-3 my-2 h-px bg-white/[0.06]" />
                    {secondary.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="block rounded-xl px-3 py-3 text-sm text-neutral-400 transition hover:bg-white/5 hover:text-white"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </>
                )}

                {signedIn && (
                  <>
                    <div className="mx-3 mb-1 mt-3 px-1 text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                      Account
                    </div>
                    {[
                      { href: "/account",          label: "Overview" },
                      { href: "/account/settings", label: "Settings" },
                      { href: "/account/plan",     label: "Plan" },
                      { href: "/account/addons",   label: "Addons" },
                      { href: "/account/credits",  label: "Credits" },
                      { href: "/account/usage",    label: "Usage" },
                      ...(isAdmin
                        ? [{ href: "/account/content", label: "Learn content (admin)" }]
                        : []),
                    ].map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="block rounded-xl px-3 py-3 text-[15px] font-medium text-neutral-300 transition hover:bg-white/5 hover:text-white"
                      >
                        {link.label}
                      </Link>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        void signOut({ callbackUrl: "/" });
                      }}
                      className="mt-1 block w-full rounded-xl px-3 py-3 text-left text-sm text-neutral-400 transition hover:bg-white/5 hover:text-white"
                    >
                      Sign out
                    </button>
                  </>
                )}
              </div>

              {/* CTA pinned at bottom */}
              <div className="border-t border-white/[0.08] p-4">
                <Link
                  href={accessHref}
                  className="sansxel-white-button block rounded-xl bg-white px-5 py-3 text-center text-sm font-medium text-black transition hover:opacity-90"
                >
                  {signedIn ? "Open Workshop" : "Access"}
                </Link>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
