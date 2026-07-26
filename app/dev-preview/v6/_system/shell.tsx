"use client";

// Shared public shell for design 06: one nav, one Resources mega-menu, one mobile full-screen nav, one
// footer, one route transition, used by every v6 route. Sticky nav goes transparent -> blurred on scroll and
// flips to a dark treatment over graphite (live-work) sections. Client-side nav with prefetch (next/link).
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiteFooter } from "./close";
import { V6_BASE, V6_HOME, V6_APP, v6SignInPath } from "@/lib/v6-routes";

// FOLLOWS THE PROMOTION FLAG. These were hardcoded to "/dev-preview/v6", which is precisely the mistake
// lib/v6-routes.ts was written to prevent: it says every V6 destination lives there so promotion is one
// edit, and then the shell kept its own copy anyway.
//
// Promoted, the hardcoded value broke two things at once. themeAtTop compared the pathname "/" against
// "/dev-preview/v6", never matched, and painted the bar LIGHT over the black hero. And every nav link still
// pointed into the preview namespace, so the promoted site navigated back out of itself.
const BASE = V6_BASE;
const SIGNIN = v6SignInPath();

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
    feature: { eyebrow: "One real run", title: "Approved by a person, executed exactly as approved.",
      body: "A plan minted by a dry run, reviewed, then consumed unchanged by the paid execution.",
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
  const pathname = usePathname();
  // Clicking the wordmark while already on the homepage, part way down, used to animate a scroll all the way
  // back up: 15600px of pinned chapters replaying backwards at speed, which looks like the page glitching.
  // It now does what Scale does, which is not a scroll at all: the view fades out, the position is set to
  // the top in the same frame the content is invisible, and it fades back in. The reader arrives at the top
  // of the page rather than watching the page rewind to it.
  const restart = (e: React.MouseEvent) => {
    const isHome = pathname === BASE || pathname === BASE + "/";
    if (!isHome || window.scrollY < 4) return;         // a normal navigation, or already at the top
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;  // let new-tab behave normally
    e.preventDefault();
    const root = document.querySelector(".v6") as HTMLElement | null;
    if (!root) { window.scrollTo({ top: 0, behavior: "instant" }); return; }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    root.dataset.restart = "out";
    window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "instant" });   // moved while nothing is visible
      root.dataset.restart = "in";
      window.setTimeout(() => { delete root.dataset.restart; }, 260);
    }, 170);
  };
  return (
    <Link href={V6_HOME} className="v6-brand" aria-label="Vraelis home" onClick={restart}>Vraelis</Link>
  );
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

/** Which theme the top of a route paints, known synchronously so the server-rendered bar is already right. */
function themeAtTop(pathname: string): boolean {
  if (pathname === BASE || pathname === BASE + "/") return true;      // the homepage opens on a black hero
  if (pathname.startsWith(BASE + "/docs")) return true;               // the docs environment is night
  return false;                                                        // every other route opens on a page hero
}

// A SIGNED-IN READER MUST NOT BE ASKED TO SIGN IN.
//
// The bar offered "Sign in" and "Open Vraelis" unconditionally, so someone already authenticated was invited
// to authenticate again, next to a page telling them they were signed in. The shell is a client component
// and cannot read the session itself, so the layout resolves it on the server and passes the one fact the
// bar needs. Undefined means "not known yet", which renders the signed-out affordance, because inviting a
// signed-out reader to open the app is a smaller error than telling a signed-in one to sign in again.
export function V6Nav({ authed = false }: { authed?: boolean }) {
  const pathname = usePathname() || "";
  const navRef = useRef<HTMLElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [scrolled, setScrolled] = useState(false);
  // Derived during render, not in an effect. The bar used to mount light and correct itself a beat later,
  // which showed as a white flash over the black hero on every load.
  const [dark, setDark] = useState(() => themeAtTop(pathname));
  const [settled, setSettled] = useState(false);
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
    // The SECTION under the bar decides, by its own declaration. Sampling a computed background picked up
    // whatever child happened to sit under the sample point (a code block, a card) and guessed wrong.
    const onScroll = () => {
      const y0 = window.scrollY;
      setScrolled(y0 > 4);
      if (!nav) return;
      // While a panel is open it covers the sample line, so hold whatever was measured before it opened.
      if (shown !== null) return;
      // AT THE TOP THERE IS NOTHING TO WORK OUT. Every route's first screen is a known quantity, so the bar
      // takes it from the route and never measures. Measuring here is what left a white bar on the black
      // homepage: on arrival the probe runs before the hero has painted, finds no labelled surface, and the
      // fallback resolves to light. If the reader then never scrolls, it stays wrong.
      if (y0 <= 4) { setDark(themeAtTop(pathname)); return; }
      const y = Math.round(nav.getBoundingClientRect().bottom) + 1;
      const stack = document.elementsFromPoint(Math.round(window.innerWidth / 2), y) as HTMLElement[];
      for (const el of stack) {
        // Both attributes count. Every dark band in the page kit declares data-nav-dark and NOT
        // data-nav-theme, so matching only the latter walked straight past them.
        const surface = el.closest?.("[data-nav-theme], [data-nav-dark]") as HTMLElement | null;
        if (surface) {
          const t = surface.dataset.navTheme;
          setDark(t ? t === "dark" : surface.hasAttribute("data-nav-dark"));
          return;
        }
      }
      // Nothing under the bar declares a theme, so the surface is the ordinary light page. This used to
      // fall out of the loop without deciding anything, which left the bar holding whatever the LAST dark
      // section set: scroll off a dark band onto white and the bar stayed black the rest of the page.
      setDark(false);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, [pathname, shown]);

  // Colour transitions are suppressed for the first frames so the correct initial theme never animates in.
  useEffect(() => {
    const id = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(id);
  }, []);

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

  // THE BAR AND THE PAGE MUST TURN OVER IN THE SAME FRAME.
  //
  // The theme used to be set inside a requestAnimationFrame, so the content swapped on the pathname change
  // and the bar followed a frame later, with a 90ms colour crossfade running on top of that. Navigating from
  // a light route to a dark one showed a light bar sitting on the new dark page for long enough to read as
  // a bug.
  //
  // Derived during render instead, which is React's own pattern for state that has to track a prop change:
  // it re-renders before the browser paints, so there is no frame where the two disagree. The crossfade is
  // suppressed for that swap too (data-settled=false), because a transition between two correct states still
  // looks like lag when the thing underneath changed instantly.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setDark(themeAtTop(pathname));
    setSettled(false);
    setOpen(null);
    setExiting(null);
    setDrawer(false);
  }
  useEffect(() => {
    const id = requestAnimationFrame(() => setSettled(true));
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
      data-open={shown !== null} data-settled={settled} aria-label="Primary" onMouseLeave={scheduleClose}>
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
          {authed ? null : <Link href={SIGNIN} className="v6-nav__signin">Sign in</Link>}
          <Link href={authed ? V6_APP : SIGNIN} className="v6-btn v6-btn--brand">Open Vraelis</Link>
          <button className="v6-nav__burger" aria-label="Open navigation" aria-haspopup="dialog" onClick={() => setDrawer(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
        </div>
      </div>
      {drawer ? <MobileNav authed={authed} onClose={() => setDrawer(false)} /> : null}
    </nav>
  );
}

function MobileNav({ authed, onClose }: { authed: boolean; onClose: () => void }) {
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
        {authed ? null : <Link href={SIGNIN} className="v6-btn v6-btn--ghost" onClick={onClose}>Sign in</Link>}
        <Link href={authed ? V6_APP : SIGNIN} className="v6-btn v6-btn--brand" onClick={onClose}>Open Vraelis <span className="v6-arw" aria-hidden>→</span></Link>
      </div>
    </div>
  );
}

// Fires before the browser paints, so the new route is never shown at the offset it inherited. Falls back
// to useEffect on the server, which never runs it and avoids React's SSR warning: a server-rendered first
// paint is at the top already.
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // THE HOMEPAGE always opens at the top. Every other v6 route keeps normal scroll restoration.
  //
  // The homepage is ~15600px of scroll-position-driven pinned chapters, so arriving part way down it is not
  // a small blemish: it drops the reader into the middle of a chapter. On a client-side navigation the
  // document never changes, so the route mounts at the offset carried over from the page before it, which
  // measured y=9435 coming back from the foot of /platform.
  //
  // Two things this deliberately does NOT do:
  //
  //   It does not use window.scrollTo(0, 0). app/globals.css sets `html { scroll-behavior: smooth }` for
  //   in-page anchors, which turns that call into an animation: 1488ms across 344 intermediate positions,
  //   replaying the pinned chapters backwards. `behavior: "instant"` overrides the CSS for this one call
  //   and leaves anchor links smooth.
  //
  //   It does not force the top on inner routes. Doing that clobbered Back on /docs, /method and /platform,
  //   which should return the reader where they were.
  //
  // scrollRestoration is a browser-global that sticks to the history entry it was set on, so it is written
  // on every pathname change rather than once: "manual" only while the homepage is the entry being forced
  // to the top, "auto" everywhere else and on the way out, so it is never left switched off behind us.
  useBeforePaint(() => {
    const canRestore = "scrollRestoration" in history;
    // Exact match, not a prefix: /dev-preview/v6/platform must not be treated as the homepage.
    const isHome = pathname === BASE || pathname === BASE + "/";
    // A hash names a position the reader asked for. Without this guard the anchor scroll started and was
    // then pulled back to the top, so /dev-preview/v6#gap never landed.
    const wantsTop = isHome && !window.location.hash;

    if (!wantsTop) {
      if (canRestore) history.scrollRestoration = "auto";
      return;
    }

    if (canRestore) history.scrollRestoration = "manual";
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });

    // Runs once the pathname has already moved on, so this hands "auto" to the entry we are leaving for.
    return () => { if (canRestore) history.scrollRestoration = "auto"; };
  }, [pathname]);
  return <div key={pathname} className="v6-page">{children}</div>;
}

/**
 * Browser history traversal restores the scroll position itself, and `html { scroll-behavior: smooth }`
 * (globals.css, deliberately kept for in-page anchors) makes that restoration ANIMATE. Measured on Back
 * from /platform: 281 distinct scroll positions over 1199ms, 335 over 1480ms from the foot of the page,
 * with the target route already committed the whole way, so the reader watches it crawl back through the
 * pinned chapters. The data-scroll-behavior attribute added to <html> only covers the scrolls Next itself
 * performs; this one belongs to the browser and is untouched by it.
 *
 * The override therefore goes on documentElement, which is the scrolling element, and only for the length
 * of a traversal:
 *
 *   arm    on the Navigation API's `navigate` event when navigationType is "traverse". That fires before
 *          the traversal commits, which is early enough that the restoration is already instant. popstate
 *          is the fallback where the Navigation API is missing.
 *   disarm on the next pointer or key press. Every anchor activation is preceded by one, so the table of
 *          contents is always smooth again by the time it is used, and on scrollend so the inline style
 *          does not linger in the DOM.
 *
 * No timers, no rAF, and the restoration is never animated by hand: the browser is simply allowed to do
 * it instantly.
 */
function useInstantHistoryRestore() {
  useEffect(() => {
    const html = document.documentElement;
    let armed = false;
    const arm = () => {
      if (armed) return;
      armed = true;
      html.style.setProperty("scroll-behavior", "auto", "important");
    };
    const disarm = () => {
      if (!armed) return;
      armed = false;
      html.style.removeProperty("scroll-behavior");
    };
    const onNavigate = (e: Event) => {
      if ((e as Event & { navigationType?: string }).navigationType === "traverse") arm();
    };
    const nav = (window as Window & { navigation?: EventTarget }).navigation;
    nav?.addEventListener("navigate", onNavigate);
    window.addEventListener("popstate", arm);
    window.addEventListener("scrollend", disarm);
    window.addEventListener("pointerdown", disarm, true);
    window.addEventListener("keydown", disarm, true);
    return () => {
      nav?.removeEventListener("navigate", onNavigate);
      window.removeEventListener("popstate", arm);
      window.removeEventListener("scrollend", disarm);
      window.removeEventListener("pointerdown", disarm, true);
      window.removeEventListener("keydown", disarm, true);
      disarm();
    };
  }, []);
}

export function V6Shell({ children, authed = false }: { children: ReactNode; authed?: boolean }) {
  useInstantHistoryRestore();
  // THE PERSISTENT ROUTE CANVAS. Every route declares the ground of its opening surface from the same map
  // the nav already trusts, computed during render, so the server-rendered document carries it and a
  // client-side commit swaps it in the same frame as the content. Nothing samples, defers, or corrects
  // after paint. The shell is opaque and viewport-tall, so the fade the incoming page plays happens over
  // the route's own ground: the white shell that used to sit beneath dark routes is what every transition
  // flash was actually showing.
  const pathname = usePathname() || "";
  const ground = themeAtTop(pathname) ? "dark" : "light";
  return (
    <div className="v6" data-route-theme={ground}>
      {/* The final safety canvas, behind even the shell. The root layout paints html/body cream inline for
          the rest of the site; on v6 documents this beats it (stylesheet !important outranks an inline
          style), so the browser has no frame in which its own canvas can show. It follows the route theme,
          so a light route never flashes black and a dark route never flashes white, in overscroll included. */}
      <style>{`html, body { background: ${ground === "dark" ? "#0A0A0B" : "#FFFFFF"} !important; }`}</style>
      {/* Nine focus stops sit in the nav before any content. Keyboard and screen-reader users get one stop to
          jump past them; it is invisible until focused. */}
      <a href="#v6-main" className="v6-skip">Skip to content</a>
      <V6Nav authed={authed} />
      <main id="v6-main" tabIndex={-1}><RouteTransition>{children}</RouteTransition></main>
      <SiteFooter />
    </div>
  );
}
