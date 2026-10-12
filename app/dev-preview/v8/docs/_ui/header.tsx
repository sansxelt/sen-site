"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Mark, Wordmark } from "../../_kit/logo";
import { localHref } from "../../_kit/site";
import { ThemeToggle } from "../../_kit/theme";
import type { NavBranch, NavLeaf, NavTab, TabId } from "../_data/types";
import { AskButton } from "./ask-button";
import { Go, useDocsLink, useDocsMain, useDocsPlace } from "./host";
import { SearchPill } from "./search";

// THE DOCS HEADER (x.ai's docs, founder 2026-10-10: "That's literally what I meant"). One bar, on both hosts, with no
// site header above it: the Vraelis lockup at left goes to the main site's homepage and "Docs" to the docs home; the
// product tabs sit in the middle, Products with a menu as x.ai's API; at right the theme toggle, search with its
// shortcut, Ask AI, and the primary pill, Join us, split with a menu of the other ways out (x.ai's "API Console").
// Below 900px the tabs move to a row of their own that scrolls sideways and the sidebar folds into the menu sheet;
// on a phone Join us and the theme toggle move into the sheet too.

function Chevron() {
  return <svg className="v8-dhd__chev" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="4,6 8,10 12,6" /></svg>;
}
function MenuIcon({ open }: { open: boolean }) {
  return open
    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 8h16M4 16h16" /></svg>;
}
export function OutArrow() {
  return <svg className="v8-out" width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 2.5h6v6M9.5 2.5l-7 7" /></svg>;
}

/** One dropdown: opens on click, closes on Escape (focus back to its button), a click outside, or a choice. */
function useMenu() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null); // a card drawn elsewhere (a portal) still counts as inside the menu
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { const t = e.target as Node; if (!box.current?.contains(t) && !card.current?.contains(t)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return { open, setOpen, box, button, card };
}

/** The sidebar tree (Scale's docs): large topic headings; under each, pages and expandable subtopics. A subtopic opens
 *  by itself when the current page is inside it, and the reader can open or close any of them. */
export function NavTree({ tab, onNavigate }: { tab: NavTab; onNavigate?: () => void }) {
  const link = useDocsLink();
  const { pathname } = useDocsPlace({});
  const row = (it: NavLeaf) => {
    const to = link(it.to);
    return (
      <li key={it.to}>
        <Go to={to} onClick={onNavigate} aria-current={to === pathname ? "page" : undefined}>
          <span>{it.label}</span>{it.badge ? <em className="v8-dsb__badge">{it.badge}</em> : null}
        </Go>
      </li>
    );
  };
  return (
    <>
      {tab.topics.map((t) => (
        <div key={t.title} className="v8-dsb__topic">
          <p className="v8-dsb__topichead">{t.title}</p>
          <ul>
            {t.items.map((it) => ("items" in it
              ? <Branch key={it.label} branch={it} current={it.items.some((x) => link(x.to) === pathname)} row={row} />
              : row(it)))}
          </ul>
        </div>
      ))}
    </>
  );
}

function Branch({ branch, current, row }: { branch: NavBranch; current: boolean; row: (it: NavLeaf) => ReactNode }) {
  const [open, setOpen] = useState(current);
  const id = useId();
  // Arriving on a page inside it opens it (state adjusted during render, not in an effect).
  const [was, setWas] = useState(current);
  if (current !== was) { setWas(current); if (current) setOpen(true); }
  return (
    <li className="v8-dsb__branch" data-open={open}>
      <button type="button" className="v8-dsb__branchbtn" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <span>{branch.label}</span><Chevron />
      </button>
      <ul id={id} className="v8-dsb__sub" hidden={!open}>{branch.items.map(row)}</ul>
    </li>
  );
}

/** The left sidebar (wide screens). The current tab comes from the path, so it stays mounted across pages. */
export function DocsSidebar({ nav, slugTab }: { nav: NavTab[]; slugTab: Record<string, TabId> }) {
  const { tab } = useDocsPlace(slugTab);
  const current = nav.find((t) => t.id === tab) ?? nav[0];
  return <nav className="v8-dsb" aria-label={`${current.label} pages`}><NavTree tab={current} /></nav>;
}

function JoinMenu() {
  const link = useDocsLink();
  const main = useDocsMain();
  const { open, setOpen, box, button } = useMenu();
  const id = useId();
  const home = main ? main + localHref("/") : localHref("/");
  const groups: { title: string; links: { to: string; label: string; out?: boolean }[] }[] = [
    { title: "Vraelis", links: [{ to: home, label: "vraelis.com", out: !!main }, { to: link("/contact"), label: "Contact" }] },
    { title: "Resources", links: [{ to: link("/docs/llms.txt"), label: "llms.txt" }, { to: link("/security#report"), label: "Report a security issue" }, { to: link("/legal"), label: "Terms and policies" }] },
  ];
  return (
    <div ref={box} className="v8-dhd__split" data-open={open}>
      <Go to={link("/contact?topic=contour")} className="v8-dhd__join">Join us</Go>
      <button ref={button} type="button" className="v8-dhd__joinmore" aria-label="More links" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}><Chevron /></button>
      {open ? (
        <div id={id} className="v8-dhd__card v8-dhd__card--end">
          {groups.map((g) => (
            <div key={g.title} className="v8-dhd__cardgroup">
              <p>{g.title}</p>
              {g.links.map((l) => <Go key={l.label} to={l.to} onClick={() => setOpen(false)}>{l.label}{l.out ? <OutArrow /> : null}</Go>)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Tabs({ nav, active }: { nav: NavTab[]; active?: TabId }) {
  const link = useDocsLink();
  const { open, setOpen, box, button, card } = useMenu();
  const id = useId();
  const strip = useRef<HTMLElement>(null);
  // In the scrolling row (narrow screens) keep the current tab in view without moving the page.
  useEffect(() => {
    const nav = strip.current;
    const a = nav?.querySelector<HTMLElement>("[aria-current]");
    if (!nav || !a || nav.scrollWidth <= nav.clientWidth) return;
    const left = a.offsetLeft - nav.offsetLeft, right = left + a.offsetWidth;
    if (left < nav.scrollLeft || right > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = Math.max(0, right - nav.clientWidth + 16);
  }, [active]);
  // The menu card is drawn in the header itself, under the tab: below 900px the tabs row scrolls sideways and fades
  // at its edge, and both clip anything drawn inside it (the menu opened invisibly on phones). Scrolling the row or
  // resizing closes it rather than leaving it pointing at nothing.
  const [at, setAt] = useState<{ host: HTMLElement; top: number; left: number } | null>(null);
  useEffect(() => {
    if (!open) return;
    const host = button.current?.closest<HTMLElement>(".v8-dhd");
    const r = button.current?.getBoundingClientRect(), h = host?.getBoundingClientRect();
    if (!host || !r || !h) return;
    const place = () => setAt({ host, top: r.bottom - h.top + 8, left: Math.max(12, Math.min(r.left - h.left - 4, h.width - 260)) });
    place();
    const close = () => setOpen(false);
    const row = strip.current;
    row?.addEventListener("scroll", close, { passive: true });
    window.addEventListener("resize", close);
    return () => { row?.removeEventListener("scroll", close); window.removeEventListener("resize", close); };
  }, [open, setOpen, button]);
  // Hover opens it on a mouse, as the site's own menus do (founder, 2026-10-12: "dropdown should be hover in the
  // docs"), with the site's intent delays; touch and keyboard keep the click. A click just after a hover opened it
  // leaves it open rather than toggling it shut under the pointer.
  const hoverTimer = useRef(0);
  const hoverAt = useRef(0);
  const mouse = () => matchMedia("(hover: hover) and (pointer: fine)").matches;
  const hoverIn = () => { if (!mouse()) return; clearTimeout(hoverTimer.current); hoverTimer.current = window.setTimeout(() => { hoverAt.current = performance.now(); setOpen(true); }, 70); };
  const hoverOut = () => { if (!mouse()) return; clearTimeout(hoverTimer.current); hoverTimer.current = window.setTimeout(() => setOpen(false), 180); };
  useEffect(() => () => clearTimeout(hoverTimer.current), []);
  return (
    <nav ref={strip} className="v8-dhd__tabs" aria-label="Documentation sections">
      {nav.map((t) => {
        const cur = active === t.id ? "page" as const : undefined;
        if (!t.menu) return <Go key={t.id} to={link(t.to)} className="v8-dhd__tab" aria-current={cur}>{t.label}</Go>;
        return (
          <div key={t.id} ref={box} className="v8-dhd__tabsplit" data-open={open} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
            {/* The whole tab opens the menu (founder, 2026-10-11: clicking "Products" went to the page instead, so the
                menu looked missing). Its overview page is the menu's first entry. */}
            <button ref={button} type="button" className="v8-dhd__tab v8-dhd__tab--menu" aria-haspopup="true" aria-expanded={open} aria-controls={id}
              data-current={!!cur} onClick={() => setOpen((o) => (o && performance.now() - hoverAt.current < 600 ? true : !o))}>{t.label}<Chevron /></button>
            {open && at ? createPortal(
              <div ref={card} id={id} className="v8-dhd__card v8-dhd__card--tab" style={{ top: at.top, left: at.left }} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                {t.menu.map((l) => (
                  <Go key={l.to} to={link(l.to)} onClick={() => setOpen(false)}><b>{l.label}</b><small>{l.line}</small></Go>
                ))}
              </div>, at.host) : null}
          </div>
        );
      })}
    </nav>
  );
}

export function DocsHeader({ nav, slugTab }: { nav: NavTab[]; slugTab: Record<string, TabId> }) {
  const main = useDocsMain();
  const link = useDocsLink();
  const { pathname, tab } = useDocsPlace(slugTab);
  const [sheet, setSheet] = useState(false);
  const bar = useRef<HTMLElement>(null);
  const home = main ? main + localHref("/") : localHref("/");
  const current = nav.find((t) => t.id === tab) ?? nav[0];

  // A route change closes the sheet.
  const [seen, setSeen] = useState(pathname);
  if (seen !== pathname) { setSeen(pathname); setSheet(false); }
  // The hairline under the bar fades in with scroll (x.ai).
  useEffect(() => {
    const el = bar.current; if (!el) return;
    const on = () => el.style.setProperty("--rule", String(Math.min(1, window.scrollY / 48)));
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  // The open sheet holds the page still and closes on Escape or when the screen grows past it.
  useEffect(() => {
    if (!sheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSheet(false); };
    const mq = matchMedia("(min-width: 901px)");
    const onWide = () => { if (mq.matches) setSheet(false); };
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onWide);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); mq.removeEventListener("change", onWide); };
  }, [sheet]);

  const brand: ReactNode = <><span className="v8-dhd__mark"><Mark /></span><Wordmark height={13.5} /></>;
  return (
    <>
      <a className="v8-skip" href="#v8-docs-content" data-no-reveal>Skip to content</a>
      <header ref={bar} className="v8-dhd" data-no-reveal data-sheet={sheet}>
        <div className="v8-dhd__bar">
          <div className="v8-dhd__start">
            <Go to={home} className="v8-dhd__brand" title="Vraelis home">{brand}<span className="v8-sr">Vraelis home</span></Go>
            <span className="v8-dhd__rule" aria-hidden="true" />
            <Go to={link("/docs")} className="v8-dhd__docs" aria-current={pathname === link("/docs") ? "page" : undefined}>Docs</Go>
          </div>
          <Tabs nav={nav} active={tab} />
          <div className="v8-dhd__end">
            <span className="v8-dhd__theme"><ThemeToggle /></span>
            <SearchPill />
            <AskButton />
            <span className="v8-dhd__joinwrap"><JoinMenu /></span>
            <button type="button" className="v8-dhd__menu" aria-label={sheet ? "Close the docs menu" : "Open the docs menu"} aria-expanded={sheet} aria-controls="v8-dhd-sheet"
              onClick={() => setSheet((s) => !s)}><MenuIcon open={sheet} /></button>
          </div>
        </div>
      </header>
      <div id="v8-dhd-sheet" className="v8-dhd-sheet" hidden={!sheet} data-no-reveal>
        <nav aria-label={`${current.label} pages`} className="v8-dsb v8-dsb--sheet"><NavTree tab={current} onNavigate={() => setSheet(false)} /></nav>
        <div className="v8-dhd-sheet__end">
          <Go to={link("/contact?topic=contour")} className="v8-btn v8-btn--solid v8-btn--lg" onClick={() => setSheet(false)}>Join us</Go>
          <Go to={link("/contact")} className="v8-btn v8-btn--soft v8-btn--lg" onClick={() => setSheet(false)}>Contact</Go>
          <div className="v8-dhd-sheet__row">
            <Go to={home} className="v8-dhd-sheet__home">vraelis.com{main ? <OutArrow /> : null}</Go>
            {sheet ? <ThemeToggle /> : null}
          </div>
        </div>
      </div>
    </>
  );
}
