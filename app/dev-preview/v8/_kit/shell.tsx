"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { PrivacyChoicesButton } from "@/app/_components/privacy-choices-button";
import { Brand, Mark } from "./logo";
import { FOOTER, FOREMAKE, JOIN, MENUS, href, type Menu } from "./site";

// THE V8 HEADER. x.ai's shape: a 64px frosted bar whose bottom rule fades in over the first 72px of scroll, menus
// that open on hover with a short intent delay or on click, and a mega panel whose preview pane swaps to the
// hovered link's own picture. Previews are real app captures or licensed photographs, never rebuilt windows.
// Join us is a split button: the label opens the Contour inquiry, the caret lists the other routes into the same
// intake. Escape closes and returns focus to the trigger; focus leaving a menu closes it.

const OPEN_DELAY = 70;
const CLOSE_DELAY = 180;

function MegaPanel({ menu, open, id, onNavigate }: { menu: Menu; open: boolean; id: string; onNavigate: () => void }) {
  const [active, setActive] = useState(0);
  useEffect(() => { if (!open) setActive(0); }, [open]);
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
  // A route change closes everything.
  useEffect(() => { setOpen(null); setDrawer(false); }, [pathname]);
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
  // The phone drawer pins the page behind it (iOS ignores overflow hidden on body).
  useEffect(() => {
    if (!drawer) return;
    const y = window.scrollY, s = document.body.style;
    const prev = { position: s.position, top: s.top, width: s.width };
    s.position = "fixed"; s.top = `-${y}px`; s.width = "100%";
    return () => { s.position = prev.position; s.top = prev.top; s.width = prev.width; window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }); };
  }, [drawer]);

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
            <Link className="v8-btn v8-btn--soft v8-btn--sm" href={href("/contact")}>Contact</Link>
            <Link className="v8-btn v8-btn--solid v8-btn--sm" href={href(JOIN[0].to)}>Join us</Link>
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
        <div className="v8-drawer__ctas">
          <Link className="v8-btn v8-btn--solid v8-btn--lg" href={href(JOIN[0].to)} onClick={() => setDrawer(false)}>Join us</Link>
          <Link className="v8-btn v8-btn--soft v8-btn--lg" href={href("/contact")} onClick={() => setDrawer(false)}>Contact</Link>
        </div>
      </div>
    </>
  );
}

export function V8Footer() {
  return (
    <footer className="v8-footer">
      <div className="v8-wrap v8-wrap--frame">
        <div className="v8-footer__grid">
          <div className="v8-footer__brand">
            <Link href={href("/")} className="v8-lockup" aria-label="Vraelis home"><Mark />Vraelis</Link>
            <p className="v8-small" style={{ maxWidth: "30ch" }}>AI security for defense, critical infrastructure and autonomous systems.</p>
            <p className="v8-small" style={{ maxWidth: "34ch", color: "var(--ink-4)" }}>{FOREMAKE}</p>
          </div>
          {FOOTER.map((col) => (
            <div key={col.title}>
              <h2>{col.title}</h2>
              <ul>{col.links.map((l) => <li key={l.label}><Link href={href(l.to)}>{l.label}</Link></li>)}</ul>
            </div>
          ))}
        </div>
        <div className="v8-footer__bottom">
          <span>© 2026 Vraelis</span>
          <nav aria-label="Footer">
            <a href="https://www.linkedin.com/company/vraelis" rel="noopener noreferrer" target="_blank">LinkedIn</a>
            <PrivacyChoicesButton />
          </nav>
        </div>
      </div>
    </footer>
  );
}
