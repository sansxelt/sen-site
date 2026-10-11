import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Capture, Ledger, Tag } from "../../_kit/blocks";
import { KIND_LABEL, WORKFLOW } from "../../_kit/site";
import { dl } from "../_data/host";
import { headingIds } from "../_data/pages";
import { inline, isClosedProduct } from "../_data/text";
import type { Block } from "../_data/types";
import { CopyButton } from "./client";
import { Highlight } from "../../_kit/highlight";
import { isDocsFile } from "../_data/links";

// The docs block renderer (server). x.ai's article parts in v8's materials: headings that link to themselves,
// code blocks with a label, the language and a copy button and no window dots, callouts as one filled card whose label is the
// only difference, tables with no outer frame, and real app captures with their caption.

function DocLink({ to, children }: { to: string; children: ReactNode }) {
  if (to.startsWith("/")) {
    const at = dl(to);
    // Files (Markdown twins, llms.txt) and the main site seen from the docs host open as documents.
    if (isDocsFile(at) || /^https?:/.test(at)) return <a href={at}>{children}</a>;
    return <Link href={at}>{children}</Link>;
  }
  if (to.startsWith("#")) return <a href={to}>{children}</a>;
  return <a href={to} rel="noopener noreferrer" target="_blank">{children}</a>;
}

/** Docs text with its inline markup: `code` and [label](href). */
export function Rich({ text }: { text: string }) {
  const parts = inline(text);
  if (parts.length === 1 && parts[0].k === "text") return <>{text}</>;
  return (
    <>
      {parts.map((x, i) => x.k === "code" ? <code key={i}>{x.s}</code>
        : x.k === "link" ? (isClosedProduct(x.href) ? null : <DocLink key={i} to={x.href}>{x.s}</DocLink>)
        : <Fragment key={i}>{x.s}</Fragment>)}
    </>
  );
}

const LANG: Record<string, string> = { json: "JSON", bash: "Bash", text: "Text" };

/** Code in the GitHub dark colours of the kit's Highlight (.hl-*). Text output keeps its prompt line coloured and
 *  the rest plain; JSON and shell go through Highlight. */
export function CodeText({ code, lang }: { code: string; lang?: string }) {
  if (lang !== "text") return <Highlight code={code} />;
  return (
    <>
      {code.split("\n").map((line, i) => (
        <Fragment key={i}>
          {i ? "\n" : null}
          {line.startsWith("$ ") ? <><span className="hl-p">$</span> <span className="hl-cmd">{line.slice(2)}</span></> : line}
        </Fragment>
      ))}
    </>
  );
}

/** x.ai's code block: a header with what the code is and its language, an icon copy button, then the code. Always
 *  dark, in both themes, like a terminal. */
export function CodeBlock({ label, code, lang, className }: { label: string; code: string; lang?: string; className?: string }) {
  return (
    <div className={className ? `v8-docs-code ${className}` : "v8-docs-code"}>
      <div className="v8-docs-code__bar">
        <span className="v8-docs-code__label">{label}</span>
        {lang && LANG[lang] ? <span className="v8-docs-code__lang">{LANG[lang]}</span> : null}
        <CopyButton text={code} icon label="Copy code" />
      </div>
      {/* tabIndex: a long line scrolls sideways, and keyboard readers can only scroll what takes focus. */}
      <pre tabIndex={0}><code><CodeText code={code} lang={lang} /></code></pre>
    </div>
  );
}

function Table({ block }: { block: Extract<Block, { t: "table" }> }) {
  return (
    <div className="v8-docs-table" role="region" aria-label={block.label} tabIndex={0}>
      <table>
        <thead><tr>{block.head.map((h, j) => <th key={j} scope="col">{h}</th>)}</tr></thead>
        <tbody>
          {block.rows.map((r, j) => (
            <tr key={j}>{r.map((c, k) => k === 0
              ? <th key={k} scope="row"><Rich text={c} /></th>
              : <td key={k}><Rich text={c} /></td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The five steps as a labelled HTML diagram. The detail for each step follows it in the text. */
function Workflow() {
  return (
    <figure className="v8-docs-flow">
      <ol aria-label="The five steps of the Vraelis Contour workflow">
        {WORKFLOW.map((w) => (
          <li key={w.n}><span className="n">{w.n}</span><b>{w.title}</b></li>
        ))}
      </ol>
      <figcaption>Diagram of the five-step workflow. Each step is described below.</figcaption>
    </figure>
  );
}

function Heading({ level, id, text }: { level: 2 | 3; id: string; text: string }) {
  const H = level === 2 ? "h2" : "h3";
  return <H id={id} className="v8-docs-h"><a href={`#${id}`}>{text}</a></H>;
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  const ids = headingIds(blocks);
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case "h2": return <Heading key={i} level={2} id={ids.get(i)!} text={b.text} />;
          case "h3": return <Heading key={i} level={3} id={ids.get(i)!} text={b.text} />;
          case "p": return <p key={i}><Rich text={b.text} /></p>;
          case "ul": return <ul key={i} className="v8-docs-ul">{b.items.map((it, j) => <li key={j}><Rich text={it} /></li>)}</ul>;
          case "steps": return <ol key={i} className="v8-docs-ol">{b.items.map((it, j) => <li key={j}><Rich text={it} /></li>)}</ol>;
          case "note": return <div key={i} className="v8-docs-note" role="note"><b>{b.label.replace(/[.:]$/, "")}</b><p><Rich text={b.text} /></p></div>;
          case "code": return <CodeBlock key={i} label={b.label} code={b.text} lang={b.lang} />;
          case "table": return <Table key={i} block={b} />;
          case "capture": return <div key={i} className="v8-docs-capture"><Capture name={b.name} caption={b.caption} /></div>;
          case "kinds": return (
            <ul key={i} className="v8-docs-kinds">
              {b.items.map((it, j) => <li key={j}><Tag kind={it.kind}>{it.label ?? KIND_LABEL[it.kind]}</Tag><span><Rich text={it.text} /></span></li>)}
            </ul>
          );
          case "facts": return (
            <dl key={i} className="v8-docs-facts">
              {b.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd><Rich text={v} /></dd></div>)}
            </dl>
          );
          case "workflow": return <Workflow key={i} />;
          case "ledger": return <div key={i} className="v8-docs-ledger"><Ledger /></div>;
          case "cards": return (
            <div key={i} className="v8-docs-cards">
              {b.items.map((c) => (
                <Link key={c.to} href={dl(c.to)} className="v8-docs-card">
                  <b>{c.title}</b><span>{c.line}</span><span className="v8-docs-card__go">Read<i className="v8-arrow" aria-hidden="true" /></span>
                </Link>
              ))}
            </div>
          );
          default: return null;
        }
      })}
    </>
  );
}
