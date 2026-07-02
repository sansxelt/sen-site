"use client";

// Vraelis chrome: public nav/footer for marketing pages, and a real sidebar
// shell for the app so the product feels like one connected SaaS surface.
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const PUBLIC_LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/developers", label: "Developers" },
  { href: "/enterprise", label: "Enterprise" },
  { href: "/vote", label: "Evaluate & Earn" },
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
  folder: "M3 7a2 2 0 0 1 2-2h3.5l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4",
  clock: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
  building: "M4 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17M13 9h6a1 1 0 0 1 1 1v11M3 21h18M7 7h2M7 11h2M7 15h2M16 13h1M16 17h1",
};

const APP_NAV: { group: string; items: { href: string; label: string; d: string }[] }[] = [
  { group: "Workspace", items: [
    { href: "/app", label: "Dashboard", d: I.grid },
    { href: "/app/projects", label: "Projects", d: I.folder },
    { href: "/app/team", label: "Team", d: I.user },
    { href: "/app/organization", label: "Organization", d: I.building },
    { href: "/app/data", label: "Analytics", d: I.data },
    { href: "/app/data-quality", label: "Data quality", d: I.shield },
    { href: "/app/audit", label: "Activity", d: I.clock },
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
    { href: "/vote", label: "Evaluate & Earn", d: I.vote },
  ] },
];

export function SignOutButton({ className = "btn btn--ghost", label = "Sign out" }: { className?: string; label?: string }) {
  return <button onClick={() => signOut({ callbackUrl: "/" })} className={className}>{label}</button>;
}

function Brand({ href }: { href: string }) {
  return (
    <a href={href} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none", color: "var(--fg-1)", fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1 }}>Vraelis</a>
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
        <a href="/app/new" className="btn">Test your AI content</a>
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
  const Col = ({ title, links }: { title: string; links: [string, string][] }) => (
    <div style={col}><div style={head}>{title}</div>
      {links.map(([href, label]) => <a key={href} href={href} style={a}>{label}</a>)}
    </div>
  );
  return (
    <footer style={{ borderTop: "1px solid var(--line-1)", background: "var(--bg-2)" }}>
      <div className="wrap foot-grid" style={{ padding: "clamp(44px, 5vw, 68px) var(--gutter)" }}>
        <div>
          <Brand href="/" />
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.6, maxWidth: 260, marginTop: 14 }}>Human QA for AI output.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <a href="https://instagram.com/usevraelis" target="_blank" rel="noreferrer" aria-label="Vraelis on Instagram" style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--line-2)", background: "var(--bg-1)", display: "grid", placeItems: "center", color: "var(--fg-3)", textDecoration: "none" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="2" y="2" width="20" height="20" rx="5.5" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" /></svg>
            </a>
            <a href="https://facebook.com/vraelis" target="_blank" rel="noreferrer" aria-label="Vraelis on Facebook" style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--line-2)", background: "var(--bg-1)", display: "grid", placeItems: "center", color: "var(--fg-3)", textDecoration: "none" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z" /></svg>
            </a>
          </div>
        </div>
        <Col title="Product" links={[["/how-it-works", "How it works"], ["/pricing", "Pricing"], ["/vote", "Evaluate & Earn"], ["/app/new", "Test your AI content"]]} />
        <Col title="Developers" links={[["/developers", "Developers"], ["/app/api-keys", "API keys"], ["/app/api-keys", "Webhooks"], ["/app/data", "Data exports"]]} />
        <Col title="Account" links={[["/app", "Dashboard"], ["/app/account", "Account"], ["/app/billing", "Billing"], ["/signin", "Sign in"]]} />
        <Col title="Legal" links={[["/enterprise", "Enterprise & security"], ["/privacy", "Privacy"], ["/terms", "Terms"], ["/data-rights", "Data rights"], ["/trademark", "Trademark"], ["/contact", "Contact"]]} />
      </div>
      <div className="wrap" style={{ padding: "0 var(--gutter) 32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, borderTop: "1px solid var(--line-1)", paddingTop: 24 }}>
        <span style={{ fontSize: 13, color: "var(--fg-4)" }}>© 2026 Vraelis. All rights reserved.</span>
        <span style={{ fontSize: 13, color: "var(--fg-4)" }}>Questions? <a href="mailto:help@vraelis.com" style={{ color: "var(--acc-deep)", textDecoration: "none" }}>help@vraelis.com</a></span>
      </div>
    </footer>
  );
}

function AppTopbar({ email }: { email: string | null }) {
  const [menu, setMenu] = useState(false);
  const pathname = usePathname() || "";
  useEffect(() => { setMenu(false); }, [pathname]);
  // The layout's email can be stale-null when this shell was first rendered from a public
  // (static) page and kept across client navigation; self-resolve so the signed-in account
  // is always identifiable (never "?" / "your account" for a real session).
  const [who, setWho] = useState<string | null>(email);
  useEffect(() => { if (email) setWho(email); }, [email]);
  useEffect(() => {
    if (who) return;
    fetch("/api/auth/session").then((r) => (r.ok ? r.json() : null)).then((j) => { const e = j?.user?.email; if (e) setWho(e); }).catch(() => {});
  }, [who]);
  return (
    <header style={{ display: "flex", alignItems: "center", gap: 16, height: 64, padding: "0 var(--gutter)", borderBottom: "1px solid var(--line-1)", background: "rgba(250,248,244,0.88)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
      {/* in-app logo returns to the public home (sidebar's "Back to site" does too);
          small left nudge so the wordmark sits centered over the sidebar column */}
      <span style={{ marginLeft: 14, marginTop: 4, display: "inline-flex", alignItems: "center" }}><Brand href="/" /></span>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
        <a href="/app/new" className="btn" style={{ padding: "9px 16px" }}>+ New test</a>
        <button onClick={() => setMenu((v) => !v)} aria-label="Account" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px 6px 6px", borderRadius: 99, border: "1px solid var(--line-2)", background: "var(--bg-1)", cursor: "pointer", boxShadow: "var(--shadow-sm)" }}>
          <span aria-hidden style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg, var(--acc), var(--acc-deep))", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 12 }}>{(who || "?").slice(0, 1).toUpperCase()}</span>
          <span style={{ fontSize: 13, color: "var(--fg-3)" }} aria-hidden>▾</span>
        </button>
        {menu && (
          <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 220, background: "var(--bg-1)", border: "1px solid var(--line-2)", borderRadius: 14, boxShadow: "var(--shadow-lg)", padding: 8, zIndex: 60 }}>
            <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid var(--line-1)", marginBottom: 6 }}>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-4)" }}>Signed in</div>
              <div style={{ fontSize: 13, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{who || "your account"}</div>
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

const WS_ROLE: Record<string, string> = { owner: "Owner", admin: "Admin", editor: "Editor", viewer: "Viewer", client_viewer: "Client viewer" };
function WorkspaceSwitcher() {
  const [data, setData] = useState<{ available: { id: string; name: string; role: string; isPersonal: boolean }[]; selectedId: string | null } | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { fetch("/api/v/workspace/available").then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => {}); }, []);
  if (!data || !data.available || data.available.length <= 1) return null; // only when the user belongs to >1 workspace
  const current = data.available.find((w) => w.id === data.selectedId) || data.available[0];
  function select(id: string) { document.cookie = `vws=${id}; path=/; max-age=31536000; samesite=lax`; window.location.href = "/app"; }
  return (
    <div style={{ position: "relative", margin: "2px 0 14px" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "9px 11px", borderRadius: 10, border: "1px solid var(--line-2)", background: "var(--bg-1)", cursor: "pointer", textAlign: "left" }}>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{current.isPersonal ? "Personal workspace" : current.name}</span>
          <span style={{ display: "block", fontFamily: "var(--font-code)", fontSize: 10, color: "var(--fg-4)", marginTop: 1 }}>{WS_ROLE[current.role] ?? current.role}</span>
        </span>
        <span style={{ fontSize: 11, color: "var(--fg-4)" }}>▾</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "var(--bg-1)", border: "1px solid var(--line-2)", borderRadius: 12, boxShadow: "var(--shadow-lg)", padding: 6, zIndex: 70 }}>
          {data.available.map((w) => (
            <button key={w.id} onClick={() => select(w.id)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 10px", borderRadius: 8, border: "none", background: w.id === current.id ? "var(--acc-soft)" : "transparent", cursor: "pointer", textAlign: "left" }}>
              <span style={{ minWidth: 0 }}><span style={{ display: "block", fontSize: 13, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.isPersonal ? "Personal workspace" : w.name}</span><span style={{ fontSize: 10.5, color: "var(--fg-4)" }}>{WS_ROLE[w.role] ?? w.role}</span></span>
              {w.id === current.id ? <span style={{ color: "var(--acc-deep)", fontSize: 12 }}>✓</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AppSidebar() {
  const pathname = usePathname() || "";
  const active = (href: string) => href === "/app" ? pathname === "/app" : (pathname === href || pathname.startsWith(href + "/"));
  return (
    <aside className="app-side">
      <WorkspaceSwitcher />
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
      <div className="app-side__foot" style={{ marginTop: "auto", position: "sticky", bottom: 0, background: "var(--bg-0)", paddingTop: 12, paddingBottom: 4, borderTop: "1px solid var(--line-1)" }}>
        <a href="/" className="slink" style={{ color: "var(--fg-3)" }}><span className="slink__i"><Ic d="M19 12H5M11 18l-6-6 6-6" /></span>Back to site</a>
        <button onClick={() => signOut({ callbackUrl: "/" })} className="slink" style={{ color: "var(--fg-3)", width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontSize: 14, fontWeight: 500 }}><span className="slink__i"><Ic d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></span>Sign out</button>
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
