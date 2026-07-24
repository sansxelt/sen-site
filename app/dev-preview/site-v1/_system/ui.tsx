"use client";

// Shared public-site primitives for site-v1. Presentational + one motion primitive (Reveal).
// All classes are defined in system.css and scoped under .sv1. No serif, mono only for machine text.
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";

const SIGNIN = "/signin?callbackUrl=%2Fapp";

/* ── Reveal: intersection-driven section/media entrance. Plays once. Reduced motion shows it
      immediately (CSS neutralizes the transform). Falls back to visible if IO is unavailable. ── */
export function Reveal({ children, i = 0, media = false, className = "", style }: {
  children: ReactNode; i?: number; media?: boolean; className?: string; style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { el.classList.add("in"); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { el.classList.add("in"); io.unobserve(el); }
    }, { threshold: 0.15, rootMargin: "0px 0px -7% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`sv1-reveal ${media ? "sv1-reveal--media" : ""} ${className}`} style={{ ["--i" as string]: i, ...style } as CSSProperties}>
      {children}
    </div>
  );
}

export function Eyebrow({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return <p className={`sv1-eyebrow ${muted ? "sv1-eyebrow--mut" : ""}`}>{children}</p>;
}

export function TechnicalLabel({ children }: { children: ReactNode }) {
  return <span className="sv1-tlabel">{children}</span>;
}

/* The recurring section unit: eyebrow -> strong statement -> concise explanation. */
export function SectionHead({ eyebrow, title, lead, size = "l", muted = false }: {
  eyebrow?: string; title: ReactNode; lead?: ReactNode; size?: "l" | "m"; muted?: boolean;
}) {
  return (
    <div className="sv1-head">
      {eyebrow ? <Eyebrow muted={muted}>{eyebrow}</Eyebrow> : null}
      <h2 className={size === "m" ? "sv1-display-m" : "sv1-display-l"}>{title}</h2>
      {lead ? <p className="sv1-lead">{lead}</p> : null}
    </div>
  );
}

export function PrimaryCTA({ href = SIGNIN, children, size, ghost = false }: {
  href?: string; children: ReactNode; size?: "lg"; ghost?: boolean;
}) {
  return (
    <Link href={href} className={`sv1-cta ${size === "lg" ? "sv1-cta--lg" : ""} ${ghost ? "sv1-cta--ghost" : ""}`}>
      {children}{!ghost && <span className="sv1-arrow" aria-hidden>→</span>}
    </Link>
  );
}

export function EditorialLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="sv1-elink">
      <span className="sv1-elink__t">{children}</span><span className="sv1-arrow" aria-hidden>→</span>
    </Link>
  );
}

type State = "ok" | "fail" | "block";
const WORD: Record<State, string> = { ok: "Verified", fail: "Failed", block: "Blocked" };

export function Verdict({ state, style }: { state: State; style?: CSSProperties }) {
  return (
    <span className={`sv1-verd sv1-verd--${state}`}>
      <span className="sv1-verd__word" style={style}>{WORD[state]}</span>
    </span>
  );
}

export function Pill({ state, children }: { state: State; children?: ReactNode }) {
  return (
    <span className={`sv1-pill sv1-pill--${state}`}>
      <span className="sv1-pill__dot" aria-hidden />{children ?? WORD[state]}
    </span>
  );
}

export function PreservedRecord({ state, id, status }: { state: "ok" | "fail"; id: string; status: string }) {
  return (
    <span className={`sv1-rec sv1-rec--${state}`}>
      <span className="sv1-rec__v">{state === "ok" ? "Verified" : "Failed"}</span>
      <span className="sv1-rec__id">{id}</span>
      <span className="sv1-rec__st">{status}</span>
    </span>
  );
}

/* Dark evidence surface. Use ONLY for execution / browser / verdict / technical proof. */
export function EvidenceSurface({ title, id, dotState = "ok", children, className = "", style }: {
  title: string; id?: string; dotState?: State; children: ReactNode; className?: string; style?: CSSProperties;
}) {
  const dot = dotState === "fail" ? "var(--sv-dfail)" : dotState === "block" ? "var(--sv-dfg3)" : "var(--sv-dok)";
  return (
    <div className={`sv1-ev ${className}`} style={style}>
      <div className="sv1-ev__bar">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
          <span className="sv1-ev__dot" style={{ background: dot }} aria-hidden />
          <span className="sv1-ev__title">{title}</span>
        </span>
        {id ? <span className="sv1-ev__id">{id}</span> : null}
      </div>
      {children}
    </div>
  );
}

export type Row = { k: string; v: string; ok: boolean };
export function EvidenceRows({ rows }: { rows: Row[] }) {
  return (
    <div className="sv1-rows">
      {rows.map((r) => (
        <div key={r.k} className={`sv1-row ${r.ok ? "is-ok" : "is-bad"}`}>
          <span className="sv1-row__k">{r.k}</span>
          <span className="sv1-row__v">{r.v}</span>
          <span className="sv1-row__mk" aria-hidden>
            {r.ok
              ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CurrentNext({ today, next }: { today: string[]; next: string[] }) {
  return (
    <div className="sv1-cn">
      <div className="sv1-cn__col">
        <p className="sv1-cn__k">Live today</p>
        <ul className="sv1-cn__list">{today.map((t) => <li key={t}>{t}</li>)}</ul>
      </div>
      <div className="sv1-cn__col sv1-cn__col--next">
        <p className="sv1-cn__k">Next, marked as direction</p>
        <ul className="sv1-cn__list">{next.map((t) => <li key={t}>{t}</li>)}</ul>
      </div>
    </div>
  );
}
