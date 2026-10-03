"use client";

// The documentation environment. Night mode, its own header and rail, a reading column at documentation
// sizes, and a right-hand "On this page" list on articles. The rail becomes a drawer on a phone.
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { docsByGroup, inline, docPrefetch, dslug as slugOf, type Block, type TocItem } from "./docs";
import { SURFACES } from "./coverage";
import { V6_BASE, V6_HOME, V6_APP, V6_SIGNIN } from "@/lib/v6-routes";
import { MARK_PATH, MARK_VIEWBOX } from "@/lib/brand-mark";
import { PrivacyChoicesButton } from "@/app/_components/privacy-choices-button";
import { LanguageSwitcher } from "@/components/language-switcher";

const BASE = V6_BASE;
export const dslug = slugOf;

/** A link inside docs text. A site path gets the base and the console prefetch rule (docPrefetch); anything
 *  else (another host, mailto:, an anchor on this page) is a plain anchor. */
function DocLink({ href, children }: { href: string; children: React.ReactNode }) {
  if (!href.startsWith("/")) return <a href={href}>{children}</a>;
  return <Link href={`${BASE}${href}`} prefetch={docPrefetch(href)}>{children}</Link>;
}

/** Docs text with its inline markup (`code` and [label](href), see _content/docs.ts). Plain text stays one
 *  text node, which is what the translator keys on. */
function Rich({ text }: { text: string }) {
  const parts = inline(text);
  if (parts.length === 1 && parts[0].k === "text") return <>{text}</>;
  return (
    <>
      {parts.map((x, i) => (x.k === "code" ? <code key={i}>{x.s}</code>
        : x.k === "link" ? <DocLink key={i} href={x.href}>{x.s}</DocLink>
        : <Fragment key={i}>{x.s}</Fragment>))}
    </>
  );
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  // A page that opens with a screenshot (its first figure comes before the page's second h2) has it as the
  // largest paint in the first screen, so it loads at once instead of lazily (Next 16.2: loading="eager" with
  // fetchPriority="high"; `priority` is deprecated). A figure further down, as on Getting started, stays lazy.
  const firstFigure = blocks.findIndex((b) => b.t === "figure");
  const eagerFigure = firstFigure >= 0 && blocks.slice(0, firstFigure).filter((b) => b.t === "h2").length <= 1 ? firstFigure : -1;
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case "h2": return <h2 key={i} id={slugOf(b.text)}>{b.text}</h2>;
          case "h3": return <h3 key={i} id={b.id}>{b.text}</h3>;
          case "p": return <p key={i}><Rich text={b.text} /></p>;
          case "ul": return <ul key={i}>{b.items.map((it, j) => <li key={j}><Rich text={it} /></li>)}</ul>;
          case "steps": return <ol key={i}>{b.items.map((it, j) => <li key={j}><Rich text={it} /></li>)}</ol>;
          case "note": return <div className="v6-note" key={i}><b>{b.label}</b><Rich text={b.text} /></div>;
          case "code": return <DocCode key={i} label={b.label} code={b.text} />;
          case "table": return <DocTable key={i} block={b} />;
          case "figure": return <DocFigure key={i} block={b} eager={i === eagerFigure} />;
          case "surfaces": return <DocSurfaces key={i} />;
          default: return null;
        }
      })}
    </>
  );
}

/** Reference rows (exit codes, options, variables). The first cell of a row is its header. The box scrolls
 *  sideways on a narrow screen, so it takes focus (axe scrollable-region-focusable) and has a name. */
function DocTable({ block }: { block: Extract<Block, { t: "table" }> }) {
  return (
    <div className="v6-docs__table" role="region" aria-label={block.label} tabIndex={0}>
      <table>
        <thead><tr>{block.head.map((h, j) => <th key={j} scope="col">{h}</th>)}</tr></thead>
        <tbody>
          {block.rows.map((r, j) => (
            <tr key={j}>
              {r.map((c, k) => (k === 0
                ? <th key={k} scope="row"><Rich text={c} /></th>
                : <td key={k}><Rich text={c} /></td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A real console screenshot with numbered marks. The labels are printed under the image as an ordered list,
 *  so the marks are a pointer, not the only place the meaning lives (and a screen reader gets the list). */
function DocFigure({ block, eager = false }: { block: Extract<Block, { t: "figure" }>; eager?: boolean }) {
  return (
    <figure className="v6-docs__fig">
      <div className="v6-docs__shot">
        {/* The crop opens at full size in a new tab: on a phone the column is narrower than the text in it. */}
        <a href={block.src} target="_blank" rel="noopener" aria-label={`Open the screenshot at full size: ${block.alt}`}>
          <Image src={block.src} alt={block.alt} width={block.width} height={block.height}
            sizes="(max-width: 880px) calc(100vw - 36px), 700px"
            loading={eager ? "eager" : undefined} fetchPriority={eager ? "high" : undefined} />
        </a>
        {block.marks?.map((m, i) => (
          <span key={i} className="v6-docs__mark" aria-hidden style={{ left: `${m.x}%`, top: `${m.y}%` }}>{i + 1}</span>
        ))}
      </div>
      <figcaption>
        <p>
          <span>{block.caption}</span>
          {block.credit ? <span className="v6-docs__credit">{block.credit}</span> : null}
        </p>
        {block.marks?.length ? <ol>{block.marks.map((m, i) => <li key={i}>{m.label}</li>)}</ol> : null}
      </figcaption>
    </figure>
  );
}

/** What Vraelis can check, from the same list the homepage and /platform read. The tier is a plain mono word
 *  (plan C, docs): no pill. data-tier marks it as a coverage word for the copy lint. */
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
      if (!navigator.clipboard) setDone("failed");
      else navigator.clipboard.writeText(markdown).then(() => setDone("copied"), () => setDone("failed"));
      window.setTimeout(() => setDone("idle"), 2200);
    }}>
      {done === "copied" ? "Copied" : done === "failed" ? "Copy failed" : "Copy page"}
    </button>
  );
}

/** Comments in a snippet, dimmed: a line that starts with # or //, or a trailing "  # ..." or " // ...". The
 *  text is unchanged character for character, and the Copy button copies the source string, not the DOM. */
function shade(src: string) {
  const lines = src.split("\n");
  return lines.map((line, i) => {
    const nl = i < lines.length - 1 ? "\n" : "";
    if (/^\s*(#|\/\/)/.test(line)) return <Fragment key={i}><span className="c">{line}</span>{nl}</Fragment>;
    const m = /^(.*?\S)(\s+)((?:#|\/\/)\s.*)$/.exec(line);
    if (m) return <Fragment key={i}>{m[1]}{m[2]}<span className="c">{m[3]}</span>{nl}</Fragment>;
    return <Fragment key={i}>{line}{nl}</Fragment>;
  });
}

/** A real, runnable example rather than a decorative code block: a label, a Copy button that reads "Copied"
 *  for 1.6 s (plan A5), and the snippet. The words are seeded once per page by DocShell for translation. */
export function DocCode({ label, code }: { label: string; code: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = () => {
    window.clearTimeout(timer.current);
    const reset = () => { timer.current = window.setTimeout(() => setState("idle"), 1600); };
    if (!navigator.clipboard) { setState("failed"); reset(); return; }
    navigator.clipboard.writeText(code).then(() => { setState("copied"); reset(); }, () => { setState("failed"); reset(); });
  };
  return (
    <div className="v6-docs__code">
      <div className="v6-docs__code-bar">
        <p className="v6-docs__code-h">{label}</p>
        <button type="button" className="v6-docs__code-copy" onClick={copy}>
          {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy"}
        </button>
      </div>
      {/* tabIndex: a long line scrolls sideways, and keyboard users can only scroll what can take focus. */}
      <pre tabIndex={0}>{shade(code)}</pre>
    </div>
  );
}

/* THE DOCS SHELL (rebuilt 2026-09-30, after Linear's docs).

   The docs used to live under the marketing site's menu and above its four-column footer, at the marketing
   site's type sizes, which the founder read as "zoomed in" and "weird" next to Linear. Docs are a tool, so
   they get a tool's frame: their own slim header (the mark, "Docs", where you are, Copy page, the way into
   the product), a quiet rail, a reading column at documentation sizes, an "On this page" list that follows
   the scroll, and a single line of footer. V6Shell leaves out its nav and footer on /docs for this.

   2026-10-02: previous and next live only at the foot of an article. The compact pair that also sat above
   the title was the widest thing in the column on a phone and pushed the page sideways (plan C, docs). */
/** Previous and next, as two even cards at the foot of an article. */
export function DocPager({ prev, next }: {
  prev?: { slug: string; title: string } | null; next?: { slug: string; title: string } | null;
}) {
  if (!prev && !next) return null;
  return (
    <nav className="v6-docs__pager" aria-label="Previous and next page">
      {prev ? <Link href={`${BASE}/docs/${prev.slug}`}><span className="l">← Previous</span><span className="t">{prev.title}</span></Link> : <span />}
      {next ? <Link className="is-next" href={`${BASE}/docs/${next.slug}`}><span className="l">Next →</span><span className="t">{next.title}</span></Link> : <span />}
    </nav>
  );
}

export function DocShell({ activeSlug = "", toc = [], crumb, markdown, children }: {
  activeSlug?: string;
  /** "On this page": the article's h2s and h3s with their ids (docOutline). */
  toc?: TocItem[];
  /** The group and the page title, shown as the breadcrumb in the header. */
  crumb?: [string, string];
  /** The page as Markdown, for the header's Copy page button. */
  markdown?: string;
  children: React.ReactNode;
}) {
  const groups = docsByGroup();
  const [drawer, setDrawer] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string>(toc[0]?.id ?? "");
  // SECTIONS ARE DROPDOWNS. The section holding the page being read starts open and the rest start closed;
  // on the docs index, where nothing is being read, all start open. A search opens every section it
  // matches in, so a result is never hidden inside a closed one.
  const activeGroup = groups.find((g) => g.docs.some((d) => d.slug === activeSlug))?.group ?? null;
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.group, activeGroup === null || g.group === activeGroup])));
  const toggle = (g: string) => setOpen((o) => ({ ...o, [g]: !o[g] }));

  // THE DRAWER IS A MODAL (880px and below, where the rail is a full-screen sheet under the header). It used to
  // lock only the scroll: Tab walked out of the rail onto the 20 or so controls of the page hidden behind it,
  // so a keyboard reader could not see where focus was, and Escape closed it with focus left on a link that
  // had just been hidden. Now, while it is open, the page behind is inert (unreachable for Tab and for a
  // screen reader), Tab cycles from the menu button through the header and the rail and back, and every
  // close returns focus to the menu button first, while the control that was used still holds it (the same
  // order MobileNav in _system/shell.tsx keeps). preventScroll: html's scroll-padding would otherwise make
  // focusing the sticky header scroll the page.
  const menuRef = useRef<HTMLButtonElement>(null);
  const headRef = useRef<HTMLElement>(null);
  const sideRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const openedByKey = useRef(false);
  const closeDrawer = useCallback((returnFocus: boolean) => {
    if (returnFocus) menuRef.current?.focus({ preventScroll: true });
    setDrawer(false);
  }, [setDrawer]); // a state setter never changes; named because the compiler lint asks for it
  // A link followed from the open drawer closes it (from the desktop rail, a click changes nothing here).
  const follow = () => { if (drawer) closeDrawer(true); };

  useEffect(() => {
    if (!drawer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Opened from the keyboard, focus goes into the drawer, to the search field. Opened by a tap or a click it
    // stays on the menu button, now the close button: focusing a text field from a tap raises a phone's
    // keyboard over the list the reader came for.
    if (openedByKey.current) searchRef.current?.focus({ preventScroll: true });
    // Everything a Tab can reach while the drawer is open: the header (the menu button first), then the rail.
    // Controls the layout hides (Copy page, Sign in, a closed section's links) have no box and are left out.
    const reachable = () => [headRef.current, sideRef.current]
      .flatMap((root) => Array.from(root?.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled])") ?? []))
      .filter((el) => el.getClientRects().length > 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // The language menu opens over the drawer, and Escape closes that menu alone.
        if (document.querySelector(".lsw__menu")) return;
        closeDrawer(true);
        return;
      }
      if (e.key !== "Tab") return;
      const f = reachable(); if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    // The drawer exists only at 880px and below. Widening past that (rotating a tablet, zooming out) closes
    // it without moving focus, because the menu button is gone there; left open, the page would stay inert.
    const narrow = window.matchMedia("(max-width: 880px)");
    const onWidth = () => { if (!narrow.matches) closeDrawer(false); };
    document.addEventListener("keydown", onKey);
    narrow.addEventListener("change", onWidth);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      narrow.removeEventListener("change", onWidth);
    };
  }, [drawer, closeDrawer]);

  // "On this page" follows the reader: the last heading that has scrolled past the header is the active one.
  // At the foot of the page the last headings can never reach the header, so there the lowest heading on
  // screen wins: the list then ends on the section being read, not on the one above it.
  const tocKey = toc.map((t) => t.id).join("|");
  useEffect(() => {
    const ids = tocKey ? tocKey.split("|") : [];
    if (!ids.length) return;
    const onScroll = () => {
      const atFoot = window.scrollY > 0
        && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      const line = atFoot ? window.innerHeight : 120;
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < line) current = id;
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
      <header ref={headRef} className="v6-dh">
        <div className="v6-dh__brand">
          {/* e.detail is 0 for a click made with Enter or Space, which is how the open effect tells the keyboard
              from a tap. */}
          <button ref={menuRef} type="button" className="v6-dh__menu" aria-controls="v6-docs-side" aria-expanded={drawer}
            onClick={(e) => {
              if (drawer) { closeDrawer(true); return; }
              openedByKey.current = e.detail === 0;
              setDrawer(true);
            }}
            aria-label={drawer ? "Close documentation navigation" : "Open documentation navigation"}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d={drawer ? "M6 6l12 12M6 18L18 6" : "M4 7h16M4 12h16M4 17h16"} />
            </svg>
          </button>
          {/* The way home was a bare 18px mark that read as decoration. The wordmark goes to the homepage and
              says so; "Docs" beside it goes to the docs index. */}
          <Link href={V6_HOME} className="v6-dh__mark" title="Back to vraelis.com">
            <svg viewBox={MARK_VIEWBOX} aria-hidden><path d={MARK_PATH} fill="currentColor" /></svg>
            <span className="v6-dh__word">Vraelis</span>
          </Link>
          <span className="v6-dh__slash" aria-hidden>/</span>
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
          <Link href={V6_APP} prefetch={docPrefetch(V6_APP)} className="v6-dh__open">Open Vraelis</Link>
        </div>
      </header>

      <div className={`v6-docs ${toc.length ? "v6-docs--article" : ""}`}>
        <aside ref={sideRef} id="v6-docs-side" className="v6-docs__side" aria-label="Documentation sections">
          <div className="v6-docs__search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
            </svg>
            <input ref={searchRef} type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search docs" aria-label="Search documentation" />
          </div>

          <nav aria-label="Documentation sections list" className="v6-docs__nav">
            {/* The docs home, first in the rail: on a phone the header keeps only the page title, so this is
                where "Docs" lives there. */}
            {!q ? (
              <Link href={`${BASE}/docs`} className="v6-docs__link v6-docs__overview" onClick={follow}
                aria-current={activeSlug === "" ? "page" : undefined}>Overview</Link>
            ) : null}
            {shown.map((g) => {
              const isOpen = q ? true : open[g.group] !== false;
              const id = `docs-group-${slugOf(g.group)}`;
              return (
                <div className="v6-docs__group" key={g.group} data-open={isOpen}>
                  <button type="button" className="v6-docs__group-h" aria-expanded={isOpen} aria-controls={id}
                    onClick={() => toggle(g.group)}>
                    <span>{g.group}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </button>
                  <div id={id} className="v6-docs__group-list" hidden={!isOpen}>
                    {g.docs.map((d) => (
                      <Link key={d.slug} href={`${BASE}/docs/${d.slug}`} className="v6-docs__link"
                        onClick={() => { follow(); setQuery(""); }}
                        aria-current={d.slug === activeSlug ? "page" : undefined}>{d.title}</Link>
                    ))}
                  </div>
                </div>
              );
            })}
            {!shown.length ? <p className="v6-docs__empty">No page matches that.</p> : null}
          </nav>

          <div className="v6-docs__railfoot">
            <LanguageSwitcher placement="up" className="v6-docs__lang" />
            <Link href={V6_HOME} onClick={follow}>← Back to vraelis.com</Link>
            <Link href={`${BASE}/developers`} onClick={follow}>Developers</Link>
            <Link href={`${BASE}/changelog`} onClick={follow}>Changelog</Link>
            <Link href={`${BASE}/company#contact`} onClick={follow}>Contact support</Link>
          </div>
        </aside>

        {/* inert while the drawer covers it: nothing behind the drawer can take focus or be read out. */}
        <div className="v6-docs__main" inert={drawer}>
          {children}
          <footer className="v6-docs__foot">
            <span>© 2026 Vraelis</span>
            <Link href={V6_HOME}>vraelis.com</Link>
            <Link href={`${BASE}/security`}>Security</Link>
            <Link href={`${BASE}/privacy`}>Privacy</Link>
            <Link href={`${BASE}/cookies`}>Cookies</Link>
            <Link href={`${BASE}/terms`}>Terms</Link>
            <Link href={`${BASE}/acceptable-use`}>Acceptable use</Link>
            <PrivacyChoicesButton />
          </footer>
        </div>

        {toc.length ? (
          <aside className="v6-docs__toc" aria-label="On this page" inert={drawer}>
            <p className="v6-docs__toc-h">On this page</p>
            {toc.map((h) => (
              <a key={h.id} href={`#${h.id}`} className={h.level === 3 ? "is-sub" : undefined}
                aria-current={active === h.id ? "location" : undefined}>{h.text}</a>
            ))}
          </aside>
        ) : null}
      </div>

      {/* Words that only appear after a click, rendered once so the translation crawl collects them (plan 0.6). */}
      <div hidden data-i18n-seed>
        <span>Copied</span>
        <span>Copy failed</span>
      </div>
    </div>
  );
}
