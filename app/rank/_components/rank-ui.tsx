"use client";

// Vraelis chrome: public nav/footer for marketing pages, and a real sidebar
// shell for the app so the product feels like one connected SaaS surface.
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const PUBLIC_LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/developers", label: "Developers" },
  { href: "/enterprise", label: "Enterprise" },
];

function Ic({ d }: { d: string }) {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
}
const I = {
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  check: "M20 6 9 17l-5-5",
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

// Preflight (the pivot) shows an "Applications" nav item for internal testers only. NEXT_PUBLIC_ is
// inlined at build, so this controls nav VISIBILITY; route access is gated server-side in each page.
const PREFLIGHT_NAV = process.env.NEXT_PUBLIC_VRAELIS_PREFLIGHT === "1";

const APP_NAV: { group: string; items: { href: string; label: string; d: string }[] }[] = [
  { group: "Workspace", items: [
    { href: "/app", label: "Dashboard", d: I.grid },
    ...(PREFLIGHT_NAV ? [{ href: "/app/apps", label: "Applications", d: I.shield }] : []),
    { href: "/app/checks", label: "Checks", d: I.check },
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
    <Link href={href} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none", color: "var(--fg-1)", fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1 }}>Vraelis</Link>
  );
}

function PublicNav({ signedIn }: { signedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [authed, setAuthed] = useState(signedIn);
  const pathname = usePathname() || "";

  useEffect(() => {
    const o = () => setScrolled(window.scrollY > 4);
    o(); window.addEventListener("scroll", o, { passive: true });
    return () => window.removeEventListener("scroll", o);
  }, []);
  useEffect(() => { setOpen(false); }, [pathname]);
  // Marketing pages can be served statically, so the server-passed signedIn may be
  // stale (false) for a logged-in visitor. Resolve it on the client so the "Dashboard"
  // nav link routes signed-in users to their dashboard. (The logo always goes home.)
  useEffect(() => {
    if (authed) return;
    fetch("/api/auth/session").then((r) => r.json()).then((s) => { if (s?.user?.email) setAuthed(true); }).catch(() => {});
  }, [authed]);

  const link = { fontSize: 14, color: "var(--fg-2)", textDecoration: "none", whiteSpace: "nowrap", fontWeight: 500 } as const;
  return (
    <nav style={{ position: "relative", display: "flex", alignItems: "center", gap: 18, padding: "15px var(--gutter)", background: scrolled ? "rgba(250,248,244,0.82)" : "transparent", backdropFilter: scrolled ? "blur(14px)" : "none", WebkitBackdropFilter: scrolled ? "blur(14px)" : "none", borderBottom: `1px solid ${scrolled ? "var(--line-1)" : "transparent"}`, transition: "border-color .25s ease, background .25s ease" }}>
      <Brand href="/" />
      <div className="vra-nav-links" style={{ display: "flex", gap: 28, alignItems: "center", marginLeft: 22 }}>
        {PUBLIC_LINKS.map((l) => <Link key={l.href} href={l.href} style={{ ...link, color: pathname === l.href ? "var(--fg-1)" : "var(--fg-2)" }}>{l.label}</Link>)}
      </div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href={authed ? "/app" : "/signin?callbackUrl=%2Fapp"} className="vra-nav-secondary" style={link}>{authed ? "Dashboard" : "Sign in"}</Link>
        <Link href={authed ? "/app" : "/signin?callbackUrl=%2Fapp"} className="btn">{authed ? "Open app" : "Get early access"}</Link>
        <button aria-label="Menu" onClick={() => setOpen((v) => !v)} className="vra-nav-burger" style={{ display: "none", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 11, border: "1px solid var(--line-2)", background: "var(--bg-1)", cursor: "pointer", color: "var(--fg-1)" }}>
          <span aria-hidden>{open ? "✕" : "☰"}</span>
        </button>
      </div>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-1)", borderBottom: "1px solid var(--line-2)", boxShadow: "var(--shadow-md)", padding: "10px var(--gutter) 18px", display: "flex", flexDirection: "column", gap: 2 }}>
          {PUBLIC_LINKS.map((l) => <Link key={l.href} href={l.href} style={{ ...link, padding: "12px 4px", borderBottom: "1px solid var(--line-1)" }}>{l.label}</Link>)}
          <Link href={authed ? "/app" : "/signin?callbackUrl=%2Fapp"} style={{ ...link, padding: "12px 4px" }}>{authed ? "Dashboard" : "Sign in"}</Link>
        </div>
      )}
    </nav>
  );
}

function Footer({ humanEval }: { humanEval: boolean }) {
  const col = { display: "flex", flexDirection: "column", gap: 10 } as const;
  const productLinks: [string, string][] = [["/how-it-works", "How it works"], ["/pricing", "Pricing"], ["/enterprise", "Enterprise"], ["/signin?callbackUrl=%2Fapp", "Get early access"]];
  if (humanEval) productLinks.push(["/vote", "Evaluate & Earn"]);
  const a = { color: "var(--fg-3)", textDecoration: "none", fontSize: 13.5 } as const;
  const head = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 4 } as const;
  const Col = ({ title, links }: { title: string; links: [string, string][] }) => (
    <div style={col}><div style={head}>{title}</div>
      {links.map(([href, label]) => <Link key={href} href={href} style={a}>{label}</Link>)}
    </div>
  );
  return (
    <footer style={{ borderTop: "1px solid var(--line-1)", background: "var(--bg-2)" }}>
      <div className="wrap foot-grid" style={{ padding: "clamp(44px, 5vw, 68px) var(--gutter)" }}>
        <div>
          <Brand href="/" />
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.6, maxWidth: 260, marginTop: 14 }}>The production layer for AI-built software: a launch decision before your users find the blockers.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <a href="https://instagram.com/usevraelis" target="_blank" rel="noreferrer" aria-label="Vraelis on Instagram" style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--line-2)", background: "var(--bg-1)", display: "grid", placeItems: "center", color: "var(--fg-3)", textDecoration: "none" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="2" y="2" width="20" height="20" rx="5.5" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" /></svg>
            </a>
            <a href="https://facebook.com/vraelis" target="_blank" rel="noreferrer" aria-label="Vraelis on Facebook" style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--line-2)", background: "var(--bg-1)", display: "grid", placeItems: "center", color: "var(--fg-3)", textDecoration: "none" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z" /></svg>
            </a>
            <a href="https://www.youtube.com/@usevraelis" target="_blank" rel="noreferrer" aria-label="Vraelis on YouTube" style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--line-2)", background: "var(--bg-1)", display: "grid", placeItems: "center", color: "var(--fg-3)", textDecoration: "none" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M23 12s0-3.2-.4-4.7a2.5 2.5 0 0 0-1.77-1.77C19.14 5.13 12 5.13 12 5.13s-7.14 0-8.83.4A2.5 2.5 0 0 0 1.4 7.3C1 8.8 1 12 1 12s0 3.2.4 4.7a2.5 2.5 0 0 0 1.77 1.77c1.69.4 8.83.4 8.83.4s7.14 0 8.83-.4a2.5 2.5 0 0 0 1.77-1.77c.4-1.5.4-4.7.4-4.7ZM9.75 15.5v-7l6 3.5-6 3.5Z" /></svg>
            </a>
            <a href="https://x.com/vraelis" target="_blank" rel="noreferrer" aria-label="Vraelis on X" style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--line-2)", background: "var(--bg-1)", display: "grid", placeItems: "center", color: "var(--fg-3)", textDecoration: "none" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M18.9 2H22l-7.5 8.57L23 22h-6.9l-5.4-7.06L4.5 22H1.4l8-9.17L1 2h7.06l4.9 6.48L18.9 2Zm-1.2 18h1.7L7.2 3.9H5.4L17.7 20Z" /></svg>
            </a>
          </div>
        </div>
        <Col title="Product" links={productLinks} />
        <Col title="Developers" links={[["/developers", "Developers"], ["/app/api-keys", "API keys"], ["/app/api-keys", "Webhooks"], ["/app/data", "Data exports"]]} />
        <Col title="Account" links={[["/app", "Dashboard"], ["/app/account", "Account"], ["/app/billing", "Billing"], ["/signin", "Sign in"]]} />
        <Col title="Legal" links={[["/enterprise", "Enterprise & security"], ["/privacy", "Privacy"], ["/terms", "Terms"], ["/refunds", "Refunds"], ["/data-rights", "Data rights"], ["/subprocessors", "Subprocessors"], ["/trademark", "Trademark"], ["/contact", "Contact"]]} />
      </div>
      <div className="wrap" style={{ padding: "0 var(--gutter) 32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, borderTop: "1px solid var(--line-1)", paddingTop: 24 }}>
        <span style={{ fontSize: 13, color: "var(--fg-4)" }}>© 2026 Vraelis. All rights reserved.</span>
        <span style={{ fontSize: 13, color: "var(--fg-4)" }}>Questions? <Link href="/contact" style={{ color: "var(--acc-deep)", textDecoration: "none" }}>Contact us</Link></span>
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
        <Link href="/app/apps/new" className="btn" style={{ padding: "9px 16px" }}>+ Connect app</Link>
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
            <Link href="/app/account" style={{ display: "block", padding: "9px 10px", borderRadius: 9, fontSize: 13.5, color: "var(--fg-2)", textDecoration: "none" }}>Account</Link>
            <Link href="/app/billing" style={{ display: "block", padding: "9px 10px", borderRadius: 9, fontSize: 13.5, color: "var(--fg-2)", textDecoration: "none" }}>Billing</Link>
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

function AppSidebar({ humanEval }: { humanEval: boolean }) {
  const pathname = usePathname() || "";
  const active = (href: string) => href === "/app" ? pathname === "/app" : (pathname === href || pathname.startsWith(href + "/"));
  // Human-eval ingress ("Evaluate & Earn" -> /vote) is hidden unless the flag is on.
  const nav = APP_NAV.map((g) => ({ ...g, items: g.items.filter((it) => humanEval || it.href !== "/vote") }));
  return (
    <aside className="app-side">
      <WorkspaceSwitcher />
      {nav.map((g) => (
        <div key={g.group}>
          <div className="app-side__group">{g.group}</div>
          {g.items.map((it) => (
            <Link key={it.href} href={it.href} className={`slink${active(it.href) ? " on" : ""}`}>
              <span className="slink__i"><Ic d={it.d} /></span>{it.label}
            </Link>
          ))}
        </div>
      ))}
      <div className="app-side__foot" style={{ marginTop: "auto", position: "sticky", bottom: 0, background: "var(--bg-0)", paddingTop: 12, paddingBottom: 4, borderTop: "1px solid var(--line-1)" }}>
        <Link href="/" className="slink" style={{ color: "var(--fg-3)" }}><span className="slink__i"><Ic d="M19 12H5M11 18l-6-6 6-6" /></span>Back to site</Link>
        <button onClick={() => signOut({ callbackUrl: "/" })} className="slink" style={{ color: "var(--fg-3)", width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontSize: 14, fontWeight: 500 }}><span className="slink__i"><Ic d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></span>Sign out</button>
      </div>
    </aside>
  );
}

// Shell UI CSS, injected once (the shell persists across client navigations):
//  1. Text reveal, eyebrows, display headings, and lead copy fade + rise in on mount.
//     Replays per page because page content remounts on client nav. Excludes the hero's
//     own .rise so nothing double-animates.
//  2. Instant tactile feedback, buttons press (scale) and clickable cards lift on hover,
//     with fast transitions, so every click feels registered immediately (perceived
//     speed), not "did it work? click again". Pairs with the client-side nav + prefetch.
// Reduced-motion disables all of it.
const SHELL_UI_CSS = "@keyframes vraTextIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}"
  + ".rank-root .eyebrow:not(.rise),.rank-root .display:not(.rise),.rank-root .lead-copy:not(.rise){animation:vraTextIn 560ms cubic-bezier(0.22,1,0.36,1) both}"
  + ".rank-root .display:not(.rise){animation-delay:60ms}"
  + ".rank-root .lead-copy:not(.rise){animation-delay:120ms}"
  + ".rank-root .btn{transition:transform 110ms ease,background 140ms ease,border-color 140ms ease,color 140ms ease,opacity 140ms ease,box-shadow 140ms ease}"
  + ".rank-root .btn:active{transform:scale(0.97)}"
  + ".rank-root a.card,.rank-root a.acard,.rank-root a.price{transition:transform 150ms cubic-bezier(0.22,1,0.36,1),border-color 150ms ease,box-shadow 150ms ease}"
  + ".rank-root a.card:hover,.rank-root a.acard:hover{transform:translateY(-1px);border-color:var(--acc-line)}"
  + ".rank-root a.card:active,.rank-root a.acard:active{transform:translateY(0) scale(0.995)}"
  // Tighten the top of every app page. Pages set paddingTop inline on their .wrap
  // (clamp up to 40px), which felt like dead space under the topbar; override it once
  // here (a stylesheet !important beats the inline value) so all /app pages match.
  + ".rank-root .app-main>.wrap{padding-top:clamp(12px,1.6vw,20px)!important}"
  + "@media (prefers-reduced-motion:reduce){.rank-root .eyebrow,.rank-root .display,.rank-root .lead-copy{animation:none}.rank-root .btn:active,.rank-root a.card:hover,.rank-root a.card:active,.rank-root a.acard:hover,.rank-root a.acard:active{transform:none}}";

export function RankShell({ signedIn = false, email = null, humanEval = false, children }: { signedIn?: boolean; email?: string | null; humanEval?: boolean; children: ReactNode }) {
  const pathname = usePathname() || "";
  const inApp = pathname.startsWith("/app");

  if (inApp) {
    return (
      <div className="rank-root">
        <style dangerouslySetInnerHTML={{ __html: SHELL_UI_CSS }} />
        <div style={{ position: "sticky", top: 0, zIndex: 50 }}><AppTopbar email={email} /></div>
        <div className="app-shell">
          <AppSidebar humanEval={humanEval} />
          <main className="app-main">{children}</main>
        </div>
      </div>
    );
  }

  return (
    <div className="rank-root">
      <style dangerouslySetInnerHTML={{ __html: SHELL_UI_CSS }} />
      <div style={{ position: "sticky", top: 0, zIndex: 50 }}><PublicNav signedIn={signedIn} /></div>
      {children}
      <Footer humanEval={humanEval} />
    </div>
  );
}
