"use client";

// Flip Engine chrome — nav + footer on the shared vraelis design system
// (/vraelis/tokens.css + styles.css). Clean URLs (/, /app, /pricing,
// /connections, /account) are mapped to the internal /flip routes by proxy.ts.

import { useEffect, useState, type ReactNode } from "react";
import { VraelisPromoBar } from "@/components/vraelis-promo-bar";

const NAV_LINKS = [
  { href: "/#how", label: "How it works", key: "how" },
  { href: "/pricing", label: "Pricing", key: "pricing" },
  { href: "/connections", label: "Marketplaces", key: "connections" },
];

function FlipNav({ signedIn }: { signedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const link = { fontSize: 14, color: "var(--fg-2)", textDecoration: "none", letterSpacing: "-0.005em", whiteSpace: "nowrap" } as const;
  return (
    <nav
      style={{
        position: "relative", display: "grid", gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center", padding: "16px var(--gutter)",
        background: "rgba(250, 248, 244, 0.86)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        borderBottom: `1px solid ${scrolled ? "var(--line-1)" : "transparent"}`, transition: "border-color 0.25s ease",
      }}
    >
      <a href="/" style={{ gridColumn: 1, justifySelf: "start", display: "inline-flex", alignItems: "center", textDecoration: "none", color: "var(--fg-1)", fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, letterSpacing: "-0.04em" }}>
        Flip Engine
      </a>
      <div className="vra-nav-links" style={{ justifySelf: "center", display: "flex", gap: 28, alignItems: "center" }}>
        {NAV_LINKS.map((l) => <a key={l.key} href={l.href} style={link}>{l.label}</a>)}
      </div>
      <div style={{ gridColumn: 3, justifySelf: "end", display: "flex", alignItems: "center", gap: 16 }}>
        {signedIn ? (
          <a href="/account" className="vra-nav-secondary" style={link}>Account</a>
        ) : (
          <a href="/signin?callbackUrl=%2Faccount" className="vra-nav-secondary" style={link}>Sign in</a>
        )}
        <a href="/app" className="btn">Try it free</a>
        <button
          type="button" className="vra-nav-burger" aria-label="Menu" aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          style={{ display: "none", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: "var(--fg-1)", padding: 4, lineHeight: 0 }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            {menuOpen ? (<><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>)
              : (<><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>)}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#FAF8F4", borderBottom: "1px solid var(--line-2)", boxShadow: "0 16px 30px -18px rgba(0,0,0,0.22)", display: "flex", flexDirection: "column", padding: "6px 0" }}>
          {NAV_LINKS.map((l) => (
            <a key={l.key} href={l.href} onClick={() => setMenuOpen(false)} style={{ padding: "13px var(--gutter)", fontSize: 15, textDecoration: "none", color: "var(--fg-2)" }}>{l.label}</a>
          ))}
          <a href={signedIn ? "/account" : "/signin?callbackUrl=%2Faccount"} onClick={() => setMenuOpen(false)} style={{ padding: "13px var(--gutter)", fontSize: 15, textDecoration: "none", color: "var(--fg-2)", borderTop: "1px solid var(--line-1)" }}>{signedIn ? "Account" : "Sign in"}</a>
          <a href="/app" onClick={() => setMenuOpen(false)} style={{ padding: "13px var(--gutter)", fontSize: 15, color: "var(--acc-deep)", fontWeight: 600, textDecoration: "none" }}>Try it free →</a>
        </div>
      )}
    </nav>
  );
}

const FOOT_COLS: { title: string; links: { label: string; href: string }[] }[] = [
  { title: "Product", links: [{ label: "How it works", href: "/#how" }, { label: "Pricing", href: "/pricing" }, { label: "Marketplaces", href: "/connections" }, { label: "Try it free", href: "/app" }] },
  { title: "Account", links: [{ label: "Your listings", href: "/account" }, { label: "Sign in", href: "/signin?callbackUrl=%2Faccount" }] },
  { title: "Company", links: [{ label: "Privacy", href: "/privacy" }, { label: "Terms", href: "/terms" }, { label: "Refunds", href: "/refunds" }, { label: "Contact", href: "/contact" }] },
];

function FlipFooter() {
  return (
    <footer style={{ padding: "var(--s-16) var(--gutter) var(--s-12)", borderTop: "1px solid var(--line-1)" }}>
      <div style={{ maxWidth: "var(--max-content)", margin: "0 auto", display: "flex", flexWrap: "wrap", gap: "clamp(32px, 5vw, 72px)", alignItems: "flex-start" }}>
        <div style={{ flex: "1.5 1 280px", minWidth: 240, maxWidth: 420 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--fg-1)" }}>Flip Engine</span>
          <p style={{ fontSize: 13, color: "var(--fg-4)", lineHeight: 1.55, marginTop: 14 }}>
            Turn a thrift find into a finished resale listing — platform titles, a clean description, and a price range, from a phone photo.
          </p>
          <a href="https://instagram.com/usevraelis" target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 13, fontWeight: 600, color: "var(--acc-deep)", textDecoration: "none" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="2" y="2" width="20" height="20" rx="5.5" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
            </svg>
            Follow @usevraelis
          </a>
        </div>
        <div style={{ flex: "2 1 340px", display: "flex", flexWrap: "wrap", gap: "clamp(24px, 4vw, 56px)" }}>
          {FOOT_COLS.map((col) => (
            <div key={col.title} style={{ flex: "1 1 120px", minWidth: 120 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 14 }}>{col.title}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {col.links.map((l) => <a key={l.label} href={l.href} style={{ fontSize: 13, color: "var(--fg-3)", textDecoration: "none" }}>{l.label}</a>)}
              </div>
            </div>
          ))}
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

export function FlipShell({ signedIn = false, children }: { signedIn?: boolean; children: ReactNode }) {
  return (
    <div className="flip-root">
      <div style={{ position: "sticky", top: 0, zIndex: 50 }}>
        <VraelisPromoBar />
        <FlipNav signedIn={signedIn} />
      </div>
      {children}
      <FlipFooter />
    </div>
  );
}
