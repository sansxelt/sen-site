"use client";

// The documentation environment. Night mode, its own header and rail, a reading column at documentation
// sizes, and a right-hand "On this page" list on articles. The rail becomes a drawer on a phone.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { docsByGroup, type Block } from "./docs";
import { SURFACES } from "./coverage";
import { V6_BASE, V6_HOME, V6_APP, V6_SIGNIN } from "@/lib/v6-routes";
import { MARK_PATH, MARK_VIEWBOX } from "@/lib/brand-mark";

const BASE = V6_BASE;
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
          case "code": return <DocCode key={i} label={b.label} code={b.text} />;
          case "figure": return <DocFigure key={i} block={b} />;
          case "surfaces": return <DocSurfaces key={i} />;
          default: return null;
        }
      })}
    </>
  );
}

/** A real console screenshot with numbered marks. The labels are printed under the image as an ordered list,
 *  so the marks are a pointer, not the only place the meaning lives (and a screen reader gets the list). */
function DocFigure({ block }: { block: Extract<Block, { t: "figure" }> }) {
  return (
    <figure className="v6-docs__fig">
      <div className="v6-docs__shot">
        {/* The crop opens at full size in a new tab: on a phone the column is narrower than the text in it. */}
        <a href={block.src} target="_blank" rel="noopener" aria-label={`Open the screenshot at full size: ${block.alt}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.src} alt={block.alt} width={block.width} height={block.height} loading="lazy" decoding="async" />
        </a>
        {block.marks?.map((m, i) => (
          <span key={i} className="v6-docs__mark" aria-hidden style={{ left: `${m.x}%`, top: `${m.y}%` }}>{i + 1}</span>
        ))}
      </div>
      <figcaption>
        <p>{block.caption}</p>
        {block.marks?.length ? <ol>{block.marks.map((m, i) => <li key={i}>{m.label}</li>)}</ol> : null}
      </figcaption>
    </figure>
  );
}

/** What Vraelis can check, from the same list the homepage and /platform read. */
function DocSurfaces() {
  return (
    <ul className="v6-docs__surfaces">
      {SURFACES.map((x) => (
        <li key={x.name}>
          <span className="n">{x.name}</span>
          <span className="t" data-tier={x.tier === "Live" ? "live" : "other"}>{x.tier === "Next" ? "Not built yet" : x.tier}</span>
          <span className="b">{x.brief}</span>
        </li>
      ))}
    </ul>
  );
}

/** Copies the page as Markdown, for pasting into an AI assistant or a ticket. */
export function CopyMarkdown({ markdown }: { markdown: string }) {
  const [done, setDone] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <button type="button" className="v6-docs__copy" title="Copy this page as Markdown, for an AI assistant or a ticket" onClick={() => {
      navigator.clipboard.writeText(markdown).then(() => setDone("copied"), () => setDone("failed"));
      window.setTimeout(() => setDone("idle"), 2200);
    }}>
      {done === "copied" ? "Copied" : done === "failed" ? "Copy failed" : "Copy page"}
    </button>
  );
}

/** A real, runnable example rather than a decorative code block. */
export function DocCode({ label, code }: { label: string; code: string }) {
  return (
    <div className="v6-docs__code">
      <p className="v6-docs__code-h">{label}</p>
      {/* tabIndex: a long line scrolls sideways, and keyboard users can only scroll what can take focus. */}
      <pre tabIndex={0}>{code}</pre>
    </div>
  );
}

/* THE DOCS SHELL (rebuilt 2026-09-30, after Linear's docs).

   The docs used to live under the marketing site's menu and above its four-column footer, at the marketing
   site's type sizes, which the founder read as "zoomed in" and "weird" next to Linear. Docs are a tool, so
   they get a tool's frame: their own slim header (the mark, "Docs", where you are, Copy page, the way into
   the product), a quiet rail, a reading column at documentation sizes, an "On this page" list that follows
   the scroll, and a single line of footer. V6Shell leaves out its nav and footer on /docs for this. */
export function DocShell({ activeSlug = "", toc = [], crumb, markdown, children }: {
  activeSlug?: string; toc?: string[];
  /** The group and the page title, shown as the breadcrumb in the header. */
  crumb?: [string, string];
  /** The page as Markdown, for the header's Copy page button. */
  markdown?: string;
  children: React.ReactNode;
}) {
  const groups = docsByGroup();
  const [drawer, setDrawer] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string>(toc[0] ? dslug(toc[0]) : "");

  // Lock the page behind the drawer, and let Escape dismiss it.
  useEffect(() => {
    if (!drawer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawer(false); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [drawer]);

  // "On this page" follows the reader: the last heading that has scrolled past the header is the active one.
  const tocKey = toc.join("|");
  useEffect(() => {
    const ids = tocKey ? tocKey.split("|").map(dslug) : [];
    if (!ids.length) return;
    const onScroll = () => {
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < 120) current = id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [tocKey]);

  // Substring over title and group, so typing "repair" or "record" both narrow the rail.
  const q = query.trim().toLowerCase();
  const shown = useMemo(() => groups
    .map((g) => ({ ...g, docs: g.docs.filter((d) =>
      !q || d.title.toLowerCase().includes(q) || g.group.toLowerCase().includes(q)) }))
    .filter((g) => g.docs.length), [groups, q]);

  return (
    <div className="v6-docsenv" data-nav-band data-nav-dark data-nav-theme="dark" data-drawer={drawer}>
      <header className="v6-dh">
        <div className="v6-dh__brand">
          <button type="button" className="v6-dh__menu" onClick={() => setDrawer((d) => !d)} aria-expanded={drawer}
            aria-label={drawer ? "Close documentation navigation" : "Open documentation navigation"}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d={drawer ? "M6 6l12 12M6 18L18 6" : "M4 7h16M4 12h16M4 17h16"} />
            </svg>
          </button>
          <Link href={V6_HOME} className="v6-dh__mark" aria-label="Vraelis home">
            <svg viewBox={MARK_VIEWBOX} aria-hidden><path d={MARK_PATH} fill="currentColor" /></svg>
          </Link>
          <Link href={`${BASE}/docs`} className="v6-dh__docs">Docs</Link>
        </div>
        {crumb ? (
          <nav className="v6-dh__crumb" aria-label="Breadcrumb">
            <span>{crumb[0]}</span>
            <span aria-hidden className="v6-dh__sep">/</span>
            <span aria-current="page">{crumb[1]}</span>
          </nav>
        ) : <span className="v6-dh__crumb" />}
        <div className="v6-dh__actions">
          {markdown ? <CopyMarkdown markdown={markdown} /> : null}
          <Link href={V6_SIGNIN} className="v6-dh__signin">Sign in</Link>
          <Link href={V6_APP} className="v6-dh__open">Open Vraelis</Link>
        </div>
      </header>

      <div className={`v6-docs ${toc.length ? "v6-docs--article" : ""}`}>
        <aside className="v6-docs__side" aria-label="Documentation sections">
          <div className="v6-docs__search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
            </svg>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search docs" aria-label="Search documentation" />
          </div>

          <nav aria-label="Documentation sections list" className="v6-docs__nav">
            {shown.map((g) => (
              <div className="v6-docs__group" key={g.group}>
                <p className="v6-docs__group-h">{g.group}</p>
                {g.docs.map((d) => (
                  <Link key={d.slug} href={`${BASE}/docs/${d.slug}`} className="v6-docs__link"
                    onClick={() => { setDrawer(false); setQuery(""); }}
                    aria-current={d.slug === activeSlug ? "page" : undefined}>{d.title}</Link>
                ))}
              </div>
            ))}
            {!shown.length ? <p className="v6-docs__empty">No page matches that.</p> : null}
          </nav>

          <div className="v6-docs__railfoot">
            <Link href={`${BASE}/developers`}>API and CLI</Link>
            <Link href={`${BASE}/changelog`}>Changelog</Link>
            <Link href={`${BASE}/company#contact`}>Contact support</Link>
          </div>
        </aside>

        <div className="v6-docs__main">
          {children}
          <footer className="v6-docs__foot">
            <span>© 2026 Vraelis</span>
            <Link href={V6_HOME}>vraelis.com</Link>
            <Link href={`${BASE}/security`}>Security</Link>
            <Link href={`${BASE}/privacy`}>Privacy</Link>
            <Link href={`${BASE}/terms`}>Terms</Link>
          </footer>
        </div>

        {toc.length ? (
          <aside className="v6-docs__toc" aria-label="On this page">
            <p className="v6-docs__toc-h">On this page</p>
            {toc.map((h) => {
              const id = dslug(h);
              return <a key={h} href={`#${id}`} aria-current={active === id ? "location" : undefined}>{h}</a>;
            })}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
