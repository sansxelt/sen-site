"use client";

// Vraelis chrome — path-aware nav (public vs app) + footer on the shared design
// system. Everything stays on vraelis.com.
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

const PUBLIC_LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/developers", label: "Developers" },
  { href: "/vote", label: "Vote & earn" },
];
const APP_LINKS = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/new", label: "New test" },
  { href: "/vote", label: "Vote" },
  { href: "/app/credits", label: "Credits" },
  { href: "/app/plans", label: "Plans" },
  { href: "/app/billing", label: "Billing" },
  { href: "/app/api-keys", label: "API" },
];

function Nav({ signedIn }: { signedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || "";
  const inApp = pathname.startsWith("/app");
  const links = inApp ? APP_LINKS : PUBLIC_LINKS;

  useEffect(() => {
    const o = () => setScrolled(window.scrollY > 4);
    o();
    window.addEventListener("scroll", o, { passive: true });
    return () => window.removeEventListener("scroll", o);
  }, []);
  useEffect(() => { setOpen(false); }, [pathname]);

  const link = { fontSize: 14, color: "var(--fg-2)", textDecoration: "none", whiteSpace: "nowrap" } as const;

  return (
    <nav style={{ position: "relative", display: "flex", alignItems: "center", gap: 16, padding: "14px var(--gutter)", background: "rgba(250,248,244,0.86)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottom: `1px solid ${scrolled ? "var(--line-1)" : "transparent"}`, transition: "border-color .25s ease" }}>
      <a href={signedIn ? "/app" : "/"} style={{ textDecoration: "none", color: "var(--fg-1)", fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, letterSpacing: "-0.04em", display: "flex", alignItems: "center", gap: 8 }}>
        <span aria-hidden style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--acc)", boxShadow: "0 0 10px var(--acc-glow)" }} />Vraelis
      </a>
      <div className="vra-nav-links" style={{ display: "flex", gap: 26, alignItems: "center", marginLeft: 14 }}>
        {links.map((l) => <a key={l.href} href={l.href} style={{ ...link, color: pathname === l.href ? "var(--fg-1)" : "var(--fg-2)", fontWeight: pathname === l.href ? 600 : 400 }}>{l.label}</a>)}
      </div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
        <a href={signedIn ? "/app" : "/signin?callbackUrl=%2Fapp"} className="vra-nav-secondary" style={link}>{signedIn ? "Dashboard" : "Sign in"}</a>
        <a href="/app/new" className="btn">Start a test</a>
        <button aria-label="Menu" onClick={() => setOpen((v) => !v)} className="vra-nav-burger" style={{ display: "none", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 10, border: "1px solid var(--line-2)", background: "var(--bg-1)", cursor: "pointer", color: "var(--fg-1)" }}>
          <span aria-hidden>{open ? "✕" : "☰"}</span>
        </button>
      </div>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-1)", borderBottom: "1px solid var(--line-2)", boxShadow: "var(--shadow-card)", padding: "10px var(--gutter) 18px", display: "flex", flexDirection: "column", gap: 2 }}>
          {links.map((l) => <a key={l.href} href={l.href} style={{ ...link, padding: "11px 4px", borderBottom: "1px solid var(--line-1)" }}>{l.label}</a>)}
          <a href={signedIn ? "/app" : "/signin?callbackUrl=%2Fapp"} style={{ ...link, padding: "11px 4px" }}>{signedIn ? "Dashboard" : "Sign in"}</a>
        </div>
      )}
    </nav>
  );
}

function Footer() {
  const col = { display: "flex", flexDirection: "column", gap: 9 } as const;
  const a = { color: "var(--fg-3)", textDecoration: "none", fontSize: 13.5 } as const;
  const head = { fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 4 } as const;
  return (
    <footer style={{ borderTop: "1px solid var(--line-1)", background: "var(--bg-2)" }}>
      <div className="wrap" style={{ padding: "clamp(40px, 5vw, 64px) var(--gutter)", display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 32 }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, color: "var(--fg-1)", letterSpacing: "-0.03em", marginBottom: 10 }}>Vraelis</div>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.6, maxWidth: 280 }}>A feedback network for AI apps and creative teams. Test generated content with real users, learn what wins, turn feedback into revenue.</p>
        </div>
        <div style={col}><div style={head}>Product</div>
          <a href="/#how" style={a}>How it works</a><a href="/pricing" style={a}>Pricing</a><a href="/vote" style={a}>Vote & earn</a><a href="/app/new" style={a}>Start a test</a>
        </div>
        <div style={col}><div style={head}>Developers</div>
          <a href="/developers" style={a}>API & embed</a><a href="/app/api-keys" style={a}>API keys</a><a href="/developers#embed" style={a}>Test with Vraelis</a>
        </div>
        <div style={col}><div style={head}>Company</div>
          <a href="/privacy" style={a}>Privacy</a><a href="/terms" style={a}>Terms</a><a href="/contact" style={a}>Contact</a>
        </div>
      </div>
      <div className="wrap" style={{ padding: "0 var(--gutter) 28px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-5)" }}>© Vraelis. 1 credit = 1 human judgment.</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-5)" }}>Made for AI apps & creative teams.</span>
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
