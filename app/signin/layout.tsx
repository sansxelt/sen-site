import type { ReactNode } from "react";
import { ZoneShell } from "@/components/zone-shell";
import { isVraelisRequest } from "@/lib/site-host";
import { SignInHeader } from "./signin-header";

// /signin gets the zone-aware shell on sansxel hosts (workshop /
// platform chrome). On vraelis it skips that entirely — the root
// layout already provides the light body + vraelis stylesheets, so we
// render a clean, product-first sign-in surface with just the brand and
// a "back to site" link. No promo banner on auth pages (trust > social).
export default async function SignInLayout({ children }: { children: ReactNode }) {
  if (await isVraelisRequest()) {
    return (
      // Homepage-style surface: a transparent-until-scroll bar over the hero glow + faint grid, which bleed
      // up behind it. The content column SCROLLS (min-height, not fixed 100dvh grid) and is top-padded rather
      // than vertically centered, so a tall form — the create-account panel with Terms, Google, GitHub, and
      // the email fields — is always fully reachable without being clipped at the bottom of the viewport.
      <div style={{ position: "relative", minHeight: "100dvh", overflow: "clip" }}>
        {/* atmosphere: same bloom + hairline grid the homepage hero uses, bleeding up behind the bar */}
        <div className="glow glow--bleed" aria-hidden />
        <div className="grid-faint" style={{ opacity: 0.5 }} aria-hidden />
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
          <SignInHeader />
          <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "clamp(24px, 5vh, 64px) var(--gutter) 64px" }}>
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <ZoneShell
      wide
      backHrefOverride="https://vraelis.com/home"
      backLabelOverride="← Go back"
    >
      {children}
    </ZoneShell>
  );
}
