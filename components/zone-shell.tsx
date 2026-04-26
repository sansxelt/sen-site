import Link from "next/link";
import type { ReactNode } from "react";
import { getZone, ZONE_THEME, type Zone } from "@/lib/zone";

// Wraps an auth/checkout page in a thin zone-aware shell:
//   - per-zone background color
//   - top bar with the zone wordmark + tagline + a back link to the
//     correct surface (workshop home / platform docs / marketing)
//   - per-zone accent dot + font
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
  // (https://sansxel.ai) instead of the per-zone workshop, since the
  // workshop is auth-gated and looping users back to /signin is bad.
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
      ? "https://chat.sansxel.ai"
      : zone === "platform"
        ? "https://platform.sansxel.ai"
        : "https://sansxel.ai";
  const defaultHomeLabel =
    zone === "chat" ? "← workshop" : zone === "platform" ? "← platform" : "← sansxel.ai";
  const homeHref = backHrefOverride ?? defaultHomeHref;
  const homeLabel = backLabelOverride ?? defaultHomeLabel;

  return (
    <div className={`min-h-screen ${t.bg} text-neutral-100 ${t.font}`}>
      <header className="border-b border-white/[0.06]">
        {/* Header sits at the screen edges, not centered in the
            content column. Same scaling pad pattern as the marketing
            nav (site-shell): tighter on phones, comfy on wide
            monitors. Inner content below stays centered. */}
        <div className="flex items-center justify-between px-4 py-5 sm:px-6 sm:py-6 lg:px-10 xl:px-14 2xl:px-20">
          <div className="flex items-center gap-3">
            <div className={`h-2.5 w-2.5 rounded-full ${t.accent.replace("text-", "bg-")} shadow-[0_0_10px_currentColor] opacity-90`} />
            <div className="flex flex-col gap-1.5 leading-none">
              <div className={`text-[13px] font-semibold tracking-tight text-white ${zone === "platform" ? "font-mono" : ""}`}>
                {t.label}
              </div>
              <div className="text-[10px] tracking-wide text-neutral-500">
                {t.tagline}
              </div>
            </div>
          </div>
          {!hideBackLink && (
            <Link
              href={homeHref}
              className={`text-[11px] text-neutral-500 transition hover:text-neutral-200 ${zone === "platform" ? "font-mono" : ""}`}
            >
              {homeLabel}
            </Link>
          )}
        </div>
      </header>

      <main className={`mx-auto ${wide ? "max-w-6xl" : "max-w-3xl"} px-6 py-12 sm:px-8 sm:py-16`}>
        {children}
      </main>
    </div>
  );
}
