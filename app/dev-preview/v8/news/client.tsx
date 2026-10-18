"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { href } from "../_kit/site";

export type Row = { slug: string; kind: string; date: string; day: string; month: string; title: string; dek: string; minutes: number };

/** Every story as a dated list (Scale's blog): category tabs and a search over titles and summaries, grouped by month.
 *  The category is kept in ?category= so a filtered view can be linked; without JavaScript every story shows. */
export function NewsIndex({ rows, kinds }: { rows: Row[]; kinds: string[] }) {
  const [kind, setKind] = useState("All");
  const [q, setQ] = useState("");
  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get("category");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the address on load
    if (k && kinds.includes(k)) setKind(k);
  }, [kinds]);
  const choose = (k: string) => {
    setKind(k);
    const u = new URL(window.location.href);
    if (k === "All") u.searchParams.delete("category"); else u.searchParams.set("category", k);
    window.history.replaceState(null, "", u);
  };
  const needle = q.trim().toLowerCase();
  const shown = rows.filter((r) => (kind === "All" || r.kind === kind) && (!needle || `${r.title} ${r.dek}`.toLowerCase().includes(needle)));
  const months = [...new Set(shown.map((r) => r.month))];
  const counts = Object.fromEntries(kinds.map((k) => [k, rows.filter((r) => r.kind === k).length]));
  return (
    <div className="nws-browse">
      <div className="nws-tools">
        <div className="nws-tabs" role="group" aria-label="Filter by category">
          {["All", ...kinds].filter((k) => k === "All" || counts[k]).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => choose(k)}>
              {k}<span>{k === "All" ? rows.length : counts[k]}</span>
            </button>
          ))}
        </div>
        <label className="nws-search">
          <span className="v8-sr">Search news</span>
          <input type="search" placeholder="Search news" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <p className="v8-sr" aria-live="polite">{shown.length} stories</p>
      {months.length ? months.map((m) => (
        <div key={m} className="nws-list">
          <h3 className="nws-list__month">{m}</h3>
          <ul>
            {shown.filter((r) => r.month === m).map((r) => (
              <li key={r.slug}>
                <Link href={href(`/news/${r.slug}`)}>
                  <time dateTime={r.date}>{r.day}</time>
                  <span className="nws-list__text"><b>{r.title}</b><span>{r.dek}</span></span>
                  <span className="nws-list__kind">{r.kind}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )) : <p className="nws-empty">No stories match. Try another word or category.</p>}
    </div>
  );
}

/** Copies the article's address. Says so for a moment, in words. */
export function CopyLink() {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="nws-copy" onClick={async () => {
      try { await navigator.clipboard.writeText(window.location.href.split("?")[0]); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* clipboard refused: nothing to do */ }
    }}>
      <span aria-live="polite">{done ? "Link copied" : "Copy link"}</span>
    </button>
  );
}
