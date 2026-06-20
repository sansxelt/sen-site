"use client";

// Vraelis Rank chrome — nav + footer on the shared design system.
import { useEffect, useState, type ReactNode } from "react";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/vote", label: "Vote & earn" },
];

function Nav({ signedIn }: { signedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const o = () => setScrolled(window.scrollY > 4);
    o();
    window.addEventListener("scroll", o, { passive: true });
    return () => window.removeEventListener("scroll", o);
  }, []);
  const link = { fontSize: 14, color: "var(--fg-2)", textDecoration: "none", whiteSpace: "nowrap" } as const;
  return (
    <nav style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "16px var(--gutter)", background: "rgba(250,248,244,0.86)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottom: `1px solid ${scrolled ? "var(--line-1)" : "transparent"}`, transition: "border-color .25s ease" }}>
      <a href="/" style={{ gridColumn: 1, justifySelf: "start", textDecoration: "none", color: "var(--fg-1)", fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, letterSpacing: "-0.04em" }}>Vraelis</a>
      <div className="vra-nav-links" style={{ justifySelf: "center", display: "flex", gap: 28, alignItems: "center" }}>
        {LINKS.map((l) => <a key={l.href} href={l.href} style={link}>{l.label}</a>)}
      </div>
      <div style={{ gridColumn: 3, justifySelf: "end", display: "flex", alignItems: "center", gap: 16 }}>
        <a href={signedIn ? "/app" : "/signin?callbackUrl=%2Fapp"} className="vra-nav-secondary" style={link}>{signedIn ? "Dashboard" : "Sign in"}</a>
        <a href="/app/new" className="btn">New test</a>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer style={{ padding: "var(--s-16) var(--gutter) var(--s-12)", borderTop: "1px solid var(--line-1)" }}>
      <div style={{ maxWidth: "var(--max-content)", margin: "0 auto", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16, alignItems: "baseline" }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--fg-1)", letterSpacing: "-0.03em" }}>Vraelis</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-5)" }}>A human preference engine for creative content.</span>
      </div>
    </footer>
  );
}

export function RankShell({ signedIn = false, children }: { signedIn?: boolean; children: ReactNode }) {
  return (
    <div className="rank-root">
      <div style={{ position: "sticky", top: 0, zIndex: 50 }}>
        <Nav signedIn={signedIn} />
      </div>
      {children}
      <Footer />
    </div>
  );
}
