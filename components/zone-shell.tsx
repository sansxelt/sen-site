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
}: {
  children: ReactNode;
  zoneOverride?: Zone;
}) {
  const zone = zoneOverride ?? (await getZone());
  const t = ZONE_THEME[zone];
  const homeHref =
    zone === "chat"
      ? "https://chat.sansxel.ai"
      : zone === "platform"
        ? "https://platform.sansxel.ai"
        : "https://sansxel.ai";
  const homeLabel =
    zone === "chat" ? "← workshop" : zone === "platform" ? "← platform" : "← sansxel.ai";

  return (
    <div className={`min-h-screen ${t.bg} text-neutral-100 ${t.font}`}>
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5 sm:px-8 sm:py-6">
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
          <Link
            href={homeHref}
            className={`text-[11px] text-neutral-500 transition hover:text-neutral-200 ${zone === "platform" ? "font-mono" : ""}`}
          >
            {homeLabel}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 sm:px-8 sm:py-16">
        {children}
      </main>
    </div>
  );
}
