"use client";

// Shared public shell: Product, Solutions, Research and Resources; one phone drawer, one footer,
// one route transition, used by every v6 route. The bar stays put and takes the colour of whatever is under it.
// Client-side navigation with prefetch (next/link).
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FocusEvent as ReactFocusEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiteFooter } from "./close";
import { PRIMARY_SECTORS, SOLUTIONS_HREF } from "../_content/sectors";
import { useGroundColor } from "@/components/use-ground-color";
import { V6_BASE, V6_HOME, V6_APP, v6SignInPath, v6GroundAtTop, v6ShouldPrefetch, GROUND_CSS } from "@/lib/v6-routes";
import { analyticsAllowed, onPrivacyChoiceChange } from "@/lib/privacy-choice";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ButtonLabel } from "@/components/button-label";
import { APP_ACCESS_OPEN, SYSTEM_INQUIRY_LABEL, SYSTEM_INQUIRY_PATH } from "@/lib/app-availability";

// FOLLOWS THE PROMOTION FLAG. These were hardcoded to "/dev-preview/v6", which is precisely the mistake
// lib/v6-routes.ts was written to prevent: it says every V6 destination lives there so promotion is one
// edit, and then the shell kept its own copy anyway.
//
// Promoted, the hardcoded value broke two things at once. themeAtTop compared the pathname "/" against
// "/dev-preview/v6", never matched, and painted the bar LIGHT over the black hero. And every nav link still
// pointed into the preview namespace, so the promoted site navigated back out of itself.
const BASE = V6_BASE;
const SIGNIN = v6SignInPath();
// Account creation is the same screen in its sign-up mode, landing in the console afterwards.
const SIGNUP = `${SIGNIN}&mode=signup`;

// Public navigation favors distinct destinations; detailed topics remain in their pages
// and documentation. Menus use the licensed editorial images credited alongside the assets.
type MLink = { t: string; d?: string; href: string; pic?: string };
type Group = { h: string; links: MLink[] };
type Card = { title: string; href: string; pic: string };
type Menu = { label: string; intro: string; groups: Group[]; feature?: Card & { description: string }; cards?: Card[]; foot?: MLink };

const picSrc = (p: string) => (p.startsWith("/") ? p : `/home/menu/pics/${p}.jpg`);
// The box is min(705px, 49vw) wide (nav.css); the two cards share it.
const PIC_SIZES = "(max-width: 1100px) 28vw, 32vw";
const CARD_SIZES = "(max-width: 1440px) 23vw, 330px";
// A picture that does not load (a file not delivered yet, a deploy that lost one) shows this one instead of an
// empty box: a licensed editorial photograph of industrial robotics.
const PIC_FALLBACK = "/home/menu/editorial/robotics.jpg";

const EDITORIAL = "/home/menu/editorial/";
const MENUS: Menu[] = [
  {
    label: "Product",
    intro: "Protect the intelligence inside.",
    feature: { title: "A model release is a security decision.", description: "Model release security for robotics engineering teams", href: BASE + "/guides/model-release-security", pic: "/site/photography/editorial-releaseInspection.jpg" },
    groups: [
      { h: "Product direction", links: [
        { t: "Overview", d: "AI security direction and development status", href: BASE + "/platform", pic: "/site/photography/robot-cell.jpg" },
        { t: "Vraelis Contour", d: "Model release security for robotics engineering teams", href: BASE + "/contour", pic: "/site/photography/hardware-inspection.jpg" },
        { t: "Development status", d: "Private foundations and integration work", href: BASE + "/beta", pic: "/site/photography/robot-detail.jpg" },
      ] },
      { h: "Security areas", links: [
        { t: "Model integrity", d: "Model provenance and deployment verification", href: BASE + "/model-integrity", pic: "/site/photography/server-rack.jpg" },
        { t: "Adversarial threats", d: "Manipulated inputs, poisoned data and evaluation", href: BASE + "/adversarial-security", pic: "/site/photography/robot-detail.jpg" },
        { t: "Zero trust", d: "Explicit identity, scope and approval", href: BASE + "/zero-trust", pic: "/site/photography/server-rack.jpg" },
        { t: "Recorded evidence", d: "Supporting evidence for security investigation", href: BASE + "/recorded-evidence", pic: "/site/photography/robot-detail.jpg" },
      ] },
      { h: "Engineering", links: [
        { t: "Integrations", d: "Integration boundaries and trusted context", href: BASE + "/integrations", pic: "/site/photography/network-engineer.jpg" },
        { t: "AI workloads", d: "Authority at the tool and action boundary", href: BASE + "/agents", pic: "/site/photography/electronics-bench.jpg" },
        { t: "Developer tools", d: "Implementation references and integration work", href: BASE + "/developers", pic: "/site/photography/hardware-inspection.jpg" },
      ] },
    ],
  },
  {
    label: "Solutions",
    intro: "Security for AI in the physical world.",
    feature: { title: "Different systems. Different security boundaries.", description: "The control has to fit the environment, not just the model.", href: BASE + "/guides/operating-constraints", pic: "/site/photography/editorial-windOperations.jpg" },
    groups: [
      { h: "Physical systems", links: PRIMARY_SECTORS.map(s => ({ t:s.label,d:s.line,href:s.href,pic:s.slug === "defense" ? EDITORIAL + "aviation.jpg" : s.slug === "fleets" ? "/site/photography/robot-arm.jpg" : s.pics.menu })) },
      { h: "Organizations", links: [{ t: "Government & institutions", d: "Mission systems and public infrastructure", href: BASE + "/government", pic: "/site/photography/satellite-station.jpg" }, { t: "System integrators", d: "Security boundaries across suppliers", href: BASE + "/integrators", pic: "/site/photography/network-engineer.jpg" }] },
      { h: "Engineering teams", links: [{ t: "Enterprise", d: "AI security across engineering teams", href: BASE + "/enterprise", pic: "/site/photography/server-rack.jpg" }, { t: "Integrations", d: "Integration boundaries and trusted context", href: BASE + "/integrations", pic: "/site/photography/network-engineer.jpg" }] },
    ],
    foot: { t: "Explore solutions", href: SOLUTIONS_HREF },
  },
  {
    label: "Research",
    intro: "Match the threat to a measurable test.",
    feature: { title: "Measure the boundary, not a broad security score.", description: "Match the threat to a measurable test.", href: BASE + "/guides/ai-security-evaluation", pic: "/site/photography/editorial-electronicsResearch.jpg" },
    groups: [
      { h: "Research", links: [
        { t: "Overview", d: "Our method and open questions", href: BASE + "/research", pic: "/site/photography/hardware-inspection.jpg" },
      ] },
      { h: "Security areas", links: [
        { t: "Adversarial threats", d: "Manipulated inputs, poisoned data and evaluation", href: BASE + "/adversarial-security", pic: "/site/photography/robot-detail.jpg" },
        { t: "Model integrity", d: "Model provenance and deployment verification", href: BASE + "/model-integrity", pic: "/site/photography/server-rack.jpg" },
      ] },
      { h: "Evaluation", links: [
        { t: "Recorded evidence", d: "Supporting evidence for security investigation", href: BASE + "/recorded-evidence", pic: "/site/photography/robot-detail.jpg" },
        { t: "Zero trust", d: "Explicit identity, scope and approval", href: BASE + "/zero-trust", pic: "/site/photography/server-rack.jpg" },
      ] },
    ],
  },
  {
    label: "Resources",
    intro: "Understand the threats. Examine the work.",
    groups: [
      { h: "Explore", links: [
        { t: "Documentation", d: "Implementation references and integration work", href: BASE + "/docs", pic: "/site/photography/network-engineer.jpg" },
        { t: "The problems", d: "Unauthorized actions, untrusted inputs and integrity", href: BASE + "/problems", pic: "/site/photography/hardware-inspection.jpg" },
      ] },
      { h: "Company", links: [
        { t: "Our goals", d: "The company we are building", href: BASE + "/goals", pic: "/site/photography/satellite-station.jpg" },
        { t: "About", d: "Who is building Vraelis", href: BASE + "/company", pic: "/site/photography/hardware-inspection.jpg" },
        { t: SYSTEM_INQUIRY_LABEL, d: "Tell us about your system and security problem", href: BASE + SYSTEM_INQUIRY_PATH, pic: "/site/photography/helicopter.jpg" },
      ] },
      { h: "Updates and trust", links: [
        { t: "Changelog", d: "What shipped and when", href: BASE + "/changelog", pic: "/site/photography/robot-grinding.jpg" },
        { t: "Security", d: "How we protect your data", href: BASE + "/security", pic: "/site/photography/server-rack.jpg" },
      ] },
    ],
    cards: [
      { title: "AI security at Vraelis", href: BASE + "/docs/ai-security", pic: "/site/photography/editorial-electronicsWorkbench.jpg" },
      { title: "Review recorded task reports", href: BASE + "/docs/recorded-reports", pic: "/site/photography/editorial-engineeringTeam.jpg" },
    ],
  },
];
const MEGA_ID = "v6-mega";

function restartCurrentPage(event: ReactMouseEvent<HTMLAnchorElement>) {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  const destination = new URL(event.currentTarget.href, window.location.href);
  if (destination.origin !== location.origin || destination.pathname !== location.pathname || destination.hash) return;
  // Wait until a mobile drawer has restored the document's scrolling element.
  requestAnimationFrame(() => window.scrollTo({ top:0, left:0, behavior:"instant" }));
}

// What the first look at each menu needs: its featured guide picture, or the two cards. Fetched once the page has
// settled on a desktop, so the first menu a reader opens shows its picture instead of an empty box.
const WARM_PICS: { src: string; sizes: string }[] = [...new Map(MENUS.flatMap((m) =>
  m.cards
    ? m.cards.map((c) => ({ src: picSrc(c.pic), sizes: CARD_SIZES }))
    : m.feature ? [{ src: picSrc(m.feature.pic), sizes: PIC_SIZES }] : [],
).map(p => [p.src, p])).values()];

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

// Featured reading is independent of the navigation list; pointing at a menu link never replaces it.
function MegaShell({ index, state, onNavigate }: { index: number; state: "in" | "out"; onNavigate: (event: ReactMouseEvent<HTMLAnchorElement>) => void }) {
  const menu = MENUS[index];
  // Pictures that failed to load, shown as PIC_FALLBACK instead.
  const [lost, setLost] = useState<readonly string[]>([]);
  const featured = menu.feature;
  const srcOf = (p: string) => picSrc(lost.includes(p) ? PIC_FALLBACK : p);
  const onLost = (p: string) => () => setLost((cur) => (p === PIC_FALLBACK || cur.includes(p) ? cur : [...cur, p]));
  return (
    <div className="v6-mega" data-state={state}>
      <div className="v6-mega__panel">
        <div className="v6-mega__intro"><p>{menu.intro}</p><span>Vraelis is in private development.</span></div>
        <div className="v6-mega__grid" key={menu.label} data-cards={menu.cards ? "true" : undefined}>
          {menu.groups.map((g, gi) => (
            <div key={g.h} className="v6-mega__col">
              <p className="v6-mega__col-h" id={`${MEGA_ID}-${index}-${gi}`}>{g.h}</p>
              <ul className="v6-mega__list" aria-labelledby={`${MEGA_ID}-${index}-${gi}`}>
                {g.links.map((l) => (
                  <li key={l.t}>
                    <Link href={l.href} className="v6-mega__link" onClick={onNavigate}>
                      <span>{l.t}</span>{l.d ? <span className="v6-mega__description">{l.d}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {menu.foot ? (
            <Link href={menu.foot.href} className="v6-mega__foot" onClick={onNavigate}>
              {menu.foot.t}<span className="v6-arw" aria-hidden="true">→</span>
            </Link>
          ) : null}
          {menu.cards ? (
            <div className="v6-mega__cards">
              {menu.cards.map((c) => (
                <Link key={c.href} href={c.href} className="v6-mega__card" onClick={onNavigate}>
                  <span className="v6-mega__cpic"><Image src={picSrc(c.pic)} alt="" fill sizes={CARD_SIZES} /></span>
                  <span className="v6-mega__ct">{c.title}</span>
                </Link>
              ))}
            </div>
          ) : featured ? (
            <Link href={featured.href} className="v6-mega__media" onClick={onNavigate}>
              <Image src={srcOf(featured.pic)} alt="" fill sizes={PIC_SIZES} className="v6-mega__pic" data-on="true"
                loading="eager" onError={onLost(featured.pic)} />
              <span className="v6-mega__feature-copy"><span>{featured.title}</span><span>{featured.description}</span><span className="v6-mega__feature-action">Read the guide</span></span>
            </Link>
          ) : null}
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
  // Disclosure buttons in their visual and keyboard order.
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const megaRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [settled, setSettled] = useState(false);
  const [drawer, setDrawer] = useState(false);
  // `open` is which menu is showing; `exiting` is the one still animating away. Keeping the outgoing panel
  // mounted for the length of its exit is the whole fix for menus that used to vanish on dismiss.
  const [open, setOpen] = useState<number | null>(null);
  const [exiting, setExiting] = useState<number | null>(null);
  const closeT = useRef(0);
  const exitT = useRef(0);
  // whichever panel is on screen: the open one, or the one still animating out
  const shown = open ?? exiting;

  // Direction-aware chrome leaves reading space without changing the page layout.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    let anchor = window.scrollY;
    let pointerAtTop = false;
    const show = () => { nav.dataset.hidden = "false"; };
    const onScroll = () => {
      const y = window.scrollY;
      const focused = nav.contains(document.activeElement) && document.activeElement?.matches(":focus-visible");
      if (y < 80 || shown !== null || drawer || pointerAtTop || focused) {
        show(); anchor = y; return;
      }
      if (Math.abs(y - anchor) < 8) return;
      nav.dataset.hidden = y > anchor ? "true" : "false";
      anchor = y;
    };
    const onPointer = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      pointerAtTop = event.clientY <= nav.offsetHeight + 12;
      if (pointerAtTop) show();
    };
    show();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointer, { passive: true });
    nav.addEventListener("focusin", show);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointer);
      nav.removeEventListener("focusin", show);
    };
  }, [pathname, shown, drawer]);

  // THE FIRST PICTURE OF EACH MENU IS FETCHED BEFORE ANYONE ASKS FOR IT. A panel mounts its pictures when it
  // opens, so the first menu a reader opened showed an empty box until its picture arrived. A desktop page
  // fetches the four first looks (WARM_PICS) once it has settled, or as soon as the pointer reaches the bar,
  // at the size the panel asks for, so opening a menu finds them in the cache. A phone never shows the panel
  // and fetches nothing.
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    if (!window.matchMedia("(min-width: 941px)").matches) return;
    const t = window.setTimeout(() => setWarm(true), 2500);
    return () => window.clearTimeout(t);
  }, []);

  // THE BAR CHANGES FORM AT 940px, AND WHATEVER IS OPEN MUST NOT SURVIVE THE CROSSING.
  //
  // Two surfaces answer the same question at two widths: the desktop mega panel and the phone drawer. The
  // width that decides which one exists can change with no reload -- one zoom step, entering fullscreen from
  // a small window, leaving split-screen, an external display -- and neither surface was watching it.
  //
  // A mega panel open when the window narrows past 940 renders its four-column grid at roughly 50px per
  // column, anchored to a bar that is position:fixed on the homepage, with its own trigger now display:none.
  // A drawer open when the window widens past 940 keeps document.body.style.overflow = "hidden" over a
  // desktop layout, so the page underneath cannot be scrolled and the close button that would release it is
  // display:none too. Both are dead ends a reader cannot leave without reloading the page.
  //
  // CLOSING RATHER THAN CONVERTING is deliberate. A reader who opened a menu at one width did not ask to be
  // handed the other form of it mid-gesture; dismissal is the one outcome that is never surprising. It fires
  // only on a crossing, never at mount, so the surface a reader deliberately opened is never taken away.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 940px)");
    const sync = () => {
      if (mq.matches) { setOpen(null); setExiting(null); }
      else setDrawer(false);
    };
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

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
  // Every surface is black since 2026-10-01, so the bar is always the dark bar. The sampler still runs: its
  // reading is the exact ground colour the bar takes (navBg), so a band a step lighter is matched exactly.
  const dark = sampled ? ground.dark || true : routeDark || true;
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
    // The drawer overrides everything below it, and its own colour is not `navBg`: opening it PAUSES the
    // ground sampler (see the useGroundColor call above), so navBg is whatever was last sampled before the
    // tap — a light chapter's colour, say — while v6.css paints the drawer panel a hardcoded #08080A
    // regardless ("always night"). Without this branch the chrome strip kept showing that stale light
    // reading under a full-screen dark panel: the exact "two bars, different schedules" defect this effect
    // exists to end, just reappearing on drawer-open instead of on scroll.
    //
    // Otherwise: the exact sampled ground when there is one, so the chrome matches even mid-interpolation;
    // the route's declared pole otherwise. Only rgb()/hex reach the meta tag: theme-color support for the
    // wider notations (oklab, color()) is not dependable, and an unsupported value hands the browser
    // back to its own guess, which is the disagreement this exists to end.
    const color = drawer ? "#08080A" : navBg && /^(#|rgb)/i.test(navBg) ? navBg : dark ? "#0A0A0B" : "#FFFFFF";
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
  }, [dark, navBg, pathname, drawer]);

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
    setOpen(i);
  }, []);
  // One pending close at a time: leaving the panel and the bar together used to start two, and coming back
  // cleared only the second, so the first still closed the menu under the returning pointer.
  const scheduleClose = useCallback(() => {
    window.clearTimeout(closeT.current);
    closeT.current = window.setTimeout(() => close(null), 160);
  }, [close]);
  // POINTING IS A MOUSE'S. Opening on hover, and closing when the pointer leaves, listen to pointer events and
  // only to a mouse: a finger on a tablet held sideways "enters" and "leaves" with every tap, which opened a menu
  // and then closed it again a moment later. Pointer events also come in one order, the leaving before the
  // entering, so moving from an open panel straight onto another menu's button cancels the close it started.
  const mouseOnly = (fn: () => void) => (e: ReactPointerEvent) => { if (e.pointerType === "mouse") fn(); };

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

  // THE KEYBOARD. The open menu's panel comes after all the top items in the page, so Tab from an open button
  // used to walk the other buttons and then out of the bar, leaving the panel open over the hero's address
  // field for good. Now Tab from an open button goes into its panel, Tab off the panel's last link closes it
  // and moves on to the next top item (the next menu, or Pricing after Resources), Shift+Tab walks back out the
  // same way, and focus leaving the bar (or landing on another top item) closes whatever is open.
  const focusables = () => Array.from(megaRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? []);
  const onItemKey = (i: number) => (e: ReactKeyboardEvent) => {
    if (e.key !== "Tab" || e.shiftKey || open !== i) return;
    const first = focusables()[0];
    if (first) { e.preventDefault(); first.focus(); }
  };
  const onMegaKey = (e: ReactKeyboardEvent) => {
    if (e.key !== "Tab" || shown === null) return;
    const list = focusables();
    const at = list.indexOf(document.activeElement as HTMLElement);
    if (e.shiftKey && at === 0) { e.preventDefault(); itemRefs.current[shown]?.focus(); return; }
    if (!e.shiftKey && at === list.length - 1) {
      e.preventDefault();
      const i = shown;
      close(i);
      const next = itemRefs.current[i + 1] ?? navRef.current?.querySelector<HTMLElement>(".v6-nav__right a[href], .v6-nav__right button");
      next?.focus();
    }
  };
  // Only focus that lands somewhere else closes the menu. A click on the panel's own ground (a group name, the
  // picture) sends focus nowhere (relatedTarget is null), and that used to close the menu under the pointer; a
  // click outside the bar is the pointerdown listener's to handle.
  const onNavBlur = (e: ReactFocusEvent) => {
    const to = e.relatedTarget as Node | null;
    if (open !== null && to && !navRef.current?.contains(to)) close(open);
  };
  // A MOUSE OPENS A MENU BY POINTING, SO ITS CLICK NEVER CLOSES ONE. The pointer reaches a menu button before it
  // can click it, so the menu is already open by then, and the click used to close it under the pointer: the
  // reader who clicked "Product" to see Product got nothing. A mouse click now opens (or keeps open); a tap, a
  // pen and the keyboard (Enter or Space, whose click has detail 0) still open and close it in turn.
  const lastPointer = useRef("");
  const onItemClick = (i: number) => (e: ReactMouseEvent) => {
    const mouse = e.detail > 0 && lastPointer.current === "mouse";
    if (open === i) { if (!mouse) close(i); }
    else openAt(i);
  };
  // Pricing is a plain link: pointing at it or tabbing onto it closes whatever menu is open, as moving to any
  // top item that is not the open one does.
  const leaveMenus = () => { if (open !== null) close(open); };

  // Escape + click-outside. Escape hands focus back to the menu's button only when focus was on that button or
  // in its panel. A menu opened by pointing leaves focus wherever the reader had it (a field on the page, say),
  // and Escape closing that menu must not pull focus up into the bar.
  useEffect(() => {
    if (open === null) return;
    const i = open;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const a = document.activeElement;
      const own = !!a && (a === itemRefs.current[i] || !!megaRef.current?.contains(a));
      close(i);
      if (own) itemRefs.current[i]?.focus();
    };
    const onDown = (e: PointerEvent) => { if (!navRef.current?.contains(e.target as Node)) close(i); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown, true); };
  }, [open, close]);

  // THE DRAWER HANDS FOCUS BACK. It unmounts with focus inside it, which dropped a keyboard or screen-reader
  // user on <body> with nothing to say where they were. Every close that leaves the reader on this page
  // (Escape, the close button, a link to this page or a section of it) returns focus to the menu button
  // that opened it. A link to another route does not: the new page is what comes next, and the route change
  // owns focus from there. Crossing 940px closes it without moving focus, since the button is gone there.
  //
  // Focus moves BEFORE the drawer unmounts, while the control that was pressed still holds it, so the
  // browser's rule for a scripted focus (draw a ring only if the element it leaves had one) reads the real
  // input: a tap returns focus to the button with no ring, Escape or Enter returns it with one.
  // preventScroll is load-bearing: a plain focus() on the sticky bar scrolls the page, because html's
  // scroll-padding-top (app/globals.css) counts the strip the bar sits in as out of view. Measured on
  // /platform at 390px: 1400 to 978 without it.
  //
  // Stable on purpose: MobileNav's effect depends on it. The inline arrow it replaces was a new function on
  // every render, and the bar does re-render with the drawer open (pinning the body resets scrollY, which
  // flips `scrolled`), so that effect released the body and pinned it again.
  const closeDrawer = useCallback((returnFocus: boolean) => {
    if (returnFocus) burgerRef.current?.focus({ preventScroll: true });
    setDrawer(false);
  }, [setDrawer]); // a state setter never changes; named because the compiler lint asks for it

  return (
    <nav ref={navRef} className="v6-nav" data-scrolled={scrolled} data-theme={dark ? "dark" : "light"}
      data-open={shown !== null} data-menu={open !== null ? "open" : undefined} data-settled={settled}
      data-ground={navBg ? "1" : undefined}
      style={navBg ? ({ "--nav-bg": navBg } as CSSProperties) : undefined}
      aria-label="Primary" onPointerLeave={(event) => mouseOnly(scheduleClose)(event)} onBlur={onNavBlur} onPointerEnter={() => setWarm(true)}>
      <div className="v6-nav__in">
        <Brand />
        <div className="v6-nav__items">
          {/* No caret on any item. A mouse opens a menu by pointing at it; a touch screen wide enough for this
              bar (a tablet held sideways) has no pointing, so a tap opens and a second tap closes, and the
              keyboard opens with Enter or Space. A menu button is a disclosure (aria-expanded, and aria-controls
              while its panel exists), not an ARIA menu: the panel is a set of links, reached with Tab. While one
              is open the other items dim (nav.css). */}
          {MENUS.map((m, i) => (
            <button key={m.label} type="button" ref={(el) => { itemRefs.current[i] = el; }}
              className="v6-nav__item" aria-expanded={open === i} aria-controls={open === i ? MEGA_ID : undefined}
              onPointerDown={(e) => { lastPointer.current = e.pointerType; }} onClick={onItemClick(i)}
              onPointerEnter={(event) => mouseOnly(() => openAt(i))(event)}
              onKeyDown={onItemKey(i)} onFocus={() => { if (open !== null && open !== i) close(open); }}>
              {m.label}
            </button>
          ))}

        </div>
        {/* A panel on its way out stays on screen for its exit, and is inert for it: nothing in it can take focus
            (a quick Tab from Pricing used to land in a panel about to unmount) or be read out while it fades. */}
        {shown !== null ? (
          <div ref={megaRef} id={MEGA_ID} inert={open === null}
            onPointerEnter={(event) => mouseOnly(() => openAt(shown))(event)} onPointerLeave={(event) => mouseOnly(scheduleClose)(event)} onKeyDown={onMegaKey}>
            <MegaShell index={shown} state={open === null ? "out" : "in"} onNavigate={(event) => { restartCurrentPage(event); close(shown); }} />
          </div>
        ) : null}
        {warm ? (
          <div className="v6-mega__warm" aria-hidden="true">
            {WARM_PICS.map((w) => (
              <span key={w.src} className="v6-mega__warm-i"><Image src={w.src} alt="" fill sizes={w.sizes} loading="eager" fetchPriority="low" /></span>
            ))}
          </div>
        ) : null}
        {/* Pointing at the right-hand controls leaves the menus, as pointing at Pricing does: the language list
            opening over a menu panel was two surfaces at once. */}
        <div className="v6-nav__right" onPointerEnter={(event) => mouseOnly(leaveMenus)(event)}>
          {/* THE RIGHT SIDE, LIKE OVERLYM'S (founder, 2026-10-01): the language as a flag pill, then Sign in and
              Create account for a visitor, or Open Vraelis for someone already signed in. It used to carry
              one button, which left the bar looking unfinished on a wide screen. */}
          <LanguageSwitcher variant="pill" placement="down" className="v6-nav__lang" />
          {!APP_ACCESS_OPEN ? <Link href={`${BASE}${SYSTEM_INQUIRY_PATH}`} className="v6-btn v6-btn--brand"><ButtonLabel>{SYSTEM_INQUIRY_LABEL}</ButtonLabel></Link> : <>
          {authed ? null : <Link href={SIGNIN} className="v6-nav__signin">Sign in</Link>}
          {authed
            ? <Link href={V6_APP} prefetch={v6ShouldPrefetch(V6_APP) ? undefined : false} className="v6-btn v6-btn--brand">Open Vraelis</Link>
            : <Link href={SIGNUP} className="v6-btn v6-btn--brand">Create account</Link>}
          </>}
          <button ref={burgerRef} className="v6-nav__burger" aria-label="Open navigation" aria-haspopup="dialog" onClick={() => setDrawer(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
        </div>
      </div>
      {drawer ? <MobileNav authed={authed} onClose={closeDrawer} /> : null}
    </nav>
  );
}

function MobileNav({ authed, onClose }: { authed: boolean; onClose: (returnFocus: boolean) => void }) {
  const panel = useRef<HTMLDivElement>(null);
  // One section open at a time, Product first: the drawer used to flatten every desktop group into one long
  // list under headings like "Platform, Understand", which read as an index dump next to the desktop menus.
  // Each menu is an accordion carrying the same groups and titles the desktop panel shows, each link with its
  // one-line description, on the same black surface.
  const [openSec, setOpenSec] = useState<number | null>(0);
  useEffect(() => {
    // THE PAGE BEHIND MUST NOT SCROLL (founder, from an iPhone, 2026-10-01: "they can scroll the page and
    // this at the same time"). overflow: hidden on <body> alone is ignored by iOS Safari, which scrolls the
    // document anyway, so the body is pinned in place at its current offset and released to the same offset
    // on close. The drawer's own list scrolls inside itself and does not chain to the page.
    const html = document.documentElement, body = document.body;
    const y = window.scrollY;
    const prev = { ho: html.style.overflow, bo: body.style.overflow, bp: body.style.position, bt: body.style.top, bw: body.style.width };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.width = "100%";
    const focusables = () => Array.from(panel.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])') ?? []);
    // Focus the close button, not the first link: landing on the wordmark drew a focus ring around the logo,
    // which read as a rendering bug when the drawer was opened by tapping.
    (panel.current?.querySelector<HTMLElement>(".v6-drawer__x") ?? focusables()[0])?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // The language menu opens over the drawer, and Escape closes that menu alone. Both used to close.
        if (document.querySelector(".lsw__menu")) return;
        onClose(true);
        return;
      }
      if (e.key !== "Tab") return;
      const f = focusables(); if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      html.style.overflow = prev.ho; body.style.overflow = prev.bo; body.style.position = prev.bp;
      body.style.top = prev.bt; body.style.width = prev.bw;
      // instant, not smooth: html { scroll-behavior: smooth } would otherwise animate back from the top
      window.scrollTo({ top: y, behavior: "instant" });
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // A link to another route closes the drawer on the way to a new page. One that keeps the reader here (this
  // page, a section of it, or a new tab) also sends focus back to the menu button.
  const follow = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    restartCurrentPage(e);
    const to = new URL(e.currentTarget.href, window.location.href);
    const newTab = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
    onClose(newTab || (to.origin === window.location.origin && to.pathname === window.location.pathname));
  };

  return (
    <div ref={panel} className="v6-drawer" role="dialog" aria-modal="true" aria-label="Navigation">
      <div className="v6-drawer__top">
        <Brand />
        <button className="v6-drawer__x" aria-label="Close navigation" onClick={() => onClose(true)}>
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
                      <Link key={l.t} href={l.href} className="v6-drawer__glink" onClick={follow}>
                        <span className="v6-drawer__glt">{l.t}</span>
                        {l.d ? <span className="v6-drawer__gld">{l.d}</span> : null}
                      </Link>
                    ))}
                  </div>
                ))}
                {m.foot ? (
                  <Link href={m.foot.href} className="v6-drawer__more" onClick={follow}>
                    {m.foot.t}<span className="v6-arw" aria-hidden="true">→</span>
                  </Link>
                ) : null}
                {(m.cards ?? (m.feature ? [m.feature] : [])).map(feature => <Link key={feature.href} href={feature.href} className="v6-drawer__feature" onClick={follow}>
                  <Image src={picSrc(feature.pic)} alt="" width={120} height={90} sizes="120px" />
                  <span>{feature.title}</span>
                </Link>)}
              </div>
            ) : null}
          </section>
        ))}

      </div>
      <div className="v6-drawer__foot">
        <LanguageSwitcher placement="up" className="v6-drawer__lang" />
        {!APP_ACCESS_OPEN ? <Link href={`${BASE}${SYSTEM_INQUIRY_PATH}`} className="v6-btn v6-btn--brand" onClick={follow}><ButtonLabel>{SYSTEM_INQUIRY_LABEL}</ButtonLabel></Link> : <>
        {authed ? null : <Link href={SIGNIN} className="v6-btn v6-btn--ghost" onClick={follow}>Sign in</Link>}
        {authed
          ? <Link href={V6_APP} prefetch={v6ShouldPrefetch(V6_APP) ? undefined : false} className="v6-btn v6-btn--brand" onClick={follow}>Open Vraelis <span className="v6-arw" aria-hidden>→</span></Link>
          : <Link href={SIGNUP} className="v6-btn v6-btn--brand" onClick={follow}>Create account <span className="v6-arw" aria-hidden>→</span></Link>}
        </>}
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
  // Fresh page navigation starts at its opening. History traversal and explicit
  // in-page links keep their requested positions.
  useBeforePaint(() => {
    if (window.location.hash || lastNavWasTraversal.current) return;
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

/* SKIP TO CONTENT, ON THE DOCS. There <main> opens on the docs header and the sections rail (21 focus stops
 * on /docs/cli before the article's first control), so the plain jump to #v6-main skipped nothing. On the docs
 * the link goes to the article column instead: #docs-content if the docs shell names it, else the column by
 * its class (.v6-docs__main, _content/docs-ui.tsx). The column takes focus as a target, not as a control
 * (tabindex -1, no ring: nav.css), so the next Tab lands on the article's first link. Anywhere else, or if
 * the column is missing, the link stays the plain jump to #v6-main. */
function skipToDocsArticle(e: ReactMouseEvent<HTMLAnchorElement>) {
  const col = document.getElementById("docs-content") ?? document.querySelector<HTMLElement>(".v6-docs__main");
  if (!col) return;
  e.preventDefault();
  if (!col.hasAttribute("tabindex")) col.setAttribute("tabindex", "-1");
  col.focus();
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
 *
 * ONLY WITH CONSENT (2026-09-30). The count and its sessionStorage marker belong to the Analytics category of
 * the privacy choices, so nothing is stored or sent until that is on. A first visit answers the question
 * after the page has mounted, so the landing path is captured at mount and the visit is sent when (and if)
 * Analytics is turned on, still recording where the person arrived rather than where they chose.
 */
function useVisitBeacon() {
  useEffect(() => {
    const landing = window.location.pathname;
    let done = false;
    function send() {
      if (done || !analyticsAllowed()) return;
      done = true;
      try {
        if (sessionStorage.getItem("v6.visited") === "1") return;
        sessionStorage.setItem("v6.visited", "1");
      } catch {
        return; // storage disabled (private mode): skip, rather than beacon on every mount forever
      }
      const body = JSON.stringify({ path: landing });
      try {
        if (navigator.sendBeacon?.("/api/v/funnel", new Blob([body], { type: "application/json" }))) return;
      } catch { /* fall through to fetch */ }
      void fetch("/api/v/funnel", {
        method: "POST", body, keepalive: true, headers: { "content-type": "application/json" },
      }).catch(() => {});
    }
    send();
    return onPrivacyChoiceChange(send);
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
  // The docs carry their own header and a one-line footer (_content/docs-ui.tsx), like Linear's. Under the
  // marketing menu and above the four-column marketing footer they read as a page about a tool rather than
  // the tool's manual.
  const isDocs = pathname === BASE + "/docs" || pathname.startsWith(BASE + "/docs/");
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
      <a href="#v6-main" className="v6-skip" onClick={isDocs ? skipToDocsArticle : undefined}>Skip to content</a>
      {isDocs ? null : <V6Nav authed={authed} />}
      <main id="v6-main" tabIndex={-1}><RouteTransition>{children}</RouteTransition></main>
      {isDocs ? null : <SiteFooter />}
    </div>
  );
}
