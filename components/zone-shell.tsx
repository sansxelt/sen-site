import Link from "next/link";
import type { ReactNode } from "react";

// Auth shell — used by /signin, /auth/*, /checkout.
// Uses the same visual language as the landing page.
export function ZoneShell({
  children,
  hideBackLink = false,
  backHrefOverride,
  backLabelOverride,
  wide = false,
}: {
  children: ReactNode;
  zoneOverride?: string;
  hideBackLink?: boolean;
  backHrefOverride?: string;
  backLabelOverride?: string;
  wide?: boolean;
}) {
  const backHref  = backHrefOverride  ?? "/home";
  const backLabel = backLabelOverride ?? "← Go back";

  // This shell is a fixed DARK surface (used by /signin, /auth/*, /checkout)
  // and its pages style text with Tailwind's text-white / text-neutral-*.
  // On the Vraelis host the cream theme overrides --background and --fg-1 to
  // LIGHT values, and a global `h1,h2,h3 { color: var(--fg-1) }` rule darkens
  // headings to near-black on this dark background (invisible). So we pin
  // explicit dark-theme colors here and re-assert a light heading colour for
  // descendants, independent of whichever theme tokens are loaded.
  return (
    <div className="zone-shell-dark" style={{
      minHeight: "100vh",
      background: "#0A0F18",
      color: "#ECEFF4",
      fontFamily: '"Inter Tight", var(--font-geist-sans), sans-serif',
    }}>
      <style>{`.zone-shell-dark h1,.zone-shell-dark h2,.zone-shell-dark h3,.zone-shell-dark h4{color:#ECEFF4;}`}</style>
      <header style={{
        position: "sticky", top: 0, zIndex: 40,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 clamp(20px,4vw,64px)",
        height: 64,
        background: "rgba(10,15,24,0.90)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <Link href="/home" style={{
          fontSize: 19, fontWeight: 600, letterSpacing: "-0.025em",
          color: "#ECEFF4", textDecoration: "none",
          fontFamily: '"Inter Tight", sans-serif',
        }}>
          vraelis<span style={{ color: "#0E9E6C" }}>.</span>
        </Link>
        {!hideBackLink && (
          <Link href={backHref} style={{
            fontSize: 13, color: "#9AA3B2", textDecoration: "none",
            letterSpacing: "-0.005em", transition: "color 150ms",
            fontFamily: '"Inter Tight", sans-serif',
          }}>
            {backLabel}
          </Link>
        )}
      </header>

      <main
        data-route-transition
        style={{
          maxWidth: wide ? 1080 : 720,
          margin: "0 auto",
          padding: "clamp(40px,8vw,96px) clamp(20px,4vw,48px)",
        }}
      >
        {children}
      </main>
    </div>
  );
}
