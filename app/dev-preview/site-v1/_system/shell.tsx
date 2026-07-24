"use client";

// Shared public-site shell for site-v1: one nav, one footer, one route transition, used by every page.
// Sticky nav goes transparent -> blurred at the top edge on scroll, and flips to a dark treatment while a
// dark evidence section sits under it (sections opt in with data-nav-dark). Mobile is an authored, focus-
// trapped drawer. In this preview only Home and Product are built; the other routes render as "soon".
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE = "/dev-preview/site-v1";
const SIGNIN = "/signin?callbackUrl=%2Fapp";

// label, href (null = not built in this preview -> rendered as "soon")
const NAV: { label: string; href: string | null }[] = [
  { label: "Product", href: `${BASE}/product` },
  { label: "Research", href: null },
  { label: "Developers", href: null },
  { label: "Pricing", href: null },
  { label: "Enterprise", href: null },
];

function Brand({ dark = false }: { dark?: boolean }) {
  return <Link href={BASE} className="sv1-brand" aria-label="Vraelis home" style={dark ? { color: "var(--sv-dfg)" } : undefined}>Vraelis</Link>;
}

function Burger({ onClick }: { onClick: () => void }) {
  return (
    <button className="sv1-nav__burger" aria-label="Open navigation" aria-haspopup="dialog" onClick={onClick}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
    </button>
  );
}

function PublicNav() {
  const pathname = usePathname() || "";
  const navRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [dark, setDark] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    const nav = navRef.current;
    const onScroll = () => {
      setScrolled(window.scrollY > 4);
      const h = nav?.offsetHeight ?? 56;
      const el = typeof document !== "undefined" ? document.elementFromPoint(Math.round(window.innerWidth / 2), h + 2) : null;
      setDark(!!(el && (el as Element).closest && (el as Element).closest("[data-nav-dark]")));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, [pathname]);

  return (
    <nav ref={navRef} className="sv1-nav" data-scrolled={scrolled} data-theme={dark ? "dark" : "light"} aria-label="Primary">
      <div className="sv1-nav__in">
        <Brand dark={dark} />
        <div className="sv1-nav__links">
          {NAV.map((l) => l.href
            ? <Link key={l.label} href={l.href} className="sv1-nav__link" aria-current={pathname === l.href ? "page" : undefined}>{l.label}</Link>
            : <span key={l.label} className="sv1-nav__soon" title="Arrives in a later stage">{l.label}</span>)}
        </div>
        <div className="sv1-nav__right">
          <Link href={SIGNIN} className="sv1-nav__signin">Sign in</Link>
          <Link href={SIGNIN} className="sv1-cta">Verify an application</Link>
          <Burger onClick={() => setDrawer(true)} />
        </div>
      </div>
      {drawer ? <MobileNav pathname={pathname} onClose={() => setDrawer(false)} /> : null}
    </nav>
  );
}

function MobileNav({ pathname, onClose }: { pathname: string; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () => Array.from(panel.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])') ?? []);
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      const f = focusables(); if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [onClose]);

  return (
    <div className="sv1-drawer-root" role="presentation">
      <div className="sv1-drawer-scrim" onClick={onClose} aria-hidden />
      <div ref={panel} className="sv1-drawer" role="dialog" aria-modal="true" aria-label="Navigation">
        <div className="sv1-drawer__head">
          <Brand />
          <button className="sv1-drawer__x" aria-label="Close navigation" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M6 18L18 6" /></svg>
          </button>
        </div>
        {NAV.map((l) => l.href
          ? <Link key={l.label} href={l.href} className="sv1-drawer__link" aria-current={pathname === l.href ? "page" : undefined} onClick={onClose}>{l.label}</Link>
          : <span key={l.label} className="sv1-drawer__link" style={{ color: "var(--sv-meta)", opacity: 0.72 }}>{l.label} <span className="sv1-tlabel">soon</span></span>)}
        <Link href={SIGNIN} className="sv1-drawer__link" onClick={onClose}>Sign in</Link>
        <Link href={SIGNIN} className="sv1-cta sv1-cta--lg sv1-drawer__cta" onClick={onClose}>Verify an application <span className="sv1-arrow" aria-hidden>→</span></Link>
      </div>
    </div>
  );
}

function Soc() {
  // real brand accounts only
  return (
    <div className="sv1-foot__soc">
      <a href="https://instagram.com/usevraelis" target="_blank" rel="noreferrer" aria-label="Vraelis on Instagram">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5.5" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" /></svg>
      </a>
      <a href="https://x.com/vraelis" target="_blank" rel="noreferrer" aria-label="Vraelis on X">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2H22l-7.5 8.57L23 22h-6.9l-5.4-7.06L4.5 22H1.4l8-9.17L1 2h7.06l4.9 6.48L18.9 2Zm-1.2 18h1.7L7.2 3.9H5.4L17.7 20Z" /></svg>
      </a>
      <a href="https://www.linkedin.com/company/vraelis" target="_blank" rel="noreferrer" aria-label="Vraelis on LinkedIn">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
      </a>
    </div>
  );
}

function FootCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="sv1-foot__col">
      <div className="sv1-foot__h">{title}</div>
      {links.map(([href, label]) => <Link key={label} href={href}>{label}</Link>)}
    </div>
  );
}

function PublicFooter() {
  return (
    <footer className="sv1-foot">
      <div className="sv1-foot__grid">
        <div className="sv1-foot__brandcol">
          <Brand />
          <p className="sv1-foot__blurb">Independent proof for AI-built software. Hold the requirements your business depends on outside the code, and let Vraelis prove the live software against them.</p>
          <Soc />
        </div>
        <FootCol title="Product" links={[[`${BASE}`, "Overview"], [`${BASE}/product`, "The Guarantee"], ["/limitations", "What is live"], ["/pricing", "Pricing"]]} />
        <FootCol title="Developers" links={[["/developers", "Developer overview"], ["/developers#ci-gate", "CI gate"], [SIGNIN, "API and webhooks"]]} />
        <FootCol title="Company" links={[["/research", "Research"], ["/enterprise", "Enterprise"], ["/contact", "Contact"]]} />
        <FootCol title="Legal" links={[["/privacy", "Privacy"], ["/terms", "Terms"], ["/refunds", "Refunds"], ["/data-rights", "Data rights"], ["/subprocessors", "Subprocessors"], ["/trademark", "Trademark"]]} />
      </div>
      <div className="sv1-foot__base">
        <span>© 2026 Vraelis. All rights reserved.</span>
        <span>Questions? <Link href="/contact">Contact us</Link></span>
      </div>
    </footer>
  );
}

/* Page-body route transition: fades + rises on each route mount; shell (nav/footer) persists. */
export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div key={pathname} className="sv1-page">{children}</div>;
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="sv1">
      <PublicNav />
      <main><RouteTransition>{children}</RouteTransition></main>
      <PublicFooter />
    </div>
  );
}
