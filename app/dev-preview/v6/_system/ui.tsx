"use client";

// Shared presentational primitives for design 06. One reveal primitive; the rest are static.
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";

const SIGNIN = "/signin?callbackUrl=%2Fapp";

export function Reveal({ children, i = 0, media = false, className = "", style }: {
  children: ReactNode; i?: number; media?: boolean; className?: string; style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { el.classList.add("in"); return; }
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) { el.classList.add("in"); io.unobserve(el); }
    }, { threshold: 0.14, rootMargin: "0px 0px -7% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`v6-reveal ${media ? "v6-reveal--m" : ""} ${className}`} style={{ ["--i" as string]: i, ...style } as CSSProperties}>{children}</div>;
}

export function SectionHead({ eyebrow, title, lead, align = "left" }: {
  eyebrow?: string; title: ReactNode; lead?: ReactNode; align?: "left" | "center";
}) {
  return (
    <div className="v6-head" style={align === "center" ? { marginInline: "auto", textAlign: "center", alignItems: "center" } : undefined}>
      {eyebrow ? <p className="v6-eyebrow">{eyebrow}</p> : null}
      <h2 className="v6-dl">{title}</h2>
      {lead ? <p className="v6-lead" style={align === "center" ? { marginInline: "auto" } : undefined}>{lead}</p> : null}
    </div>
  );
}

export function CTA({ href = SIGNIN, children, brand = false, ghost = false, lg = false }: {
  href?: string; children: ReactNode; brand?: boolean; ghost?: boolean; lg?: boolean;
}) {
  return (
    <Link href={href} className={`v6-btn ${brand ? "v6-btn--brand" : ""} ${ghost ? "v6-btn--ghost" : ""} ${lg ? "v6-btn--lg" : ""}`}>
      {children}{!ghost && <span className="v6-arw" aria-hidden>→</span>}
    </Link>
  );
}

export function EditorialLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="v6-elink"><span className="v6-elink__t">{children}</span><span className="v6-arw" aria-hidden>→</span></Link>;
}

export function Signal({ state, children }: { state: "go" | "wait" | "stop"; children: ReactNode }) {
  return <span className={`v6-sig v6-sig--${state}`}><span className="v6-sig__dot" aria-hidden />{children}</span>;
}

export function Kicker({ children }: { children: ReactNode }) {
  return <span className="v6-kicker">{children}</span>;
}

export function PageHero({ kicker, title, lead, cta, dark = false }: {
  kicker?: string; title: ReactNode; lead?: ReactNode; cta?: ReactNode; dark?: boolean;
}) {
  return (
    <section className={`v6-sec v6-phero ${dark ? "v6-dark" : ""}`} data-nav-theme={dark ? "dark" : "light"} {...(dark ? { "data-nav-dark": "" } : {})}>
      {/* v6-wrap, not --wide: the hero sat on the 1320 grid while every body section below used 1200, so the
          page jogged 58px to the left at the first section boundary on six of seven routes. */}
      <div className="v6-wrap">
        {kicker ? <p className="v6-eyebrow v6-phero__k">{kicker}</p> : null}
        <h1>{title}</h1>
        {lead ? <p className="v6-phero__lead">{lead}</p> : null}
        {cta ? <div className="v6-phero__cta">{cta}</div> : null}
      </div>
    </section>
  );
}

export function Prose({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`v6-prose ${className}`}>{children}</div>;
}
