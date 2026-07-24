"use client";

// Shared public shell for design 06: one nav, one Resources mega-menu, one mobile full-screen nav, one
// footer, one route transition, used by every v6 route. Sticky nav goes transparent -> blurred on scroll and
// flips to a dark treatment over graphite (live-work) sections. Client-side nav with prefetch (next/link).
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE = "/dev-preview/v6";
const SIGNIN = "/signin?callbackUrl=%2Fapp";

const MAIN: { label: string; href: string }[] = [
  { label: "Platform", href: `${BASE}/platform` },
  { label: "Agents", href: `${BASE}/agents` },
  { label: "Research", href: `${BASE}/research` },
  { label: "Developers", href: `${BASE}/developers` },
];

const MEGA: { h: string; links: { t: string; d: string; href: string }[] }[] = [
  { h: "Learn", links: [
    { t: "Documentation", d: "Use and administer Vraelis", href: `${BASE}/docs` },
    { t: "Vraelis Method", d: "The worldview behind the product", href: `${BASE}/method` },
    { t: "README", d: "Why Vraelis exists", href: `${BASE}/readme` },
    { t: "Changelog", d: "What shipped, dated", href: `${BASE}/changelog` },
  ] },
  { h: "Build", links: [
    { t: "Developer docs", d: "Build on the API", href: `${BASE}/developers` },
    { t: "API", d: "Create and read verifications", href: `${BASE}/developers#api` },
    { t: "CLI", d: "One command, one exit code", href: `${BASE}/developers#cli` },
    { t: "Webhooks", d: "verification.completed", href: `${BASE}/developers#webhooks` },
    { t: "Integrations", d: "GitHub, Vercel, Slack", href: `${BASE}/integrations` },
  ] },
  { h: "Trust", links: [
    { t: "Security", d: "Architecture and data handling", href: `${BASE}/security` },
    { t: "System status", d: "What is operational", href: `${BASE}/security#status` },
    { t: "Current capabilities", d: "Live today vs direction", href: `${BASE}/platform#current` },
    { t: "Contact", d: "Talk to the team", href: `${BASE}/company#contact` },
  ] },
];

function Brand() {
  return <Link href={BASE} className="v6-brand" aria-label="Vraelis home">Vraelis</Link>;
}

function ResourcesMega({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="v6-mega">
      <div className="v6-mega__panel">
        <div className="v6-mega__grid">
          {MEGA.map((col) => (
            <div key={col.h}>
              <p className="v6-mega__col-h">{col.h}</p>
              {col.links.map((l) => (
                <Link key={l.t} href={l.href} className="v6-mega__link" onClick={onNavigate}>
                  <span className="v6-mega__lt">{l.t}</span>
                  <span className="v6-mega__ld">{l.d}</span>
                </Link>
              ))}
            </div>
          ))}
          <Link href={`${BASE}/platform`} className="v6-mega__feature" onClick={onNavigate}>
            <span className="v6-eyebrow" style={{ color: "var(--go-dk)" }}>The platform</span>
            <h4>One system that follows the work</h4>
            <p>Responsibility, live activity, review, findings, repair, and memory, in one place.</p>
            <span className="v6-elink" style={{ marginTop: "auto", color: "var(--g-fg)" }}><span className="v6-elink__t">Explore the platform</span><span className="v6-arw" aria-hidden>→</span></span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function V6Nav() {
  const pathname = usePathname() || "";
  const navRef = useRef<HTMLElement>(null);
  const resBtn = useRef<HTMLButtonElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [dark, setDark] = useState(false);
  const [menu, setMenu] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const closeT = useRef(0);

  useEffect(() => {
    const nav = navRef.current;
    const onScroll = () => {
      setScrolled(window.scrollY > 4);
      const h = nav?.offsetHeight ?? 56;
      const el = document.elementFromPoint(Math.round(window.innerWidth / 2), h + 2);
      setDark(!!(el && (el as Element).closest?.("[data-nav-dark]")));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, [pathname]);

  // close menus on route change (deferred so it is not a synchronous setState in the effect body)
  useEffect(() => {
    const id = requestAnimationFrame(() => { setMenu(false); setDrawer(false); });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  // Escape + click-outside for the mega-menu
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenu(false); resBtn.current?.focus(); } };
    const onDown = (e: PointerEvent) => { if (!navRef.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown, true); };
  }, [menu]);

  const openMenu = useCallback(() => { window.clearTimeout(closeT.current); setMenu(true); }, []);
  const scheduleClose = useCallback(() => { closeT.current = window.setTimeout(() => setMenu(false), 140); }, []);

  return (
    <nav ref={navRef} className="v6-nav" data-scrolled={scrolled} data-theme={dark ? "dark" : "light"} data-open={menu} aria-label="Primary"
      onMouseLeave={scheduleClose}>
      <div className="v6-nav__in">
        <Brand />
        <div className="v6-nav__items">
          {MAIN.map((l) => (
            <Link key={l.label} href={l.href} className="v6-nav__item" aria-current={pathname === l.href ? "page" : undefined}>{l.label}</Link>
          ))}
          <button ref={resBtn} type="button" className="v6-nav__item" aria-expanded={menu} aria-haspopup="true"
            onClick={() => setMenu((v) => !v)} onMouseEnter={openMenu} onFocus={openMenu}>
            Resources <span className="v6-nav__caret" aria-hidden />
          </button>
          <Link href={`${BASE}/company`} className="v6-nav__item" aria-current={pathname === `${BASE}/company` ? "page" : undefined}>Company</Link>
        </div>
        <div className="v6-nav__right">
          <Link href={SIGNIN} className="v6-nav__signin">Sign in</Link>
          <Link href={SIGNIN} className="v6-btn v6-btn--brand">Open Vraelis</Link>
          <button className="v6-nav__burger" aria-label="Open navigation" aria-haspopup="dialog" onClick={() => setDrawer(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
        </div>
      </div>
      {menu ? <div onMouseEnter={openMenu} onMouseLeave={scheduleClose}><ResourcesMega onNavigate={() => setMenu(false)} /></div> : null}
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
    <div ref={panel} className="v6-drawer" role="dialog" aria-modal="true" aria-label="Navigation">
      <div className="v6-drawer__top">
        <Brand />
        <button className="v6-drawer__x" aria-label="Close navigation" onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M6 18L18 6" /></svg>
        </button>
      </div>
      <div className="v6-drawer__body">
        {MAIN.map((l) => <Link key={l.label} href={l.href} className="v6-drawer__link" onClick={onClose} aria-current={pathname === l.href ? "page" : undefined}>{l.label}</Link>)}
        <Link href={`${BASE}/company`} className="v6-drawer__link" onClick={onClose}>Company</Link>
        {MEGA.map((col) => (
          <div key={col.h} className="v6-drawer__sub">
            <p className="v6-drawer__sub-h">{col.h}</p>
            <div className="v6-drawer__sub-links">
              {col.links.map((l) => <Link key={l.t} href={l.href} onClick={onClose}>{l.t}</Link>)}
            </div>
          </div>
        ))}
        <div className="v6-drawer__cta">
          <Link href={SIGNIN} className="v6-btn v6-btn--ghost" onClick={onClose}>Sign in</Link>
          <Link href={SIGNIN} className="v6-btn v6-btn--brand" onClick={onClose}>Open Vraelis <span className="v6-arw" aria-hidden>→</span></Link>
        </div>
      </div>
    </div>
  );
}

function Soc() {
  return (
    <div className="v6-foot__soc">
      <a href="https://x.com/vraelis" target="_blank" rel="noreferrer" aria-label="Vraelis on X"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2H22l-7.5 8.57L23 22h-6.9l-5.4-7.06L4.5 22H1.4l8-9.17L1 2h7.06l4.9 6.48L18.9 2Zm-1.2 18h1.7L7.2 3.9H5.4L17.7 20Z" /></svg></a>
      <a href="https://www.linkedin.com/company/vraelis" target="_blank" rel="noreferrer" aria-label="Vraelis on LinkedIn"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M20.4 20.4h-3.5v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.4V9h3.3v1.6h.1c.5-.9 1.6-1.8 3.3-1.8 3.6 0 4.3 2.4 4.3 5.4v6.2zM5.3 7.4a2.1 2.1 0 1 1 0-4.1 2.1 2.1 0 0 1 0 4.1zM7.1 20.4H3.5V9h3.6v11.4zM22.2 0H1.8C.8 0 0 .8 0 1.7v20.5C0 23.2.8 24 1.8 24h20.4c1 0 1.8-.8 1.8-1.7V1.7C24 .8 23.2 0 22.2 0z" /></svg></a>
      <a href="https://github.com/vraelis" target="_blank" rel="noreferrer" aria-label="Vraelis on GitHub"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.26-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 22 12 10 10 0 0 0 12 2z" /></svg></a>
    </div>
  );
}

function FootCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="v6-foot__col">
      <div className="v6-foot__h">{title}</div>
      {links.map(([href, label]) => <Link key={label} href={href}>{label}</Link>)}
    </div>
  );
}

function Footer() {
  return (
    <footer className="v6-foot">
      <div className="v6-foot__grid">
        <div className="v6-foot__brandcol">
          <Brand />
          <p className="v6-foot__blurb">Independent oversight for AI software agents, from assigned responsibility to trusted completion.</p>
          <Soc />
        </div>
        <FootCol title="Product" links={[[`${BASE}/platform`, "Platform"], [`${BASE}/agents`, "Agents"], [`${BASE}/integrations`, "Integrations"], [`${BASE}/platform#current`, "Capabilities"]]} />
        <FootCol title="Developers" links={[[`${BASE}/developers`, "Developer docs"], [`${BASE}/developers#api`, "API"], [`${BASE}/developers#cli`, "CLI"], [`${BASE}/developers#webhooks`, "Webhooks"]]} />
        <FootCol title="Learn" links={[[`${BASE}/docs`, "Documentation"], [`${BASE}/method`, "Method"], [`${BASE}/readme`, "README"], [`${BASE}/changelog`, "Changelog"], [`${BASE}/research`, "Research"]]} />
        <FootCol title="Company" links={[[`${BASE}/company`, "About"], [`${BASE}/security`, "Security"], [`${BASE}/company#contact`, "Contact"], ["/privacy", "Privacy"], ["/terms", "Terms"]]} />
      </div>
      <div className="v6-foot__base">
        <span>© 2026 Vraelis. All rights reserved.</span>
        <span>Oversight for AI software agents.</span>
      </div>
    </footer>
  );
}

export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div key={pathname} className="v6-page">{children}</div>;
}

export function V6Shell({ children }: { children: ReactNode }) {
  return (
    <div className="v6">
      <V6Nav />
      <main><RouteTransition>{children}</RouteTransition></main>
      <Footer />
    </div>
  );
}
