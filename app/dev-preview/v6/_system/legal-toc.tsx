"use client";

// THE LEGAL PAGES' CONTENTS LIST (plan T13, 2026-10-02). LegalPage (./legal.tsx) reads the h2s out of the page's
// own element tree on the server and hands their ids and words here, so the list is in the server HTML: it
// needs no script to show, it cannot shift the page when it arrives, and server and client render the same
// thing (no hydration mismatch). The only thing this file adds in the browser is which section is current.
//
// Two renderings of one list, one shown at a time (legal.css):
//   from 1100px   a rail beside the 720 body, sticky under the bar, the current section in ink with a 2px rule
//   below 1100px  a folded "Contents" box above the body, closed until opened, so the policy starts at once
// Both sit inside the page's data-no-translate region (plan 0.6), so they stay in English beside the English
// text they point into. The links are plain fragment links: html { scroll-padding-top: var(--nav-h) } in
// app/globals.css lands a heading under the bar, and the heading's own 48px of padding-top (legal.css) is the
// space between the two.
//
// The file also holds the head's English-only notice (LegalNotice, below), the legal pages' other client part.
import { useEffect, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale } from "@/lib/i18n/client";
import { DEFAULT_LOCALE, LOCALE_PARAM, isLocale } from "@/lib/i18n/locales";

/** One entry: the heading's anchor id and its words, exactly as the h2 shows them. */
export type LegalHeading = { id: string; text: string };

// A section is current once its heading's text has come up to this far below the bar: 48px of the heading's
// own lead-in, plus a margin, so the heading a contents link has just landed is always the current one even when
// the next section is short.
const LINE_BELOW_BAR = 120;

export function LegalToc({ items }: { items: LegalHeading[] }) {
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    const heads = items.map((it) => document.getElementById(it.id)).filter((h): h is HTMLElement => h !== null);
    if (heads.length < 2) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      const bar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) || 66;
      const line = bar + LINE_BELOW_BAR;
      let at: string | null = null;
      for (const h of heads) {
        const textTop = h.getBoundingClientRect().top + (parseFloat(getComputedStyle(h).paddingTop) || 0);
        if (textTop <= line) at = h.id;
        else break;
      }
      // Before any heading has come up to the line, the first one is current only when the page opens on it (it
      // starts in the first screen). Where a table comes first, as on Subprocessors, nothing is: the rail does
      // not claim the reader is in a section they have not reached.
      if (at === null && heads[0].getBoundingClientRect().top + window.scrollY < window.innerHeight) at = heads[0].id;
      setCurrent((c) => (c === at ? c : at));
    };
    const onMove = () => { if (!raf) raf = requestAnimationFrame(read); };
    read();
    window.addEventListener("scroll", onMove, { passive: true });
    window.addEventListener("resize", onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onMove);
      window.removeEventListener("resize", onMove);
    };
  }, [items]);

  if (items.length < 2) return null;

  const list = (rail: boolean) => (
    <ol className="v6-lg__tocl" role="list">
      {items.map((it) => (
        <li key={it.id}>
          <a className="v6-lg__toca" href={`#${it.id}`} aria-current={rail && current === it.id ? "location" : undefined}>
            {it.text}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <>
      <nav className="v6-lg__toc" aria-label="Contents">
        <p className="v6-lg__toch">Contents</p>
        {list(true)}
      </nav>
      <details className="v6-lg__tocm">
        <summary className="v6-lg__tocs">
          <span>Contents</span>
          <span className="v6-lg__tocx" aria-hidden />
        </summary>
        <nav aria-label="Contents">{list(false)}</nav>
      </details>
    </>
  );
}

const subscribeNothing = () => () => {};

/**
 * The head's English-only notice, for a reader in another language (plan T13: after the Updated line). The legal
 * text is not machine-translated, because the English text is the one that applies; this says so, and it is
 * translated like the rest of the head.
 *
 * It is in the server HTML whenever the address asks for another language (?lang=, which every link carries once
 * a language is chosen: lib/i18n/locales.ts), so it is on screen from the first paint. The shared notice,
 * components/english-only-notice.tsx, can only appear after hydration (its server snapshot is English): on these
 * pages it pushed the whole document 92px down about a second after load, a layout shift of 0.037 at 1440x900
 * for every reader in another language, almost four times the 0.01 budget. Once the page is running, the
 * browser's own choice decides, exactly as there. The sentence is that component's, word for word, so its
 * translations apply. The pages are rendered per request (the root layout reads the request headers), so the
 * search params are known on the server; LegalPage still wraps this in Suspense, which is what a prerendered
 * page would need.
 */
export function LegalNotice() {
  const asked = useSearchParams().get(LOCALE_PARAM);
  const locale = useLocale();
  // false on the server and while hydrating, true from then on (and at once on a client-side navigation)
  const running = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const other = running ? locale !== DEFAULT_LOCALE : isLocale(asked) && asked !== DEFAULT_LOCALE;
  if (!other) return null;
  return (
    <p role="note" className="v6-lg__note">
      This page is available in English only. The English text is the version that applies.
    </p>
  );
}
