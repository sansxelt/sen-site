import type { ReactNode } from "react";
import { ZoneShell } from "@/components/zone-shell";
import { isVraelisRequest } from "@/lib/site-host";

// /signin gets the zone-aware shell on sansxel hosts (workshop /
// platform chrome). On vraelis it skips that entirely — the root
// layout already provides the light body + vraelis stylesheets, so we
// render a clean, product-first sign-in surface with just the brand and
// a "back to site" link. No promo banner on auth pages (trust > social).
export default async function SignInLayout({ children }: { children: ReactNode }) {
  if (await isVraelisRequest()) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ padding: "20px var(--gutter)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: "rgba(250, 248, 244, 0.86)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottom: "1px solid var(--line-1)" }}>
          <a
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              fontFamily: "var(--font-display)",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              color: "var(--fg-1)",
              textDecoration: "none",
            }}
          >
            Vraelis
          </a>
          <a
            href="/"
            style={{
              display: "flex",
              width: "fit-content",
              alignItems: "center",
              gap: 7,
              fontSize: 14,
              fontWeight: 500,
              color: "var(--fg-2)",
              textDecoration: "none",
              border: "1px solid var(--line-3)",
              borderRadius: 999,
              padding: "8px 16px",
              whiteSpace: "nowrap",
            }}
          >
            <span aria-hidden>←</span> Back to site
          </a>
          </div>
        </div>
        <div style={{ flex: 1, display: "grid", placeItems: "center" }}>{children}</div>
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
