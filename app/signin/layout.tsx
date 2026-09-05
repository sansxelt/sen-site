import type { ReactNode } from "react";
import { SignInHeader } from "./signin-header";
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


// vraelis.com is the only host now (the sansxel zone shell is retired), so /signin always renders the
// clean, product-first surface. The root layout already provides the light body + vraelis stylesheets;
// this layout adds just the brand and a "back to site" link. No promo banner on auth pages (trust >
// social).
export default function SignInLayout({ children }: { children: ReactNode }) {
  return (
    // Homepage-style surface: a transparent-until-scroll bar over the hero glow + faint grid, which bleed
    // up behind it. The content column SCROLLS (min-height, not fixed 100dvh grid) and is top-padded rather
    // than vertically centered, so a tall form — the create-account panel with Terms, Google, GitHub, and
    // the email fields — is always fully reachable without being clipped at the bottom of the viewport.
    <ProductSurface>
    <div style={{ position: "relative", minHeight: "100dvh", overflow: "clip" }}>
      {/* atmosphere: same bloom + hairline grid the homepage hero uses, bleeding up behind the bar */}
      <div className="glow glow--bleed" aria-hidden />
      <div className="grid-faint" style={{ opacity: 0.5 }} aria-hidden />
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
        <SignInHeader />
        {/* The card is vertically centred in the space below the header. This column is its own scroll
            container: flex:1 + minHeight:0 lets it take the leftover height and actually scroll (a flex child
            won't scroll without minHeight:0), and overflowY:auto means a tall form — create-account with Terms,
            OAuth, and the name/email/password fields — that exceeds the viewport scrolls from the top instead
            of being clipped. When the form fits, justify-content:center centres it in the leftover space; the
            symmetric block-padding keeps a minimum breathing gap so a just-barely-fitting form never kisses
            the edges. */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "safe center", alignItems: "center", overflowY: "auto", padding: "clamp(20px, 4vh, 44px) var(--gutter)" }}>
          {children}
        </div>
      </div>
    </div>
    </ProductSurface>
  );
}
