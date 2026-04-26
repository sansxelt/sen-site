// Reusable blocks for /learn articles. Kept tiny + dependency-free
// so authoring an article is just composing these inside the
// article's render() function in lib/learn-content.tsx.

import Link from "next/link";
import type { ReactNode } from "react";

export function P({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-base leading-7 text-neutral-200">{children}</p>;
}

export function H2({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      className="mt-10 scroll-mt-24 text-2xl font-semibold tracking-tight text-white sm:text-3xl"
    >
      {children}
    </h2>
  );
}

export function H3({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h3
      id={id}
      className="mt-7 scroll-mt-24 text-lg font-semibold text-white sm:text-xl"
    >
      {children}
    </h3>
  );
}

export function Bold({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-white">{children}</strong>;
}

export function CodeInline({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[0.92em] text-violet-200">
      {children}
    </code>
  );
}

export function CodeBlock({
  lang,
  code,
}: {
  lang?: string;
  code: string;
}) {
  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/50">
      {lang && (
        <div className="border-b border-white/[0.06] px-4 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
          {lang}
        </div>
      )}
      <pre className="overflow-x-auto px-4 py-4 text-[13px] leading-6 text-neutral-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function StepList({ items }: { items: ReactNode[] }) {
  return (
    <ol className="mt-5 space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3 text-base leading-7 text-neutral-200">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-violet-400/30 bg-violet-400/10 text-xs font-semibold text-violet-200">
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

export function BulletList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-4 space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-base leading-7 text-neutral-200">
          <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400/70" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// Placeholder "diagram" — a visually-distinct card with an emoji, a
// caption, and an alt label. Real diagrams / screenshots can replace
// these later by swapping the emoji for an <Image>. Keeps articles
// looking visual from day one without waiting on art.
export function Diagram({
  emoji,
  caption,
  alt,
}: {
  emoji: string;
  caption: string;
  alt?: string;
}) {
  return (
    <figure className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/[0.06] to-fuchsia-500/[0.04] px-6 py-10 text-center">
      <div className="text-5xl" aria-label={alt ?? caption}>
        {emoji}
      </div>
      <figcaption className="mt-3 text-xs text-neutral-400">{caption}</figcaption>
    </figure>
  );
}

export function Callout({
  title,
  children,
  tone = "tip",
}: {
  title?: string;
  children: ReactNode;
  tone?: "tip" | "note" | "warn";
}) {
  const styles = {
    tip:  "border-violet-400/30 bg-violet-400/[0.05] text-violet-100",
    note: "border-white/15 bg-white/[0.04] text-neutral-200",
    warn: "border-amber-400/30 bg-amber-400/[0.05] text-amber-100",
  }[tone];
  return (
    <aside className={`mt-6 rounded-2xl border p-4 sm:p-5 ${styles}`}>
      {title && (
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">
          {title}
        </div>
      )}
      <div className="mt-1 text-sm leading-6">{children}</div>
    </aside>
  );
}

export function TryItCTA({
  text = "Try it in the workshop",
  href = "/app",
}: {
  text?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className="mt-10 inline-flex items-center gap-2 rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-500/[0.18] to-fuchsia-500/[0.12] px-5 py-3 text-sm font-medium text-white transition hover:from-violet-500/[0.28] hover:to-fuchsia-500/[0.18]"
    >
      <span>{text}</span>
      <span aria-hidden>→</span>
    </Link>
  );
}
