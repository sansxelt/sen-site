"use client";

// Flip Engine chrome — nav + footer built on the SAME vraelis design system
// (/vraelis/tokens.css + styles.css, already loaded for every vraelis.com
// request by the root layout). Mirrors the (vraelis) shell so /flip reads as a
// page on the same site, with flip-appropriate links. Reuses the shared
// promo bar and the .vra-nav-links / .vra-nav-burger responsive classes.

import { useEffect, useState, type ReactNode } from "react";
import { VraelisPromoBar } from "@/components/vraelis-promo-bar";

const NAV_LINKS = [
  { href: "/flip#how", label: "How it works", key: "how" },
  { href: "/flip#pricing", label: "Pricing", key: "pricing" },
];

function FlipNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <nav
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        padding: "16px var(--gutter)",
        background: "rgba(250, 248, 244, 0.86)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: `1px solid ${scrolled ? "var(--line-1)" : "transparent"}`,
        transition: "border-color 0.25s ease",
      }}
    >
      <a
        href="/flip"
        style={{
          gridColumn: 1,
          justifySelf: "start",
          display: "inline-flex",
          alignItems: "center",
          textDecoration: "none",
          color: "var(--fg-1)",
          fontFamily: "var(--font-display)",
          fontSize: 21,
          fontWeight: 700,
          letterSpacing: "-0.04em",
        }}
      >
        Flip Engine
      </a>
      <div className="vra-nav-links" style={{ justifySelf: "center", display: "flex", gap: 28, alignItems: "center" }}>
        {NAV_LINKS.map((l) => (
          <a
            key={l.key}
            href={l.href}
            style={{ fontSize: 14, color: "var(--fg-2)", textDecoration: "none", letterSpacing: "-0.005em", whiteSpace: "nowrap" }}
          >
            {l.label}
          </a>
        ))}
      </div>
      <div style={{ gridColumn: 3, justifySelf: "end", display: "flex", alignItems: "center", gap: 16 }}>
        <a href="/flip/app" className="btn vra-nav-cta">Try it free</a>
        <button
          type="button"
          className="vra-nav-burger"
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          style={{ display: "none", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: "var(--fg-1)", padding: 4, lineHeight: 0 }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            {menuOpen ? (
              <>
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div
          style={{
            position: "absolute", top: "100%", left: 0, right: 0,
            background: "#FAF8F4", borderBottom: "1px solid var(--line-2)",
            boxShadow: "0 16px 30px -18px rgba(0,0,0,0.22)",
            display: "flex", flexDirection: "column", padding: "6px 0",
          }}
        >
          {NAV_LINKS.map((l) => (
            <a
              key={l.key}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              style={{ padding: "13px var(--gutter)", fontSize: 15, textDecoration: "none", color: "var(--fg-2)" }}
            >
              {l.label}
            </a>
          ))}
          <a
            href="/flip/app"
            onClick={() => setMenuOpen(false)}
            style={{ padding: "13px var(--gutter)", fontSize: 15, color: "var(--acc-deep)", fontWeight: 600, textDecoration: "none", borderTop: "1px solid var(--line-1)" }}
          >
            Try it free →
          </a>
        </div>
      )}
    </nav>
  );
}

function FlipFooter() {
  return (
    <footer style={{ padding: "var(--s-16) var(--gutter) var(--s-12)", borderTop: "1px solid var(--line-1)" }}>
      <div style={{ maxWidth: "var(--max-content)", margin: "0 auto", display: "flex", flexWrap: "wrap", gap: "clamp(32px, 5vw, 72px)", alignItems: "flex-start" }}>
        <div style={{ flex: "1.5 1 280px", minWidth: 240, maxWidth: 420 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--fg-1)" }}>Flip Engine</span>
          <p style={{ fontSize: 13, color: "var(--fg-4)", lineHeight: 1.55, marginTop: 14 }}>
            Turn a thrift find into a finished resale listing — platform titles, a clean description, and a price range, from a phone photo.
          </p>
        </div>
        <div style={{ flex: "2 1 340px", display: "flex", flexWrap: "wrap", gap: "clamp(24px, 4vw, 56px)" }}>
          <div style={{ flex: "1 1 120px", minWidth: 120 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 14 }}>Product</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <a href="/flip#how" style={{ fontSize: 13, color: "var(--fg-3)", textDecoration: "none" }}>How it works</a>
              <a href="/flip#pricing" style={{ fontSize: 13, color: "var(--fg-3)", textDecoration: "none" }}>Pricing</a>
              <a href="/flip/app" style={{ fontSize: 13, color: "var(--fg-3)", textDecoration: "none" }}>Try it free</a>
            </div>
          </div>
          <div style={{ flex: "1 1 120px", minWidth: 120 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 14 }}>Works with</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "var(--fg-3)" }}>
              <span>eBay</span><span>Poshmark</span><span>Depop</span><span>Mercari</span>
            </div>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: "var(--max-content)", margin: "var(--s-12) auto 0", paddingTop: "var(--s-6)", borderTop: "1px solid var(--line-1)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-5)" }}>
        <span>© 2026 Flip Engine</span>
        <span>From a photo to a finished listing.</span>
      </div>
      <p style={{ maxWidth: "var(--max-content)", margin: "10px auto 0", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-5)", lineHeight: 1.5 }}>
        Listings are AI-generated and may contain mistakes — check the item details, price, and condition before you post.
      </p>
    </footer>
  );
}

export function FlipShell({ children }: { children: ReactNode }) {
  return (
    <div className="flip-root">
      <div style={{ position: "sticky", top: 0, zIndex: 50 }}>
        <VraelisPromoBar />
        <FlipNav />
      </div>
      {children}
      <FlipFooter />
    </div>
  );
}
