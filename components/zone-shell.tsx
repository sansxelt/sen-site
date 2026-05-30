import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { getZone, ZONE_THEME, type Zone } from "@/lib/zone";

export async function ZoneShell({
  children,
  zoneOverride,
  hideBackLink = false,
  backHrefOverride,
  backLabelOverride,
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
      ? "/chat"
      : zone === "platform"
        ? "/platform"
        : "/home";
  const defaultHomeLabel =
    zone === "chat" ? "← Go back" : zone === "platform" ? "← platform" : "← Go back";
  const homeHref  = backHrefOverride  ?? defaultHomeHref;
  const homeLabel = backLabelOverride ?? defaultHomeLabel;

  return (
    <div className={`min-h-screen ${t.bg} text-neutral-100 ${t.font}`}>
      <header className="border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 lg:px-10 xl:px-14 2xl:px-20">
          <Link
            href={zone === "platform" ? "/platform" : zone === "chat" ? "/chat" : "/home"}
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
