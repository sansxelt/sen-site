import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { getZone, ZONE_THEME, type Zone } from "@/lib/zone";

// Wraps an auth/checkout page in a thin zone-aware shell:
//   - per-zone background color
//   - top bar with the zone pinwheel + wordmark + tagline + a back
//     link, edge-aligned across breakpoints to match the marketing
//     site nav rhythm so every surface reads as the same site
//   - per-zone font (mono on platform)
// The page content lives unchanged inside <main>; the shell handles
// the chrome so each subdomain's auth flow feels native.

export async function ZoneShell({
  children,
  // Optional override, useful when a page wants to force a specific
  // zone (e.g. testing the platform variant from any host).
  zoneOverride,
  // Hide the top-right back link entirely. Rare; usually prefer
  // backHrefOverride to redirect it somewhere useful.
  hideBackLink = false,
  // Override where the back link points + how it's labeled. /signin
  // uses this to send unauth visitors back to the marketing home
  // instead of the per-zone workshop, since the workshop is auth
  // gated and looping users back to /signin is bad.
  backHrefOverride,
  backLabelOverride,
  // Widen the inner content column from the default max-w-3xl
  // (768px) to max-w-6xl (1152px). Used by /signin where the
  // two-column auth + OAuth layout needs real horizontal room.
  wide = false,
}: {
  children: ReactNode;
  zoneOverride?: Zone;
  hideBackLink?: boolean;
  backHrefOverride?: string;
  backLabelOverride?: string;
  wide?: boolean;
}) {
  const zone = zoneOverride ?? (await getZone());
  const t = ZONE_THEME[zone];
  const defaultHomeHref =
    zone === "chat"
      ? "https://chat.vraelis.com"
      : zone === "platform"
        ? "https://platform.vraelis.com"
        : "https://vraelis.com";
  const defaultHomeLabel =
    zone === "chat" ? "← workshop" : zone === "platform" ? "← platform" : "← vraelis.com";
  const homeHref = backHrefOverride ?? defaultHomeHref;
  const homeLabel = backLabelOverride ?? defaultHomeLabel;

  return (
    <div className={`min-h-screen ${t.bg} text-neutral-100 ${t.font}`}>
      <header className="border-b border-white/[0.06]">
        {/* Edge-aligned chrome. Wordmark hugs the left edge, back
            link hugs the right edge. Same scaling pad as the
            marketing nav (site-shell): tighter on phones, comfy on
            wide monitors. Inner content below stays centered. */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 lg:px-10 xl:px-14 2xl:px-20">
          <Link
            href={zone === "platform" ? "https://platform.vraelis.com" : zone === "chat" ? "https://chat.vraelis.com" : "/home"}
            className="inline-flex shrink-0 items-center gap-2.5"
          >
            <Image
              src={t.logoSrc}
              alt="Vraelis"
              width={36}
              height={36}
              className="h-9 w-9 rounded-xl"
              priority
            />
            <div>
              <div className={`text-sm font-semibold tracking-tight text-white sm:text-base ${zone === "platform" ? "font-mono" : ""}`}>
                {t.label}
              </div>
              <div className="hidden text-[11px] leading-none text-neutral-500 sm:block">
                {t.tagline}
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            {!hideBackLink && (
              <Link
                href={homeHref}
                className={`text-[11px] text-neutral-500 transition hover:text-neutral-200 ${zone === "platform" ? "font-mono" : ""}`}
              >
                {homeLabel}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className={`mx-auto ${wide ? "max-w-6xl" : "max-w-3xl"} px-6 py-12 sm:px-8 sm:py-16`}>
        {children}
      </main>
    </div>
  );
}
