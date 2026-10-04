"use client";

// Shared presentational primitives for design 06. One reveal primitive; the rest are static.
//
// PUBLIC API (frozen for phase 2 of the 2026-10 site plan; add, never rename or remove):
//   Reveal         { children, i?, media?, className?, style? }        entry motion for a block below the fold
//   SectionHead    { eyebrow?, title, lead?, align?: "left"|"center" } the h2 unit; content starts --head-gap below
//   CTA            { href?, children, brand?, ghost?, lg?, sm? }        the button; white primary, or ghost
//   EditorialLink  { href, children }                                  a standalone next step with an arrow
//   ProseLink      { href, children }                                  a link inside a sentence
//   Signal         { state: "go"|"wait"|"stop", children }             a state word, mono, no pill and no dot
//   Kicker         { children }                                        a small label
//   PageHero       { kicker?, title, lead?, cta?, dark?, read?, aside? } an index page's hero (the plan's IndexHero)
//   Prose          { children, className? }                            a long-form column
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { v6AppEntry, v6ShouldPrefetch } from "@/lib/v6-routes";
import { useMarketingHref } from "./entry-navigation";

// The session-aware link resolves product destinations before a visitor leaves marketing.
const OPEN_APP = v6AppEntry();

// NOTHING IN THE FIRST SCREEN IS EVER HIDDEN (plan A6, 2026-10-02). A Reveal renders VISIBLE, so the server
// HTML shows every block before any script runs. On mount it measures itself once:
//   - its top is inside the first screen: it gets `in v6-reveal--now`, which is shown with no transition;
//   - it starts below the first screen: it gets `v6-reveal--wait` (hidden, down there, where nobody sees the
//     change) and an observer adds `in` once any part of it is inside the top 92% of the screen.
// Until 2026-10-02 the default was hidden, so a first screen opened blank until hydration, and a block taller
// than the screen on a phone never reached the old 14% threshold: four research articles opened with half the
// first screen empty (site audit, 2026-10-01). Never wrap an h1, a call to action or an article body in one.
export function Reveal({ children, i = 0, media = false, className = "", style }: {
  children: ReactNode; i?: number; media?: boolean; className?: string; style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined" || el.getBoundingClientRect().top < window.innerHeight) {
      el.classList.add("in", "v6-reveal--now");
      return;
    }
    el.classList.add("v6-reveal--wait");
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) { el.classList.add("in"); io.disconnect(); }
    }, { threshold: 0, rootMargin: "0px 0px -8% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`v6-reveal ${media ? "v6-reveal--m" : ""} ${className}`} style={{ ["--i" as string]: i, ...style } as CSSProperties}>{children}</div>;
}

// The h2 unit of a section: eyebrow (14/500, ink-3), h2 at --t-h2 (22ch), lead at --t-lead-s (60ch). The
// content after it starts --head-gap below, which the head carries as its own bottom margin (v6.css).
export function SectionHead({ eyebrow, title, lead, align = "left" }: {
  eyebrow?: string; title: ReactNode; lead?: ReactNode; align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "v6-head v6-head--center" : "v6-head"}>
      {eyebrow ? <p className="v6-eyebrow">{eyebrow}</p> : null}
      <h2 className="v6-dl">{title}</h2>
      {lead ? <p className="v6-lead">{lead}</p> : null}
    </div>
  );
}

// The button. Primary is the white plate (one per view); ghost is the secondary. Sizes: sm 36, the default
// 44, lg 52. The primary carries the two-arrow conveyor (v6.css): the first arrow leaves to the right while
// the second comes in from the left. Ghost buttons carry no arrow.
export function CTA({ href = OPEN_APP, children, brand = false, ghost = false, lg = false, sm = false }: {
  href?: string; children: ReactNode; brand?: boolean; ghost?: boolean; lg?: boolean; sm?: boolean;
}) {
  const destination = useMarketingHref(href);
  const cls = ["v6-btn", brand ? "v6-btn--brand" : "", ghost ? "v6-btn--ghost" : "", lg ? "v6-btn--lg" : sm ? "v6-btn--sm" : ""].filter(Boolean).join(" ");
  return (
    <Link href={destination} prefetch={v6ShouldPrefetch(destination) ? undefined : false} className={cls}>
      {children}{!ghost && <span className="v6-arw" aria-hidden><span>→</span><span>→</span></span>}
    </Link>
  );
}

// A STANDALONE next step. "Read the docs →", "See the full platform →". The arrow is the whole point: it
// says this link is somewhere to go, and it belongs at the end of a line, not in the middle of one.
export function EditorialLink({ href, children }: { href: string; children: ReactNode }) {
  const destination = useMarketingHref(href);
  // The same prefetch guard as CTA: /app and /checkout are another origin in production (v6ShouldPrefetch).
  return <Link href={destination} prefetch={v6ShouldPrefetch(destination) ? undefined : false} className="v6-elink"><span className="v6-elink__t">{children}</span><span className="v6-arw" aria-hidden>→</span></Link>;
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
  const destination = useMarketingHref(href);
  return <Link href={destination} prefetch={v6ShouldPrefetch(destination) ? undefined : false} className="v6-plink">{children}</Link>;
}

// A state as a word (plan A5): Plex Mono, no pill, no border and no dot. go and wait read in ink-3; stop
// reads in --stop-ink, the one colour that means something went wrong.
export function Signal({ state, children }: { state: "go" | "wait" | "stop"; children: ReactNode }) {
  return <span className={`v6-sig v6-sig--${state}`}>{children}</span>;
}

export function Kicker({ children }: { children: ReactNode }) {
  return <span className="v6-kicker">{children}</span>;
}

// THE INDEX HERO (plan A5, "IndexHero"): eyebrow, an h1 at --t-h1 (20ch), a lead at --t-lead (60ch) and the
// actions, in columns 1 to 7. Pass `aside` only when it shows a real piece of the product: it takes columns 8
// to 12. The page's single h1 lives here.
// read: an article page (method, readme) whose title sits in the centred reading column, at --t-read-h1, so
// the page does not start on the left edge and then jump right for the text.
// dark: kept for the callers that pass it; every ground is black since 2026-10-01.
export function PageHero({ kicker, title, lead, cta, dark = false, read = false, aside }: {
  kicker?: string; title: ReactNode; lead?: ReactNode; cta?: ReactNode; dark?: boolean; read?: boolean; aside?: ReactNode;
}) {
  return (
    <section className={`v6-sec v6-phero ${dark ? "v6-dark" : ""}`} data-nav-theme={dark ? "dark" : "light"} {...(dark ? { "data-nav-dark": "" } : {})}>
      {/* v6-wrap, not --wide: the hero sat on the 1320 grid while every body section below used 1200, so the
          page jogged 58px to the left at the first section boundary on six of seven routes. */}
      <div className={`${read ? "v6-wrap v6-wrap--read" : "v6-wrap"}${aside ? " v6-phero__split" : ""}`}>
        <div className="v6-phero__text">
          {kicker ? <p className="v6-eyebrow v6-phero__k">{kicker}</p> : null}
          <h1>{title}</h1>
          {lead ? <p className="v6-phero__lead">{lead}</p> : null}
          {cta ? <div className="v6-phero__cta">{cta}</div> : null}
        </div>
        {aside ? <div className="v6-phero__aside">{aside}</div> : null}
      </div>
    </section>
  );
}

export function Prose({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`v6-prose ${className}`}>{children}</div>;
}
