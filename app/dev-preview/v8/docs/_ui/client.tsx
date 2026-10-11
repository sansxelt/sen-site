"use client";

import { useEffect, useRef, useState } from "react";
import { MARKDOWN_ID, type TocItem } from "../_data/types";

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

/** A copy button. Copies the source string, not the highlighted DOM. `icon`: x.ai's code-block button, an icon
 *  whose label is read out (and shown as a tooltip) rather than printed. */
export function CopyButton({ text, icon, label = "Copy" }: { text: string; icon?: boolean; label?: string }) {
  const [state, copy] = useCopy();
  const said = state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label;
  return (
    <button type="button" className={icon ? "v8-docs-copy v8-docs-copy--icon" : "v8-docs-copy"} onClick={() => copy(text)} title={icon ? said : undefined} data-state={state}>
      <CopyIcon done={state === "copied"} />
      <span className={icon ? "v8-sr" : undefined} aria-live="polite">{said}</span>
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

/** "On this page": the heading that last passed under the docs header is the active one. At the foot of the page
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
      // Headings land about 84px down (under the docs header); anything above 150px has been reached.
      const line = atFoot ? window.innerHeight * 0.85 : 150;
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
