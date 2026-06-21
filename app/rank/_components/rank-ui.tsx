"use client";

// Vraelis chrome — public nav/footer for marketing pages, and a real sidebar
// shell for the app so the product feels like one connected SaaS surface.
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const PUBLIC_LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/developers", label: "Developers" },
  { href: "/vote", label: "Vote & earn" },
];

function Ic({ d }: { d: string }) {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
}
const I = {
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  plus: "M12 5v14M5 12h14",
  data: "M3 3v18h18M7 14l3-3 3 3 5-6",
  coin: "M12 8v8M9.5 10.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
  layers: "M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5",
  card: "M3 6h18v12H3zM3 10h18",
  code: "M8 9l-3 3 3 3M16 9l3 3-3 3",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M5 21v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1",
  vote: "M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
};

const APP_NAV: { group: string; items: { href: string; label: string; d: string }[] }[] = [
  { group: "Workspace", items: [
    { href: "/app", label: "Dashboard", d: I.grid },
    { href: "/app/new", label: "New test", d: I.plus },
    { href: "/app/data", label: "Data", d: I.data },
  ] },
  { group: "Billing", items: [
    { href: "/app/credits", label: "Credits", d: I.coin },
    { href: "/app/plans", label: "Plans", d: I.layers },
    { href: "/app/billing", label: "Billing", d: I.card },
  ] },
  { group: "Developer", items: [
    { href: "/app/api-keys", label: "API & webhooks", d: I.code },
  ] },
  { group: "Account", items: [
    { href: "/app/account", label: "Account", d: I.user },
    { href: "/vote", label: "Vote & earn", d: I.vote },
  ] },
];

export function SignOutButton({ className = "btn btn--ghost", label = "Sign out" }: { className?: string; label?: string }) {
  return <button onClick={() => signOut({ callbackUrl: "/" })} className={className}>{label}</button>;
}

function Brand({ href }: { href: string }) {
  return (
    <a href={href} style={{ textDecoration: "none", color: "var(--fg-1)", fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, letterSpacing: "-0.035em" }}>Vraelis</a>
  );
}

function PublicNav({ signedIn }: { signedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || "";

  useEffect(() => {
    const o = () => setScrolled(window.scrollY > 4);
    o(); window.addEventListener("scroll", o, { passive: true });
    return () => window.removeEventListener("scroll", o);
  }, []);
  useEffect(() => { setOpen(false); }, [pathname]);

  const link = { fontSize: 14, color: "var(--fg-2)", textDecoration: "none", whiteSpace: "nowrap", fontWeight: 500 } as const;
  return (
    <nav style={{ position: "relative", display: "flex", alignItems: "center", gap: 18, padding: "15px var(--gutter)", background: scrolled ? "rgba(250,248,244,0.82)" : "transparent", backdropFilter: scrolled ? "blur(14px)" : "none", WebkitBackdropFilter: scrolled ? "blur(14px)" : "none", borderBottom: `1px solid ${scrolled ? "var(--line-1)" : "transparent"}`, transition: "border-color .25s ease, background .25s ease" }}>
      <Brand href={signedIn ? "/app" : "/"} />
      <div className="vra-nav-links" style={{ display: "flex", gap: 28, alignItems: "center", marginLeft: 22 }}>
        {PUBLIC_LINKS.map((l) => <a key={l.href} href={l.href} style={{ ...link, color: pathname === l.href ? "var(--fg-1)" : "var(--fg-2)" }}>{l.label}</a>)}
      </div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
        <a href={signedIn ? "/app" : "/signin?callbackUrl=%2Fapp"} className="vra-nav-secondary" style={link}>{signedIn ? "Dashboard" : "Sign in"}</a>
        <a href="/app/new" className="btn">Start a test</a>
        <button aria-label="Menu" onClick={() => setOpen((v) => !v)} className="vra-nav-burger" style={{ display: "none", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 11, border: "1px solid var(--line-2)", background: "var(--bg-1)", cursor: "pointer", color: "var(--fg-1)" }}>
          <span aria-hidden>{open ? "✕" : "☰"}</span>
        </button>
      </div>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-1)", borderBottom: "1px solid var(--line-2)", boxShadow: "var(--shadow-md)", padding: "10px var(--gutter) 18px", display: "flex", flexDirection: "column", gap: 2 }}>
          {PUBLIC_LINKS.map((l) => <a key={l.href} href={l.href} style={{ ...link, padding: "12px 4px", borderBottom: "1px solid var(--line-1)" }}>{l.label}</a>)}
          <a href={signedIn ? "/app" : "/signin?callbackUrl=%2Fapp"} style={{ ...link, padding: "12px 4px" }}>{signedIn ? "Dashboard" : "Sign in"}</a>
        </div>
      )}
    </nav>
  );
}

function Footer() {
  const col = { display: "flex", flexDirection: "column", gap: 10 } as const;
  const a = { color: "var(--fg-3)", textDecoration: "none", fontSize: 13.5 } as const;
  const head = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 4 } as const;
  return (
    <footer style={{ borderTop: "1px solid var(--line-1)", background: "var(--bg-2)" }}>
      <div className="wrap" style={{ padding: "clamp(44px, 5vw, 68px) var(--gutter)", display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: 32 }}>
        <div>
          <Brand href="/" />
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.6, maxWidth: 290, marginTop: 14 }}>A feedback network for AI apps and creative teams. Test generated content with real users, learn what wins, turn feedback into revenue.</p>
        </div>
        <div style={col}><div style={head}>Product</div>
          <a href="/#how" style={a}>How it works</a><a href="/pricing" style={a}>Pricing</a><a href="/vote" style={a}>Vote &amp; earn</a><a href="/app/new" style={a}>Start a test</a>
        </div>
        <div style={col}><div style={head}>Developers</div>
          <a href="/developers" style={a}>API &amp; embed</a><a href="/developers#webhooks" style={a}>Webhooks</a><a href="/developers#export" style={a}>Exports</a><a href="/app/api-keys" style={a}>API keys</a>
        </div>
        <div style={col}><div style={head}>Account</div>
          <a href="/app" style={a}>Dashboard</a><a href="/app/billing" style={a}>Billing</a><a href="/privacy" style={a}>Privacy</a><a href="/terms" style={a}>Terms</a>
        </div>
      </div>
      <div className="wrap" style={{ padding: "0 var(--gutter) 32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, borderTop: "1px solid var(--line-1)", paddingTop: 24 }}>
        <span style={{ fontSize: 13, color: "var(--fg-4)" }}>© Vraelis</span>
        <span style={{ fontSize: 13, color: "var(--fg-4)" }}>Built for AI apps and creative teams</span>
      </div>
    </footer>
  );
}

function AppTopbar({ email }: { email: string | null }) {
  const [menu, setMenu] = useState(false);
  const pathname = usePathname() || "";
  useEffect(() => { setMenu(false); }, [pathname]);
  return (
    <header style={{ display: "flex", alignItems: "center", gap: 16, padding: "13px var(--gutter)", borderBottom: "1px solid var(--line-1)", background: "rgba(250,248,244,0.88)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
      <Brand href="/app" />
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
        <a href="/app/new" className="btn" style={{ padding: "9px 16px" }}>+ New test</a>
        <button onClick={() => setMenu((v) => !v)} aria-label="Account" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px 6px 6px", borderRadius: 99, border: "1px solid var(--line-2)", background: "var(--bg-1)", cursor: "pointer", boxShadow: "var(--shadow-sm)" }}>
          <span aria-hidden style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg, var(--acc), var(--acc-deep))", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 12 }}>{(email || "?").slice(0, 1).toUpperCase()}</span>
          <span style={{ fontSize: 13, color: "var(--fg-3)" }} aria-hidden>▾</span>
        </button>
        {menu && (
          <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 220, background: "var(--bg-1)", border: "1px solid var(--line-2)", borderRadius: 14, boxShadow: "var(--shadow-lg)", padding: 8, zIndex: 60 }}>
            <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid var(--line-1)", marginBottom: 6 }}>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-4)" }}>Signed in</div>
              <div style={{ fontSize: 13, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{email || "your account"}</div>
            </div>
            <a href="/app/account" style={{ display: "block", padding: "9px 10px", borderRadius: 9, fontSize: 13.5, color: "var(--fg-2)", textDecoration: "none" }}>Account</a>
            <a href="/app/billing" style={{ display: "block", padding: "9px 10px", borderRadius: 9, fontSize: 13.5, color: "var(--fg-2)", textDecoration: "none" }}>Billing</a>
            <button onClick={() => signOut({ callbackUrl: "/" })} style={{ width: "100%", textAlign: "left", padding: "9px 10px", borderRadius: 9, fontSize: 13.5, color: "var(--err)", background: "transparent", border: "none", cursor: "pointer" }}>Sign out</button>
          </div>
        )}
      </div>
    </header>
  );
}

function AppSidebar() {
  const pathname = usePathname() || "";
  const active = (href: string) => href === "/app" ? pathname === "/app" : pathname.startsWith(href);
  return (
    <aside className="app-side">
      {APP_NAV.map((g) => (
        <div key={g.group}>
          <div className="app-side__group">{g.group}</div>
          {g.items.map((it) => (
            <a key={it.href} href={it.href} className={`slink${active(it.href) ? " on" : ""}`}>
              <span className="slink__i"><Ic d={it.d} /></span>{it.label}
            </a>
          ))}
        </div>
      ))}
      <div className="app-side__foot" style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--line-1)" }}>
        <a href="/" className="slink" style={{ color: "var(--fg-3)" }}><span className="slink__i"><Ic d="M19 12H5M11 18l-6-6 6-6" /></span>Back to site</a>
      </div>
    </aside>
  );
}

export function RankShell({ signedIn = false, email = null, children }: { signedIn?: boolean; email?: string | null; children: ReactNode }) {
  const pathname = usePathname() || "";
  const inApp = pathname.startsWith("/app");

  if (inApp) {
    return (
      <div className="rank-root">
        <div style={{ position: "sticky", top: 0, zIndex: 50 }}><AppTopbar email={email} /></div>
        <div className="app-shell">
          <AppSidebar />
          <main className="app-main">{children}</main>
        </div>
      </div>
    );
  }

  return (
    <div className="rank-root">
      <div style={{ position: "sticky", top: 0, zIndex: 50 }}><PublicNav signedIn={signedIn} /></div>
      {children}
      <Footer />
    </div>
  );
}
