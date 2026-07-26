import type { ReactNode } from "react";
import Link from "next/link";

/* V6 primitives for the legal pages. The words come from app/_content/legal.tsx, which both this surface
   and the rank surface render; only the styling is decided here. */

function H({ children }: { children: ReactNode }) {
  return <h2 className="v6-lg__h">{children}</h2>;
}

function P({ children }: { children: ReactNode }) {
  return <p className="v6-lg__p">{children}</p>;
}

function Ul({ items }: { items: ReactNode[] }) {
  return (
    <ul className="v6-lg__ul">
      {items.map((it, i) => (
        <li key={i} className="v6-lg__li">
          <span aria-hidden className="v6-lg__b" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

/* The legal text is shared with the rank surface, so it names that surface's routes. Rewrite them to the
   V6 equivalents here rather than forking the copy: a crawl found /account and /refunds walking readers out
   of the preview from inside Privacy and Terms. */
const V6_EQUIVALENT: Record<string, string> = {
  "/account": "/dev-preview/v6/app",
  "/refunds": "/dev-preview/v6/refunds",
  "/terms": "/dev-preview/v6/terms",
  "/privacy": "/dev-preview/v6/privacy",
  "/billing": "/dev-preview/v6/app",
};

function A({ href, children }: { href: string; children: ReactNode }) {
  // mailto and other schemes must not go through the router
  if (!href.startsWith("/")) return <a className="v6-lg__a" href={href}>{children}</a>;
  return <Link className="v6-lg__a" href={V6_EQUIVALENT[href] ?? href}>{children}</Link>;
}

function S({ children }: { children: ReactNode }) {
  return <strong className="v6-lg__s">{children}</strong>;
}

export const V6_LEGAL_PRIMS = { H, P, Ul, A, S };

export function LegalPage({ title, updated, children }: {
  title: string; updated: string; children: ReactNode;
}) {
  return (
    <section className="v6-sec v6-lg" data-nav-theme="light">
      <div className="v6-wrap v6-lg__wrap">
        <p className="v6-eyebrow">Legal</p>
        <h1 className="v6-lg__title">{title}</h1>
        <p className="v6-lg__upd">{updated}</p>
        {children}
      </div>
    </section>
  );
}
