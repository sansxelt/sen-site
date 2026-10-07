"use client";

// The current language in the browser, as one small store every component reads from, so the switcher in
// the footer and the switcher in the console are the same switch. See lib/i18n/locales.ts for how the
// choice travels and when it is remembered.
import { useSyncExternalStore } from "react";
import {
  DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, hrefWithLocale, isLocale, localeFromHref,
  type Locale,
} from "./locales";
import { PRIVACY_CHANGE_EVENT, preferencesAllowed, privacyCookieDomain } from "@/lib/privacy-choice";

// Listed under Preferences in lib/privacy-choice.ts and on /cookies, which clear and describe it.
const LOCALE_STORAGE_KEY = "vraelis-locale";

function readStored(): Locale | null {
  if (!preferencesAllowed()) return null;
  try {
    const fromCookie = document.cookie.split(";").map((p) => p.trim()).find((p) => p.startsWith(`${LOCALE_COOKIE}=`))?.split("=")[1];
    if (isLocale(fromCookie)) return fromCookie;
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(saved) ? saved : null;
  } catch { return null; }
}

/** The URL first (it is what a shared link carries), then what this browser remembers, then English. */
export function readLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  return localeFromHref(window.location.href) ?? readStored() ?? DEFAULT_LOCALE;
}

let snapshot: Locale = typeof window === "undefined" ? DEFAULT_LOCALE : readLocale();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function refreshLocale() {
  const next = readLocale();
  if (next !== snapshot) { snapshot = next; emit(); }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Allowing preference storage later can reveal a remembered language; refresh the snapshot then.
  if (listeners.size === 1) {
    window.addEventListener(PRIVACY_CHANGE_EVENT, refreshLocale);
    window.addEventListener("popstate", refreshLocale);
    window.addEventListener("storage", refreshLocale);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener(PRIVACY_CHANGE_EVENT, refreshLocale);
      window.removeEventListener("popstate", refreshLocale);
      window.removeEventListener("storage", refreshLocale);
    }
  };
}

/** Remembers the language, but only where the person allowed preference storage. */
function remember(locale: Locale) {
  if (!preferencesAllowed()) return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    const domain = privacyCookieDomain(location.hostname);
    // Spelled out (it is LOCALE_COOKIE) so scripts/privacy-consent-verify.ts can find it in the policy.
    document.cookie = `vraelis_language=${locale}; Max-Age=${LOCALE_COOKIE_MAX_AGE}; Path=/; SameSite=Lax${domain ? `; Domain=${domain}` : ""}${location.protocol === "https:" ? "; Secure" : ""}`;
  } catch { /* storage refused: the URL still carries the language on this visit */ }
}

export function setLocale(next: Locale) {
  snapshot = next;
  // null, as Next's docs do it: the router syncs its URL from a native replaceState, and handing Next's own
  // history state back would mark this as its internal update and leave that URL stale (Overlym found this).
  window.history.replaceState(null, "", hrefWithLocale(window.location.href, next));
  remember(next);
  emit();
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, () => snapshot, () => DEFAULT_LOCALE);
}

/** For links rendered outside React's reach (the controller rewrites them on the way out). */
export function currentLocale(): Locale { return snapshot; }
