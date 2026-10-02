"use client";

// THE LANGUAGE SWITCH. One component, placed in the site header and footer, the docs rail, the sign-in
// screen and the console, all reading and writing the same store (lib/i18n/client.ts), so changing it in any
// of them changes the language everywhere.
//
// Each language shows its country flag, as Overlym's does (founder, 2026-10-01). The flags are the MIT
// flag-icons SVGs served from /flags (public/flags/README.md), so the switch makes no third-party request,
// and emoji flags are not used because Windows renders them as two letters.
//
// THE MENU IS PORTALLED TO <body> AND PLACED AGAINST THE VIEWPORT. It used to hang off the button, so inside
// the console sidebar (which clips its overflow) half of it was cut away. Now it opens below or above the
// button, whichever has room, and is pulled back inside the screen edges.
//
// The language names are written in their own language and are never translated ([data-no-translate]),
// so a reader who cannot read the current language can still find theirs.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LOCALES, LOCALE_KEYS, type Locale } from "@/lib/i18n/locales";
import { setLocale, useLocale } from "@/lib/i18n/client";
import "./language-switcher.css";

const FLAG: Record<Locale, string> = {
  en: "us", es: "es", fr: "fr", de: "de", pt: "br", it: "it", nl: "nl", ja: "jp", ko: "kr", zh: "cn", hi: "in", id: "id",
};

function Flag({ locale, size = 18 }: { locale: Locale; size?: number }) {
  // Tiny static SVGs: they scale cleanly and gain nothing from image optimisation.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="lsw__flag" src={`/flags/${FLAG[locale]}.svg`} width={size} height={Math.round(size * 0.75)} alt="" aria-hidden decoding="async" />;
}

const MENU_W = 340;
const GAP = 8;

export function LanguageSwitcher({ tone = "light", variant = "box", placement = "up", className = "", labelHidden = false, toTop = false }: {
  tone?: "light" | "dark";
  /** "box" (rounded rectangle, footers and rails) or "pill" (the header, like Overlym's). */
  variant?: "box" | "pill";
  /** Preferred side; the menu flips when that side has no room. */
  placement?: "up" | "down";
  className?: string;
  /** Flag only on the button (the name is still announced). */
  labelHidden?: boolean;
  /** Scroll back to the top after a language is picked (the site footer: founder, 2026-10-01, the page
   *  should be read from its start in the new language rather than from the footer). */
  toTop?: boolean;
  /** Kept for callers from before the menu was portalled; the menu now finds its own side. */
  align?: "left" | "right";
}) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; up: boolean } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const wordId = useId();
  const nameId = useId();

  const place = useCallback(() => {
    const b = btn.current?.getBoundingClientRect();
    if (!b) return;
    const h = menu.current?.offsetHeight ?? 360;
    const vw = window.innerWidth, vh = window.innerHeight;
    const roomBelow = vh - b.bottom - GAP, roomAbove = b.top - GAP;
    const up = placement === "up" ? (roomAbove >= h || roomAbove > roomBelow) : !(roomBelow >= h || roomBelow > roomAbove);
    const w = Math.min(MENU_W, vw - 16);
    // Line the menu up with the button's left edge, or its right edge when the button sits in the right half.
    let left = b.left + b.width / 2 > vw / 2 ? b.right - w : b.left;
    left = Math.max(8, Math.min(left, vw - w - 8));
    const top = up ? Math.max(8, b.top - GAP - h) : Math.min(b.bottom + GAP, vh - h - 8);
    setPos({ left, top, up });
  }, [placement]);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')?.focus();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!root.current?.contains(t) && !menu.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    const onMove = () => place();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, place]);

  const choose = (next: Locale) => {
    setLocale(next); setOpen(false);
    if (toTop) {
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
      btn.current?.focus({ preventScroll: true });
    } else btn.current?.focus();
  };

  const panel = open ? (
    <div ref={menu} id={menuId} className="lsw__menu" role="menu" aria-label="Language" data-up={pos?.up ? "true" : "false"}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: Math.min(MENU_W, typeof window === "undefined" ? MENU_W : window.innerWidth - 16) }}
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null;
        if (next && !menu.current?.contains(next) && !root.current?.contains(next)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
        e.preventDefault();
        const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'));
        const i = items.indexOf(document.activeElement as HTMLButtonElement);
        const step = e.key === "ArrowDown" ? 2 : e.key === "ArrowUp" ? -2 : e.key === "ArrowRight" ? 1 : -1;
        const n = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (i + step + items.length) % items.length;
        items[n]?.focus();
      }}>
      <p className="lsw__head">Language</p>
      <p className="lsw__note">The site, the docs and the console. Legal pages stay in English.</p>
      <div className="lsw__list" data-no-translate>
        {LOCALE_KEYS.map((key) => (
          <button key={key} type="button" role="menuitemradio" aria-checked={locale === key} className="lsw__opt" onClick={() => choose(key)}>
            <Flag locale={key} />
            <span lang={LOCALES[key].htmlLang}>{LOCALES[key].label}</span>
            {locale === key ? <svg className="lsw__tick" viewBox="0 0 12 12" width="12" height="12" aria-hidden><path d="M2.5 6.3 5 8.7l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div ref={root} className={`lsw ${className}`} data-tone={tone} data-variant={variant} data-open={open}>
      {/* THE BUTTON'S NAME IS TWO PIECES, EACH ONE THE TRANSLATOR CAN HANDLE. It was aria-label="Language:
          Español", a string no catalogue can carry a key for, so it stayed English in every language. Now the
          word is a text node of its own, hidden and read only through aria-labelledby, which the page
          translator swaps like any other text, and the language's own name is the label beside the flag,
          never translated. With labelHidden the name is still there for the label to point at, just hidden. */}
      <button ref={btn} type="button" className="lsw__btn" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
        aria-labelledby={`${wordId} ${nameId}`} onClick={() => setOpen((v) => !v)}>
        <span id={wordId} hidden>Language</span>
        <Flag locale={locale} />
        {labelHidden
          ? <span id={nameId} hidden data-no-translate lang={LOCALES[locale].htmlLang}>{LOCALES[locale].label}</span>
          : <span id={nameId} className="lsw__label" data-no-translate lang={LOCALES[locale].htmlLang}>{LOCALES[locale].label}</span>}
        <svg className="lsw__chev" viewBox="0 0 12 12" width="11" height="11" aria-hidden><path d="M3 4.5 6 7.5l3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {panel && typeof document !== "undefined" ? createPortal(panel, document.body) : null}
    </div>
  );
}
