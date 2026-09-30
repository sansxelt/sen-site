"use client";

// THE PAGE TRANSLATOR. Mounted once in the root layout, so it covers the site, the docs, sign-in and the
// console alike. Ported from Overlym (components/language-controller.tsx there), which has run it in
// production across its site and app.
//
// Every page renders in English. When another language is chosen this walks the text on the page, looks
// each piece up in public/locales/<code>.json by its English text, and swaps it in place, keeping the
// original so switching back (or React re-rendering the node) is exact. aria-label, title and placeholder
// are translated the same way. Then it watches for anything React adds or changes and translates only
// that, so a replaying run or a menu opening costs a few nodes, not the whole page.
//
// NOT TRANSLATED: code and terminal text, form inputs, anything marked [data-no-translate] (the legal
// documents, whose English text is the one that applies, and user content such as names and URLs where a
// component marks it), and the brand names below. A string with no translation stays English.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LOCALES, hrefWithLocale, isVraelisHost, localeFromHref, type Locale } from "@/lib/i18n/locales";
import { useLocale } from "@/lib/i18n/client";

type Catalogue = Record<string, string>;
type TextRecord = { source: string; lead: string; trail: string; applied: string };

const SKIP = "[data-no-translate],input,textarea,select,script,style,noscript,code,pre,kbd,samp,[contenteditable='true']";
const ATTRS = ["aria-label", "title", "placeholder"] as const;
const PROTECTED = new Set(["Vraelis", "Reddit", "ByteDance", "TikTok", "GitHub", "Google", "Vercel", "Stripe", "Supabase", "Sentry", "Slack", "MCP", "CLI", "API"]);

const texts = new WeakMap<Text, TextRecord>();
const attrs = new WeakMap<Element, Map<string, { source: string; applied: string }>>();
const catalogues = new Map<Locale, Promise<Catalogue>>();

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const skipped = (el: Element | null) => !!el?.closest(SKIP);

function load(locale: Locale): Promise<Catalogue> {
  if (locale === "en") return Promise.resolve({});
  let p = catalogues.get(locale);
  if (!p) {
    p = fetch(`/locales/${locale}.json`, { cache: "force-cache" })
      .then((r) => (r.ok ? (r.json() as Promise<Catalogue>) : {}))
      .catch(() => ({}));
    catalogues.set(locale, p);
  }
  return p;
}

function lookup(source: string, cat: Catalogue, locale: Locale): string {
  if (locale === "en" || PROTECTED.has(source)) return source;
  return cat[source] ?? source;
}

function translateText(node: Text, cat: Catalogue, locale: Locale) {
  if (skipped(node.parentElement)) return;
  const current = norm(node.data);
  let rec = texts.get(node);
  if (!rec || current !== rec.applied) {
    // First sight of this node, or React wrote new English into it since we last translated it.
    if (!current) return;
    rec = { source: current, lead: node.data.match(/^\s*/)?.[0] ?? "", trail: node.data.match(/\s*$/)?.[0] ?? "", applied: current };
    texts.set(node, rec);
  }
  const next = lookup(rec.source, cat, locale);
  rec.applied = next;
  const data = rec.lead + next + rec.trail;
  if (node.data !== data) node.data = data;
}

function translateAttrs(el: Element, cat: Catalogue, locale: Locale) {
  if (skipped(el)) return;
  let map = attrs.get(el);
  for (const a of ATTRS) {
    const current = el.getAttribute(a);
    if (!current) continue;
    if (!map) { map = new Map(); attrs.set(el, map); }
    let rec = map.get(a);
    if (!rec || current !== rec.applied) { rec = { source: norm(current), applied: current }; map.set(a, rec); }
    const next = lookup(rec.source, cat, locale);
    rec.applied = next;
    if (current !== next) el.setAttribute(a, next);
  }
}

function translateTree(root: Node, cat: Catalogue, locale: Locale) {
  if (root.nodeType === Node.TEXT_NODE) { translateText(root as Text, cat, locale); return; }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) {
    if (skipped(root as Element)) return;
    translateAttrs(root as Element, cat, locale);
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) => (n.nodeType === Node.ELEMENT_NODE && (n as Element).matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const found: Node[] = [];
  while (walker.nextNode()) found.push(walker.currentNode);
  for (const n of found) {
    if (n.nodeType === Node.TEXT_NODE) translateText(n as Text, cat, locale);
    else translateAttrs(n as Element, cat, locale);
  }
}

let titleSource = "";
let titleApplied = "";
function translateTitle(cat: Catalogue, locale: Locale) {
  if (!document.title) return;
  if (document.title !== titleApplied) titleSource = document.title;
  const next = titleSource.split(" | ").map((part) => lookup(part.trim(), cat, locale)).join(" | ");
  titleApplied = next;
  if (document.title !== next) document.title = next;
}

/** Carries the language onto a link to one of our pages as it is followed, so it survives navigation
 *  (and the hop to app.vraelis.com) even when nothing is stored. */
function carry(locale: Locale, target: EventTarget | null) {
  const link = target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
  if (!link || link.hasAttribute("download")) return null;
  let url: URL;
  try { url = new URL(link.href, location.href); } catch { return null; }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || !isVraelisHost(url.hostname, location.hostname)) return null;
  if ((localeFromHref(url.href) ?? "en") === locale) return { link, url };
  link.href = hrefWithLocale(url.href, locale);
  return { link, url: new URL(link.href) };
}

export function LanguageController() {
  const locale = useLocale();
  const router = useRouter();

  useEffect(() => { document.documentElement.lang = LOCALES[locale].htmlLang; }, [locale]);

  useEffect(() => {
    let disposed = false;
    let observer: MutationObserver | undefined;
    void load(locale).then((cat) => {
      if (disposed) return;
      translateTree(document.body, cat, locale);
      translateTitle(cat, locale);
      if (locale === "en") return; // back to English: everything is restored, nothing new needs watching
      observer = new MutationObserver((records) => {
        for (const r of records) {
          if (r.type === "characterData") translateText(r.target as Text, cat, locale);
          else if (r.type === "attributes") translateAttrs(r.target as Element, cat, locale);
          else r.addedNodes.forEach((n) => translateTree(n, cat, locale));
        }
        translateTitle(cat, locale);
        observer?.takeRecords(); // our own writes, already handled
      });
      observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
    });

    // Next's <Link> navigates from its href prop, not from the rewritten attribute, so a click on an in-app
    // link is routed here with the language on it. Anything else (new tab, another host) follows the
    // rewritten href natively.
    const onPointerDown = (e: Event) => { if (locale !== "en") carry(locale, e.target); };
    const onClick = (e: MouseEvent) => {
      if (locale === "en") return;
      const hit = carry(locale, e.target);
      if (!hit || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const { link, url } = hit;
      if (url.origin !== location.origin || (link.target && link.target.toLowerCase() !== "_self")) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // an anchor on this page
      // A route handler (an API route, a download) answers the router with something that is not a page,
      // and Next then loads it as a normal navigation, so pushing every same-origin link here is safe.
      e.preventDefault();
      router.push(`${url.pathname}${url.search}${url.hash}`);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onClick, true);
    return () => {
      disposed = true;
      observer?.disconnect();
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [locale, router]);

  return null;
}
