"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

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

  async function handleSignOut() {
    setSigningOut(true);
    setOpen(false);
    try {
      await signOut({ redirect: false });
      window.location.href = "/home";
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={email}
        disabled={signingOut}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-sm font-semibold text-neutral-100 transition hover:border-white/25 hover:bg-white/[0.12] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 disabled:opacity-50"
      >
        {signingOut ? (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        ) : initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 overflow-hidden rounded-xl border border-white/10 bg-neutral-950 shadow-[0_18px_48px_rgba(0,0,0,0.45)]"
        >
          <div className="px-3 py-2.5 border-b border-white/[0.06]">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">Signed in</div>
            <div className="mt-0.5 truncate text-xs text-neutral-300" title={email}>{email}</div>
          </div>

          <div className="py-1">
            {[
              { href: "/account",          label: "Account" },
              { href: "/account/settings", label: "Settings" },
              { href: "/account/usage",    label: "Usage" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-sm text-neutral-300 transition hover:bg-white/[0.05] hover:text-white"
              >
                {link.label}
              </Link>
            ))}

            {isAdmin && (
              <Link
                href="/account/content"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-sm text-violet-300 transition hover:bg-white/[0.05] hover:text-white"
              >
                Admin
              </Link>
            )}
          </div>

          <div className="border-t border-white/[0.06] py-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => void handleSignOut()}
              className="block w-full px-3 py-2 text-left text-sm text-neutral-500 transition hover:bg-white/[0.05] hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
