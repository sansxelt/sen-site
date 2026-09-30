"use client";

// The current language in the browser, as one small store every component reads from, so the switcher in
// the footer and the switcher in the console are the same switch. See lib/i18n/locales.ts for how the
// choice travels and when it is remembered.
import { useSyncExternalStore } from "react";
import {
  DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALE_STORAGE_KEY, hrefWithLocale, isLocale, localeFromHref,
  type Locale,
} from "./locales";
// TEMPORARY until lib/privacy-choice.ts (the consent work) merges: the same reading of the same cookie.
const PRIVACY_CHANGE_EVENT = "vraelis:privacy-change";
function preferencesAllowed(): boolean {
  try {
    if ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true) return false;
    const v = document.cookie.split(";").map((p) => p.trim()).find((p) => p.startsWith("vraelis_privacy="))?.split("=")[1] ?? "";
    return v.startsWith("v1.") && v.split(".").includes("preferences");
  } catch { return false; }
}
function privacyCookieDomain(hostname: string): string | null {
  const h = (hostname || "").toLowerCase().replace(/\.$/, "");
  return h === "vraelis.com" || h.endsWith(".vraelis.com") ? ".vraelis.com" : null;
}

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

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Allowing preference storage later can reveal a remembered language; refresh the snapshot then.
  const onPrivacy = () => { const next = readLocale(); if (next !== snapshot) { snapshot = next; emit(); } };
  if (listeners.size === 1) window.addEventListener(PRIVACY_CHANGE_EVENT, onPrivacy);
  return () => { listeners.delete(listener); if (listeners.size === 0) window.removeEventListener(PRIVACY_CHANGE_EVENT, onPrivacy); };
}

/** Remembers the language, but only where the person allowed preference storage. */
function remember(locale: Locale) {
  if (!preferencesAllowed()) return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    const domain = privacyCookieDomain(location.hostname);
    document.cookie = [
      `${LOCALE_COOKIE}=${locale}`, `Max-Age=${LOCALE_COOKIE_MAX_AGE}`, "Path=/", "SameSite=Lax",
      domain ? `Domain=${domain}` : "", location.protocol === "https:" ? "Secure" : "",
    ].filter(Boolean).join("; ");
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
