import { Suspense, isValidElement, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import { V6_BASE } from "@/lib/v6-routes";
import { PrivacyChoicesButton } from "@/app/_components/privacy-choices-button";
import {
  AcceptableUseBody, CookiesBody, PrivacyBody, RefundsBody, SubprocessorsTail, TermsBody,
} from "@/app/_content/legal";
import { LegalNotice, LegalToc, type LegalHeading } from "./legal-toc";

/* V6 primitives for the legal pages (plan T13, 2026-10-02). The words come from app/_content/legal.tsx, which
   both this surface and the rank surface render; only the structure and the styling are decided here
   (legal.css). Data rights and trademark write their few sections in their own page files with the same
   primitives. */

/** The words of a node: a heading's children are a plain string here, but a fragment would work too. */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}

/** A heading's anchor: its words in lower case, joined by hyphens ("EU, EEA, and UK privacy rights" becomes
 *  "eu-eea-and-uk-privacy-rights"). The h2 and the contents list both call this, so they always agree. */
function legalSlug(text: string): string {
  return text.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function H({ children }: { children: ReactNode }) {
  return <h2 id={legalSlug(textOf(children))} className="v6-lg__h">{children}</h2>;
}

function P({ children }: { children: ReactNode }) {
  return <p className="v6-lg__p">{children}</p>;
}

// The marker is drawn by legal.css (the prose lists' 6 x 1px rule at x-height), not by an element: no dots.
function Ul({ items }: { items: ReactNode[] }) {
  return (
    <ul className="v6-lg__ul">
      {items.map((it, i) => <li key={i} className="v6-lg__li">{it}</li>)}
    </ul>
  );
}

/* The legal text is shared with the rank surface, so it names that surface's routes. Promoted (V6_BASE is ""),
   every one of them is also a real path on this site and passes through unchanged: /account and /billing are
   the console's own settings pages, which matters on Refunds and Terms, the pages someone reads while
   disputing a charge. Unpromoted, the preview has no /account or /billing, so those two go to the preview's
   console page, and every other path is kept inside the preview tree. */
const UNPROMOTED: Record<string, string> = { "/account": "/app", "/billing": "/app" };
const localHref = (href: string) => (V6_BASE === "" ? href : `${V6_BASE}${UNPROMOTED[href] ?? href}`);

/* Console paths (plan 0.5, the reserved first segments, plus app) are never prefetched. In production each one
   answers with a 308 to app.vraelis.com, so a prefetch is a cross-origin fetch the browser blocks: Privacy,
   Terms and Refunds logged a CORS error on every load (site study, 2026-10-02). A plain <a> also keeps a click
   from trying a client-side fetch into the same redirect: it is one ordinary navigation to the console. */
const CONSOLE = new Set([
  "systems", "verifications", "guarantees", "review", "records", "usage", "applications", "passes", "issues",
  "repairs", "deployments", "activity", "team", "organization", "api", "connections", "plans", "credits",
  "billing", "account", "checkout", "limits", "cli", "admin", "new", "app",
]);
function isConsolePath(href: string) {
  const path = V6_BASE && href.startsWith(`${V6_BASE}/`) ? href.slice(V6_BASE.length) : href;
  const first = /^\/([^/?#]+)/.exec(path)?.[1];
  return !!first && CONSOLE.has(first);
}

// An address is always the whole text of its own element here (the mailto link's only child). On vraelis.com,
// Cloudflare's email obfuscation rewrites every address in the HTML into a placeholder that a script turns back
// into text, which leaves the address as a separate text node. Where the address shared one text node with
// other words, React found "Write to " where it expected the whole sentence and threw #418 while hydrating:
// that was the /data-rights error (a plain-text address in a paragraph that also held two links). As the only
// child of an element, the address is compared through textContent, which is whole again once the script ran.
function A({ href, children }: { href: string; children: ReactNode }) {
  if (!href.startsWith("/")) return <a className="v6-lg__a" href={href}>{children}</a>;
  const to = localHref(href);
  if (isConsolePath(to)) return <a className="v6-lg__a" href={to}>{children}</a>;
  return <Link className="v6-lg__a" href={to}>{children}</Link>;
}

function S({ children }: { children: ReactNode }) {
  return <strong className="v6-lg__s">{children}</strong>;
}

export const V6_LEGAL_PRIMS = { H, P, Ul, A, S };

/* THE CONTENTS LIST, READ FROM THE PAGE ITSELF. The shared bodies are plain functions of the primitives above
   with no hooks, so LegalPage can call them here to see their headings, on the server, before anything renders.
   That is what puts the list in the server HTML. Only the bodies named in BODIES are called: an element of any
   other function type (a client component, for one) is never called, only looked inside. A new body exported
   from app/_content/legal.tsx joins this set, or its headings are missing from the list. */
const BODIES = new Set<unknown>([PrivacyBody, TermsBody, CookiesBody, AcceptableUseBody, RefundsBody, SubprocessorsTail]);

function headingsIn(node: ReactNode, out: LegalHeading[]) {
  if (Array.isArray(node)) { for (const n of node) headingsIn(n, out); return; }
  if (!isValidElement(node)) return;
  const el = node as ReactElement<{ children?: ReactNode }>;
  if (el.type === H) {
    const text = textOf(el.props.children);
    out.push({ id: legalSlug(text), text });
    return;
  }
  if (BODIES.has(el.type)) { headingsIn((el.type as (props: unknown) => ReactNode)(el.props), out); return; }
  headingsIn(el.props.children, out);
}

/* A TABLE IN THE BODY (plan T13). It spans the 720 body; `wide` (more than four columns, the cookie tables)
   breaks out to 960 to the right from 1100px, where the page has the room. The wrapper is a focusable, labelled
   region because it scrolls sideways when the window is narrower than the table, and a scroll box a keyboard
   cannot reach hides its right-hand columns. At 640px and below each row stands as its own block, a label
   beside each value (the labels are visible there only, and hidden from assistive technology, which reads the
   column headers). The explicit roles keep it a table for assistive technology when the phone layout changes
   its display. */
/** A column: its header, and how its cells set. name: the row's name in ink; code: a machine name in mono, broken
 *  anywhere; nowrap: one line (a category, a region); short: a short value that keeps a minimum width, so
 *  "Vraelis (sign-in)" does not break at its hyphen when the table is narrow. */
export type LegalCol = { label: string; kind?: "name" | "code" | "nowrap" | "short" };

const KIND_CLASS = { name: "v6-lg__tname", code: "v6-lg__tcode", nowrap: "v6-lg__tnw", short: "v6-lg__tshort" } as const;

export function LegalTable({ label, cols, rows, wide = false }: {
  label: string; cols: LegalCol[]; rows: { key: string; cells: ReactNode[] }[]; wide?: boolean;
}) {
  const cls = (c: LegalCol) => (c.kind ? KIND_CLASS[c.kind] : undefined);
  return (
    <div className={wide ? "v6-lg__tw v6-lg__tw--wide" : "v6-lg__tw"} role="region" aria-label={label} tabIndex={0}>
      <table className="v6-lg__t" role="table">
        <thead role="rowgroup">
          <tr role="row">{cols.map((c) => <th key={c.label} scope="col" role="columnheader">{c.label}</th>)}</tr>
        </thead>
        <tbody role="rowgroup">
          {rows.map((r) => (
            <tr key={r.key} role="row">
              {r.cells.map((cell, i) => (
                <td key={cols[i].label} role="cell" className={cls(cols[i])}>
                  {i > 0 ? <span className="v6-lg__tl" aria-hidden>{cols[i].label}</span> : null}
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* THE END OF EVERY LEGAL PAGE (plan T13): where to write, and the Privacy choices control, so a reader can change
   their choice from the page that describes it. help@ on every page (plan C, legal). No marketing closing. */
function LegalEnd() {
  return (
    <div className="v6-lg__end">
      <h2 className="v6-lg__endh" data-label="">Questions about this page</h2>
      <div className="v6-lg__endacts">
        <a className="v6-lg__mail" href="mailto:help@vraelis.com" data-no-translate>help@vraelis.com</a>
        <PrivacyChoicesButton className="v6-btn v6-btn--ghost v6-btn--sm" />
      </div>
    </div>
  );
}

/**
 * A legal page (plan T13): eyebrow "Legal", the h1 at the read size, the mono "Updated" line and the English-only
 * notice; then the document, with its contents list built from its own h2s; then the end row.
 *
 * The document and its contents list sit inside one data-no-translate region: a legal text is not
 * machine-translated, because the English text is the one that applies. The head and the end row around it
 * are translated, and the notice (LegalNotice, legal-toc.tsx) tells a reader in another language why the rest
 * is English; it is in the server HTML when the address asks for another language, so it never moves the page.
 *
 * Props: title (the h1), updated ("Updated September 2026"), children (the body: the shared body components
 * from app/_content/legal.tsx, or sections written with V6_LEGAL_PRIMS).
 */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  const contents: LegalHeading[] = [];
  headingsIn(children, contents);
  return (
    <section className="v6-lg" data-nav-theme="dark">
      <div className="v6-wrap">
        <div className="v6-lg__grid">
          <div className="v6-lg__head">
            <p className="v6-eyebrow">Legal</p>
            <h1 className="v6-dread v6-lg__title">{title}</h1>
            <p className="v6-lg__upd">{updated}</p>
            <Suspense fallback={null}><LegalNotice /></Suspense>
          </div>
          <div className="v6-lg__doc" data-no-translate>
            <LegalToc items={contents} />
            <div className="v6-lg__body">{children}</div>
          </div>
          <LegalEnd />
        </div>
      </div>
    </section>
  );
}
