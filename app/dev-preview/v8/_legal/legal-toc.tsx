"use client";

// THE V8 LEGAL PAGES' CONTENTS LIST. LegalPage (./legal.tsx) reads the h2s out of the page's own element tree on
// the server and hands their ids and words here, so the list is in the server HTML and cannot shift the page.
// The only thing this file adds in the browser is which section is current.
//
// Two renderings of one list, one shown at a time (legal.css):
//   from 1100px   a rail beside the body, sticky under the header; the current section in ink with the
//                 spectral rule (the v8 "selected item" light)
//   below 1100px  a folded "On this page" box above the body, closed until opened
//
// The file also holds the head's English-only notice (LegalNotice), the same as v6's.
import { useEffect, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale } from "@/lib/i18n/client";
import { DEFAULT_LOCALE, LOCALE_PARAM, isLocale } from "@/lib/i18n/locales";

/** One entry: the heading's anchor id and its words, exactly as the h2 shows them. */
export type LegalHeading = { id: string; text: string };

// A section is current once its heading has come up to this far below the header.
const LINE_BELOW_HEADER = 120;

export function LegalToc({ items }: { items: LegalHeading[] }) {
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    const heads = items.map((it) => document.getElementById(it.id)).filter((h): h is HTMLElement => h !== null);
    if (heads.length < 2) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      const bar = document.querySelector(".v8-header")?.getBoundingClientRect().height || 64;
      const line = bar + LINE_BELOW_HEADER;
      let at: string | null = null;
      for (const h of heads) {
        if (h.getBoundingClientRect().top <= line) at = h.id;
        else break;
      }
      // Before any heading reaches the line, the first one is current only when it starts in the first screen
      // (where a table comes first, as on Subprocessors, nothing is current yet).
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
    <ol className="v8-legal__tocl" role="list">
      {items.map((it) => (
        <li key={it.id}>
          <a className="v8-legal__toca" href={`#${it.id}`} aria-current={rail && current === it.id ? "location" : undefined}>
            {it.text}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <>
      <nav className="v8-legal__toc" aria-label="On this page">
        <p className="v8-legal__toch">On this page</p>
        {list(true)}
      </nav>
      <details className="v8-legal__fold">
        <summary className="v8-legal__folds">
          <span>On this page</span>
          <span className="v8-legal__foldx" aria-hidden />
        </summary>
        <nav aria-label="On this page">{list(false)}</nav>
      </details>
    </>
  );
}

const subscribeNothing = () => () => {};

/** The English-only notice for a reader in another language, word for word v6's (and the shared component's), so
 *  its translations apply. In the server HTML when the address asks for another language (?lang=). */
export function LegalNotice() {
  const asked = useSearchParams().get(LOCALE_PARAM);
  const locale = useLocale();
  const running = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const other = running ? locale !== DEFAULT_LOCALE : isLocale(asked) && asked !== DEFAULT_LOCALE;
  if (!other) return null;
  return (
    <p role="note" className="v8-legal__note">
      This page is available in English only. The English text is the version that applies.
    </p>
  );
}
