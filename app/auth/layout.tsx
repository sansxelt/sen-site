import type { ReactNode } from "react";
import Link from "next/link";
import { MARK_PATH, MARK_VIEWBOX } from "@/lib/brand-mark";

// Auth round-trip shell for /auth/* (verify-email, confirm-signup, verified, reset-password, error,
// auto-signin).
//
// These used to render inside ZoneShell, a pinned DARK surface with a lowercase "vraelis." wordmark. That
// shell predates the light Vraelis theme: /signin was moved onto its own light surface and these pages were
// not, so signing up walked you from a cream sign-in screen onto a near-black confirmation screen with a
// different wordmark, in the middle of the flow. It read like a different product.
//
// ZoneShell is deliberately left alone rather than flipped to light: /checkout still depends on its dark
// surface and carries hardcoded dark Tailwind classes that would go invisible on a light ground. The pages
// here are already token-based (var(--fg-*), var(--bg-*), var(--line-*)), so they render correctly on the
// cream theme with no per-page changes.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100svh", background: "var(--bg-0)", color: "var(--fg-1)" }}>
      <header
        style={{
          position: "sticky", top: 0, zIndex: 40,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          height: 64, padding: "0 clamp(20px, 4vw, 64px)",
          background: "rgba(250,248,244,0.88)",
          backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--line-1)",
        }}
      >
        {/* Same wordmark treatment as the rest of the site. The old shell used a lowercase "vraelis." with a
            green period, which appears nowhere else and made this screen look like another company. */}
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700,
            letterSpacing: "-0.035em", lineHeight: 1,
            color: "var(--fg-1)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8,
          }}
        >
          <svg width="18" height="18" viewBox={MARK_VIEWBOX} aria-hidden style={{ flex: "none", display: "block" }}>
            <path d={MARK_PATH} fill="currentColor" />
          </svg>
          Vraelis
        </Link>
        <Link href="/" style={{ fontSize: 13, color: "var(--fg-3)", textDecoration: "none" }}>
          &larr; Back to site
        </Link>
      </header>

      <main style={{ display: "flex", justifyContent: "center", padding: "clamp(28px, 6vw, 72px) var(--gutter) 80px" }}>
        <div style={{ width: "100%", maxWidth: 560 }}>{children}</div>
      </main>
    </div>
  );
}
