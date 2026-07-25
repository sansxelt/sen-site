"use client";

// Shared public shell for design 06: one nav, one Resources mega-menu, one mobile full-screen nav, one
// footer, one route transition, used by every v6 route. Sticky nav goes transparent -> blurred on scroll and
// flips to a dark treatment over graphite (live-work) sections. Client-side nav with prefetch (next/link).
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiteFooter } from "./close";

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
    { t: "Current capabilities", d: "What is built, and what is not", href: `${BASE}/platform#current` },
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
            {/* brand indigo, not green: green is reserved for successful states */}
            <span className="v6-eyebrow" style={{ color: "var(--brand-dk)" }}>The platform</span>
            <h4>What the product actually does</h4>
            <p>Requirements, runs, findings, review, repair, and the record, in one place.</p>
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

  // Publish the real nav height as --nav-h. The hero and the lifecycle scene both size themselves against it,
  // and it changes with the wordmark size and the viewport, so measuring beats the hardcoded fallback.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const root = nav.closest(".v6") as HTMLElement | null;
    if (!root) return;
    const publish = () => root.style.setProperty("--nav-h", `${Math.round(nav.offsetHeight)}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(nav);
    return () => ro.disconnect();
  }, []);

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
          {/* No onFocus opener: it re-fired when the Escape handler restored focus (so Escape could never
              close the panel), and it sprang the panel open merely by tabbing through the nav. Pointer users
              get hover; keyboard users open it with Enter or Space on this real button. */}
          <button ref={resBtn} type="button" className="v6-nav__item" aria-expanded={menu} aria-haspopup="true"
            onClick={() => setMenu((v) => !v)} onMouseEnter={openMenu}>
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
    // Focus the close button, not the first link: landing on the wordmark drew a focus ring around the logo,
    // which read as a rendering bug when the drawer was opened by tapping.
    (panel.current?.querySelector<HTMLElement>(".v6-drawer__x") ?? focusables()[0])?.focus();
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
      </div>
      <div className="v6-drawer__foot">
        <Link href={SIGNIN} className="v6-btn v6-btn--ghost" onClick={onClose}>Sign in</Link>
        <Link href={SIGNIN} className="v6-btn v6-btn--brand" onClick={onClose}>Open Vraelis <span className="v6-arw" aria-hidden>→</span></Link>
      </div>
    </div>
  );
}

export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div key={pathname} className="v6-page">{children}</div>;
}

export function V6Shell({ children }: { children: ReactNode }) {
  return (
    <div className="v6">
      {/* Nine focus stops sit in the nav before any content. Keyboard and screen-reader users get one stop to
          jump past them; it is invisible until focused. */}
      <a href="#v6-main" className="v6-skip">Skip to content</a>
      <V6Nav />
      <main id="v6-main" tabIndex={-1}><RouteTransition>{children}</RouteTransition></main>
      <SiteFooter />
    </div>
  );
}
