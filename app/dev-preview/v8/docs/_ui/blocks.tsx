import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Capture, Ledger, Tag } from "../../_kit/blocks";
import { KIND_LABEL, WORKFLOW } from "../../_kit/site";
import { dl } from "../_data/host";
import { headingIds } from "../_data/pages";
import { inline, isClosedProduct } from "../_data/text";
import type { Block } from "../_data/types";
import { CopyButton } from "./client";

// The docs block renderer (server). x.ai's article parts in v8's materials: headings that link to themselves,
// code blocks with a label and a copy button and no window dots, callouts as one filled card whose label is the
// only difference, tables with no outer frame, and real app captures with their caption.

function DocLink({ to, children }: { to: string; children: ReactNode }) {
  if (to.startsWith("/")) return <Link href={dl(to)}>{children}</Link>;
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

/** JSON keys, strings and numbers; comment lines dimmed elsewhere. The copy button copies the source text. */
function highlight(code: string, lang?: string): ReactNode {
  const json = lang === "json" || (!lang && /^\s*[{[]/.test(code));
  if (json) {
    const out: ReactNode[] = [];
    const re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(-?\d+(?:\.\d+)?)\b|\b(true|false|null)\b/g;
    let last = 0, k = 0;
    for (const m of code.matchAll(re)) {
      const at = m.index ?? 0;
      if (at > last) out.push(code.slice(last, at));
      if (m[1] !== undefined) {
        out.push(<span key={k++} className={m[2] ? "k" : "s"}>{m[1]}</span>);
        if (m[2]) out.push(m[2]);
      } else out.push(<span key={k++} className="n">{m[0]}</span>);
      last = at + m[0].length;
    }
    if (last < code.length) out.push(code.slice(last));
    return out;
  }
  const lines = code.split("\n");
  return lines.map((line, i) => {
    const nl = i < lines.length - 1 ? "\n" : "";
    if (/^\s*(#|\/\/)/.test(line)) return <Fragment key={i}><span className="c">{line}</span>{nl}</Fragment>;
    const m = /^(.*?\S)(\s+)((?:#|\/\/)\s.*)$/.exec(line);
    if (m) return <Fragment key={i}>{m[1]}{m[2]}<span className="c">{m[3]}</span>{nl}</Fragment>;
    return <Fragment key={i}>{line}{nl}</Fragment>;
  });
}

export function CodeBlock({ label, code, lang, className }: { label: string; code: string; lang?: string; className?: string }) {
  return (
    <div className={className ? `v8-docs-code ${className}` : "v8-docs-code"}>
      <div className="v8-docs-code__bar">
        <span>{label}</span>
        <CopyButton text={code} />
      </div>
      {/* tabIndex: a long line scrolls sideways, and keyboard readers can only scroll what takes focus. */}
      <pre tabIndex={0}>{highlight(code, lang)}</pre>
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
                  <b>{c.title}</b><span>{c.line}</span><i className="v8-arrow" aria-hidden="true" />
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
