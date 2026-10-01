// PRIVACY CHOICES: the cookie format, where the question blocks and where it does not, Global Privacy
// Control, and the static wiring that makes the rest of it true: the dialog mounted once for every surface,
// every optional script and storage key behind its category, and the cookie policy listing what the code
// actually sets.
//
// The founder's rule, 2026-09-30: people may read the privacy policy without choosing, but anywhere else,
// the site, the docs, sign-in and the console, they must choose first. The pure half of lib/privacy-choice.ts
// is exercised directly; the browser half runs against a small fake document (cookie jar, storage,
// navigator) because what matters there is exactly which cookie string gets written.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  ANALYTICS_SESSION_KEYS, ESSENTIAL_ONLY, LEGAL_PATHS, OPTIONAL_CATEGORIES, PREFERENCE_LOCAL_KEYS, PRIVACY_COOKIE,
  PRIVACY_COOKIE_MAX_AGE, advertisingConsentFromRequest, effectivePrivacyChoice, gpcHeaderOptsOut, isLegalPath,
  parsePrivacyChoice, privacyChoiceFromCookieHeader, privacyCookieDomain, privacyCookieString,
  serializePrivacyChoice, type PrivacyChoice,
} from "../lib/privacy-choice";
import * as lib from "../lib/privacy-choice";
import { COOKIES, STORAGE } from "../app/_content/legal";
import { V6_EXACT } from "../proxy";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  (${d})` : ""}`); }
};
const read = (p: string) => readFileSync(p, "utf8");
// Comments removed, so a check never passes on a sentence that only describes the code.
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const choice = (preferences: boolean, analytics: boolean, advertising: boolean): PrivacyChoice => ({ preferences, analytics, advertising });

console.log("── the cookie value round-trips, in one canonical spelling ──");
{
  ok("nothing optional is v1.essential", serializePrivacyChoice(ESSENTIAL_ONLY) === "v1.essential");
  ok("one category is v1.<category>", serializePrivacyChoice(choice(true, false, false)) === "v1.preferences");
  ok("all three are written in a fixed order", serializePrivacyChoice(choice(true, true, true)) === "v1.preferences.analytics.advertising");
  let all = true;
  for (let i = 0; i < 8; i++) {
    const c = choice(!!(i & 1), !!(i & 2), !!(i & 4));
    const back = parsePrivacyChoice(serializePrivacyChoice(c));
    if (!back || OPTIONAL_CATEGORIES.some((k) => back[k] !== c[k])) all = false;
  }
  ok("every one of the 8 combinations parses back to itself", all);
  ok("a URL-encoded value still parses", parsePrivacyChoice(encodeURIComponent("v1.analytics"))?.analytics === true);
  for (const bad of ["", "v1", "v1.", "v2.essential", "v1.everything", "v1.analytics.analytics", "v1.essential.analytics", "true", "%E0%A4%A"]) {
    ok(`"${bad}" is NO choice (asked again), never a guess`, parsePrivacyChoice(bad) === null);
  }
  ok("found among other cookies in a Cookie header",
    privacyChoiceFromCookieHeader(`a=1; ${PRIVACY_COOKIE}=v1.preferences.advertising; b=2`)?.advertising === true);
  ok("a cookie whose name merely contains it does not count",
    privacyChoiceFromCookieHeader(`x${PRIVACY_COOKIE}=v1.analytics`) === null);
  ok("no header is no choice", privacyChoiceFromCookieHeader(undefined) === null && privacyChoiceFromCookieHeader("") === null);
}

console.log("\n── the cookie string: 6 months, Lax, Secure on https, shared across vraelis.com ──");
{
  const prod = privacyCookieString(choice(false, true, false), { hostname: "vraelis.com", protocol: "https:" });
  const app = privacyCookieString(ESSENTIAL_ONLY, { hostname: "app.vraelis.com", protocol: "https:" });
  const local = privacyCookieString(ESSENTIAL_ONLY, { hostname: "localhost", protocol: "http:" });
  ok("the name and value lead", prod.startsWith(`${PRIVACY_COOKIE}=v1.analytics;`));
  ok("six months (180 days)", PRIVACY_COOKIE_MAX_AGE === 15552000 && prod.includes("Max-Age=15552000"));
  ok("SameSite=Lax and Path=/", prod.includes("SameSite=Lax") && prod.includes("Path=/"));
  ok("apex gets Domain=.vraelis.com", prod.includes("Domain=.vraelis.com"));
  ok("app.vraelis.com gets the SAME domain, so the two share one choice", app.includes("Domain=.vraelis.com"));
  ok("Secure on https", prod.includes("Secure"));
  ok("localhost: host-only and not Secure (it would not be stored over http)", !local.includes("Domain=") && !local.includes("Secure"));
  ok("a lookalike host does not get the shared domain", privacyCookieDomain("vraelis.com.evil.io") === null && privacyCookieDomain("notvraelis.com") === null);
  ok("a trailing-dot host is still vraelis.com", privacyCookieDomain("vraelis.com.") === ".vraelis.com");
}

console.log("\n── where the question blocks, and where it waits ──");
{
  const legal = [...LEGAL_PATHS];
  ok("the legal pages are the eight the founder named",
    ["/privacy", "/cookies", "/terms", "/acceptable-use", "/subprocessors", "/data-rights", "/security", "/limitations"].every((p) => legal.includes(p as never)) && legal.length === 8);
  for (const p of legal) {
    ok(`${p} is readable first (bar, not dialog)`, isLegalPath(p) && isLegalPath(`/dev-preview/v6${p}`) && isLegalPath(`${p}/`) && isLegalPath(`${p}?x=1#y`));
  }
  for (const p of ["/", "/pricing", "/docs", "/docs/privacy", "/signin", "/signup", "/auth/verify-email", "/app", "/systems", "/dev-preview/v6",
    "/dev-preview/v6/pricing", "/privacy-policy", "/privacyx", "/rank/privacy", "/refunds", "/trademark", "/contact", "/Privacy"]) {
    ok(`${p} blocks until a choice exists`, !isLegalPath(p));
  }
}

console.log("\n── Global Privacy Control is an opt out of every optional category ──");
{
  const all = choice(true, true, true);
  ok("GPC turns a saved all-on choice into essential only", serializePrivacyChoice(effectivePrivacyChoice(all, true)) === "v1.essential");
  ok("no choice yet is essential only, GPC or not", serializePrivacyChoice(effectivePrivacyChoice(null, false)) === "v1.essential");
  ok("without GPC the saved choice stands", effectivePrivacyChoice(all, false).analytics === true);
  ok("Sec-GPC: 1 opts out", gpcHeaderOptsOut("1") && gpcHeaderOptsOut(" 1 "));
  ok("anything else does not", !gpcHeaderOptsOut("0") && !gpcHeaderOptsOut(null) && !gpcHeaderOptsOut("true"));
  const adv = `${PRIVACY_COOKIE}=v1.advertising`;
  ok("server: advertising choice and no GPC may report", advertisingConsentFromRequest(adv, null) === true);
  ok("server: the same choice WITH Sec-GPC: 1 may not", advertisingConsentFromRequest(adv, "1") === false);
  ok("server: no cookie may not", advertisingConsentFromRequest(null, null) === false && advertisingConsentFromRequest("a=b", null) === false);
  ok("server: analytics and preferences do not imply advertising",
    advertisingConsentFromRequest(`${PRIVACY_COOKIE}=v1.preferences.analytics`, null) === false);
}

console.log("\n── in a browser: what saving writes, and what GPC and a refused cookie do ──");
{
  // A cookie jar that behaves like document.cookie for what this module does: set name=value, drop on
  // Max-Age=0, read back "a=1; b=2". It records every raw string so the attributes can be checked.
  const jar = new Map<string, string>();
  const written: string[] = [];
  let refuse = false;
  const store = () => { const m = new Map<string, string>(); return {
    getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k), has: (k: string) => m.has(k) }; };
  const local = store(), session = store();
  const events: string[] = [];
  const g = globalThis as Record<string, unknown>;
  g.document = {
    get cookie() { return [...jar].map(([k, v]) => `${k}=${v}`).join("; "); },
    set cookie(s: string) {
      written.push(s);
      if (refuse) return;
      const [pair] = s.split(";"); const eq = pair.indexOf("=");
      const name = pair.slice(0, eq).trim(), value = pair.slice(eq + 1).trim();
      if (/Max-Age=0\b/.test(s)) jar.delete(name); else jar.set(name, value);
    },
  };
  g.location = { hostname: "app.vraelis.com", protocol: "https:" };
  g.localStorage = local; g.sessionStorage = session;
  g.window = { dispatchEvent: (e: { type: string }) => { events.push(e.type); return true; }, addEventListener() {}, removeEventListener() {} };
  g.Event = class { type: string; constructor(t: string) { this.type = t; } };
  const nav = { globalPrivacyControl: false as boolean | undefined };
  Object.defineProperty(globalThis, "navigator", { value: nav, configurable: true, writable: true });

  // The browser helpers read document, navigator and storage at call time, so the fakes above apply to the
  // module already imported at the top.
  ok("before choosing: no choice, nothing optional allowed",
    lib.readPrivacyChoice() === null && !lib.preferencesAllowed() && !lib.analyticsAllowed() && !lib.advertisingAllowed());

  local.setItem("vraelis:scratchpad-open", "1"); local.setItem("vraelis:scratchpad-view", "zoom"); local.setItem("vraelis:scratchpad", "my note");
  session.setItem("v6.visited", "1");
  const kept = lib.savePrivacyChoice(choice(false, true, false));
  ok("saving reports that the browser kept it", kept === true);
  // The consent cookie is not always the last write: with Preferences off, the save also clears the
  // preference cookies (the language switch's vraelis_language), so look for the consent cookie itself.
  const consentWrite = written.filter((w) => w.startsWith("vraelis_privacy=")).at(-1);
  ok("the written cookie carries every attribute", /^vraelis_privacy=v1\.analytics; Max-Age=15552000; Path=\/; SameSite=Lax; Domain=\.vraelis\.com; Secure$/.test(consentWrite ?? ""), consentWrite);
  ok("  and Preferences off clears the language cookie on both hosts", written.some((w) => /^vraelis_language=; Max-Age=0; Path=\/; SameSite=Lax; Domain=\.vraelis\.com/.test(w)));
  ok("the page is told (so Speed Insights and the visit count can start)", events.includes(lib.PRIVACY_CHANGE_EVENT));
  ok("analytics on, preferences and advertising off", lib.analyticsAllowed() && !lib.preferencesAllowed() && !lib.advertisingAllowed());
  ok("preferences off removed the panel's window state", !local.has("vraelis:scratchpad-open") && !local.has("vraelis:scratchpad-view"));
  ok("  and left the note itself, which is essential", local.getItem("vraelis:scratchpad") === "my note");
  ok("analytics on kept the visit marker", session.has("v6.visited"));

  lib.savePrivacyChoice(ESSENTIAL_ONLY);
  ok("essential only removes the analytics marker too", !session.has("v6.visited") && !lib.analyticsAllowed());

  lib.savePrivacyChoice(choice(true, true, true));
  nav.globalPrivacyControl = true;
  ok("GPC in the browser: a saved all-on choice allows nothing optional",
    lib.browserSendsGpc() && !lib.preferencesAllowed() && !lib.analyticsAllowed() && !lib.advertisingAllowed());
  ok("  but the saved choice itself is untouched (it applies again when GPC is off)", lib.readPrivacyChoice()?.advertising === true);
  nav.globalPrivacyControl = false;
  ok("GPC off: the saved choice applies again", lib.preferencesAllowed() && lib.analyticsAllowed());

  jar.clear(); refuse = true;
  const kept2 = lib.savePrivacyChoice(choice(true, true, true));
  ok("cookies blocked: saving reports it was not kept", kept2 === false);
  ok("  the person is not re-asked on every soft navigation (answered for this page session)", lib.readPrivacyChoice() !== null);
  ok("  and nothing optional runs on a choice that could not be remembered", !lib.preferencesAllowed() && !lib.analyticsAllowed());
  refuse = false;
}

console.log("\n── mounted once, where it covers the site, the docs, sign-in, /auth and the console ──");
{
  const layout = code("app/layout.tsx");
  const curtainEnd = layout.indexOf("<StealthScreen />");
  const mount = layout.indexOf("<PrivacyChoices />");
  ok("the root layout mounts the dialog", mount !== -1 && layout.split("<PrivacyChoices />").length === 2);
  ok("  in the real branch, never on the stealth curtain", curtainEnd !== -1 && mount > curtainEnd && layout.indexOf("</html>") < mount);
  ok("  after the page itself, in the same body", layout.lastIndexOf("{children}") !== -1 && layout.lastIndexOf("{children}") < mount);
  // A second root layout (a route group with its own <html>) would be a surface this mount never reaches.
  const layouts: string[] = [];
  const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (n === "layout.tsx") layouts.push(p); } };
  walk("app");
  const withHtml = layouts.filter((p) => /<html\b/.test(code(p)));
  ok("app/layout.tsx is the only layout that renders <html>, so every route is under the mount",
    withHtml.length === 1 && withHtml[0].replace(/\\/g, "/") === "app/layout.tsx", withHtml.join(", "));
  for (const [surface, file] of [
    ["the site and the docs", "app/dev-preview/v6/layout.tsx"], ["sign-in", "app/signin/layout.tsx"],
    ["the /auth screens", "app/auth/layout.tsx"], ["the console", "app/rank/app/layout.tsx"],
  ] as const) {
    ok(`${surface} render under the root layout (${file} exists and adds no <html>)`, existsSync(file) && !/<html\b/.test(code(file)));
  }
  const dlg = code("app/_components/privacy-choices.tsx");
  ok("the dialog is modal (showModal), so the page behind it is inert and focus stays inside", /\.showModal\(\)/.test(dlg));
  ok("Escape is refused while an answer is required", /onCancel=\{\(e\) => \{ if \(mustAnswer\(\)\) e\.preventDefault\(\); \}\}/.test(dlg));
  ok("a close without an answer reopens it (Chrome's second-Escape close)", /onClose=\{\(\) => \{\s*if \(mustAnswer\(\)\) \{ requestAnimationFrame\(\(\) => openDialog\(true\)\)/.test(dlg));
  ok("a backdrop click closes only an optional dialog", /if \(e\.target !== e\.currentTarget \|\| mustAnswer\(\)\) return;/.test(dlg));
  ok("there is no close button until the person may close it", /\{closable && \(\s*<button[^>]*vr-pc__x/.test(dlg));
  ok("the legal pages get the bar, not the dialog", /const showBar = ready && saved === null && legal;/.test(dlg) && /if \(!onLegal\) openDialog\(true\);/.test(dlg));
  const btns = [...dlg.matchAll(/<button type="button" className="([^"]+)" onClick=\{\(\) => save\(([^)]+)\)\}>([^<]+)<\/button>/g)];
  ok("both places offer exactly the two answers", btns.length === 4
    && btns.filter((b) => b[3] === "Essential only" && b[2] === "ESSENTIAL_ONLY").length === 2
    && btns.filter((b) => b[3] === "Save my choices" && b[2] === "draft").length === 2);
  ok("  with the SAME class, so refusing is exactly as easy as accepting", btns.every((b) => b[1] === "vr-pc__btn"));
  ok("every optional switch starts off", /useState<PrivacyChoice>\(ESSENTIAL_ONLY\)/.test(dlg));
  ok("GPC disables the switches and says so", /disabled=\{gpc\}/.test(dlg) && /Global Privacy Control/.test(dlg));
  ok("the dialog links the privacy policy and the cookie policy", /href=\{V6_PRIVACY\}/.test(dlg) && /href=\{COOKIES_PAGE\}/.test(dlg) && /`\$\{V6_BASE\}\/cookies`/.test(dlg));
}

console.log("\n── every surface has a way back to the choice ──");
{
  const close = code("app/dev-preview/v6/_system/close.tsx");
  ok("site footer: in the Trust column", /h === "Trust" && <PrivacyChoicesButton \/>/.test(close));
  ok("site footer: in the bottom legal row", /v6-foot2__legal[\s\S]*<PrivacyChoicesButton \/>/.test(close));
  ok("docs footer", /v6-docs__foot[\s\S]{0,600}<PrivacyChoicesButton \/>/.test(code("app/dev-preview/v6/_content/docs-ui.tsx")));
  ok("sign-in and /auth footer", /auth-split__foot[\s\S]{0,500}<PrivacyChoicesButton \/>/.test(code("app/_components/auth-frame.tsx")));
  const rank = code("app/rank/_components/rank-ui.tsx");
  ok("console sidebar foot (shared by the desktop sidebar and the phone drawer)", /function NavFoot[\s\S]{0,900}<PrivacyChoicesButton[^>]*>[\s\S]{0,120}Privacy choices<\/PrivacyChoicesButton>/.test(rank));
  ok("the control opens the dialog rather than navigating", /<button\b/.test(code("app/_components/privacy-choices-button.tsx")) && /openPrivacyChoices\(\)/.test(code("app/_components/privacy-choices-button.tsx")));
}

console.log("\n── nothing optional runs before its category is on ──");
{
  // The full inventory of client-side measurement and advertising code. Any new one fails here until it is
  // gated and added to the cookie policy.
  // Script hosts, SDK packages and call signatures, not bare product names: "amplitude" is a camera-drift
  // parameter here and PostHog is an integration a customer can connect, and neither is a tracker.
  const TRACKERS = /googletagmanager\.com|google-analytics\.com\/(g|analytics)|\bgtag\(|\bfbq\(|fbevents\.js|connect\.facebook\.net|posthog-js|posthog\.(init|capture)\(|cdn\.segment\.com|\banalytics\.(track|page|identify)\(|static\.hotjar\.com|clarity\.ms|plausible\.io|mixpanel\.(init|track)\(|mixpanel-browser|@amplitude\/|cdn\.amplitude\.com|redditstatic\.com|\brdt\(|snap\.licdn\.com|analytics\.tiktok\.com|\bttq\.|static\.ads-twitter\.com|\btwq\(|@vercel\/analytics/i;
  const offenders: string[] = [];
  const scan = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (n === "node_modules" || n.startsWith(".")) continue;
    if (statSync(p).isDirectory()) scan(p); else if (/\.(tsx?|jsx?)$/.test(n) && TRACKERS.test(code(p))) offenders.push(p); } };
  for (const d of ["app", "components", "lib"]) scan(d);
  ok("no advertising pixel or third-party analytics tag is loaded anywhere", offenders.length === 0, offenders.join(", "));

  const siUsers: string[] = [];
  const scanSi = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) scanSi(p); else if (/\.(tsx?|jsx?)$/.test(n) && /@vercel\/speed-insights/.test(code(p))) siUsers.push(p.replace(/\\/g, "/")); } };
  for (const d of ["app", "components", "lib"]) scanSi(d);
  ok("Vercel Speed Insights is imported in exactly one place, the consent gate", siUsers.length === 1 && siUsers[0] === "app/_components/consented-measurement.tsx", siUsers.join(", "));
  const cm = code("app/_components/consented-measurement.tsx");
  ok("  which renders it only once Analytics is allowed", /if \(!allowed\) return null;/.test(cm) && /setAllowed\(analyticsAllowed\(\)\)/.test(cm));
  ok("  and drops every send if Analytics is turned off after it loaded", /beforeSend=\{\(event\) => \(analyticsAllowed\(\) \? event : null\)\}/.test(cm));
  ok("the root layout no longer renders Speed Insights directly", !/<SpeedInsights\b/.test(code("app/layout.tsx")) && /<ConsentedMeasurement \/>/.test(code("app/layout.tsx")));

  const shell = code("app/dev-preview/v6/_system/shell.tsx");
  const beacon = shell.slice(shell.indexOf("function useVisitBeacon"), shell.indexOf("export function V6Shell"));
  ok("the visit count asks Analytics before storing or sending anything",
    /if \(done \|\| !analyticsAllowed\(\)\) return;/.test(beacon)
    && beacon.indexOf("analyticsAllowed()") < beacon.indexOf("sessionStorage") && beacon.indexOf("analyticsAllowed()") < beacon.indexOf("/api/v/funnel"));
  ok("  and sends when Analytics is turned on later, not only at load", /return onPrivacyChoiceChange\(send\);/.test(beacon));

  const an = code("lib/analytics.ts");
  const track = an.slice(an.indexOf("export async function trackServer"));
  ok("server conversions (Meta, GA4) need the request's own advertising consent",
    /advertisingConsentFromRequest\(h\.get\("cookie"\), h\.get\("sec-gpc"\)\)/.test(an)
    && /if \(!\(await consent\)\) return;/.test(track) && track.indexOf("await consent") < track.indexOf("sendMeta("));
  ok("  and anything unreadable is a no", /catch \{\s*return false;\s*\}/.test(an));

  const pad = code("app/rank/_components/scratchpad.tsx");
  ok("the notes panel's window state is written only with Preferences on",
    /if \(!ready \|\| !preferencesAllowed\(\)\) return;\s*try \{ localStorage\.setItem\(OPEN_KEY/.test(pad)
    && /if \(!ready \|\| !preferencesAllowed\(\)\) return;\s*try \{ localStorage\.setItem\(VIEW_KEY/.test(pad));
  ok("  and read only with Preferences on", /if \(preferencesAllowed\(\)\) \{\s*setOpen\(localStorage\.getItem\(OPEN_KEY\)/.test(pad));
  const keyOf = (name: string) => new RegExp(`const ${name} = "([^"]+)"`).exec(read("app/rank/_components/scratchpad.tsx"))?.[1];
  ok("  and both keys are the ones the dialog clears", [keyOf("OPEN_KEY"), keyOf("VIEW_KEY")].every((k) => !!k && PREFERENCE_LOCAL_KEYS.includes(k)));
}

console.log("\n── the cookie policy lists what the code sets ──");
{
  const names = COOKIES.flatMap((r) => r.name.split(/,\s*/));
  const listed = (n: string) => names.some((x) => x === n || (x.includes("<") && n.startsWith(x.slice(0, x.indexOf("<")))));
  // Every cookie name the code writes, discovered rather than remembered: literal and templated names in
  // cookies.set / response cookies and document.cookie, plus the named constants.
  const found = new Set<string>();
  const consts: Record<string, string> = {};
  const files: string[] = [];
  const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (/\.(tsx?)$/.test(n)) files.push(p); } };
  for (const d of ["app", "lib", "components"]) walk(d);
  files.push("auth.ts", "proxy.ts");
  for (const f of files) for (const m of read(f).matchAll(/export const ([A-Z_]*COOKIE[A-Z_]*) = "([^"]+)"/g)) consts[m[1]] = m[2];
  for (const f of files) {
    const s = code(f);
    for (const m of s.matchAll(/cookies\.set\(\s*(?:\{\s*name:\s*)?(?:"([^"]+)"|`([^`$]+)\$\{|([A-Z_]+COOKIE[A-Z_]*))/g)) found.add(m[1] ?? m[2] ?? consts[m[3]] ?? m[3]);
    for (const m of s.matchAll(/document\.cookie = `([a-z_]+)=/g)) found.add(m[1]);
    for (const m of s.matchAll(/pkceCookieName[^\n]*return `([a-z_]+)\$\{/g)) found.add(m[1]);
  }
  found.add(read("lib/preflight/oauth/pkce.ts").match(/return `(vr_pkce_)\$\{provider\}`/)?.[1] ?? "vr_pkce_(missing)");
  found.add(PRIVACY_COOKIE);
  // Not listed, with the reason. An entry here is a claim that the cookie is never set in production.
  const NOT_SET: Record<string, string> = {
    vr_cal_state: "retired lead-agent calendar connection; set only when GOOGLE_CALENDAR_CLIENT_ID is configured, and it is not",
  };
  for (const n of [...found].sort()) {
    if (NOT_SET[n]) { ok(`${n} is deliberately unlisted: ${NOT_SET[n]}`, true); continue; }
    ok(`cookie "${n}" is in the cookie policy`, listed(n));
  }
  ok("the Auth.js production cookies are listed", ["__Secure-authjs.session-token", "__Host-authjs.csrf-token", "__Secure-authjs.callback-url", "__Secure-authjs.pkce.code_verifier"].every(listed));
  ok("  the session cookie is the one auth.ts pins to .vraelis.com", /name: "__Secure-authjs\.session-token",\s*options: \{ domain: "\.vraelis\.com"/.test(read("auth.ts")));
  ok("Stripe's checkout cookies are listed as Stripe's", COOKIES.some((r) => r.setBy === "Stripe" && r.name.includes("__stripe_mid")));
  ok("the consent cookie is essential and lasts six months", COOKIES.some((r) => r.name === PRIVACY_COOKIE && r.category === "Essential" && r.duration === "6 months"));

  // Browser storage, the same way: every setItem key the live code writes.
  const snames = STORAGE.flatMap((r) => r.name.split(/,\s*/));
  const sListed = (k: string) => snames.some((x) => x === k || (x.includes("<") && k.startsWith(x.slice(0, x.indexOf("<")))) || x.startsWith(k));
  // Components nothing imports are not part of the product and are not inventoried (chat-history-rail,
  // lei-shell and free-check-draft belong to retired products).
  const DEAD = ["components/chat-history-rail.tsx", "components/lei-shell.tsx", "lib/free-check-draft.ts"];
  const keys = new Set<string>();
  for (const f of files.concat(["lib/fixtures/drone-console.ts"])) {
    const norm = f.replace(/\\/g, "/");
    if (DEAD.includes(norm)) continue;
    const raw = read(f);
    const s = code(f);
    for (const m of s.matchAll(/(?:localStorage|sessionStorage)\.setItem\(\s*(?:"([^"]+)"|`([^`$]+)\$\{|([A-Za-z_]+))/g)) {
      const lit = m[1] ?? m[2];
      if (lit) { keys.add(lit); continue; }
      const id = m[3];
      const c = new RegExp(`(?:const|var) ${id} = (?:"([^"]+)"|\`([^\`$]+)\\$\\{|"([^"]+)" \\+)`).exec(raw);
      keys.add(c ? (c[1] ?? c[2] ?? c[3]) : `(unresolved ${id} in ${norm})`);
    }
  }
  for (const k of [...keys].sort()) ok(`storage key "${k}" is in the cookie policy`, sListed(k));
  for (const k of PREFERENCE_LOCAL_KEYS) ok(`${k} is listed under Preferences`, STORAGE.some((r) => r.name.split(/,\s*/).includes(k) && r.category === "Preferences"));
  for (const k of ANALYTICS_SESSION_KEYS) ok(`${k} is listed under Analytics`, STORAGE.some((r) => r.name.split(/,\s*/).includes(k) && r.category === "Analytics"));
}

console.log("\n── the two new pages route, index and link like the other legal pages ──");
{
  for (const [path, title] of [["/cookies", "Cookies"], ["/acceptable-use", "Acceptable use"]] as const) {
    const file = `app/dev-preview/v6${path}/page.tsx`;
    const src = existsSync(file) ? read(file) : "";
    ok(`${path} is served from the V6 tree`, V6_EXACT[path] === `/dev-preview/v6${path}` && existsSync(file));
    ok(`  with v6meta for its clean path (the same robots rule as Privacy and Terms)`, src.includes(`path: "${path}"`) && /v6meta\(/.test(src) && src.includes(`title: "${title}"`));
    ok(`  inside the shared LegalPage`, /<LegalPage title=/.test(src));
    ok(`  in the sitemap weights`, read("app/sitemap.ts").includes(`"${path}": { p: 0.3, f: "yearly" }`));
    ok(`  in the footer Trust column`, code("app/dev-preview/v6/_system/close.tsx").includes(`[\`\${BASE}${path}\``));
    ok(`  in the docs footer and the account screens' footer`,
      code("app/dev-preview/v6/_content/docs-ui.tsx").includes(`\${BASE}${path}`) && code("app/_components/auth-frame.tsx").includes(`href="${path}"`));
    ok(`  and readable before choosing`, isLegalPath(path));
  }
  ok("the sign-up agreement's Acceptable Use link now has a page behind it",
    /\$\{legalBase\}\/acceptable-use/.test(read("components/vraelis-auth.tsx")) && !!V6_EXACT["/acceptable-use"]);
  ok("the Terms say the Acceptable use policy is part of them", /<A href="\/acceptable-use">Acceptable use policy<\/A>[^<]*It is part of these terms\./.test(read("app/_content/legal.tsx")));
  ok("the privacy page links the cookie policy and describes GPC", /PrivacyBody[\s\S]*<A href="\/cookies">cookie policy<\/A>[\s\S]*Global Privacy Control[\s\S]*export function TermsBody/.test(read("app/_content/legal.tsx")));
  ok("the privacy page no longer says it never shares for advertising", !/does not sell personal information or share it for cross-context/.test(read("app/_content/legal.tsx")));
}

console.log("\n── copy rules ──");
{
  const copyFiles = ["app/_components/privacy-choices.tsx", "app/_content/legal.tsx", "app/dev-preview/v6/cookies/page.tsx", "app/dev-preview/v6/acceptable-use/page.tsx"];
  for (const f of copyFiles) {
    const s = code(f);
    ok(`${f}: no em or en dashes`, !/[–—]/.test(s));
    ok(`${f}: no compliance or certification claims`, !/\b(compliant|certified|guaranteed)\b|GDPR-compliant/i.test(s));
  }
  ok("the only mailbox the new pages name is help@", (() => {
    const s = code("app/_content/legal.tsx");
    const cookiesAup = s.slice(s.indexOf("export const COOKIES_UPDATED"));
    return !/[a-z]+@vraelis\.com/.test(cookiesAup.replace(/help@vraelis\.com/g, ""));
  })());
  const css = read("app/_components/privacy-choices.css");
  const colours = [...css.matchAll(/#([0-9A-Fa-f]{6})\b/g)].map((m) => m[1].toUpperCase());
  // Within 12 points across channels: the zinc greys the console already uses (#52525B is its --fg-3) carry
  // a few points of blue, which is still grey. A real blue or green is tens of points apart.
  const grey = (h: string) => { const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); return Math.max(r, g, b) - Math.min(r, g, b) <= 12; };
  ok("the dialog uses no colour but greys and ink (no blue, no green)", colours.every(grey), colours.filter((c) => !grey(c)).join(","));
  ok("it respects reduced motion", /prefers-reduced-motion: reduce[\s\S]*animation: none/.test(css));
  ok("it has visible focus rings", /:focus-visible \{ outline: 2px solid #0A0A0B/.test(css));
  ok("it is set in IBM Plex through the brand variable", /font-family: var\(--font-brand-sans\)/.test(css));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
