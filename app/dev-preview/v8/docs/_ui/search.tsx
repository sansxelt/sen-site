"use client";

import { usePathname, useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { AskIcon } from "./ask-button";
import { SEARCH_EVENT, openAsk, openSearch } from "./events";
import { useDocsEndpoint, useDocsLink } from "./host";
import type { SearchEntry, TabId } from "../_data/types";

// DOCS SEARCH (x.ai's Cmd/Ctrl K modal). Its first row hands the query to Ask AI (ask.tsx), as x.ai's does to Grok. The index is section level, one entry for each
// page's opening and each h2 and h3, built from the docs data by the search-index route and fetched the first
// time search opens (or the pill is hovered). Matching is local: every word of the query has to start a word
// somewhere in the section; title hits outrank page-title hits, which outrank body hits, and current docs
// rank above earlier references. Filter chips narrow by tab. Arrow keys move, Enter opens, Escape closes, and
// the right pane previews the selected section. Nothing leaves the browser.

type Entry = SearchEntry & { _t: string; _p: string; _x: string };
let indexPromise: Promise<Entry[]> | null = null;
/** The index URL depends on the host: /dev-preview/v8/docs/search-index, or /search-index on docs.vraelis.com. */
function loadIndex(url: string): Promise<Entry[]> {
  if (!indexPromise) {
    indexPromise = fetch(url)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<SearchEntry[]>; })
      .then((list) => list.map((e) => ({ ...e, _t: e.title.toLowerCase(), _p: e.page.toLowerCase(), _x: e.text.toLowerCase() })))
      .catch((err) => { indexPromise = null; throw err; });
  }
  return indexPromise;
}
export { openSearch };

const noop = () => () => {};
/** "⌘K" on Apple platforms, "Ctrl K" elsewhere. The server and first paint say "Ctrl K". */
export function useModKey() {
  const mac = useSyncExternalStore(noop, () => /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent), () => false);
  return mac ? "⌘K" : "Ctrl K";
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

/** The search field in the docs header (x.ai's outlined pill with the shortcut). On narrow screens, an icon. */
export function SearchPill() {
  const key = useModKey();
  const endpoint = useDocsEndpoint();
  const warm = () => { loadIndex(endpoint("/docs/search-index")).catch(() => {}); };
  return (
    <button type="button" className="v8-docs-pill" aria-label="Search docs" aria-keyshortcuts="Control+K Meta+K"
      onClick={openSearch} onPointerEnter={warm} onFocus={warm}>
      <SearchIcon />
      <span className="v8-docs-pill__label">Search</span>
      <kbd>{key}</kbd>
    </button>
  );
}

// ── Matching ─────────────────────────────────────────────────────────────────────────────────────────────
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const tokens = (q: string) => q.toLowerCase().split(/\s+/)
  .map((t) => t.replace(/^[^\p{L}\p{N}_]+|[^\p{L}\p{N}_]+$/gu, "")).filter(Boolean).slice(0, 8);
const START = "(?<![\\p{L}\\p{N}])";

function score(e: Entry, res: RegExp[], phrase: string) {
  let s = 0;
  for (const re of res) {
    let hit = 0;
    if (re.test(e._t)) hit += 10;
    if (re.test(e._p)) hit += 4;
    if (re.test(e._x)) hit += 2;
    if (!hit) return 0;
    s += hit;
  }
  if (phrase.includes(" ")) { if (e._t.includes(phrase)) s += 12; else if (e._x.includes(phrase)) s += 4; }
  if (e.tab === "earlier") s -= 3;
  return Math.max(1, s);
}

function snippet(text: string, any: RegExp | null) {
  const m = any ? any.exec(text) : null;
  const at = m ? m.index : 0;
  let start = Math.max(0, at - 60), end = Math.min(text.length, start + 190);
  if (start > 0) { const sp = text.indexOf(" ", start); if (sp > 0 && sp < at) start = sp + 1; }
  if (end < text.length) { const sp = text.lastIndexOf(" ", end); if (sp > at) end = sp; }
  return `${start > 0 ? "… " : ""}${text.slice(start, end)}${end < text.length ? " …" : ""}`;
}

function mark(text: string, re: RegExp | null): ReactNode {
  if (!re) return text;
  const parts = text.split(re);
  return parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : <Fragment key={i}>{p}</Fragment>));
}

// ── The preview pane: a small Markdown reader for the section's twin ──────────────────────────────────────
function inlineMd(s: string, re: RegExp | null): ReactNode[] {
  const out: ReactNode[] = [];
  const rx = /\*\*([^*]+)\*\*|`([^`]+)`|!?\[([^\]]*)\]\([^)\s]+\)|\*([^*]+)\*/g;
  let last = 0, k = 0;
  for (const m of s.matchAll(rx)) {
    const at = m.index ?? 0;
    if (at > last) out.push(<Fragment key={k++}>{mark(s.slice(last, at), re)}</Fragment>);
    if (m[1] !== undefined) out.push(<b key={k++}>{mark(m[1], re)}</b>);
    else if (m[2] !== undefined) out.push(<code key={k++}>{mark(m[2], re)}</code>);
    else if (m[3] !== undefined) out.push(<Fragment key={k++}>{mark(m[3], re)}</Fragment>);
    else out.push(<Fragment key={k++}>{mark(m[4], re)}</Fragment>);
    last = at + m[0].length;
  }
  if (last < s.length) out.push(<Fragment key={k++}>{mark(s.slice(last), re)}</Fragment>);
  return out;
}
const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));

function Preview({ md, re }: { md: string; re: RegExp | null }) {
  const lines = md.split("\n");
  const out: ReactNode[] = [];
  let i = 0, k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const buf: string[] = []; i++;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
      i++; out.push(<pre key={k++}>{buf.join("\n")}</pre>); continue;
    }
    if (/^#{2,3} /.test(line)) { out.push(<p key={k++} className="h">{inlineMd(line.replace(/^#+ /, ""), re)}</p>); i++; continue; }
    if (/^- /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^- /.test(lines[i])) items.push(lines[i++].slice(2));
      out.push(<ul key={k++}>{items.map((x, j) => <li key={j}>{inlineMd(x, re)}</li>)}</ul>); continue;
    }
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) items.push(lines[i++].replace(/^\d+\. /, ""));
      out.push(<ol key={k++}>{items.map((x, j) => <li key={j}>{inlineMd(x, re)}</li>)}</ol>); continue;
    }
    if (line.startsWith("> ")) { out.push(<div key={k++} className="note">{inlineMd(line.slice(2), re)}</div>); i++; continue; }
    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) rows.push(cells(lines[i++]));
      const [head, , ...body] = rows;
      out.push(
        <table key={k++}>
          <thead><tr>{head.map((c, j) => <th key={j}>{inlineMd(c, re)}</th>)}</tr></thead>
          <tbody>{body.map((r, j) => <tr key={j}>{r.map((c, n) => <td key={n}>{inlineMd(c, re)}</td>)}</tr>)}</tbody>
        </table>,
      );
      continue;
    }
    if (line.startsWith("![")) { const m = /^!\[([^\]]*)\]/.exec(line); out.push(<p key={k++} className="cap">Capture: {m?.[1]}</p>); i++; continue; }
    if (!line.trim()) { i++; continue; }
    out.push(<p key={k++}>{inlineMd(line, re)}</p>); i++;
  }
  return <>{out}</>;
}

// ── The modal ────────────────────────────────────────────────────────────────────────────────────────────
type Filter = "all" | TabId;

export function SearchModal({ tabs }: { tabs: { id: TabId; label: string }[] }) {
  const router = useRouter();
  const link = useDocsLink();
  const endpoint = useDocsEndpoint();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sel, setSel] = useState(0);
  const [data, setData] = useState<Entry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const openRef = useRef(false);
  const returnTo = useRef<HTMLElement | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const show = useCallback(() => {
    if (openRef.current) return;
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openRef.current = true; setOpen(true); setSel(-1);
  }, []);
  const close = useCallback((restore = true) => {
    if (!openRef.current) return;
    openRef.current = false; setOpen(false);
    if (restore) returnTo.current?.focus({ preventScroll: true });
  }, []);

  // Ctrl K or Cmd K anywhere in the docs, and the pills' open event.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (openRef.current) close(); else show();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(SEARCH_EVENT, show);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener(SEARCH_EVENT, show); };
  }, [show, close]);

  // Load the index the first time search opens.
  useEffect(() => {
    if (!open || data) return;
    let live = true;
    loadIndex(endpoint("/docs/search-index")).then((d) => { if (live) { setData(d); setFailed(false); } }, () => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [open, data, endpoint]);

  // While open: the page behind does not scroll, and the field has focus.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    input.current?.focus();
    input.current?.select();
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const terms = useMemo(() => tokens(q), [q]);
  const res = useMemo(() => terms.map((t) => new RegExp(START + esc(t), "u")), [terms]);
  const hl = useMemo(() => (terms.length ? new RegExp(`${START}(${terms.map(esc).join("|")})`, "giu") : null), [terms]);
  const any = useMemo(() => (terms.length ? new RegExp(`${START}(?:${terms.map(esc).join("|")})`, "iu") : null), [terms]);

  const scored = useMemo(() => {
    if (!data) return [];
    if (!terms.length) return data.filter((e) => !e.anchor);
    const phrase = terms.join(" ");
    const out: { e: Entry; s: number; i: number }[] = [];
    data.forEach((e, i) => { const s = score(e, res, phrase); if (s > 0) out.push({ e, s, i }); });
    out.sort((a, b) => b.s - a.s || a.i - b.i);
    return out.map((x) => x.e);
  }, [data, terms, res]);
  const counts = useMemo(() => {
    const c = { all: scored.length } as Record<Filter, number>;
    for (const t of tabs) c[t.id] = 0;
    for (const e of scored) c[e.tab] = (c[e.tab] ?? 0) + 1;
    return c;
  }, [scored, tabs]);
  const visible = useMemo(() => (filter === "all" ? scored : scored.filter((e) => e.tab === filter)).slice(0, 60), [scored, filter]);
  // Row 0 is Ask AI; results follow. With nothing chosen yet, a query selects its best result, and Ask AI when
  // nothing matches, so Enter does the useful thing either way.
  const at = sel < 0 ? (terms.length && visible.length ? 1 : 0) : Math.min(sel, visible.length);
  const cur = at > 0 ? visible[at - 1] ?? null : null;

  // Keep the selected result in view as the arrows move it.
  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [at, open, visible]);

  const ask = () => { close(false); openAsk(q.trim() || undefined); };
  const go = (e: Entry) => {
    const path = link(`/docs/${e.slug}`);
    close(false);
    if (pathname === path) {
      if (e.anchor) { window.location.assign(`#${e.anchor}`); document.getElementById(e.anchor)?.focus?.({ preventScroll: true }); }
      else window.scrollTo({ top: 0 });
      return;
    }
    router.push(e.anchor ? `${path}#${e.anchor}` : path);
  };

  const onInputKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(Math.min(at + 1, visible.length)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel(Math.max(at - 1, 0)); }
    else if (e.key === "Home" && e.ctrlKey) { e.preventDefault(); setSel(0); }
    else if (e.key === "End" && e.ctrlKey) { e.preventDefault(); setSel(visible.length); }
    else if (e.key === "Enter") { e.preventDefault(); if (cur) go(cur); else if (at === 0) ask(); }
  };
  // Escape closes; Tab stays inside the dialog.
  const onDialogKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key !== "Tab" || !dialog.current) return;
    const f = Array.from(dialog.current.querySelectorAll<HTMLElement>("input, button, a[href]")).filter((el) => el.getClientRects().length > 0);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  if (!open) return null;
  const chips: { id: Filter; label: string }[] = [{ id: "all", label: "All" }, ...tabs];
  const tabLabel = (id: TabId) => tabs.find((t) => t.id === id)?.label ?? id;

  // With no query, every page is listed under its tab; with a query, results are one ranked list.
  const options = visible.map((e, i) => (
    <div key={e.id} id={`v8-docs-sr-${i + 1}`} role="option" aria-selected={i + 1 === at} className="v8-docs-sr__item"
      onMouseMove={() => { if (i + 1 !== at) setSel(i + 1); }} onClick={() => go(e)}>
      <span className="t">{mark(e.title, hl)}</span>
      <span className="c">{e.crumb}</span>
      {terms.length ? <span className="x">{mark(snippet(e.text, any), hl)}</span> : null}
    </div>
  ));
  let body: ReactNode;
  if (!data) body = <p className="v8-docs-sr__empty">{failed ? "Search could not load. Check your connection and try again." : "Loading the search index."}</p>;
  else if (!visible.length) body = <p className="v8-docs-sr__empty">{terms.length ? "No section matches every word. Try fewer or different words." : "No pages in this section."}</p>;
  else if (!terms.length) {
    const groups: { tab: TabId; items: ReactNode[] }[] = [];
    visible.forEach((e, i) => {
      const g = groups[groups.length - 1];
      if (g && g.tab === e.tab) g.items.push(options[i]); else groups.push({ tab: e.tab, items: [options[i]] });
    });
    body = groups.map((g) => (
      <div key={g.tab} role="group" aria-label={tabLabel(g.tab)}>
        <div className="v8-docs-sr__group" aria-hidden="true">{tabLabel(g.tab)}</div>
        {g.items}
      </div>
    ));
  } else body = <div role="group" aria-label="Results"><div className="v8-docs-sr__group" aria-hidden="true">Results</div>{options}</div>;
  const askRow = (
    <div role="group" aria-label="Ask AI">
      <div className="v8-docs-sr__group" aria-hidden="true">Ask AI</div>
      <div id="v8-docs-sr-0" role="option" aria-selected={at === 0} className="v8-docs-sr__item v8-docs-sr__ask"
        onMouseMove={() => { if (at !== 0) setSel(0); }} onClick={ask}>
        <span className="t"><AskIcon />{terms.length ? <>Ask AI: <q>{q.trim()}</q></> : "Ask AI a question"}</span>
        <span className="c">An answer written from these docs, with links to its sections</span>
      </div>
    </div>
  );

  return (
    <div className="v8-docs-modal" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div ref={dialog} className="v8-docs-modal__box" role="dialog" aria-modal="true" aria-label="Search documentation" onKeyDown={onDialogKey}>
        <div className="v8-docs-modal__field">
          <SearchIcon />
          <input ref={input} type="text" value={q} placeholder="Search docs" aria-label="Search docs" autoComplete="off" spellCheck={false}
            role="combobox" aria-expanded="true" aria-controls="v8-docs-sr-list" aria-autocomplete="list"
            aria-activedescendant={`v8-docs-sr-${at}`}
            onChange={(e) => { setQ(e.target.value); setSel(-1); }} onKeyDown={onInputKey} />
          <button type="button" className="v8-docs-modal__esc" onClick={() => close()} aria-label="Close search">Esc</button>
        </div>
        <div className="v8-docs-modal__chips" aria-label="Filter by section">
          {chips.map((c) => (
            <button key={c.id} type="button" aria-pressed={filter === c.id} onClick={() => { setFilter(c.id); setSel(-1); input.current?.focus(); }}>
              {c.label}<span>{data ? counts[c.id] : ""}</span>
            </button>
          ))}
        </div>
        <div className="v8-docs-modal__panes">
          <div ref={list} id="v8-docs-sr-list" className="v8-docs-sr" role="listbox" aria-label={terms.length ? "Search results" : "All pages"}>
            {askRow}
            {body}
          </div>
          <div className="v8-docs-sp" aria-label="Preview of the selected section" role="region" key={cur?.id ?? "none"}>
            {cur ? (
              <>
                <p className="v8-docs-sp__crumb">{cur.crumb}</p>
                <p className="v8-docs-sp__title">{mark(cur.title, hl)}</p>
                <div className="v8-docs-sp__body"><Preview md={cur.md} re={hl} /></div>
              </>
            ) : at === 0 ? (
              <>
                <p className="v8-docs-sp__crumb">Ask AI</p>
                <p className="v8-docs-sp__title">{terms.length ? q.trim() : "Ask a question about these docs"}</p>
                <div className="v8-docs-sp__body">
                  <p>Ask AI answers from this documentation only: the passages that match your question, each linked to its section. When the docs do not cover something, it says so.</p>
                  <p>Press Enter to ask.</p>
                </div>
              </>
            ) : <p className="v8-docs-sr__empty">The selected section appears here.</p>}
          </div>
        </div>
        <div className="v8-docs-modal__foot">
          <span>Section search over these docs, in your browser</span>
          <span className="keys"><span><kbd>↑</kbd><kbd>↓</kbd> Move</span><span><kbd>Enter</kbd> Open</span><span><kbd>Esc</kbd> Close</span></span>
        </div>
        <p className="v8-sr" aria-live="polite">{data ? (terms.length ? `${visible.length} results` : "") : ""}</p>
      </div>
    </div>
  );
}
