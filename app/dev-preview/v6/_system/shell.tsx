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

// Three top-level items open a menu; Company is a plain link. Research and Developers were promoted to the
// top bar in phase 1 and are demoted back into the menus that already carry them, so the closed bar stays
// short and calm. Every menu has 2-3 named groups plus one editorial preview.
type Preview = { eyebrow: string; title: string; body: string; stat?: string };
type MLink = { t: string; d?: string; href: string; preview?: Preview };
type Group = { h: string; links: MLink[] };
type Menu = { label: string; groups: Group[]; feature: Preview & { href: string; cta: string } };

const MENUS: Menu[] = [
  {
    label: "Platform",
    groups: [
      { h: "Understand", links: [
        { t: "Platform overview", d: "What the product does", href: BASE + "/platform" },
        { t: "Requirements", d: "What a change must not break", href: BASE + "/docs/responsibilities",
          preview: { eyebrow: "Requirements", title: "One sentence the change is not allowed to break.", body: "Written by a person, held outside the code, and fixed before anything runs.", stat: "Held outside the code" } },
        { t: "Systems", d: "Everything you have connected", href: BASE + "/docs/work" },
      ] },
      { h: "Verify", links: [
        { t: "Execution", d: "A real browser on the live software", href: BASE + "/docs/live-activity",
          preview: { eyebrow: "Execution", title: "A real browser drives the running software.", body: "Not a mock, and not the agent's account of itself. What the run does is captured as it goes.", stat: "Real browser" } },
        { t: "Findings", d: "What the evidence does not support", href: BASE + "/docs/findings" },
        { t: "Completion", d: "Verified, Failed, or Blocked", href: BASE + "/docs/completion",
          preview: { eyebrow: "Completion", title: "Three answers, and the third is the honest one.", body: "Verified, Failed, or Blocked. Blocked is the one most tools refuse to say.", stat: "Three outcomes" } },
      ] },
      { h: "Resolve", links: [
        { t: "Review", d: "Decisions that need a person", href: BASE + "/docs/review" },
        { t: "Repair", d: "Handoff and independent recheck", href: BASE + "/docs/repair" },
        { t: "Integrations", d: "GitHub, Vercel, Slack", href: BASE + "/integrations" },
      ] },
    ],
    feature: { eyebrow: "One real run", title: "Payment went through. Access did not.",
      body: "A checkout that reported success, two repairs, and the run that finally held.",
      stat: "vrf_ff9d6c0d", href: BASE + "/platform", cta: "See the platform" },
  },
  {
    label: "Agents",
    groups: [
      { h: "Coding agents", links: [
        { t: "How agent work is read", d: "Plans, changes, and claims", href: BASE + "/agents" },
        { t: "Claimed complete", d: "Where a check begins", href: BASE + "/docs/completion" },
      ] },
      { h: "Agent workflows", links: [
        { t: "API", d: "Create and read verifications", href: BASE + "/developers#api" },
        { t: "CLI", d: "One command, one exit code", href: BASE + "/developers#cli" },
        { t: "Webhooks", d: "verification.completed", href: BASE + "/developers#webhooks" },
      ] },
      { h: "Direction", links: [
        { t: "Continuous agent activity", d: "Not available yet", href: BASE + "/platform#current",
          preview: { eyebrow: "Direction", title: "Reading an agent's work as it happens.", body: "Not built. Today a check begins at the point the work is claimed complete.", stat: "Not available" } },
        { t: "Autonomy from track record", d: "Not available yet", href: BASE + "/platform#current",
          preview: { eyebrow: "Direction", title: "Autonomy earned from a record.", body: "Not built. How much an agent may do alone should be a conclusion, not a setting.", stat: "Not available" } },
      ] },
    ],
    feature: { eyebrow: "Honest boundary", title: "Vraelis does not watch an agent work.",
      body: "It holds a requirement outside the code and checks the running software when the work is claimed done.",
      stat: "What is actually built", href: BASE + "/agents", cta: "How agents are handled" },
  },
  {
    label: "Resources",
    groups: [
      { h: "Learn", links: [
        { t: "Documentation", d: "Use and administer Vraelis", href: BASE + "/docs",
          preview: { eyebrow: "Documentation", title: "Nine pages, each with one outcome.", body: "Getting started, the work, oversight, and what is kept once the work is done.", stat: "9 pages" } },
        { t: "Vraelis Method", d: "The worldview behind the product", href: BASE + "/method" },
        { t: "README", d: "Why Vraelis exists", href: BASE + "/readme" },
      ] },
      { h: "Build", links: [
        { t: "Developer docs", d: "Build on the API", href: BASE + "/developers" },
        { t: "Changelog", d: "What shipped, dated", href: BASE + "/changelog" },
        { t: "Research", d: "Methodology and open questions", href: BASE + "/research",
          preview: { eyebrow: "Research", title: "How do you show the edge of a check?", body: "So that absence of evidence is never read as evidence of safety.", stat: "Open question" } },
      ] },
      { h: "Trust", links: [
        { t: "Security", d: "Architecture and data handling", href: BASE + "/security" },
        { t: "System status", d: "What is operational", href: BASE + "/security#status" },
        { t: "Current capabilities", d: "What is built, and what is not", href: BASE + "/platform#current" },
      ] },
    ],
    feature: { eyebrow: "The Vraelis Method", title: "The builder cannot be the only judge.",
      body: "Eight positions on how software built by agents earns trust.",
      stat: "8 positions", href: BASE + "/method", cta: "Read the Method" },
  },
  {
    label: "Company",
    groups: [
      { h: "Company", links: [
        { t: "About Vraelis", d: "Who is building this", href: BASE + "/company" },
        { t: "Why Vraelis exists", d: "The README", href: BASE + "/readme",
          preview: { eyebrow: "Why Vraelis exists", title: "Software used to be trusted because humans held the loop.", body: "That loop is changing. Agents now plan, change code, and repair their own failures faster than any review process built for people.", stat: "README" } },
        { t: "Contact", d: "Talk to the team", href: BASE + "/company#contact" },
      ] },
      { h: "Trust", links: [
        { t: "Security", d: "Architecture and data handling", href: BASE + "/security",
          preview: { eyebrow: "Security", title: "How the engine is built and what it can reach.", body: "Data handling, isolation, and the boundary of what a single run is allowed to touch.", stat: "Architecture" } },
        { t: "Privacy", href: "/privacy" },
        { t: "Terms", href: "/terms" },
        { t: "Subprocessors", href: "/subprocessors" },
      ] },
      { h: "Updates", links: [
        { t: "Current capabilities", d: "What is built, and what is not", href: BASE + "/platform#current",
          preview: { eyebrow: "Current capabilities", title: "What is built, stated without decoration.", body: "Everything marked Direction is unbuilt, and is labelled that way everywhere it appears on this site.", stat: "Live vs Direction" } },
        { t: "System status", d: "What is operational", href: BASE + "/security#status",
          preview: { eyebrow: "System status", title: "Verification engine operational.", body: "The engine that drives a real browser against a requirement is running.", stat: "Operational" } },
        { t: "Changelog", d: "What shipped, dated", href: BASE + "/changelog" },
      ] },
    ],
    feature: { eyebrow: "Vraelis", title: "Independent proof that software built by agents does what the business needs.",
      body: "Built in the open, with the boundary between what works and what does not stated on the site rather than in a footnote.",
      stat: "Verification engine operational", href: BASE + "/company", cta: "About the company" },
  },
];

function Brand() {
  return <Link href={BASE} className="v6-brand" aria-label="Vraelis home">Vraelis</Link>;
}

// ONE persistent night shell. Switching top-level items keeps the shell open and crossfades only its
// contents; hovering or focusing a link swaps the preview inside the same frame. The panel stays mounted
// through its exit animation, so dismissing it animates rather than popping away.
function MegaShell({ index, state, preview, onPreview, onNavigate }: {
  index: number; state: "in" | "out"; preview: Preview | null;
  onPreview: (p: Preview | null) => void; onNavigate: () => void;
}) {
  const menu = MENUS[index];
  const shown: Preview = preview ?? menu.feature;
  return (
    <div className="v6-mega" data-state={state}>
      <div className="v6-mega__panel">
        <div className="v6-mega__grid" key={menu.label}>
          {menu.groups.map((col) => (
            <div key={col.h} className="v6-mega__col">
              <p className="v6-mega__col-h">{col.h}</p>
              {col.links.map((l) => (
                <Link key={l.t} href={l.href} className="v6-mega__link" onClick={onNavigate}
                  onMouseEnter={() => onPreview(l.preview ?? null)} onFocus={() => onPreview(l.preview ?? null)}>
                  <span className="v6-mega__lt">{l.t}</span>
                  {l.d ? <span className="v6-mega__ld">{l.d}</span> : null}
                </Link>
              ))}
            </div>
          ))}
          <div className="v6-mega__feature">
            <div className="v6-mega__fin" key={menu.label + shown.title}>
              <span className="v6-mega__fe">{shown.eyebrow}</span>
              <h4>{shown.title}</h4>
              <p>{shown.body}</p>
            </div>
            <Link href={menu.feature.href} className="v6-mega__fcta" onClick={onNavigate}>
              {menu.feature.cta}<span className="v6-arw" aria-hidden>&rarr;</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function V6Nav() {
  const pathname = usePathname() || "";
  const navRef = useRef<HTMLElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [scrolled, setScrolled] = useState(false);
  const [dark, setDark] = useState(false);
  const [drawer, setDrawer] = useState(false);
  // `open` is which menu is showing; `exiting` is the one still animating away. Keeping the outgoing panel
  // mounted for the length of its exit is the whole fix for menus that used to vanish on dismiss.
  const [open, setOpen] = useState<number | null>(null);
  const [exiting, setExiting] = useState<number | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const closeT = useRef(0);
  const exitT = useRef(0);
  // whichever panel is on screen: the open one, or the one still animating out
  const shown = open ?? exiting;

  // Publish the real nav height as --nav-h. Chapters size themselves against it, and it changes with the
  // wordmark size and the viewport, so measuring beats a hardcoded fallback.
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
    // Read the ACTUAL background under the bar rather than trusting a [data-nav-dark] marker. The marker
    // approach guessed, and it guessed wrong on the docs environment: a white bar on a near-black page.
    // Walk up from the element under the bar to the first opaque background, measure its luminance, and let
    // that decide. Any surface added later is handled without having to remember to tag it.
    const luminance = (c: string) => {
      const m = c.match(/[\d.]+/g);
      if (!m || m.length < 3) return null;
      if (m.length > 3 && Number(m[3]) < 0.5) return null; // effectively transparent
      const [r, g, b] = m.slice(0, 3).map((v) => {
        const x = Number(v) / 255;
        return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const onScroll = () => {
      setScrolled(window.scrollY > 4);
      if (!nav) return;
      // While a panel is open it covers the sample point, so measuring would read the panel's own colour and
      // feed back on itself. Hold the theme measured just before it opened.
      if (shown !== null) return;
      const y = Math.round(nav.getBoundingClientRect().bottom) + 4;
      let el = document.elementFromPoint(Math.round(window.innerWidth / 2), y) as HTMLElement | null;
      let lum: number | null = null;
      while (el && lum === null) {
        // only a surface that spans most of the viewport counts as "the background". Without this the
        // knowledge chapter read as dark because its small black code fragment happened to sit under the bar.
        if (el.getBoundingClientRect().width >= window.innerWidth * 0.7) {
          lum = luminance(getComputedStyle(el).backgroundColor);
        }
        el = el.parentElement;
      }
      setDark(lum !== null && lum < 0.4);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, [pathname, shown]);

  const close = useCallback((i: number | null) => {
    window.clearTimeout(closeT.current);
    setOpen((cur) => {
      const target = i === null ? cur : i;
      if (target !== null) {
        setExiting(target);
        window.clearTimeout(exitT.current);
        exitT.current = window.setTimeout(() => setExiting(null), 200);
      }
      return null;
    });
  }, []);

  const openAt = useCallback((i: number) => {
    window.clearTimeout(closeT.current);
    window.clearTimeout(exitT.current);
    setExiting(null);
    // switching top-level items keeps the shell open and only crossfades its contents
    setOpen((cur) => { if (cur !== i) setPreview(null); return i; });
  }, []);
  const scheduleClose = useCallback(() => { closeT.current = window.setTimeout(() => close(null), 160); }, [close]);

  // close on route change (deferred so it is not a synchronous setState in the effect body)
  useEffect(() => {
    const id = requestAnimationFrame(() => { setOpen(null); setExiting(null); setDrawer(false); });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  // Escape + click-outside
  useEffect(() => {
    if (open === null) return;
    const i = open;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { close(i); btnRefs.current[i]?.focus(); } };
    const onDown = (e: PointerEvent) => { if (!navRef.current?.contains(e.target as Node)) close(i); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown, true); };
  }, [open, close]);

  return (
    <nav ref={navRef} className="v6-nav" data-scrolled={scrolled} data-theme={dark ? "dark" : "light"}
      data-open={shown !== null} aria-label="Primary" onMouseLeave={scheduleClose}>
      <div className="v6-nav__in">
        <Brand />
        <div className="v6-nav__items">
          {/* No caret on any item. Pointer users get hover; keyboard users open with Enter or Space. */}
          {MENUS.map((m, i) => (
            <button key={m.label} type="button" ref={(el) => { btnRefs.current[i] = el; }}
              className="v6-nav__item" aria-expanded={open === i} aria-haspopup="true"
              onClick={() => (open === i ? close(i) : openAt(i))} onMouseEnter={() => openAt(i)}>
              {m.label}
            </button>
          ))}
        </div>
        {shown !== null ? (
          <div onMouseEnter={() => openAt(shown)} onMouseLeave={scheduleClose}>
            <MegaShell index={shown} state={open === null ? "out" : "in"} preview={preview}
              onPreview={setPreview} onNavigate={() => close(shown)} />
          </div>
        ) : null}
        <div className="v6-nav__right">
          <Link href={SIGNIN} className="v6-nav__signin">Sign in</Link>
          <Link href={SIGNIN} className="v6-btn v6-btn--brand">Open Vraelis</Link>
          <button className="v6-nav__burger" aria-label="Open navigation" aria-haspopup="dialog" onClick={() => setDrawer(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
        </div>
      </div>
      {drawer ? <MobileNav onClose={() => setDrawer(false)} /> : null}
    </nav>
  );
}

function MobileNav({ onClose }: { onClose: () => void }) {
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
        <Link href={`${BASE}/company`} className="v6-drawer__link" onClick={onClose}>Company</Link>
        {MENUS.flatMap((m) => m.groups.map((col) => (
          <div key={m.label + col.h} className="v6-drawer__sub">
            <p className="v6-drawer__sub-h">{m.label}, {col.h}</p>
            <div className="v6-drawer__sub-links">
              {col.links.map((l) => <Link key={l.t} href={l.href} onClick={onClose}>{l.t}</Link>)}
            </div>
          </div>
        )))}
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
  // Navigating back to a route restored the scroll position it was left at, so returning to the homepage
  // dropped the visitor into the middle of a chapter and scrolled up from there. Every route entry starts
  // at the top. Deferred a frame so it runs after the new route has painted.
  useEffect(() => {
    // Turn off the browser's own scroll restoration first: on a fresh load it restores the offset from the
    // previous visit before React mounts, which dropped visitors into the middle of the page on arrival.
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    const id = requestAnimationFrame(() => window.scrollTo(0, 0));
    return () => cancelAnimationFrame(id);
  }, [pathname]);
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
