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

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--background)",
      color: "var(--fg-1)",
      fontFamily: '"Inter Tight", var(--font-geist-sans), sans-serif',
    }}>
      <header style={{
        position: "sticky", top: 0, zIndex: 40,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 clamp(20px,4vw,64px)",
        height: 64,
        background: "rgba(10,15,24,0.90)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border-soft)",
      }}>
        <Link href="/home" style={{
          fontSize: 19, fontWeight: 600, letterSpacing: "-0.025em",
          color: "var(--fg-1)", textDecoration: "none",
          fontFamily: '"Inter Tight", sans-serif',
        }}>
          vraelis<span style={{ color: "var(--accent)" }}>.</span>
        </Link>
        {!hideBackLink && (
          <Link href={backHref} style={{
            fontSize: 13, color: "var(--fg-4)", textDecoration: "none",
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
