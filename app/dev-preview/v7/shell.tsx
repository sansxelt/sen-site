"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { PREVIEW, MEDIA } from "./config";
export function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={diagonal ? "M6 18 18 6M6 6h12v12" : "M5 12h14m-6-6 6 6-6 6"} /></svg>;
}

const menus = [
  { label: "Products", items: [
    { title: "Vraelis Contour", text: "Model release security for robotics teams", href: `${PREVIEW}/contour` },
    { title: "Our approach", text: "The company behind the first product", href: `${PREVIEW}/company` },
    { title: "Development status", text: "Current foundations and what's ahead", href: `${PREVIEW}/beta` },
  ], feature: { title: "What makes a model release secure?", href: `${PREVIEW}/guides/model-release-security`, image: `${MEDIA}/optics.png` } },
  { label: "Solutions", items: [
    { title: "Defense", text: "Mission software and operational systems", href: `${PREVIEW}/defense` },
    { title: "Critical infrastructure", text: "Utilities, transport and industrial operations", href: `${PREVIEW}/infrastructure` },
    { title: "Robotics", text: "Suppliers, integrators and operating teams", href: `${PREVIEW}/robotics` },
  ], feature: { title: "Security shaped by the environment", href: `${PREVIEW}/guides/operating-constraints`, image: `${MEDIA}/infrastructure.png` } },
  { label: "Research", items: [
    { title: "Research at Vraelis", text: "Threats, controls and their limits", href: `${PREVIEW}/research` },
    { title: "Model integrity", text: "Provenance and unauthorized changes", href: `${PREVIEW}/model-integrity` },
    { title: "Adversarial threats", text: "Manipulated inputs and poisoned data", href: `${PREVIEW}/adversarial-security` },
  ], feature: { title: "How to evaluate an AI security control", href: `${PREVIEW}/guides/ai-security-evaluation`, image: `${MEDIA}/optics.png` } },
  { label: "Resources", items: [
    { title: "Documentation", text: "Scope, concepts and engineering references", href: `${PREVIEW}/docs` },
    { title: "Company", text: "Who we are and what we're building", href: `${PREVIEW}/company` },
    { title: "Security", text: "Policies and responsible disclosure", href: "https://vraelis.com/security" },
  ], feature: { title: "The technology behind our work", href: `${PREVIEW}/technology`, image: `${MEDIA}/robotics-hall.png` } },
] as const;

export function PreviewShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<number | null>(null);
  const [mobile, setMobile] = useState(false);
  const [light, setLight] = useState(false);
  const nav = useRef<HTMLElement>(null);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const triggers = useRef<(HTMLButtonElement | null)[]>([]);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const close = () => { if (closeTimer.current) clearTimeout(closeTimer.current); setOpen(null); };
  useEffect(() => {
    const outside = (e: PointerEvent) => { if (!nav.current?.contains(e.target as Node)) { setOpen(null); setMobile(false); } };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") { if (mobile) mobileTrigger.current?.focus(); else if (open !== null) triggers.current[open]?.focus(); setOpen(null); setMobile(false); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); if (closeTimer.current) clearTimeout(closeTimer.current); };
  }, [open, mobile]);
  useEffect(() => {
    if (!mobile) return;
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [mobile]);
  useEffect(() => {
    const wide = matchMedia("(min-width: 901px)");
    const resize = () => { if (wide.matches) setMobile(false); };
    wide.addEventListener("change", resize);
    return () => wide.removeEventListener("change", resize);
  }, []);
  useEffect(() => {
    if (!mobile) return;
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = [...(nav.current?.querySelectorAll<HTMLElement>("a[href],button") ?? [])].filter(el => el.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [mobile]);
  const navigate = () => { close(); setMobile(false); };
  return <div className="v7" data-no-translate data-palette={light ? "light" : "dark"}>
    <a className="v7-skip" href="#v7-main">Skip to content</a>
    <header className="v7-header" ref={nav}>
      <div className="v7-header__inner">
        <Link href={PREVIEW} className="v7-brand" onClick={navigate} aria-label="Vraelis home"><svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M3 4h5l5 11-3 6L3 4Zm10 0h8l-6 13-3-6 1-7Z" fill="currentColor" /></svg><span>Vraelis</span></Link>
        <nav className="v7-desktop-nav" aria-label="Main navigation">
          {menus.map((menu, index) => <div className="v7-nav-item" key={menu.label}
            onPointerEnter={e => { if (e.pointerType !== "mouse") return; if (closeTimer.current) clearTimeout(closeTimer.current); setOpen(index); }}
            onPointerLeave={e => { if (e.pointerType === "mouse") { if (closeTimer.current) clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => setOpen(null), 180); } }}
            onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close(); }}>
            <button ref={el => { triggers.current[index] = el; }} className="v7-nav-trigger" aria-expanded={open === index} aria-controls={`v7-menu-${index}`} onClick={() => setOpen(open === index ? null : index)}>{menu.label}<svg aria-hidden="true" width="10" height="10" viewBox="0 0 12 12"><path d="m3 4 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg></button>
            <div id={`v7-menu-${index}`} className="v7-dropdown" hidden={open !== index}>
              <div className="v7-dropdown__links">{menu.items.map(item => <Link key={item.title} href={item.href} onClick={navigate}><strong>{item.title}</strong><span>{item.text}</span><Arrow diagonal /></Link>)}</div>
              <Link className="v7-dropdown__feature" href={menu.feature.href} onClick={navigate}><Image src={menu.feature.image} alt="" width={640} height={420} sizes="320px" /><span>{menu.feature.title}<Arrow diagonal /></span></Link>
            </div>
          </div>)}
        </nav>
        <div className="v7-header__actions">
          <button className="v7-palette" aria-label={light ? "Use dark appearance" : "Use light appearance"} aria-pressed={light} onClick={() => setLight(!light)}>{light ? <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17"><path d="M19 15a8 8 0 0 1-10-10A8 8 0 1 0 19 15Z" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg> : <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2" stroke="currentColor" strokeWidth="1.5" /></svg>}</button>
          <Link href={`${PREVIEW}/contact`} className="v7-button v7-button--primary v7-header-join">Join us<Arrow /></Link>
          <button ref={mobileTrigger} className="v7-mobile-trigger" aria-label={mobile ? "Close navigation" : "Open navigation"} aria-expanded={mobile} aria-controls="v7-mobile-nav" onClick={() => { setMobile(!mobile); close(); }}><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path d={mobile ? "m6 6 12 12M6 18 18 6" : "M4 8h16M4 16h16"} /></svg></button>
        </div>
      </div>
      {mobile && <nav className="v7-mobile-nav" id="v7-mobile-nav" aria-label="Mobile navigation">{menus.map(menu => <section key={menu.label}><h2>{menu.label}</h2>{menu.items.map(item => <Link key={item.title} href={item.href} onClick={navigate}>{item.title}<Arrow diagonal /></Link>)}</section>)}</nav>}
    </header>
    <main id="v7-main" tabIndex={-1} inert={mobile} key={pathname}>{children}</main>
    <footer className="v7-footer v7-wrap" inert={mobile}>
      <div className="v7-footer__top"><Link className="v7-brand" href={PREVIEW}>Vraelis</Link><p>Cybersecurity for AI in defense,<br />critical infrastructure and robotics.</p><Link className="v7-text-link" href={`${PREVIEW}/contact`}>Join us<Arrow diagonal /></Link></div>
      <div className="v7-footer__links"><div><span>Company</span><Link href={`${PREVIEW}/company`}>About Vraelis</Link><Link href={`${PREVIEW}/contour`}>Vraelis Contour</Link><Link href={`${PREVIEW}/research`}>Research</Link><Link href={`${PREVIEW}/landscape`}>Industry landscape</Link></div><div><span>Resources</span><Link href={`${PREVIEW}/docs`}>Documentation</Link><Link href={`${PREVIEW}/technology`}>Technology in use</Link><Link href={`${PREVIEW}/beta`}>Development status</Link></div><div><span>Trust</span><Link href="https://vraelis.com/security">Security</Link><Link href="https://vraelis.com/privacy">Privacy</Link><Link href="https://vraelis.com/terms">Terms</Link></div></div>
      <div className="v7-footer__bottom"><span>© 2026 Vraelis</span><span>Design preview · English · In private development</span><a href={`${MEDIA}/CREDITS.md`}>Image & film sources</a></div>
    </footer>
  </div>;
}
