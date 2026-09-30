"use client";

// THE LANGUAGE SWITCH. One component, placed in the site footer, the docs rail, the sign-in screen and the
// console, all reading and writing the same store (lib/i18n/client.ts), so changing it in any of them
// changes the language everywhere.
//
// The language names are written in their own language and are never translated ([data-no-translate]),
// so a reader who cannot read the current language can still find theirs.
import { useEffect, useId, useRef, useState } from "react";
import { LOCALES, LOCALE_KEYS, type Locale } from "@/lib/i18n/locales";
import { setLocale, useLocale } from "@/lib/i18n/client";
import "./language-switcher.css";

export function LanguageSwitcher({ tone = "light", placement = "up", align = "left", className = "" }: {
  tone?: "light" | "dark"; placement?: "up" | "down"; align?: "left" | "right"; className?: string;
}) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')?.focus();
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      root.current?.querySelector<HTMLButtonElement>(".lsw__btn")?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const choose = (next: Locale) => {
    setLocale(next);
    setOpen(false);
    root.current?.querySelector<HTMLButtonElement>(".lsw__btn")?.focus();
  };

  return (
    <div ref={root} className={`lsw ${className}`} data-tone={tone} data-place={placement} data-align={align} data-open={open}
      onBlur={(e) => { if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <button type="button" className="lsw__btn" aria-haspopup="menu" aria-expanded={open} aria-controls={menuId}
        aria-label={`Language: ${LOCALES[locale].label}`} onClick={() => setOpen((v) => !v)}>
        <svg className="lsw__globe" viewBox="0 0 16 16" width="15" height="15" aria-hidden>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M1.9 8h12.2M8 1.75c1.7 1.8 2.55 3.9 2.55 6.25S9.7 12.45 8 14.25C6.3 12.45 5.45 10.35 5.45 8S6.3 3.55 8 1.75Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
        <span data-no-translate lang={LOCALES[locale].htmlLang}>{LOCALES[locale].label}</span>
        <svg className="lsw__chev" viewBox="0 0 12 12" width="11" height="11" aria-hidden><path d="M3 4.5 6 7.5l3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open ? (
        <div id={menuId} className="lsw__menu" role="menu" aria-label="Language" onKeyDown={(e) => {
          if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
          e.preventDefault();
          const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'));
          const i = items.indexOf(document.activeElement as HTMLButtonElement);
          const n = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
          items[n]?.focus();
        }}>
          <p className="lsw__head">Language</p>
          <p className="lsw__note">The site, the docs and the console. Legal pages stay in English.</p>
          <div className="lsw__list" data-no-translate>
            {LOCALE_KEYS.map((key) => (
              <button key={key} type="button" role="menuitemradio" aria-checked={locale === key} className="lsw__opt" onClick={() => choose(key)}>
                <span lang={LOCALES[key].htmlLang}>{LOCALES[key].label}</span>
                {locale === key ? <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden><path d="M2.5 6.3 5 8.7l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
