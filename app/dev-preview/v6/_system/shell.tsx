"use client";

// Shared public shell for design 06: one nav, one Resources mega-menu, one mobile full-screen nav, one
// footer, one route transition, used by every v6 route. Sticky nav goes transparent -> blurred on scroll and
// flips to a dark treatment over graphite (live-work) sections. Client-side nav with prefetch (next/link).
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiteFooter } from "./close";
import { useGroundColor } from "@/components/use-ground-color";
import { V6_BASE, V6_HOME, V6_APP, v6SignInPath, v6GroundAtTop, v6ShouldPrefetch, GROUND_CSS } from "@/lib/v6-routes";

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
        { t: "Systems", d: "Everything you have connected", href: BASE + "/docs/systems" },
      ] },
      { h: "Verify", links: [
        { t: "Execution", d: "A real browser on the live software", href: BASE + "/docs/run-activity",
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
          preview: { eyebrow: "Documentation", title: "Nine pages, each with one outcome.", body: "Getting started, the systems you connect, oversight, and what is kept once the work is done.", stat: "9 pages" } },
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
        { t: "What is built, and what is next", d: "The live list beside the planned one", href: BASE + "/platform#current" },
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
        { t: "What is built, and what is next", d: "The live list beside the planned one", href: BASE + "/platform#current",
          preview: { eyebrow: "What is built, and what is next", title: "Both halves, stated without decoration.", body: "Everything marked Direction is unbuilt, is labelled that way everywhere it appears on this site, and carries no date. A line moves left when it works, and the changelog records the day it did.", stat: "Live vs Direction" } },
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

/** Which theme the top of a route paints, known synchronously so the server-rendered bar is already right.
 *  The rule itself lives in lib/v6-routes.ts, because proxy.ts needs the SAME answer one step earlier to
 *  paint the document canvas before this component exists. Two copies would eventually disagree, and the
 *  symptom of disagreeing is a white flash on a black page, which is exactly what it was. */
function themeAtTop(pathname: string): boolean {
  return v6GroundAtTop(pathname) === "graphite";
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

  // THE BAR DOES NOT HIDE. It stays where it is and matches whatever is under it instead; see the ground
  // sampler below. Hiding it was a worse answer to the same problem — a bar that fights the page — and it
  // cost a menu that could open against a moving anchor.

  // Publish the real nav height as --nav-h. The hero and every pinned chapter size themselves against it,
  // and it changes with the wordmark's clamp() and the viewport, so measuring beats a hardcoded fallback.
  //
  // WRITTEN ON <html>, NOT ON .v6, AND THE DIFFERENCE IS LOAD-BEARING.
  //
  // Custom properties inherit, so everything under .v6 reads exactly the same value it read before; nothing
  // inside the design system had to change. What moving it up buys is the one consumer that could never have
  // seen it where it was: html { scroll-padding-top: var(--nav-h) } in app/globals.css. .v6 is inside <body>,
  // and a property set on a descendant is invisible to an ancestor, so declaring the scrollport's anchor
  // offset in terms of the measured bar was impossible until this moved. It is the fix for every in-page
  // anchor landing 97px too low.
  //
  // Removed on unmount rather than left behind. Navigating from a v6 route to /signin or into the product
  // tears this component down while the DOCUMENT survives, and a stale 67px would then be applied as the
  // anchor offset on a surface whose bar is a different height, or has no bar at all.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty("--nav-h", `${Math.round(nav.offsetHeight)}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(nav);
    return () => { ro.disconnect(); root.style.removeProperty("--nav-h"); };
  }, []);

  // THE BAR TAKES THE COLOUR OF WHATEVER IS UNDER IT. The walk that works that out is
  // components/use-ground-color.ts, and the reasoning that used to be written out here lives there now.
  //
  // This file carried its own copy of it, which is how the two came to disagree: the hook was made
  // rAF-throttled and the copy was not, the hook learned that a see-through colour is not a ground and the
  // copy did not, and every repair to either one fixed half the site. There is one implementation.
  //
  // paused is everything that can sit ON the sample line. The mega panel was already here; the mobile
  // drawer was in neither the guard nor the dependencies, so a resize with the drawer open latched the
  // drawer's own surface into the bar and closing it never took a fresh reading.
  //
  // atTopFallback is the route's declared ground, because at the top of a route there is nothing to work
  // out. Measuring there is what left a white bar on the black homepage: on arrival the probe runs before
  // the hero has painted, finds no labelled surface, and the fallback resolves to light. If the reader then
  // never scrolls, it stays wrong.
  //
  // resetKey is the pathname. A client-side navigation replaces the whole DOM under a bar that is not
  // scrolling and need not resize, so without it the reading taken on the previous route stands.
  const routeDark = themeAtTop(pathname);
  const ground = useGroundColor(navRef, {
    atTopFallback: routeDark,
    paused: shown !== null || drawer,
    resetKey: pathname,
  });

  // SCROLLED IS A DIFFERENT FACT and keeps its own listener: it is the bar's border and shadow rather than
  // the page's colour, and it must go on updating while a panel is open, which is exactly when the ground
  // sampler is paused.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, []);

  // THE ROUTE'S OWN GROUND HOLDS UNTIL THE SAMPLER HAS READ THIS ROUTE. A reading can only arrive after the
  // commit that changed the page, so for one commit the value in hand belongs to the route just left. The
  // key it was taken under says which, and everything below is derived from that during render rather than
  // corrected afterwards.
  //
  // That one commit used to be indefinite. --nav-bg and data-ground were written straight to the DOM, which
  // React does not manage, so the render-time reset further down could clear the theme and not the ground:
  // v6.css:197 applies --nav-bg with !important, and the previous route's colour therefore survived into
  // the new route until something scrolled. A white bar with white type on a graphite route is what that
  // looked like. They are props on the <nav> now, so they turn over in the same commit as data-theme.
  //
  // data-ground gates the CSS rule, so a bar that has not measured (no JS, first paint, the commit after a
  // navigation) keeps its declared theme's own background rather than resolving var(--nav-bg) to nothing
  // and going transparent.
  const sampled = ground.resetKey === pathname;
  const dark = sampled ? ground.dark : routeDark;
  const navBg = sampled ? ground.bg : null;

  // Colour transitions are suppressed for the first frames so the correct initial theme never animates in.
  useEffect(() => {
    const id = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // THE OTHER BAR. On a phone there are two bars at the top of the page: this nav, and the strip of browser
  // chrome above it, which iOS Safari and Android Chrome paint from meta theme-color. The layout pins that
  // meta to graphite so the first paint of a dark route is right, but the nav flips light and dark per
  // section, so scrolling a white chapter under the bar produced a black system strip sitting on a white
  // nav: two bars, each changing on its own schedule. One state drives both now. The same flip that
  // recolours the bar rewrites the meta tag in the same commit, so the browser chrome turns over with it.
  // Re-asserted on every route change too, because Next re-emits the layout's static meta on navigation.
  useEffect(() => {
    // The exact sampled ground when there is one, so the chrome matches even mid-interpolation; the
    // route's declared pole otherwise. Only rgb()/hex reach the meta tag: theme-color support for the
    // wider notations (oklab, color()) is not dependable, and an unsupported value hands the browser
    // back to its own guess, which is the disagreement this exists to end.
    const color = navBg && /^(#|rgb)/i.test(navBg) ? navBg : dark ? "#0A0A0B" : "#FFFFFF";
    const metas = document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    if (metas.length === 0) {
      const m = document.createElement("meta");
      m.name = "theme-color";
      m.content = color;
      document.head.appendChild(m);
      return;
    }
    // The layout emits one tag per prefers-color-scheme; the bar's theme is the same in both, so the media
    // split only leaves a second tag to disagree with. Collapse them to one answer.
    metas.forEach((m) => { m.removeAttribute("media"); m.content = color; });
  }, [dark, navBg, pathname]);

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
  //
  // The theme is no longer reset here, because it is no longer state: it is derived from the sampler's
  // reading and the route above, which is the same rule one step further along. What is left is the state
  // that genuinely has to be cleared on a navigation.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
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
      data-open={shown !== null} data-settled={settled} data-ground={navBg ? "1" : undefined}
      style={navBg ? ({ "--nav-bg": navBg } as CSSProperties) : undefined}
      aria-label="Primary" onMouseLeave={scheduleClose}>
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
          <Link href={authed ? V6_APP : SIGNIN} prefetch={v6ShouldPrefetch(authed ? V6_APP : SIGNIN) ? undefined : false} className="v6-btn v6-btn--brand">Open Vraelis</Link>
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
  // One section open at a time, Platform first: the drawer used to flatten all twelve desktop groups into
  // one long list under headings like "Platform, Understand", which read as an index dump next to the
  // desktop mega-menu. Each top-level item is now an accordion carrying the same groups, titles and
  // descriptions the desktop panel shows, on the same night surface.
  const [openSec, setOpenSec] = useState<number | null>(0);
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
        {MENUS.map((m, i) => (
          <section key={m.label} className="v6-drawer__sec" data-open={openSec === i}>
            <button type="button" className="v6-drawer__sec-h" aria-expanded={openSec === i}
              aria-controls={`v6-dsec-${i}`}
              onClick={(e) => {
                const next = openSec === i ? null : i;
                setOpenSec(next);
                // Opening a section below a taller one that just collapsed can land the tapped header
                // off-screen; keep the header where the reader's thumb is.
                if (next !== null) {
                  const el = e.currentTarget;
                  requestAnimationFrame(() => el.scrollIntoView({ block: "nearest", behavior: "auto" }));
                }
              }}>
              {m.label}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {openSec === i ? (
              <div id={`v6-dsec-${i}`} className="v6-drawer__sec-b">
                {m.groups.map((col) => (
                  <div key={col.h} className="v6-drawer__grp">
                    <p className="v6-drawer__grp-h">{col.h}</p>
                    {col.links.map((l) => (
                      <Link key={l.t} href={l.href} className="v6-drawer__glink" onClick={onClose}>
                        <span className="v6-drawer__glt">{l.t}</span>
                        {l.d ? <span className="v6-drawer__gld">{l.d}</span> : null}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ))}
      </div>
      <div className="v6-drawer__foot">
        {authed ? null : <Link href={SIGNIN} className="v6-btn v6-btn--ghost" onClick={onClose}>Sign in</Link>}
        <Link href={authed ? V6_APP : SIGNIN} prefetch={v6ShouldPrefetch(authed ? V6_APP : SIGNIN) ? undefined : false} className="v6-btn v6-btn--brand" onClick={onClose}>Open Vraelis <span className="v6-arw" aria-hidden>→</span></Link>
      </div>
    </div>
  );
}

// Fires before the browser paints, so the new route is never shown at the offset it inherited. Falls back
// to useEffect on the server, which never runs it and avoids React's SSR warning: a server-rendered first
// paint is at the top already.
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

// WAS THIS NAVIGATION A BACK OR A FORWARD. Three behaviours need the same fact and only one of them could
// see it: it was a local in useInstantHistoryRestore, so the two scroll corrections below had no way to ask
// and both treated a traversal as a fresh arrival. Back to the homepage was hard-reset to the top, and a
// Back onto a hash was dragged to the heading, in both cases discarding the position the browser had just
// restored, which is the position the reader left.
//
// Module scope rather than component state, because the readers are siblings in the tree rather than one
// component, and there is exactly one shell per document.
//
// It is set by the listeners in useInstantHistoryRestore, which already watch the two events that can tell:
// the Navigation API's navigate, whose navigationType names the kind directly, and popstate as the fallback
// where that API does not exist. It is cleared on the next pointer or key press, which is the input that
// precedes any navigation the reader starts, so a Back followed by a link click reads as a link click.
const lastNavWasTraversal = { current: false };

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
  //   It does not force the top on a traversal, which is the same argument one line up: pressing Back is a
  //   request to return to a position, and the homepage is not exempt from that because it is long. The
  //   browser has already restored the offset by the time this runs, so forcing the top threw away the one
  //   thing the reader asked for.
  //
  // NOTHING HERE TOUCHES history.scrollRestoration, AND THAT IS THE FIX.
  //
  // This used to set "manual" while it forced the homepage to the top, and hand back "auto" in the effect's
  // cleanup. scrollRestoration is stored ON THE HISTORY ENTRY that was current when it was written, and the
  // cleanup does not run until the pathname has already changed, by which point the new entry is the current
  // one. So "auto" was written to the entry being navigated TO and the homepage entry kept "manual" forever.
  // An entry marked manual is one the browser declines to restore, so Back to the homepage landed at the top
  // no matter what the traversal guard below decided. Writing "auto" again from popstate does not rescue it
  // either: by the time popstate fires the browser has already decided not to restore.
  //
  // "manual" was never buying anything. It exists to stop the browser restoring a position while we move the
  // reader ourselves, and a forward navigation pushes a fresh entry that has no stored position to restore.
  // Leaving the default alone means the browser restores on a traversal, which is the whole point, and the
  // explicit scrollTo below still owns the forward case.
  //
  // Measured on the deployed site: leaving the homepage at y=3963, soft-navigating to /platform, then Back
  // returned y=0 with the manual write in place and the left position without it.
  useBeforePaint(() => {
    // Exact match, not a prefix: /dev-preview/v6/platform must not be treated as the homepage.
    const isHome = pathname === BASE || pathname === BASE + "/";
    // A hash names a position the reader asked for. Without this guard the anchor scroll started and was
    // then pulled back to the top, so /dev-preview/v6#gap never landed. A traversal names one too.
    if (!isHome || window.location.hash || lastNavWasTraversal.current) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
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
 *
 * These same two events are the only place a traversal is observable, so this is also what publishes
 * lastNavWasTraversal for the two scroll corrections below.
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
      const kind = (e as Event & { navigationType?: string }).navigationType;
      lastNavWasTraversal.current = kind === "traverse";
      if (kind === "traverse") arm();
    };
    // This used to write history.scrollRestoration = "auto" here, to undo the "manual" RouteTransition set
    // on the homepage entry. It never worked: by the time popstate fires the browser has already decided
    // whether to restore. RouteTransition no longer writes scrollRestoration at all, so there is nothing to
    // undo and this only has to record that the navigation was a traversal.
    const onPop = () => {
      lastNavWasTraversal.current = true;
      arm();
    };
    // Input disarms the style AND clears the traversal flag. scrollend deliberately does not clear it: it
    // fires as soon as the restored scroll settles, which can be before the target route has committed, and
    // the two corrections below read the flag at commit time.
    const onInput = () => { lastNavWasTraversal.current = false; disarm(); };
    const nav = (window as Window & { navigation?: EventTarget }).navigation;
    nav?.addEventListener("navigate", onNavigate);
    window.addEventListener("popstate", onPop);
    window.addEventListener("scrollend", disarm);
    window.addEventListener("pointerdown", onInput, true);
    window.addEventListener("keydown", onInput, true);
    return () => {
      nav?.removeEventListener("navigate", onNavigate);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("scrollend", disarm);
      window.removeEventListener("pointerdown", onInput, true);
      window.removeEventListener("keydown", onInput, true);
      disarm();
    };
  }, []);
}

/**
 * THE BROWSER ALIGNS AN ANCHOR ONCE, AGAINST A LAYOUT THAT IS NOT FINISHED YET.
 *
 * With the double offset removed (see app/globals.css) an anchored section should land with its top edge on
 * the bar's bottom edge, and measured cold it does not quite: /platform#current settled at 75px under a 67px
 * bar, /method#introduction at 77px, /company#contact at 77px. Asking the browser to redo the same alignment
 * once everything had settled put all of them at 67px, which is the proof that the offset itself is right and
 * the TIMING is what is off. Two things move under it, both after the scroll has already happened: the web
 * font swaps and re-measures every line of type above the target, and --nav-h is published by a
 * ResizeObserver on the real bar, so until it exists scroll-padding-top is still resolving to its 5.125rem
 * fallback rather than the measured 67px.
 *
 * Ten pixels sounds like nothing and is not, on the one surface this was reported against: those ten pixels
 * belong to the section ABOVE the target, the bar samples the ground directly beneath itself, and on
 * /platform#current the section above is the grey band. So arriving painted a grey bar over a white section
 * and then turned white as the reader moved. The offset is only correct if it is applied to the layout the
 * reader actually gets.
 *
 * A CORRECTION, NEVER AN OVERRIDE. The first deliberate input ends it, until the reader names a position
 * again. Anything done with a wheel, a finger or a key means they have taken over, and a page that scrolls
 * itself after that is worse than a page that landed ten pixels high. It never moves the page without a
 * hash, never moves it when the id is not on the page, does nothing when it is already within a pixel of
 * correct, and never touches a position that a Back or a Forward restored.
 */
function useHashLandsWhereItSays() {
  const pathname = usePathname();
  useEffect(() => {
    let surrendered = false;
    let raf = 0;
    let settleRaf = 0;
    const surrender = () => { surrendered = true; };
    window.addEventListener("wheel", surrender, { passive: true });
    window.addEventListener("touchstart", surrender, { passive: true });
    window.addEventListener("keydown", surrender);

    const align = () => {
      if (surrendered) return;
      // Read the hash at the moment of the correction rather than capturing it, because the target can
      // change without this effect re-running: usePathname() does not include the hash.
      const raw = window.location.hash.slice(1);
      if (!raw) return;
      const el = document.getElementById(decodeURIComponent(raw));
      if (!el) return;
      // The scrollport's own reserved space is the single source of the offset, so read it rather than
      // recomputing the bar's height here. Two places deciding this is the bug that was just removed.
      const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      const delta = el.getBoundingClientRect().top - pad;
      if (Math.abs(delta) < 1) return;
      // "instant" overrides html { scroll-behavior: smooth }: a correction the reader is not meant to notice
      // must not animate, or it reads as the page drifting on its own after it had already arrived.
      window.scrollBy({ top: delta, left: 0, behavior: "instant" });
    };

    // BACK AND FORWARD ARE NOT AN ARRIVAL. A traversal restores a position the reader already chose, and
    // the surrender listeners above are installed after that restoration has already happened, so a Back
    // press cannot trip the thing that is supposed to stop this. The correction then hauled the reader off
    // the position they had gone back for and onto the heading they had scrolled away from. The listeners
    // are still installed, because a hash the reader names later on the same route is a fresh request.
    //
    // Both settle points, because either one can be the last to move: the font swap, and the frame after the
    // ResizeObserver has published the real bar height. Whichever runs second finds the page already correct
    // and returns without touching anything.
    if (!lastNavWasTraversal.current) {
      raf = requestAnimationFrame(() => requestAnimationFrame(align));
      document.fonts?.ready.then(align).catch(() => {});
    }

    // A HASH-ONLY MOVE IS A NEW REQUEST, and nothing here could see one. This effect is keyed on the
    // pathname, which excludes the hash, so going from #api to #cli on /developers aligned nothing: the
    // correction was applied to the first anchor of the visit and to no other, and one wheel tick anywhere
    // in the route switched it off for the rest of the route. Naming a position again re-arms it.
    //
    // It waits for the scroll to stop before correcting. The browser is on its way to the anchor when this
    // fires, animating, because scroll-behavior: smooth is deliberately kept for exactly these links, and
    // an instant correction mid-flight would cancel the animation and drop the reader at the end of it.
    // Two identical frames is the settle test, which needs no guessed duration; the frame cap is there so a
    // reader who keeps scrolling does not leave a rAF loop running.
    const onHashChange = () => {
      if (lastNavWasTraversal.current) return;
      surrendered = false;
      cancelAnimationFrame(settleRaf);
      let last = NaN, still = 0, frames = 0;
      const tick = () => {
        if (surrendered || frames++ > 180) return;
        const y = window.scrollY;
        still = y === last ? still + 1 : 0;
        last = y;
        if (still >= 2) { align(); return; }
        settleRaf = requestAnimationFrame(tick);
      };
      settleRaf = requestAnimationFrame(tick);
    };
    window.addEventListener("hashchange", onHashChange);

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(settleRaf);
      surrendered = true;
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("wheel", surrender);
      window.removeEventListener("touchstart", surrender);
      window.removeEventListener("keydown", surrender);
    };
  }, [pathname]);
}

/**
 * ONE ANONYMOUS VISIT, ONCE PER TAB SESSION.
 *
 * The top of the funnel is the only stage that cannot be recorded server-side from something an account
 * did, because nobody is signed in yet. Everything downstream (account created, verification queued,
 * verification finished) is written at the moment it happens by the code that does it.
 *
 * sessionStorage rather than localStorage, deliberately: coming back tomorrow SHOULD count as a new visit.
 * A second tab counts as a second session, which is the honest granularity for a number whose only job is
 * "did anybody arrive", and it is better to slightly over-count sessions than to silently merge two people
 * sharing a machine.
 *
 * Fires on mount only, so what it records is the LANDING path rather than every route the reader then
 * clicks through. Route-by-route movement is a different question and this is not the mechanism for it.
 *
 * sendBeacon first, because it survives the page being closed mid-flight; fetch with keepalive is the
 * fallback. Both are fire-and-forget: a failed analytics call must be invisible to the reader.
 */
function useVisitBeacon() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("v6.visited") === "1") return;
      sessionStorage.setItem("v6.visited", "1");
    } catch {
      return; // storage disabled (private mode): skip, rather than beacon on every mount forever
    }
    const body = JSON.stringify({ path: window.location.pathname });
    try {
      if (navigator.sendBeacon?.("/api/v/funnel", new Blob([body], { type: "application/json" }))) return;
    } catch { /* fall through to fetch */ }
    void fetch("/api/v/funnel", {
      method: "POST", body, keepalive: true, headers: { "content-type": "application/json" },
    }).catch(() => {});
  }, []);
}

export function V6Shell({ children, authed = false }: { children: ReactNode; authed?: boolean }) {
  useInstantHistoryRestore();
  useHashLandsWhereItSays();
  useVisitBeacon();
  // THE PERSISTENT ROUTE CANVAS. Every route declares the ground of its opening surface from the same map
  // the nav already trusts, computed during render, so the server-rendered document carries it and a
  // client-side commit swaps it in the same frame as the content. Nothing samples, defers, or corrects
  // after paint. The shell is opaque and viewport-tall, so the fade the incoming page plays happens over
  // the route's own ground: the white shell that used to sit beneath dark routes is what every transition
  // flash was actually showing.
  const pathname = usePathname() || "";
  const groundName = v6GroundAtTop(pathname);
  const ground = groundName === "graphite" ? "dark" : "light";
  return (
    <div className="v6" data-route-theme={ground}>
      {/* The final safety canvas, behind even the shell. The root layout paints html/body cream inline for
          the rest of the site; on v6 documents this beats it (stylesheet !important outranks an inline
          style), so the browser has no frame in which its own canvas can show. It follows the route theme,
          so a light route never flashes black and a dark route never flashes white, in overscroll included.
          COLOR-SCHEME IS PART OF THE CANVAS, and leaving it out is what kept the white flash alive. The root
          layout sets color-scheme inline from --canvas-scheme, which v6 never defines, so every dark route
          ran as color-scheme:light. That value is what the browser paints BEFORE a document's own CSS has
          applied, and what it uses for the overscroll gutter and for native controls. So a dark route still
          flashed white on entry and still showed a pale strip past the end of the page, even though its
          background was pinned correctly. Both are one declaration. */}
      <style>{`html, body { background: ${GROUND_CSS[groundName].bg} !important; color-scheme: ${GROUND_CSS[groundName].scheme} !important; }`}</style>
      {/* Nine focus stops sit in the nav before any content. Keyboard and screen-reader users get one stop to
          jump past them; it is invisible until focused. */}
      <a href="#v6-main" className="v6-skip">Skip to content</a>
      <V6Nav authed={authed} />
      <main id="v6-main" tabIndex={-1}><RouteTransition>{children}</RouteTransition></main>
      <SiteFooter />
    </div>
  );
}
