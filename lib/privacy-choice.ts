// THE PRIVACY CHOICE, IN ONE PLACE.
//
// Every surface (the site, the docs, sign-in and /auth, the console on app.vraelis.com) asks the same
// question through app/_components/privacy-choices.tsx, and every piece of code that stores or sends
// something optional asks THIS file whether it may. Nothing else reads the cookie directly, so the answer
// cannot be decided two different ways.
//
// WHAT IS STORED. One first-party cookie, `vraelis_privacy`, holding a version and the optional categories
// the person turned on:
//
//   vraelis_privacy=v1.essential                          nothing optional
//   vraelis_privacy=v1.preferences                        one category
//   vraelis_privacy=v1.preferences.analytics.advertising  all three, always in this order
//
// 180 days, SameSite=Lax, Secure on https, and Domain=.vraelis.com on vraelis.com and its subdomains so a
// choice made on the site holds on app.vraelis.com and the other way round. Anything that does not parse
// exactly (an unknown version, an unknown or repeated category) reads as NO choice, so the question is asked
// again rather than guessed at. Bumping the version is how a future change to the categories re-asks.
//
// GLOBAL PRIVACY CONTROL. A browser sending GPC (navigator.globalPrivacyControl in the page, the Sec-GPC: 1
// header on the server) is treated as an opt out of every optional category for as long as it is on,
// whatever the cookie says. Essential storage is unaffected: it is what signing in and security need.
//
// This module is imported by client components AND by server code (lib/analytics.ts), so the pure functions
// at the top touch no browser globals, and the browser helpers below them check before they touch any.

export const PRIVACY_COOKIE = "vraelis_privacy";
export const PRIVACY_COOKIE_VERSION = "v1";
/** 180 days, in seconds. The choice is asked again after this, which is the usual shelf life of consent. */
export const PRIVACY_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

export const OPTIONAL_CATEGORIES = ["preferences", "analytics", "advertising"] as const;
export type OptionalCategory = (typeof OPTIONAL_CATEGORIES)[number];
export type PrivacyChoice = Readonly<Record<OptionalCategory, boolean>>;

export const ESSENTIAL_ONLY: PrivacyChoice = Object.freeze({ preferences: false, analytics: false, advertising: false });

/** Fired on window to open the dialog from anywhere (a footer link, the console sidebar). */
export const PRIVACY_OPEN_EVENT = "vraelis:privacy-open";
/** Fired on window after a choice is saved, so gated code can start or stop without a reload. */
export const PRIVACY_CHANGE_EVENT = "vraelis:privacy-change";

/* ── WHAT EACH OPTIONAL CATEGORY OWNS IN THIS BROWSER ─────────────────────────────────────────────────────
 *
 * Turning a category off removes what it had stored, so "Essential only" means that from the moment it is
 * pressed and not only for whatever is written next. Code that starts storing something optional adds its
 * key here, in the category the cookie policy lists it under (app/_content/legal.tsx), and checks the
 * matching *Allowed() helper before writing it. scripts/privacy-consent-verify.ts holds the two lists and
 * the policy to each other.
 *
 * The language switcher is expected to be the next entry under preferences. */
export const PREFERENCE_LOCAL_KEYS: readonly string[] = [
  "vraelis:scratchpad-open", // the console notes panel: open or closed
  "vraelis:scratchpad-view", // the console notes panel: docked, floating or expanded
];
/** Preference cookies (none yet). Cleared host-only and on .vraelis.com, since either may have been set. */
export const PREFERENCE_COOKIE_NAMES: readonly string[] = [];
export const ANALYTICS_SESSION_KEYS: readonly string[] = [
  "v6.visited", // marks that this tab already counted its one anonymous visit (app/dev-preview/v6/_system/shell.tsx)
];

/* ── PURE: SAFE ON THE SERVER AND IN TESTS ────────────────────────────────────────────────────────────── */

export function serializePrivacyChoice(choice: PrivacyChoice): string {
  const on = OPTIONAL_CATEGORIES.filter((c) => choice[c] === true);
  return `${PRIVACY_COOKIE_VERSION}.${on.length ? on.join(".") : "essential"}`;
}

/** A cookie value to a choice, or null when there is no valid choice (which means: ask). */
export function parsePrivacyChoice(value: string | null | undefined): PrivacyChoice | null {
  if (!value) return null;
  let v: string;
  try { v = decodeURIComponent(value.trim()); } catch { return null; }
  const [version, ...parts] = v.split(".");
  if (version !== PRIVACY_COOKIE_VERSION || parts.length === 0) return null;
  if (parts.length === 1 && parts[0] === "essential") return ESSENTIAL_ONLY;
  const out: Record<OptionalCategory, boolean> = { preferences: false, analytics: false, advertising: false };
  for (const p of parts) {
    if (!(OPTIONAL_CATEGORIES as readonly string[]).includes(p)) return null;
    const cat = p as OptionalCategory;
    if (out[cat]) return null; // a repeated category is not something this code ever wrote
    out[cat] = true;
  }
  return out;
}

/** Finds and parses the choice in a Cookie header (or document.cookie). */
export function privacyChoiceFromCookieHeader(header: string | null | undefined): PrivacyChoice | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === PRIVACY_COOKIE) return parsePrivacyChoice(part.slice(eq + 1));
  }
  return null;
}

/** ".vraelis.com" for vraelis.com and every subdomain, so the apex and the app share one choice. Anywhere
 *  else (localhost, a preview deployment) the cookie stays host-only. */
export function privacyCookieDomain(hostname: string): string | null {
  const h = (hostname || "").toLowerCase().replace(/\.$/, "");
  return h === "vraelis.com" || h.endsWith(".vraelis.com") ? ".vraelis.com" : null;
}

/** The full cookie string for document.cookie. `maxAge` 0 deletes it. */
export function privacyCookieString(
  choice: PrivacyChoice,
  where: { hostname: string; protocol: string },
  maxAge: number = PRIVACY_COOKIE_MAX_AGE,
): string {
  const domain = privacyCookieDomain(where.hostname);
  return [
    `${PRIVACY_COOKIE}=${serializePrivacyChoice(choice)}`,
    `Max-Age=${maxAge}`,
    "Path=/",
    "SameSite=Lax",
    domain ? `Domain=${domain}` : "",
    where.protocol === "https:" ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

/* THE PAGES THAT MAY BE READ BEFORE CHOOSING.
 *
 * The founder's rule: someone may read the privacy policy without choosing, and anywhere else they must
 * choose first. These are the documents a person needs in order to make that choice (or to decide whether
 * to use the product at all), so on them the question is a bar at the foot of the page rather than a
 * dialog in front of it. Everything else, including sign-in and the console, gets the dialog.
 *
 * Both spellings count: the clean public path and the /dev-preview/v6 tree it is served from. */
export const LEGAL_PATHS = [
  "/privacy", "/cookies", "/terms", "/acceptable-use",
  "/subprocessors", "/data-rights", "/security", "/limitations",
] as const;
const V6_TREE = "/dev-preview/v6";

export function isLegalPath(pathname: string | null | undefined): boolean {
  let p = (pathname || "/").split(/[?#]/)[0];
  if (p.length > 1) p = p.replace(/\/+$/, "") || "/";
  if (p.startsWith(V6_TREE + "/")) p = p.slice(V6_TREE.length);
  return (LEGAL_PATHS as readonly string[]).includes(p);
}

/** The Sec-GPC request header, as the spec defines it: the value "1" and nothing else. */
export function gpcHeaderOptsOut(value: string | null | undefined): boolean {
  return (value ?? "").trim() === "1";
}

/** What is actually allowed: no choice yet means essential only, and GPC turns every optional category off. */
export function effectivePrivacyChoice(saved: PrivacyChoice | null, gpc: boolean): PrivacyChoice {
  if (!saved || gpc) return ESSENTIAL_ONLY;
  return saved;
}

/** Server side: may this request's data go to an advertising platform? Needs the person's own Advertising
 *  choice in the cookie AND no GPC header. Anything missing or unreadable is a no. */
export function advertisingConsentFromRequest(cookieHeader: string | null | undefined, secGpc: string | null | undefined): boolean {
  return effectivePrivacyChoice(privacyChoiceFromCookieHeader(cookieHeader), gpcHeaderOptsOut(secGpc)).advertising;
}

/* ── BROWSER HELPERS ──────────────────────────────────────────────────────────────────────────────────── */

// Only used when the browser refused to store the cookie (cookies blocked). The person still answered, so
// they are not asked again on every soft navigation of this page session; optional storage stays off,
// because a choice that cannot be remembered cannot be relied on either.
let unpersistedChoice: PrivacyChoice | null = null;

export function browserSendsGpc(): boolean {
  if (typeof navigator === "undefined") return false;
  return (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}

/** The saved choice in this browser, or null when the person has not chosen yet. */
export function readPrivacyChoice(): PrivacyChoice | null {
  if (typeof document === "undefined") return null;
  let saved: PrivacyChoice | null = null;
  try { saved = privacyChoiceFromCookieHeader(document.cookie); } catch { /* cookies unreadable */ }
  return saved ?? unpersistedChoice;
}

/** The choice as it applies right now in this browser, GPC included. False everywhere on the server. */
export function currentPrivacyChoice(): PrivacyChoice {
  return effectivePrivacyChoice(readPrivacyChoice(), browserSendsGpc());
}

/** May this browser remember display choices such as language? Ask before every write, not once at load:
 *  the answer can change while the page is open. */
export function preferencesAllowed(): boolean { return currentPrivacyChoice().preferences; }
/** May this browser send performance measurements and the anonymous visit count? */
export function analyticsAllowed(): boolean { return currentPrivacyChoice().analytics; }
/** May this person's sign-up be reported to an advertising platform? (Decided server side; see lib/analytics.ts.) */
export function advertisingAllowed(): boolean { return currentPrivacyChoice().advertising; }

/** Removes whatever the categories that are now off had stored. */
export function clearDeclinedStorage(effective: PrivacyChoice): void {
  if (typeof window === "undefined") return;
  try {
    if (!effective.preferences) {
      for (const k of PREFERENCE_LOCAL_KEYS) localStorage.removeItem(k);
      const domain = privacyCookieDomain(location.hostname);
      for (const name of PREFERENCE_COOKIE_NAMES) {
        document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
        if (domain) document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax; Domain=${domain}`;
      }
    }
    if (!effective.analytics) for (const k of ANALYTICS_SESSION_KEYS) sessionStorage.removeItem(k);
  } catch { /* storage disabled: nothing was stored either */ }
}

/** Saves the choice and tells the page. Returns whether the browser actually kept the cookie. */
export function savePrivacyChoice(choice: PrivacyChoice): boolean {
  const clean: PrivacyChoice = { preferences: !!choice.preferences, analytics: !!choice.analytics, advertising: !!choice.advertising };
  try { document.cookie = privacyCookieString(clean, location); } catch { /* blocked; checked below */ }
  let persisted = false;
  try {
    const back = privacyChoiceFromCookieHeader(document.cookie);
    persisted = !!back && serializePrivacyChoice(back) === serializePrivacyChoice(clean);
  } catch { /* stays false */ }
  unpersistedChoice = persisted ? null : ESSENTIAL_ONLY;
  clearDeclinedStorage(effectivePrivacyChoice(persisted ? clean : ESSENTIAL_ONLY, browserSendsGpc()));
  window.dispatchEvent(new Event(PRIVACY_CHANGE_EVENT));
  return persisted;
}

/** Opens the privacy choices dialog. What every "Privacy choices" control calls. */
export function openPrivacyChoices(): void {
  window.dispatchEvent(new Event(PRIVACY_OPEN_EVENT));
}

/** Runs `cb` whenever the choice changes in this page. Returns the unsubscribe. */
export function onPrivacyChoiceChange(cb: () => void): () => void {
  window.addEventListener(PRIVACY_CHANGE_EVENT, cb);
  return () => window.removeEventListener(PRIVACY_CHANGE_EVENT, cb);
}
