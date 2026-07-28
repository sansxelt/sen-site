"use client";

// Shared presentational primitives for design 06. One reveal primitive; the rest are static.
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { v6AppEntry } from "@/lib/v6-routes";

// Stays inside V6. The old value left the preview for the previous design and called back to
// /app, which does not exist, so a successful sign-in landed on a 404.
// "Open Vraelis" goes to the APP, not to sign-in: a signed-in visitor was being shown a sign-in page
// before their own console. A static page cannot know the session, so it does not try to - the app decides.
const OPEN_APP = v6AppEntry();
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

export function CTA({ href = OPEN_APP, children, brand = false, ghost = false, lg = false }: {
  href?: string; children: ReactNode; brand?: boolean; ghost?: boolean; lg?: boolean;
}) {
  return (
    <Link href={href} className={`v6-btn ${brand ? "v6-btn--brand" : ""} ${ghost ? "v6-btn--ghost" : ""} ${lg ? "v6-btn--lg" : ""}`}>
      {children}{!ghost && <span className="v6-arw" aria-hidden>→</span>}
    </Link>
  );
}

// A STANDALONE next step. "Read the docs →", "See the full platform →". The arrow is the whole point: it
// says this link is somewhere to go, and it belongs at the end of a line, not in the middle of one.
export function EditorialLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="v6-elink"><span className="v6-elink__t">{children}</span><span className="v6-arw" aria-hidden>→</span></Link>;
}

// A link INSIDE a sentence. Same underline, no arrow, and it inherits the surrounding type rather than
// jumping to 15px semibold.
//
// This exists because six pages had reached for EditorialLink mid-sentence and got a component built for
// the opposite job. The result read "use the disclosure route on security → rather than a general
// address": an arrow pointing at the next word, a bold 15px fragment inside a 14px paragraph, and an
// inline-flex box that will not wrap with the text around it. There was no inline link component, which is
// exactly why people reached for the CTA one.
export function ProseLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="v6-plink">{children}</Link>;
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
