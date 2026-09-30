// THE LANGUAGES VRAELIS SPEAKS, AND HOW A CHOICE TRAVELS.
//
// One switch changes the language everywhere: the site, the docs, sign-in and the console (founder,
// 2026-09-30, "like Overlym"). The mechanism is Overlym's: the page is written in English, and the
// language controller (components/language-controller.tsx) swaps each piece of text for its translation
// from public/locales/<code>.json, keyed by the English text itself. Nothing is translated on the server,
// so every page keeps one source of truth and a missing translation falls back to English, never to a
// blank.
//
// HOW THE CHOICE TRAVELS. The URL carries it (?lang=), always, so a link someone shares opens in the
// language they were reading, and the choice crosses from vraelis.com to app.vraelis.com with no storage
// at all. It is REMEMBERED (a cookie shared by both hosts, and localStorage) only when the visitor allowed
// preference storage in the privacy choice (lib/privacy-choice.ts); withdrawing that clears both.
//
// Legal pages are not translated (components/english-only-notice.tsx): the English text is the one that
// applies, and a machine rendering of a contract is not something to put in front of anyone as binding.

export const LOCALES = {
  en: { label: "English", htmlLang: "en" },
  es: { label: "Español", htmlLang: "es" },
  fr: { label: "Français", htmlLang: "fr" },
  de: { label: "Deutsch", htmlLang: "de" },
  pt: { label: "Português", htmlLang: "pt-BR" },
  it: { label: "Italiano", htmlLang: "it" },
  nl: { label: "Nederlands", htmlLang: "nl" },
  ja: { label: "日本語", htmlLang: "ja" },
  ko: { label: "한국어", htmlLang: "ko" },
  zh: { label: "中文", htmlLang: "zh-CN" },
  hi: { label: "हिन्दी", htmlLang: "hi" },
  id: { label: "Bahasa Indonesia", htmlLang: "id" },
} as const;

export type Locale = keyof typeof LOCALES;
export const LOCALE_KEYS = Object.keys(LOCALES) as Locale[];
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_PARAM = "lang";
/** Remembered choice, shared by vraelis.com and app.vraelis.com. Preference storage only. */
export const LOCALE_COOKIE = "vraelis_language";
export const LOCALE_STORAGE_KEY = "vraelis-locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LOCALES, value);
}

/** The same address with the language set on it. English is the default, so it removes the parameter. */
export function hrefWithLocale(href: string, locale: Locale, base?: string): string {
  const url = new URL(href, base);
  if (locale === DEFAULT_LOCALE) url.searchParams.delete(LOCALE_PARAM);
  else url.searchParams.set(LOCALE_PARAM, locale);
  return url.href;
}

/** The language a URL asks for, or null when it asks for none (or for one that is not offered). */
export function localeFromHref(href: string): Locale | null {
  try {
    const v = new URL(href).searchParams.get(LOCALE_PARAM);
    return isLocale(v) ? v : null;
  } catch { return null; }
}

/** Is this address one of ours, so a language can be carried onto it? */
export function isVraelisHost(hostname: string, current: string): boolean {
  return hostname === current || hostname === "vraelis.com" || hostname.endsWith(".vraelis.com");
}
