"use client";

// The documentation environment. Night mode, and deliberately its own product rather than a lighter
// continuation of the marketing pages: near-black ground, a lifted reading surface, a dark left rail, and a
// right table of contents on article pages. The rail becomes a real drawer on a phone instead of a squeezed
// column above the article.
import { useEffect, useState } from "react";
import Link from "next/link";
import { docsByGroup, type Block } from "./docs";

const BASE = "/dev-preview/v6";
export const dslug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case "h2": return <h2 key={i} id={dslug(b.text)}>{b.text}</h2>;
          case "p": return <p key={i}>{b.text}</p>;
          case "ul": return <ul key={i}>{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>;
          case "steps": return <ol key={i}>{b.items.map((it, j) => <li key={j}>{it}</li>)}</ol>;
          case "note": return <div className="v6-note" key={i}><b>{b.label}</b>{b.text}</div>;
          default: return null;
        }
      })}
    </>
  );
}

/** A real, runnable example rather than a decorative code block. */
export function DocCode({ label, code }: { label: string; code: string }) {
  return (
    <div className="v6-docs__code">
      <p className="v6-docs__code-h">{label}</p>
      <pre>{code}</pre>
    </div>
  );
}

export function DocShell({ activeSlug = "", toc = [], children }: {
  activeSlug?: string; toc?: string[]; children: React.ReactNode;
}) {
  const groups = docsByGroup();
  const [drawer, setDrawer] = useState(false);

  // Lock the page behind the drawer, and let Escape dismiss it.
  useEffect(() => {
    if (!drawer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawer(false); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [drawer]);

  return (
    <div className="v6-docsenv" data-nav-dark data-nav-theme="dark" data-drawer={drawer}>
      <div className={`v6-wrap v6-wrap--wide v6-docs ${toc.length ? "v6-docs--article" : ""}`}>
        <button type="button" className="v6-docs__open" onClick={() => setDrawer(true)} aria-expanded={drawer}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          Documentation
        </button>
        <button type="button" className="v6-docs__close" aria-label="Close documentation navigation" onClick={() => setDrawer(false)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M6 18L18 6" /></svg>
        </button>

        <aside className="v6-docs__side" aria-label="Documentation sections">
          <nav aria-label="Documentation sections list">
            {groups.map((g) => (
              <div className="v6-docs__group" key={g.group}>
                <p className="v6-docs__group-h">{g.group}</p>
                {g.docs.map((d) => (
                  <Link key={d.slug} href={`${BASE}/docs/${d.slug}`} className="v6-docs__link"
                    onClick={() => setDrawer(false)}
                    aria-current={d.slug === activeSlug ? "page" : undefined}>{d.title}</Link>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        <div className="v6-docs__main">{children}</div>

        {toc.length ? (
          <aside className="v6-docs__toc" aria-label="On this page">
            <p className="v6-docs__toc-h">On this page</p>
            {toc.map((h) => <a key={h} href={`#${dslug(h)}`}>{h}</a>)}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
