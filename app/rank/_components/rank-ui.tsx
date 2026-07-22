"use client";

// Vraelis chrome: public nav/footer for marketing pages, and a real sidebar
// shell for the app so the product feels like one connected SaaS surface.
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { isAppPath } from "@/lib/app-routes";
// The product-wide drawn icon set (one language, no glyph characters). Kept in its own
// server-safe module so app pages can render the same icons without a client boundary.
import { Ic, I } from "./icons";

// Research sits between Developers and Enterprise for now. The fuller restructure toward
// Product / Developers / Research / Pricing belongs with the verification-first redesign
// (docs/verification-first-redesign.md), which is deliberately gated on the first real end-to-end run.
// Adding one entry now does not commit the nav to a shape the product has not earned yet.
const PUBLIC_LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/developers", label: "Developers" },
  { href: "/research", label: "Research" },
  { href: "/enterprise", label: "Enterprise" },
];

// The signed-in product: Vraelis is the production layer for AI-built software. The legacy AI-output checker
// is deliberately NOT here (it lives flag-gated at /legacy/checks); Projects / Analytics / Data quality
// belonged to that product and are out of the primary navigation with it.
// The product is ONE action, "verify this outcome", and the navigation should say that rather than listing
// six internal systems as equals. Passes, runs, contracts, issues and reports are lifecycle stages INSIDE a
// verification; putting them in the sidebar asked every user to learn the internal architecture before they
// could do anything.
//
// Nothing below was deleted. /applications, /passes, /issues, /repairs, /deployments, /activity, /credits,
// /billing and /plans all still resolve, and the pages they render are unchanged. This is a visible
// hierarchy change, not a backend rewrite, so an existing workflow or bookmark keeps working.
//
// API keys sit under Developers rather than being duplicated in Settings: it is one page, and two sidebar
// entries pointing at the same destination is how a menu starts lying about how much is in it.
const APP_NAV: { group: string; items: { href: string; label: string; d: string }[] }[] = [
  { group: "Product", items: [
    { href: "/app", label: "Home", d: I.grid },
    { href: "/verifications", label: "Verifications", d: I.shield },
    { href: "/systems", label: "Systems", d: I.layers },
    { href: "/connections", label: "Connections", d: I.key },
    { href: "/developers", label: "Developers", d: I.code },
  ] },
  { group: "Settings", items: [
    { href: "/account", label: "Account", d: I.user },
    { href: "/team", label: "Team", d: I.user },
    { href: "/organization", label: "Organization", d: I.building },
    { href: "/credits", label: "Usage & credits", d: I.coin },
    { href: "/plans", label: "Plans & billing", d: I.card },
  ] },
];

// Old destinations that are no longer in the sidebar but must still light up the right nav item when
// visited directly, so a bookmarked URL does not land you in a shell with nothing selected.
const NAV_ALIASES: Record<string, string> = {
  "/applications": "/systems",
  "/passes": "/verifications",
  "/issues": "/verifications",
  "/repairs": "/verifications",
  "/deployments": "/systems",
  "/activity": "/app",
  "/billing": "/plans",
  "/api": "/developers",
};

// Signing out of the product must land on the MARKETING site, not on app.vraelis.com. A bare "/" keeps you
// on the app subdomain, which after sign-out is a stub page with a single sign-in button and no way back to
// anything. Cross-host, so it has to be absolute; on localhost there is no second host, so "/" is correct.
function signOutTarget(): string {
  if (typeof window === "undefined") return "/";
  return window.location.hostname === "app.vraelis.com" ? "https://vraelis.com" : "/";
}

export function SignOutButton({ className = "btn btn--ghost", label = "Sign out" }: { className?: string; label?: string }) {
  return <button onClick={() => signOut({ callbackUrl: signOutTarget() })} className={className}>{label}</button>;
}

function Brand({ href }: { href: string }) {
  // When the logo already points at the page you're on, don't fire a full navigation
  // (which reloads and jumps you nowhere) — smooth-scroll back to the top instead.
  // Compared against the BROWSER url (window.location.pathname), not usePathname(), because
  // the vraelis host rewrites clean paths onto /rank/* internally, so the two never match.
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; // let new-tab / modified clicks through
    const here = window.location.pathname.replace(/\/$/, "") || "/";
    const target = href.replace(/\/$/, "") || "/";
    if (here === target) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  // Wordmark only. The mark does its job where type cannot go (browser tab, home screen); sat beside the
  // name it just crowds the header, so the lockup here is the word on its own.
  return (
    <Link href={href} onClick={onClick} className="vra-brand" style={{ display: "inline-flex", alignItems: "center", minHeight: 24, textDecoration: "none", color: "var(--fg-1)", fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1 }}>Vraelis</Link>
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

  const link = { fontSize: 15.5, color: "var(--fg-2)", textDecoration: "none", whiteSpace: "nowrap", fontWeight: 500, display: "inline-flex", alignItems: "center", minHeight: 24 } as const;
  return (
    <nav style={{ position: "relative", display: "flex", alignItems: "center", gap: 18, padding: "15px var(--gutter)", background: scrolled ? "rgba(250,248,244,0.82)" : "transparent", backdropFilter: scrolled ? "blur(14px)" : "none", WebkitBackdropFilter: scrolled ? "blur(14px)" : "none", borderBottom: `1px solid ${scrolled ? "var(--line-1)" : "transparent"}`, transition: "border-color .25s ease, background .25s ease" }}>
      <Brand href="/" />
      <div className="vra-nav-links" style={{ display: "flex", gap: 28, alignItems: "center", marginLeft: 22 }}>
        {PUBLIC_LINKS.map((l) => <Link key={l.href} href={l.href} style={{ ...link, color: pathname === l.href ? "var(--fg-1)" : "var(--fg-2)" }}>{l.label}</Link>)}
      </div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href={authed ? "/app" : "/signin?callbackUrl=%2Fapp"} className="vra-nav-secondary" style={link}>{authed ? "Dashboard" : "Sign in"}</Link>
        <Link href={authed ? "/app" : "/signin?callbackUrl=%2Fapp"} className="btn">{authed ? "Open app" : "Check your application"}</Link>
        <button aria-label="Menu" onClick={() => setOpen((v) => !v)} className="vra-nav-burger" style={{ display: "none", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 11, border: "1px solid var(--line-2)", background: "var(--bg-1)", cursor: "pointer", color: "var(--fg-1)" }}>
          <Ic d={open ? I.x : I.menu} size={18} sw={2} />
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

function Footer() {
  const col = { display: "flex", flexDirection: "column", gap: 6 } as const;
  // Limitations sits in Product, not Legal, on purpose: it is a description of what the thing does, and
  // burying it under legal reads like a disclaimer somebody was made to write.
  const productLinks: [string, string][] = [["/how-it-works", "How it works"], ["/limitations", "Limitations"], ["/pricing", "Pricing"], ["/enterprise", "Enterprise"], ["/signin?callbackUrl=%2Fapp", "Check your application"]];
  // minHeight + inline-flex gives each footer link a >=24px touch target (the text stays put; the hit area
  // grows vertically). Paired with the tighter col gap above so total row rhythm is unchanged.
  const a = { color: "var(--fg-3)", textDecoration: "none", fontSize: 13.5, display: "inline-flex", alignItems: "center", minHeight: 24 } as const;
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
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.6, maxWidth: 260, marginTop: 14 }}>Production validation for AI-built systems: know how your system behaves before it ships.</p>
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
            <a href="https://www.linkedin.com/company/vraelis" target="_blank" rel="noreferrer" aria-label="Vraelis on LinkedIn" style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--line-2)", background: "var(--bg-1)", display: "grid", placeItems: "center", color: "var(--fg-3)", textDecoration: "none" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
            </a>
          </div>
        </div>
        <Col title="Product" links={productLinks} />
        <Col title="Developers" links={[["/developers", "Developer overview"], ["/developers#ci-gate", "CI gate"], ["/research", "Research"], ["/signin?callbackUrl=%2Fapi", "API & webhooks"]]} />
        <Col title="Account" links={[["/app", "Dashboard"], ["/account", "Account"], ["/billing", "Billing"], ["/signin", "Sign in"]]} />
        <Col title="Legal" links={[["/enterprise", "Enterprise & security"], ["/privacy", "Privacy"], ["/terms", "Terms"], ["/refunds", "Refunds"], ["/data-rights", "Data rights"], ["/subprocessors", "Subprocessors"], ["/trademark", "Trademark"], ["/contact", "Contact"]]} />
      </div>
      <div className="wrap" style={{ padding: "0 var(--gutter) 32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, borderTop: "1px solid var(--line-1)", paddingTop: 24 }}>
        <span style={{ fontSize: 13, color: "var(--fg-4)" }}>© 2026 Vraelis. All rights reserved.</span>
        <span style={{ fontSize: 13, color: "var(--fg-4)" }}>Questions? <Link href="/contact" style={{ color: "var(--acc-deep)", textDecoration: "none" }}>Contact us</Link></span>
      </div>
    </footer>
  );
}

// AccountMenu region: the topbar identity button (custom profile picture with initials fallback)
// plus the quick menu. The picture comes from /api/v/avatar (a short-TTL signed URL to the PRIVATE
// avatar bucket; the owner is resolved server-side from the session, never sent by the client).
// The account page broadcasts "vraelis:avatar" after upload/remove so this stays in sync without
// a reload. Menu items mirror the sidebar's icons (same Ic stroke set, same assignments).
const ACCOUNT_MENU: { href: string; label: string; d: string }[] = [
  { href: "/applications", label: "Applications", d: I.layers },
  { href: "/plans", label: "Plans", d: I.layers },
  { href: "/credits", label: "Credits", d: I.coin },
  { href: "/api", label: "API & Webhooks", d: I.code },
];
const ACCOUNT_MENU_FOOT: { href: string; label: string; d: string }[] = [
  { href: "/account", label: "Account", d: I.user },
  { href: "/billing", label: "Billing", d: I.card },
];

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
  // Profile picture: fetched once per shell mount, updated live by the account page's event.
  const [avatar, setAvatar] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/v/avatar").then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && typeof j.url === "string") setAvatar(j.url); }).catch(() => {});
    const onChange = (e: Event) => setAvatar((e as CustomEvent<{ url: string | null }>).detail?.url ?? null);
    window.addEventListener("vraelis:avatar", onChange);
    return () => window.removeEventListener("vraelis:avatar", onChange);
  }, []);
  // Plan + balance at a glance: read once from /api/v/me (the same source the dashboard uses; no extra
  // DB work — plan and balance are already loaded there). Refetched when a purchase/launch broadcasts
  // "vraelis:balance" so the pill never lies about what's in the account after a top-up or a pass.
  // /api/v/me `balance` is a CREDIT COUNT (lib/v-credits.ts balance() sums unit='credit' rows) — NOT
  // cents and NOT dollars. Render it as a bare integer count labeled "credits", matching the trusted
  // surfaces (app/rank/app/credits/page.tsx "credits available"). Do NOT divide by any factor or prefix
  // with a currency symbol: the top-up RATE lives in credits/page.tsx and is not a per-cent conversion,
  // and this credit-only sum can't be dollar-formatted anyway.
  const [acct, setAcct] = useState<{ plan: string; credits: number } | null>(null);
  useEffect(() => {
    const load = () => fetch("/api/v/me").then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (j && j.signedIn) setAcct({ plan: typeof j.plan_v1 === "string" && j.plan_v1 ? j.plan_v1 : String(j.plan ?? "free"), credits: Number(j.balance ?? 0) });
    }).catch(() => {});
    load();
    window.addEventListener("vraelis:balance", load);
    return () => window.removeEventListener("vraelis:balance", load);
  }, []);
  const planLabel = acct ? (acct.plan === "free" ? "Free" : acct.plan.charAt(0).toUpperCase() + acct.plan.slice(1)) : null;
  const creditCount = acct ? Math.max(0, Math.round(acct.credits)) : null;
  const balanceLabel = creditCount !== null ? creditCount.toLocaleString() : null;
  const item = { display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 9, fontSize: 13.5, color: "var(--fg-2)", textDecoration: "none" } as const;
  const itemIcon = { display: "inline-flex", color: "var(--fg-4)", flex: "none" } as const;
  return (
    <header style={{ display: "flex", alignItems: "center", gap: 16, height: 64, padding: "0 var(--gutter)", borderBottom: "1px solid var(--line-1)", background: "rgba(250,248,244,0.88)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
      {/* in-app logo returns to the APP home (app.vraelis.com/); leaving the product entirely is the
          sidebar's "Back to site" -> https://vraelis.com. Small left nudge centers over the sidebar. */}
      <span style={{ marginLeft: 14, marginTop: 4, display: "inline-flex", alignItems: "center" }}><Brand href="/" /></span>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
        {/* Plan + balance at a glance, right in the bar — no menu dig. Two matched pills (per founder): the
            plan by its FULL NAME (accent-tinted, ties to the brand avatar) -> /plans, and the credits pill
            with a properly-centered coin + exact balance -> /credits. Hidden until /api/v/me resolves so it
            never flashes a wrong number. Both share height/radius/shadow so they read as one status set. */}
        {planLabel !== null && (
          <div className="vra-app-pills" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Plan pill — full plan name. Teal tint from the confirmed brand accent tokens
                (--accent-dim / --accent-border, defined in globals.css). Explicit emerald text
                (#0A7B54, the brand green the stylesheet itself names) so it stays legible on the
                cream top bar regardless of theme-token resolution. */}
            <Link
              href="/plans"
              title={`${planLabel} plan`}
              aria-label={`Your plan: ${planLabel}`}
              style={{ display: "inline-flex", alignItems: "center", height: 34, padding: "0 14px", borderRadius: 99, border: "1px solid var(--accent-border)", background: "var(--accent-dim)", textDecoration: "none", color: "#0A7B54", fontSize: 12.5, fontWeight: 700, letterSpacing: "0.01em", whiteSpace: "nowrap", flex: "none" }}
            >
              {planLabel}
            </Link>
            {/* Credits pill — styling matched to the sibling account button so the two read as a set.
                Coin icon centered in a fixed square box (its '$' stroke sits left-of-axis in the
                24x24 path, which is why it looked off-center before). */}
            <Link
              href="/credits"
              title={`${balanceLabel} credits, buy more`}
              aria-label={`Credit balance: ${balanceLabel} credits`}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 34, padding: "0 14px", borderRadius: 99, border: "1px solid var(--line-2)", background: "var(--bg-1)", boxShadow: "var(--shadow-sm)", textDecoration: "none", color: "var(--fg-1)", fontSize: 12.5, fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", flex: "none" }}
            >
              <span aria-hidden style={{ display: "grid", placeItems: "center", width: 15, height: 15, color: "var(--fg-4)", flex: "none" }}><Ic d={I.coin} size={14} sw={1.8} /></span>
              {balanceLabel}
            </Link>
          </div>
        )}
        <Link href="/applications/new" className="btn vra-app-connect" style={{ padding: "9px 16px" }} aria-label="Connect app">
          +<span className="vra-app-connect__label"> Connect app</span>
        </Link>
        <button onClick={() => setMenu((v) => !v)} aria-label="Account" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px 6px 6px", borderRadius: 99, border: "1px solid var(--line-2)", background: "var(--bg-1)", cursor: "pointer", boxShadow: "var(--shadow-sm)" }}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" aria-hidden width={26} height={26} style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover", display: "block" }} />
          ) : (
            <span aria-hidden style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg, var(--acc), var(--acc-deep))", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 12 }}>{(who || "?").slice(0, 1).toUpperCase()}</span>
          )}
          <span aria-hidden style={{ display: "inline-flex", color: "var(--fg-3)" }}><Ic d={I.chevron} size={12} sw={2.2} /></span>
        </button>
        {menu && (
          <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 232, background: "var(--bg-1)", border: "1px solid var(--line-2)", borderRadius: 14, boxShadow: "var(--shadow-lg)", padding: 8, zIndex: 60 }}>
            <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid var(--line-1)", marginBottom: 6 }}>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-4)" }}>Signed in</div>
              <div style={{ fontSize: 13, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{who || "your account"}</div>
            </div>
            {ACCOUNT_MENU.map((l) => (
              <Link key={l.href} href={l.href} style={item}><span style={itemIcon}><Ic d={l.d} size={15} sw={1.8} /></span>{l.label}</Link>
            ))}
            <div aria-hidden style={{ borderTop: "1px solid var(--line-1)", margin: "6px 2px" }} />
            {ACCOUNT_MENU_FOOT.map((l) => (
              <Link key={l.href} href={l.href} style={item}><span style={itemIcon}><Ic d={l.d} size={15} sw={1.8} /></span>{l.label}</Link>
            ))}
            <button onClick={() => signOut({ callbackUrl: signOutTarget() })} style={{ ...item, width: "100%", textAlign: "left", color: "var(--err)", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              <span style={{ ...itemIcon, color: "var(--err)" }}><Ic d={I.signout} size={15} sw={1.8} /></span>Sign out
            </button>
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
        <span aria-hidden style={{ display: "inline-flex", color: "var(--fg-4)" }}><Ic d={I.chevron} size={12} sw={2.2} /></span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "var(--bg-1)", border: "1px solid var(--line-2)", borderRadius: 12, boxShadow: "var(--shadow-lg)", padding: 6, zIndex: 70 }}>
          {data.available.map((w) => (
            <button key={w.id} onClick={() => select(w.id)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 10px", borderRadius: 8, border: "none", background: w.id === current.id ? "var(--acc-soft)" : "transparent", cursor: "pointer", textAlign: "left" }}>
              <span style={{ minWidth: 0 }}><span style={{ display: "block", fontSize: 13, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.isPersonal ? "Personal workspace" : w.name}</span><span style={{ fontSize: 10.5, color: "var(--fg-4)" }}>{WS_ROLE[w.role] ?? w.role}</span></span>
              {w.id === current.id ? <span aria-hidden style={{ display: "inline-flex", color: "var(--acc-deep)" }}><Ic d={I.check} size={12} sw={2.4} /></span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AppSidebar({ humanEval }: { humanEval: boolean }) {
  const pathname = usePathname() || "";
  // A retired destination still has to light up the item that replaced it, or a bookmarked /applications URL
  // renders the shell with nothing selected and the user cannot tell where they are.
  const aliasRoot = Object.keys(NAV_ALIASES).find((old) => pathname === old || pathname.startsWith(old + "/"));
  const effective = aliasRoot ? NAV_ALIASES[aliasRoot] : pathname;
  const active = (href: string) => href === "/app"
    ? (effective === "/app" || effective === "/")
    : (effective === href || effective.startsWith(href + "/"));
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
        <a href="https://vraelis.com" className="slink" style={{ color: "var(--fg-3)" }}><span className="slink__i"><Ic d={I.back} /></span>Back to site</a>
        <button onClick={() => signOut({ callbackUrl: signOutTarget() })} className="slink" style={{ color: "var(--fg-3)", width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontSize: 15.5, fontWeight: 500 }}><span className="slink__i"><Ic d={I.signout} /></span>Sign out</button>
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
  // The wordmark is ONE component, but the two shells render at different zooms (0.89 in the app, 0.99 on
  // the site), so an identical 21px renders ~10% smaller in the app and the logo visibly changes size when
  // you cross between them. Scale it back up inside the app by exactly the ratio between the two zooms, so
  // both read at the same optical size. !important because Brand carries an inline font-size.
  // If either zoom in styles.css changes, update the ratio here: it is site-zoom / app-zoom.
  + ".rank-root:not(.rank-root--site) .vra-brand{font-size:calc(21px * (0.99 / 0.89))!important}"
  + "@media (prefers-reduced-motion:reduce){.rank-root .eyebrow,.rank-root .display,.rank-root .lead-copy{animation:none}.rank-root .btn:active,.rank-root a.card:hover,.rank-root a.card:active,.rank-root a.acard:hover,.rank-root a.acard:active{transform:none}}";

export function RankShell({ signedIn = false, email = null, humanEval = false, appHost = false, children }: { signedIn?: boolean; email?: string | null; humanEval?: boolean; appHost?: boolean; children: ReactNode }) {
  const pathname = usePathname() || "";
  // The product answers on the legacy /app prefix (localhost dev) AND the clean subdomain paths
  // (/applications, /passes, ...). On app.vraelis.com the overview is served at "/" — the pathname
  // can't distinguish it from the marketing home, so the server layout passes the host down.
  //
  // /developers is the ONE product path deliberately kept out of APP_ROOTS: the same clean path is public,
  // indexable documentation on vraelis.com and the authenticated console on app.vraelis.com (proxy.ts picks
  // by host). isAppPath is host-agnostic, so it must NOT claim /developers — that would drag the public docs
  // into the app shell too. The host is what tells them apart: on the app host, /developers is the console
  // and renders inside the shell with the left panel like every other product page; on the marketing host it
  // stays public chrome. Same reasoning as "/" above.
  const consolePath = pathname === "/developers" || pathname.startsWith("/developers/");
  const inApp = isAppPath(pathname) || (appHost && (pathname === "/" || consolePath));

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
    <div className="rank-root rank-root--site">
      <style dangerouslySetInnerHTML={{ __html: SHELL_UI_CSS }} />
      <div style={{ position: "sticky", top: 0, zIndex: 50 }}><PublicNav signedIn={signedIn} /></div>
      {children}
      <Footer />
    </div>
  );
}
