import type { ReactNode } from "react";
import Link from "next/link";
import { ProductSurface } from "@/app/_components/product-surface";
import type { Metadata } from "next";
import { robotsMeta } from "@/lib/stealth";

// A SIGN-IN SURFACE IS NOT A SEARCH RESULT.
//
// These inherited the root layout's index/follow, so the account pages were advertised to crawlers the
// moment the curtain lifted. A password-reset page in a search index is noise at best. The one that
// actually mattered: /signin is the URL Google had cached under the RETIRED product's headline, so leaving
// it indexable meant re-earning an entry for a page nobody should arrive at from search.
export const metadata: Metadata = { robots: robotsMeta(false) };


// Auth round-trip shell for /auth/* (verify-email, confirm-signup, verified, reset-password, error,
// auto-signin).
//
// These used to render inside ZoneShell, a pinned DARK surface with a lowercase "vraelis." wordmark. That
// shell predates the light Vraelis theme: /signin was moved onto its own light surface and these pages were
// not, so signing up walked you from a cream sign-in screen onto a near-black confirmation screen with a
// different wordmark, in the middle of the flow. It read like a different product.
//
// ZoneShell is deliberately left alone rather than flipped: /checkout still depends on its dark surface and
// carries hardcoded dark Tailwind classes that would go invisible on a light ground.
//
// These pages are token-based (var(--fg-*), var(--bg-*), var(--line-*)), which is why wrapping them in
// ProductSurface is the whole change needed to move them onto design 06: the tokens resolve to graphite
// instead of cream and every page follows. Sign-up now walks from sign-in to confirmation to the product
// across one continuous ground.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <ProductSurface>
    <div style={{ minHeight: "100svh", background: "var(--bg-0)", color: "var(--fg-1)" }}>
      <header
        style={{
          position: "sticky", top: 0, zIndex: 40,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          height: 64, padding: "0 clamp(20px, 4vw, 64px)",
          background: "var(--chrome-veil)",
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
            color: "var(--fg-1)", textDecoration: "none",
          }}
        >
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
    </ProductSurface>
  );
}
