"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { PrivacyChoicesButton } from "@/app/_components/privacy-choices-button";
import { Brand, INTRO_SKIP, Mark, Wordmark, glideToTop } from "./logo";
import { ThemeToggle } from "./theme";
import { DRAWER_FEATURED, DRAWER_LINKS, FOOTER, FOOTER_QUICK, MENUS, href, localHref, type Menu } from "./site";

/** The docs draw their own header and footer (docs/layout.tsx), on this host as on docs.vraelis.com, so the site's
 *  step aside there. Decided from the path, so it also holds after a client-side navigation into or out of the docs. */
export function useOnDocs() {
  const pathname = usePathname();
  const base = localHref("/docs");
  return pathname === base || pathname.startsWith(`${base}/`);
}

// THE V8 HEADER. x.ai's shape: a 64px frosted bar whose bottom rule fades in over the first 72px of scroll, menus
// that open on hover with a short intent delay or on click, and a mega panel whose preview pane swaps to the
// hovered link's own picture. Previews are real app captures or licensed photographs, never rebuilt windows.
// Join us is a split button: the label opens the Contour inquiry, the caret lists the other routes into the same
// intake. Escape closes and returns focus to the trigger; focus leaving a menu closes it.

const OPEN_DELAY = 70;
const CLOSE_DELAY = 180;

function MegaPanel({ menu, open, id, onNavigate }: { menu: Menu; open: boolean; id: string; onNavigate: () => void }) {
  const [active, setActive] = useState(0);
  // Closing resets the preview to the first link (state adjusted during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) { setWasOpen(open); if (!open) setActive(0); }
  return (
    <div id={id} className="v8-panel" data-open={open} role="region" aria-label={`${menu.label} menu`}>
      <div className="v8-mega">
        <div className="v8-mega__list">
          {menu.links.map((l, i) => (
            <Link key={l.to} href={href(l.to)} className="v8-mega__link" data-active={i === active}
              onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onClick={onNavigate}>
              <b>{l.label}</b>{l.line ? <span>{l.line}</span> : null}
            </Link>
          ))}
          {menu.foot ? <p className="v8-mega__foot">{menu.foot}</p> : null}
        </div>
        <div className="v8-mega__preview" aria-hidden="true">
          {menu.links.map((l, i) => l.preview ? (
            // Plain img: these are already sized, and a menu that is closed must not reserve loading priority.
            // eslint-disable-next-line @next/next/no-img-element
            <img key={l.to} src={l.preview} alt="" loading="lazy" decoding="async" data-on={i === active} className="v8-mega__shot" />
          ) : null)}
          <p className="v8-mega__cap">Vraelis Contour app, recorded run</p>
        </div>
      </div>
    </div>
  );
}

function ListPanel({ links, open, id, onNavigate, align = "left" }: { links: { label: string; to: string; hint?: string }[]; open: boolean; id: string; onNavigate: () => void; align?: "left" | "right" }) {
  return (
    <div id={id} className="v8-panel" data-open={open} style={align === "right" ? { right: 0, left: "auto", transformOrigin: "top right" } : undefined}>
      <nav className="v8-menu">
        {links.map((l) => (
          <Link key={l.to} href={href(l.to)} onClick={onNavigate}>{l.label}{l.hint ? <small>{l.hint}</small> : null}</Link>
        ))}
      </nav>
    </div>
  );
}

export function V8Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const header = useRef<HTMLElement>(null);
  const navId = useId().replace(/:/g, "") + "-nav";
  const navRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ x: number; w: number; on: boolean }>({ x: 0, w: 0, on: false });
  const pillTo = (el: HTMLElement | null) => {
    const nav = navRef.current; if (!el || !nav) return;
    const n = nav.getBoundingClientRect(), r = el.getBoundingClientRect();
    setPill({ x: r.left - n.left, w: r.width, on: true });
  };
  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const later = (fn: () => void, ms: number) => { clear(); timer.current = setTimeout(fn, ms); };
  const close = useCallback(() => { clear(); setOpen(null); }, []);

  // The rule under the bar fades in with scroll, as x.ai's does.
  useEffect(() => {
    const el = header.current; if (!el) return;
    const on = () => el.style.setProperty("--rule", String(Math.min(1, window.scrollY / 72)));
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  // Every page starts at the top, on navigation and on reload (x.ai); a link to a section still lands on it.
  useEffect(() => {
    try { history.scrollRestoration = "manual"; } catch { /* old browsers */ }
    if (!location.hash) window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  // A route change closes everything (state adjusted during render, not in an effect).
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) { setSeenPath(pathname); setOpen(null); setDrawer(false); }
  // Escape closes the open menu and returns focus to its trigger.
  useEffect(() => {
    if (!open && !drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (open) { document.getElementById(`v8-trigger-${open}`)?.focus(); setOpen(null); }
      if (drawer) setDrawer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, drawer]);
  // The phone drawer pins the page behind it (iOS ignores overflow hidden on body). Opening it also settles the logo
  // intro on the mark (x.ai's menu shows only its mark; a half-dissolved name beside the menu read as broken).
  useEffect(() => {
    if (!drawer) return;
    window.dispatchEvent(new Event(INTRO_SKIP));
    const y = window.scrollY, s = document.body.style;
    const prev = { position: s.position, top: s.top, width: s.width };
    s.position = "fixed"; s.top = `-${y}px`; s.width = "100%";
    return () => { s.position = prev.position; s.top = prev.top; s.width = prev.width; window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }); };
  }, [drawer]);

  const onDocs = useOnDocs();
  const isCurrent = (to: string) => pathname === href(to) || pathname.startsWith(`${href(to)}/`);
  const item = (id: string, label: string, panel: ReactNode, current: boolean) => (
    <div key={id} style={{ position: "relative" }}
      onMouseEnter={() => later(() => setOpen(id), open ? 0 : OPEN_DELAY)}
      onMouseLeave={() => later(() => setOpen((o) => (o === id ? null : o)), CLOSE_DELAY)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen((o) => (o === id ? null : o)); }}>
      <button id={`v8-trigger-${id}`} type="button" className="v8-nav__item" onMouseEnter={(e) => pillTo(e.currentTarget)} onFocus={(e) => pillTo(e.currentTarget)} aria-expanded={open === id} aria-controls={`v8-panel-${id}`}
        aria-current={current ? "page" : undefined} onClick={() => { clear(); setOpen((o) => (o === id ? null : id)); }}>
        {label}<span className="v8-caret" aria-hidden="true" />
      </button>
      {panel}
    </div>
  );

  if (onDocs) return null;
  return (
    <>
      <a className="v8-skip" href="#v8-main">Skip to content</a>
      <header ref={header} className="v8-header" data-open={!!open || drawer}>
        <div className="v8-wrap v8-wrap--frame v8-header__bar">
          <Brand home={href("/")} navId={navId} />
          <nav id={navId} ref={navRef} className="v8-nav" aria-label="Main" onMouseLeave={() => setPill((p) => ({ ...p, on: false }))}>
            <span className="v8-nav__pill" aria-hidden="true" data-on={pill.on || !!open} style={{ transform: `translateX(${pill.x}px)`, width: pill.w }} />
            {MENUS.map((m) => item(m.id, m.label,
              m.kind === "mega"
                ? <MegaPanel menu={m} open={open === m.id} id={`v8-panel-${m.id}`} onNavigate={close} />
                : <ListPanel links={m.links} open={open === m.id} id={`v8-panel-${m.id}`} onNavigate={close} />,
              m.links.some((l) => isCurrent(l.to.split("#")[0].split("?")[0]))))}
            <Link className="v8-nav__item" href={href("/docs")} aria-current={isCurrent("/docs") ? "page" : undefined} onMouseEnter={(e) => { setOpen(null); pillTo(e.currentTarget); }} onFocus={(e) => pillTo(e.currentTarget)}>Docs</Link>
          </nav>
          <div className="v8-header__end">
            {/* One way in, as on scale.com where Contact and Get Started are the same form (founder, 2026-10-11). */}
            {/* The nav items' height, 36px, so it sits on their line (founder, 2026-10-12: the hero size was "way too big"). */}
            {/* Log in sits right beside Join us, as on scale.com (founder, 2026-10-22). Login only; no sign-up. */}
            <Link className="v8-header__login" href={href("/login")} aria-current={isCurrent("/login") ? "page" : undefined}>Log In</Link>
            <Link className="v8-btn v8-btn--solid v8-btn--sm v8-header__join" href={href("/contact")}>Join Us</Link>
            <button type="button" className="v8-burger" aria-label={drawer ? "Close menu" : "Open menu"} aria-expanded={drawer} aria-controls="v8-drawer"
              onClick={() => setDrawer((d) => !d)}><span aria-hidden="true" /></button>
          </div>
          <span className="v8-header__rule" aria-hidden="true" />
        </div>
      </header>
      <div id="v8-drawer" className="v8-drawer" data-open={drawer} hidden={!drawer}>
        {MENUS.map((m) => (
          <details key={m.id}>
            <summary>{m.label}<span className="v8-caret" aria-hidden="true" /></summary>
            <ul>{m.links.map((l) => <li key={l.to}><Link href={href(l.to)} onClick={() => setDrawer(false)}>{l.label}</Link></li>)}</ul>
          </details>
        ))}
        <Link href={href("/docs")} onClick={() => setDrawer(false)}>Docs</Link>
        {/* The drawer uses its whole height (founder, 2026-10-18): featured cards with their own pictures, then one
            button (founder: one contact, worded Join us), then the small links. */}
        <section className="v8-drawer__feature" aria-label="Featured">
          <p className="v8-drawer__label">Featured</p>
          <div className="v8-drawer__cards">
            {DRAWER_FEATURED.map((f) => (
              <Link key={f.to} href={href(f.to)} className="v8-drawer__card" onClick={() => setDrawer(false)}>
                <span className="v8-drawer__pic" data-capture={"capture" in f || undefined}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.img} alt={f.alt} loading="lazy" decoding="async" />
                </span>
                <b>{f.label}</b>
                <span>{f.line}</span>
              </Link>
            ))}
          </div>
        </section>
        <div className="v8-drawer__ctas">
          <div className="v8-drawer__pair">
            <Link className="v8-btn v8-btn--solid v8-btn--lg" href={href("/contact")} onClick={() => setDrawer(false)}>Join Us</Link>
            <Link className="v8-btn v8-btn--ghost v8-btn--lg" href={href("/login")} onClick={() => setDrawer(false)}>Log In</Link>
          </div>
          <nav className="v8-drawer__links" aria-label="More">
            {DRAWER_LINKS.map((l) => <Link key={l.to} href={href(l.to)} onClick={() => setDrawer(false)}>{l.label}</Link>)}
          </nav>
        </div>
      </div>
    </>
  );
}

export function V8Footer() {
  if (useOnDocs()) return null;
  return (
    <footer className="v8-footer">
      <div className="v8-wrap v8-wrap--frame">
        <div className="v8-footer__grid">
          <div className="v8-footer__brand">
            <button type="button" className="v8-lockup" aria-label="Back to top" onClick={glideToTop}><Mark /><Wordmark height={14.25} /></button>
            <p className="v8-small" style={{ color: "var(--ink-4)" }}>© 2026 Vraelis</p>
            <ul className="v8-footer__quick">{FOOTER_QUICK.map((l) => <li key={l.to}><Link href={href(l.to)}>{l.label}</Link></li>)}</ul>
          </div>
          {FOOTER.map((col) => (
            <div key={col.title}>
              <h2>{col.title}</h2>
              <ul>
                {col.links.map((l) => <li key={l.label}><Link href={href(l.to)}>{l.label}</Link></li>)}
                {col.title === "Legal" ? <li><PrivacyChoicesButton /></li> : null}
              </ul>
            </div>
          ))}
        </div>
        <div className="v8-footer__bottom">
          <div className="v8-footer__legal">
            <ThemeToggle />
            <a className="v8-affil" href="https://foremake.com/" target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/v8/brand/foremake-logo.jpg" alt="" width={22} height={22} />By Foremake, Inc
            </a>
          </div>
          <nav aria-label="Footer">
            <a href="https://www.linkedin.com/company/vraelis" rel="noopener noreferrer" target="_blank">LinkedIn</a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
