import Link from "next/link";
import { Suspense, isValidElement, type ReactElement, type ReactNode } from "react";
import { PrivacyChoicesButton } from "@/app/_components/privacy-choices-button";
import {
  AcceptableUseBody, CookiesBody, PrivacyBody, RefundsBody, SubprocessorsTail, TermsBody, type LegalPrims,
} from "@/app/_content/legal";
import { href } from "../_kit/site";
import { LegalNotice, LegalToc, type LegalHeading } from "./legal-toc";
import "./legal.css";

/* THE V8 LEGAL PAGES (2026-10-10). The same API as v6's _system/legal.tsx (LegalPage, LegalTable, and the H, P,
   Ul, A, S primitives), drawn in v8's reading layout: a sticky contents rail beside a 68ch body on wide screens,
   a folded contents box above it on narrow ones, tables with hairline rows and no outer border.

   The words are NOT here. Privacy, Terms, Cookies, Acceptable use, Refunds and the Subprocessors tail render the
   one shared copy in app/_content/legal.tsx with these primitives, exactly as v6 and the rank surface do, so the
   legal text cannot drift between surfaces. Data rights and Trademark write their few sections in their own page
   files, ported word for word from v6. */

/** The words of a node, for a heading's anchor and its contents entry. */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}

/** "EU, EEA, and UK privacy rights" becomes "eu-eea-and-uk-privacy-rights". The h2 and the contents list both
 *  call this, so they always agree. Same rule as v6, so an anchor someone saved still lands. */
function legalSlug(text: string): string {
  return text.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function H({ children }: { children: ReactNode }) {
  return <h2 id={legalSlug(textOf(children))} className="v8-legal__h">{children}</h2>;
}

function P({ children }: { children: ReactNode }) {
  return <p className="v8-legal__p">{children}</p>;
}

// The marker is a short hairline drawn by legal.css, as on the kit's ledger. No dots.
function Ul({ items }: { items: ReactNode[] }) {
  return (
    <ul className="v8-legal__ul">
      {items.map((it, i) => <li key={i} className="v8-legal__li">{it}</li>)}
    </ul>
  );
}

/* The shared text names the earlier product's console pages (/account, /billing). That console is closed: on
   vraelis.com both addresses redirect to the development status page, so here they go straight to v8's
   development status page instead of to an address that would 404 inside the preview. Every other internal path
   goes through href(), which keeps it inside v8 while v8 is a preview and leaves it clean once promoted. */
const CLOSED_CONSOLE: Record<string, string> = { "/account": "/contour/status", "/billing": "/contour/status" };

// An address is always the whole text of its own element (the mailto link's only child): Cloudflare's email
// obfuscation on vraelis.com splits an address out of a shared text node and React then fails to hydrate it.
function A({ href: to, children }: { href: string; children: ReactNode }) {
  if (!to.startsWith("/")) return <a className="v8-legal__a" href={to}>{children}</a>;
  return <Link className="v8-legal__a" href={href(CLOSED_CONSOLE[to] ?? to)}>{children}</Link>;
}

function S({ children }: { children: ReactNode }) {
  return <strong className="v8-legal__s">{children}</strong>;
}

export const V8_LEGAL_PRIMS = { H, P, Ul, A, S } satisfies LegalPrims;

/* THE CONTENTS LIST, READ FROM THE PAGE ITSELF, on the server. The shared bodies are plain functions of the
   primitives with no hooks, so they can be called here to see their headings before anything renders; only the
   bodies named in BODIES are called, any other component is only looked inside. */
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

/** A column: its header, and how its cells set. name: the row's name in ink; code: a machine name in mono,
 *  broken anywhere; nowrap: one line; short: a short value that keeps a minimum width. */
export type LegalCol = { label: string; kind?: "name" | "code" | "nowrap" | "short" };
const KIND_CLASS = { name: "v8-legal__tname", code: "v8-legal__tcode", nowrap: "v8-legal__tnw", short: "v8-legal__tshort" } as const;

/** A table in the body: hairline rows, no outer border. `wide` (more than four columns) reaches past the 68ch
 *  measure into the free column on wide screens. The wrapper is a focusable, labelled region because it scrolls
 *  sideways when the window is narrower than the table. At 640px and below each row stands as its own block. */
export function LegalTable({ label, cols, rows, wide = false }: {
  label: string; cols: LegalCol[]; rows: { key: string; cells: ReactNode[] }[]; wide?: boolean;
}) {
  const cls = (c: LegalCol) => (c.kind ? KIND_CLASS[c.kind] : undefined);
  return (
    <div className={wide ? "v8-legal__tw v8-legal__tw--wide" : "v8-legal__tw"} role="region" aria-label={label} tabIndex={0}>
      <table className="v8-legal__t" role="table">
        <thead role="rowgroup">
          <tr role="row">{cols.map((c) => <th key={c.label} scope="col" role="columnheader">{c.label}</th>)}</tr>
        </thead>
        <tbody role="rowgroup">
          {rows.map((r) => (
            <tr key={r.key} role="row">
              {r.cells.map((cell, i) => (
                <td key={cols[i].label} role="cell" className={cls(cols[i])}>
                  {i > 0 ? <span className="v8-legal__tl" aria-hidden>{cols[i].label}</span> : null}
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

/** The one note every page about the earlier product carries. The clauses below it are unchanged. */
export const REVIEW_NOTE = "Vraelis Contour is in private development and nothing is on sale. Sections about accounts, billing and API keys describe the earlier product and remain in force for anyone who used it. This page is under review.";
export function ReviewNote() {
  return <p role="note" className="v8-legal__review">{REVIEW_NOTE}</p>;
}

/** "Updated September 2026" as a machine date ("2026-09"), when it reads as a month and a year. */
function isoMonth(when: string): string | undefined {
  const t = Date.parse(`1 ${when} 00:00 UTC`);
  if (Number.isNaN(t)) return undefined;
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Where to write, and Privacy choices, so a reader can change their choice from the page that describes it. */
function LegalEnd() {
  return (
    <div className="v8-legal__end">
      <h2 className="v8-legal__endh">Questions about this page</h2>
      <div className="v8-legal__endacts">
        <a className="v8-legal__mail" href="mailto:help@vraelis.com" data-no-translate>help@vraelis.com</a>
        <PrivacyChoicesButton className="v8-btn v8-btn--soft v8-btn--sm" />
      </div>
    </div>
  );
}

/**
 * A legal page: eyebrow "Legal", the page's one h1, "Last updated", the English-only notice for a reader in
 * another language, and (with `review`) the note about the earlier product; then the document with its contents
 * list built from its own h2s; then the end row.
 *
 * Props: title (the h1), updated ("Updated September 2026", the same strings v6 uses), review (show ReviewNote),
 * children (a shared body from app/_content/legal.tsx, or sections written with V8_LEGAL_PRIMS).
 */
export function LegalPage({ title, updated, review = false, children }: { title: string; updated: string; review?: boolean; children: ReactNode }) {
  const contents: LegalHeading[] = [];
  headingsIn(children, contents);
  const when = updated.replace(/^(last\s+)?updated\s+/i, "");
  return (
    <section className="v8-legal">
      <div className="v8-wrap">
        <div className="v8-legal__grid">
          <header className="v8-legal__head">
            <span className="v8-eyebrow">Legal</span>
            <h1 className="v8-h1 v8-legal__title">{title}</h1>
            <p className="v8-legal__upd">Last updated <time dateTime={isoMonth(when)}>{when}</time></p>
            <Suspense fallback={null}><LegalNotice /></Suspense>
            {review ? <ReviewNote /> : null}
          </header>
          <div className="v8-legal__doc" data-no-translate>
            <LegalToc items={contents} />
            <div className="v8-legal__body">{children}</div>
          </div>
          <LegalEnd />
        </div>
      </div>
    </section>
  );
}
