"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { href } from "../_kit/site";

export type CardData = { slug: string; kind: string; date: string; day: string; title: string; minutes: number; cover: ReactNode };

/** The newsroom's category tabs over the article grid. The choice is kept in ?category= so a filtered view can be
 *  linked; without JavaScript every card shows. */
export function NewsGrid({ cards, kinds }: { cards: CardData[]; kinds: string[] }) {
  const [kind, setKind] = useState("All");
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
  const shown = kind === "All" ? cards : cards.filter((c) => c.kind === kind);
  const counts = Object.fromEntries(kinds.map((k) => [k, cards.filter((c) => c.kind === k).length]));
  return (
    <div className="nws-browse">
      <div className="nws-tabs" role="group" aria-label="Filter by category">
        {["All", ...kinds].filter((k) => k === "All" || counts[k]).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => choose(k)}>
            {k}<span>{k === "All" ? cards.length : counts[k]}</span>
          </button>
        ))}
      </div>
      <p className="v8-sr" aria-live="polite">{shown.length} articles</p>
      <div className="nws-grid">
        {shown.map((c) => (
          <Link key={c.slug} href={href(`/news/${c.slug}`)} className="nws-card">
            <div className="nws-card__media">{c.cover}</div>
            <p className="nws-meta"><span>{c.kind}</span><time dateTime={c.date}>{c.day}</time></p>
            <h3 className="nws-card__title">{c.title}</h3>
            <p className="nws-card__min">{c.minutes} min read</p>
          </Link>
        ))}
      </div>
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
