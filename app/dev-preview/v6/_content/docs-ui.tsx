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

export function DocShell({ activeSlug = "", children }: { activeSlug?: string; children: React.ReactNode }) {
  const groups = docsByGroup();
  return (
    <div className="v6-wrap v6-wrap--wide v6-docs">
      <aside className="v6-docs__side">
        <nav aria-label="Documentation">
          {groups.map((g) => (
            <div className="v6-docs__group" key={g.group}>
              <p className="v6-docs__group-h">{g.group}</p>
              {g.docs.map((d) => (
                <Link key={d.slug} href={`${BASE}/docs/${d.slug}`} className="v6-docs__link" aria-current={d.slug === activeSlug ? "page" : undefined}>{d.title}</Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <div className="v6-docs__main">{children}</div>
    </div>
  );
}
