"use client";

// THE COMPONENT KIT, INTERACTIVE HALF (plan A5). FrameMedia and Tabs: the two kit parts that need the browser.
// Pages import them from "../_system/kit" (re-exported there) or from here; both resolve to the same module.
import { ButtonLabel } from "@/components/button-label";
// Styles are in kit.css, imported here too so a page that only uses Tabs still gets them.
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import "./kit.css";
import { MediaReadyFallback, useMediaReady } from "./media-ready";

/** How far the page scrolls while the hero picture settles from 1.03 to 1 (plan A6). */
const SETTLE_PX = 320;

/**
 * The picture layer of a FrameHero: it starts scaled to 1.03 and settles to 1 over the first 320px of scroll.
 * It writes one custom property, --fh-s, which kit.css reads; with reduced motion it writes 1 and never
 * listens to scroll. FrameHero renders it for you, so a page only uses it directly to build another framed
 * picture with the same settle.
 *
 * Props: children (the picture, usually a next/image with fill), className (added to "v6-fh__media").
 * Usage: <FrameMedia><Image src={src} alt="" fill sizes="100vw" className="v6-fh__img" /></FrameMedia>
 */
export function FrameMedia({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useMediaReady(ref);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let last = "";
    const write = () => {
      raf = 0;
      const p = Math.min(1, Math.max(0, window.scrollY / SETTLE_PX));
      const s = (1 + 0.03 * (1 - p)).toFixed(4);
      if (s !== last) { last = s; el.style.setProperty("--fh-s", s); }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(write); };
    const bind = () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (reduce.matches) { last = "1"; el.style.setProperty("--fh-s", "1"); return; }
      write();
      window.addEventListener("scroll", onScroll, { passive: true });
    };
    bind();
    reduce.addEventListener("change", bind);
    return () => {
      window.removeEventListener("scroll", onScroll);
      reduce.removeEventListener("change", bind);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return <div ref={ref} className={`v6-fh__media ${className}`.trim()}><MediaReadyFallback/>{children}</div>;
}

/** One tab: a stable id (letters, digits and dashes), its visible label, and what its panel shows. */
export type TabItem = { id: string; label: string; content: ReactNode };

const safe = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, "-");

/**
 * Tabs with the full ARIA tablist model (plan A5). Left and Right move between tabs and show the panel at once,
 * Home and End jump to the first and last, Tab moves into the open panel. It never rotates on its own.
 * Every panel stays in the page (for search and the translator) and shares one box, so switching never moves
 * anything below it: a fixed height from 641px up, with the panel scrolling inside if it is taller. The open
 * panel is always focusable (tabIndex 0), so a keyboard can reach and scroll one that scrolls; closed panels are
 * hidden and out of the tab order. On a phone the box takes the open panel's own height (a tap is the reader's
 * own input, so it is not a layout shift) and the tab row scrolls sideways.
 * Tab labels are labels, not headlines: sentence case, short, no full stop. Wrap a record panel's Tabs in an
 * element with data-panel so the record's text does not count against the page's word budget.
 *
 * Props:
 *   tabs     TabItem[]: { id, label, content }. Labels are sentence case and short ("The plan").
 *   label    the tab list's accessible name, read before the tabs ("The Larkspur record").
 *   height   panel height in px from 641px up. Default 520.
 *   initial  id of the tab open on load. Default: the first.
 * Usage: <Tabs label="The Larkspur record" tabs={[{ id: "plan", label: "The plan", content: <Plan /> }]} />
 */
export function Tabs({ tabs, label, height = 520, initial }: {
  tabs: TabItem[]; label: string; height?: number; initial?: string;
}) {
  const base = useId();
  const first = initial && tabs.some((t) => t.id === initial) ? initial : tabs[0]?.id;
  const [active, setActive] = useState(first);
  const btns = useRef<(HTMLButtonElement | null)[]>([]);
  const tabId = (id: string) => `${base}-tab-${safe(id)}`;
  const panelId = (id: string) => `${base}-panel-${safe(id)}`;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = btns.current.findIndex((b) => b === document.activeElement);
    if (i < 0) return;
    const n = tabs.length;
    const next = e.key === "ArrowRight" ? (i + 1) % n
      : e.key === "ArrowLeft" ? (i - 1 + n) % n
      : e.key === "Home" ? 0
      : e.key === "End" ? n - 1
      : -1;
    if (next < 0) return;
    e.preventDefault();
    setActive(tabs[next].id);
    btns.current[next]?.focus();
  };

  return (
    <div className="v6-tabs">
      <div className="v6-tabs__list" role="tablist" aria-label={label} aria-orientation="horizontal" onKeyDown={onKeyDown}>
        {tabs.map((t, i) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => { btns.current[i] = el; }}
              type="button"
              role="tab"
              id={tabId(t.id)}
              aria-selected={on}
              aria-controls={panelId(t.id)}
              tabIndex={on ? 0 : -1}
              className="v6-tabs__tab"
              onClick={() => setActive(t.id)}
            >
              <ButtonLabel>{t.label}</ButtonLabel>
            </button>
          );
        })}
      </div>
      <div className="v6-tabs__panels" style={{ "--tabs-h": `${height}px` } as CSSProperties}>
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <div
              key={t.id}
              role="tabpanel"
              id={panelId(t.id)}
              aria-labelledby={tabId(t.id)}
              tabIndex={on ? 0 : -1}
              data-on={on}
              className="v6-tabs__panel"
            >
              {t.content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
