"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

// Header avatar dropdown for the marketing site nav. Sits next to
// the Apps button when signed in. Trigger is a 32px circle with the
// account's first initial, menu lists Overview / Settings / Billing
// / Usage / (Learn content if admin) / Sign out.

type Props = {
  email: string;
  isAdmin?: boolean;
};

export function AccountDropdown({ email, isAdmin = false }: Props) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = email.trim().charAt(0).toUpperCase() || "?";

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={email}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-sm font-semibold text-neutral-100 transition hover:border-white/25 hover:bg-white/[0.12] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden rounded-xl border border-white/10 bg-neutral-950 shadow-[0_18px_48px_rgba(0,0,0,0.45)]"
        >
          <div className="border-b border-white/[0.06] px-4 py-3">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
              Signed in
            </div>
            <div className="mt-1 truncate text-sm text-neutral-200" title={email}>
              {email}
            </div>
          </div>

          {[
            { href: "/account",          label: "Overview" },
            { href: "/account/settings", label: "Settings" },
            { href: "/account/plan",     label: "Plan" },
            { href: "/account/addons",   label: "Addons" },
            { href: "/account/credits",  label: "Credits" },
            { href: "/account/usage",    label: "Usage" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm text-neutral-200 transition hover:bg-white/[0.04] hover:text-white"
            >
              {link.label}
            </Link>
          ))}

          {isAdmin && (
            <Link
              href="/account/content"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block border-t border-white/[0.06] px-4 py-2.5 text-sm text-violet-200 transition hover:bg-white/[0.04] hover:text-white"
            >
              Learn content (admin)
            </Link>
          )}

          <button
            type="button"
            role="menuitem"
            disabled={signingOut}
            onClick={async () => {
              setOpen(false);
              setSigningOut(true);
              try {
                await signOut({ callbackUrl: "https://sansxel.ai" });
              } catch {
                setSigningOut(false);
              }
            }}
            className="block w-full border-t border-white/[0.06] px-4 py-2.5 text-left text-sm text-neutral-400 transition hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
