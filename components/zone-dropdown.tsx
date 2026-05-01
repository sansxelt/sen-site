"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Header dropdown, primary product CTA that splits into the two
// real surfaces (workshop + platform). Click the button to open;
// click outside or hit Escape to close. Click the link to navigate.
//
// Apps-only — account management lives in <AccountDropdown> next to
// this trigger so the chrome separates "where do I want to go" from
// "manage me". Used in the marketing site header in place of a
// single 'Open Workshop' / 'Try sansxel' button.

type Props = {
  signedIn: boolean;
};

export function ZoneDropdown({ signedIn }: Props) {
  const [open, setOpen] = useState(false);
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

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
      >
        <span>{signedIn ? "Apps" : "Try sansxel"}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden="true"
          className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M2 3.5L5 6.5L8 3.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 overflow-hidden rounded-xl border border-white/10 bg-neutral-950 shadow-[0_18px_48px_rgba(0,0,0,0.45)]"
        >
          <Link
            // Always send users to chat.sansxel.ai. The apex
            // marketing site can't see chat's session cookie
            // (auth.ts intentionally doesn't span subdomains), so
            // its `signedIn` is always false here. Sending people
            // to /signin on apex would set a cookie on the wrong
            // domain. chat.sansxel.ai handles its own auth gate:
            // signed-in users land at the workshop, signed-out
            // get bounced to /signin on the right domain.
            href="https://chat.sansxel.ai"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-start gap-3 border-b border-white/[0.06] px-4 py-3.5 transition hover:bg-white/[0.04]"
          >
            <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white">
                Open Workshop
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-neutral-500">
                chat.sansxel.ai
              </div>
              <div className="mt-1 text-xs leading-5 text-neutral-400">
                The product itself, chat, voice, files, image gen.
              </div>
            </div>
            <span aria-hidden className="mt-1 text-xs text-neutral-600">↗</span>
          </Link>

          <Link
            href="https://platform.sansxel.ai"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-start gap-3 px-4 py-3.5 transition hover:bg-white/[0.04]"
          >
            <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.7)]" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white">
                Open Platform
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-neutral-500">
                platform.sansxel.ai
              </div>
              <div className="mt-1 text-xs leading-5 text-neutral-400">
                Developer console, API keys, docs, usage.
              </div>
            </div>
            <span aria-hidden className="mt-1 text-xs text-neutral-600">↗</span>
          </Link>
        </div>
      )}
    </div>
  );
}
