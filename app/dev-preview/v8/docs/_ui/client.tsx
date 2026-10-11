"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { docsBase } from "../_data/links";
import { MARKDOWN_ID, type TabId, type TocItem } from "../_data/types";
import { AskButton } from "./ask-button";
import { useDocsLink, useDocsMain } from "./host";
import { SearchPill } from "./search";

// The docs' interactive parts. Everything else in the docs is server-rendered.

type CopyState = "idle" | "copied" | "failed";
function useCopy() {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = (text: string | null) => {
    window.clearTimeout(timer.current);
    const done = (s: CopyState) => { setState(s); timer.current = window.setTimeout(() => setState("idle"), 1800); };
    if (text === null || !navigator.clipboard) { done("failed"); return; }
    navigator.clipboard.writeText(text).then(() => done("copied"), () => done("failed"));
  };
  return [state, copy] as const;
}

function CopyIcon({ done }: { done: boolean }) {
  return done ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" /></svg>
  );
}

/** A code block's copy button. Copies the source string, not the highlighted DOM. */
export function CopyButton({ text }: { text: string }) {
  const [state, copy] = useCopy();
  return (
    <button type="button" className="v8-docs-copy" onClick={() => copy(text)}>
      <CopyIcon done={state === "copied"} />
      <span aria-live="polite">{state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy"}</span>
    </button>
  );
}

/** The page's Markdown lives once in the page, in a JSON script tag, so both Copy for LLM buttons share it. */
function pageMarkdown(): string | null {
  const el = document.getElementById(MARKDOWN_ID);
  if (!el?.textContent) return null;
  try { return JSON.parse(el.textContent) as string; } catch { return null; }
}

export function CopyForLLM({ className }: { className?: string }) {
  const [state, copy] = useCopy();
  return (
    <button type="button" className={className ? `v8-docs-util ${className}` : "v8-docs-util"} onClick={() => copy(pageMarkdown())}
      title="Copy this page as Markdown, for an AI assistant">
      <CopyIcon done={state === "copied"} />
      <span aria-live="polite">{state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy for LLM"}</span>
    </button>
  );
}

/** "On this page": the heading that last passed under the docs bar is the active one. At the foot of the page
 *  the lowest heading on screen wins, so the list ends on the section being read. */
export function Toc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  const key = items.map((t) => t.id).join("|");
  useEffect(() => {
    const ids = key ? key.split("|") : [];
    if (!ids.length) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const atFoot = window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      // Headings land about 136px down (under the header and the docs bar); anything above 200px has been reached.
      const line = atFoot ? window.innerHeight * 0.85 : 200;
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < line) current = id;
      }
      setActive(current);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(raf); };
  }, [key]);
  return (
    <nav className="v8-docs-toc__nav" aria-label="On this page">
      <p className="v8-docs-toc__h">On this page</p>
      <ul>
        {items.map((h) => (
          <li key={h.id} className={h.level === 3 ? "is-sub" : undefined}>
            <a href={`#${h.id}`} aria-current={active === h.id ? "location" : undefined}>{h.text}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The sidebar. On a phone it folds into one button that opens the list; on wider screens the list is always
 *  shown and the button is not rendered visible. A route change closes it. */
export function SideNav({ current, children }: { current: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [seen, setSeen] = useState(pathname);
  if (seen !== pathname) { setSeen(pathname); setOpen(false); }
  return (
    <div className="v8-docs-side__in" data-open={open}>
      <button type="button" className="v8-docs-side__toggle" aria-expanded={open} aria-controls="v8-docs-sidenav" onClick={() => setOpen((o) => !o)}>
        <span className="l">Browse docs</span>
        <span className="c">{current}</span>
        <span className="v8-caret" aria-hidden="true" />
      </button>
      <div id="v8-docs-sidenav" className="v8-docs-side__list">{children}</div>
    </div>
  );
}

/** The docs bar under the header: product tabs, the search pill and Ask AI. The active tab comes from the path,
 *  which is /dev-preview/v8/docs/<slug> on the main host and /<slug> on docs.vraelis.com. */
export function DocsBar({ tabs, slugTab }: { tabs: { id: TabId; label: string; to: string }[]; slugTab: Record<string, TabId> }) {
  const pathname = usePathname();
  const main = useDocsMain();
  const link = useDocsLink();
  const base = docsBase(main);
  const home = base || "/";
  const slug = pathname.startsWith(`${base}/`) ? pathname.slice(base.length + 1).split("/")[0] : "";
  const activeTab = slugTab[slug];
  // On a phone the tabs scroll sideways; keep the active one in view (without moving the page).
  const strip = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = strip.current;
    const a = nav?.querySelector<HTMLElement>("[aria-current]");
    if (!nav || !a || nav.scrollWidth <= nav.clientWidth) return;
    const left = a.offsetLeft - nav.offsetLeft, right = left + a.offsetWidth;
    if (left < nav.scrollLeft || right > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = Math.max(0, right - nav.clientWidth + 16);
  }, [activeTab]);
  return (
    <div className="v8-docs-bar">
      <div className="v8-wrap v8-wrap--frame v8-docs-bar__in">
        <Link href={home} className="v8-docs-bar__home" aria-current={pathname === home ? "page" : undefined}>Documentation</Link>
        <nav ref={strip} className="v8-docs-bar__tabs" aria-label="Documentation sections">
          {tabs.map((t) => (
            <Link key={t.id} href={link(t.to)} aria-current={activeTab === t.id ? "true" : undefined}>{t.label}</Link>
          ))}
        </nav>
        <div className="v8-docs-bar__end"><SearchPill /><AskButton /></div>
      </div>
    </div>
  );
}
