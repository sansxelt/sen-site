// THE V6 DESTINATIONS, IN ONE PLACE.
//
// A route-continuity crawl found four escapes that no grep for `href="/..."` could have seen, because the
// navigation was constructed rather than written:
//
//   app/auth/confirm-signup/confirm-form.tsx   router.push("/")            -> the previous homepage
//   app/auth/auto-signin/auto-signin-client.tsx  window.location.href = "/account"  -> a route that does not exist
//   app/auth/auto-signin/auto-signin-client.tsx  getSignInPath(...)        -> the previous sign-in
//   app/auth/signin/page.tsx                   redirect("/signin")         -> the previous sign-in
//
// Patching each call site separately would guarantee the next one is missed too, so every V6 destination
// lives here and the call sites ask for it by name.
//
// WHEN V6 IS PROMOTED TO THE ROOT this file is the migration: set BASE to "" and every constructed
// navigation follows. That is the whole reason for the indirection.

// Promotion is one flag, read in exactly two places: here, so constructed navigation points at the clean
// paths, and proxy.ts, so those paths resolve to the V6 tree. If only one of them flipped, links and routes
// would disagree about where the site lives, which is why both read the SAME variable rather than each
// having its own switch.
export const V6_BASE = process.env.NEXT_PUBLIC_VRAELIS_V6_PUBLIC === "1" ? "" : "/dev-preview/v6";

// THE ONE CONSTANT THAT CANNOT BE THE BARE BASE.
//
// Every other destination here appends a segment, so an empty base composes correctly: "" + "/app" is
// "/app". Home has nothing to append, so promoted it evaluated to "" — and href="" is not "no link", it
// resolves to the CURRENT url. The wordmark, which is the only home link in the entire chrome, silently
// became a reload button on every page the moment the flag was set. It was invisible in preview, because
// unpromoted the base is "/dev-preview/v6" and the link worked.
export const V6_HOME = V6_BASE || "/";
export const V6_APP = `${V6_BASE}/app`;
export const V6_SIGNIN = `${V6_BASE}/signin`;
export const V6_PRIVACY = `${V6_BASE}/privacy`;
export const V6_TERMS = `${V6_BASE}/terms`;
export const V6_DOCS = `${V6_BASE}/docs`;

/** Where "see how this works" should land, in whichever generation is serving.
 *  Design 06 drops /how-it-works (superseded by /method and /platform); before promotion that page IS the
 *  explanation. Shared surfaces like the 404 render in both regimes and must not hardcode either. */
export const PUBLIC_HOW_IT_WORKS = V6_BASE === "" ? "/method" : "/how-it-works";

/** True once design 06 is the site.
 *
 *  A handful of previous-generation pages (/how-it-works, /free-report, /demo, /sso) still RESOLVE after
 *  promotion, deliberately, so an old bookmark does not 404. Resolving and being advertised are different
 *  things: promoted, nothing links to them, they render the previous chrome, and left indexable they go on
 *  competing with /method and /platform for the same queries. /sso already sets index:false permanently;
 *  this lets the other three do the same only once there is a newer site to be superseded by. */
export const V6_IS_LIVE = V6_BASE === "";

/* ── THE GROUND A ROUTE OPENS ON ───────────────────────────────────────────────────────────────────────
 *
 * Three grounds exist and every document is one of them:
 *   graphite  the product, the auth round-trip, the v6 homepage and the docs environment
 *   paper     every other v6 route, which opens on a white page hero
 *   cream     the previous generation of the marketing site
 *
 * This has to be known BEFORE the page renders, not by the shell inside it. The browser paints its first
 * frame from the colour scheme on <html> before any stylesheet or inline <style> has been parsed, so a
 * document whose darkness is only established further down the body flashes white on the way in. That is
 * what the white transition into sign-in was, and the pale strip past the end of a dark page: both are the
 * browser's own canvas, not the site's.
 *
 * proxy.ts resolves this per request and hands it to the root layout as a header, so <html> carries the
 * right background and colour scheme on the opening tag. The v6 shell still pins the same value with an
 * !important rule, which is belt and braces rather than duplication: the shell knows the CLIENT-side route
 * after a soft navigation, where no new document is requested and no header exists. */
export type Ground = "graphite" | "paper" | "cream";

export const GROUND_CSS: Record<Ground, { bg: string; scheme: "dark" | "light" }> = {
  graphite: { bg: "#0A0A0B", scheme: "dark" },
  paper: { bg: "#FFFFFF", scheme: "light" },
  cream: { bg: "#FAF8F4", scheme: "light" },
};

/** Which ground a v6 route opens on. The homepage opens on a black hero and the docs environment is night;
 *  every other v6 route opens on a page hero. Shared with the shell so the nav bar and the document canvas
 *  can never disagree about what colour the top of the page is. */
export function v6GroundAtTop(pathname: string): Ground {
  if (pathname === V6_BASE || pathname === V6_BASE + "/" || pathname === "/") return "graphite";
  if (pathname.startsWith(V6_BASE + "/docs")) return "graphite";
  return "paper";
}
export const V6_COMPANY = `${V6_BASE}/company`;

/**
 * The V6 sign-in URL, carrying where to land afterwards.
 *
 * Defaults to the V6 app rather than /account, which does not exist. The callback is encoded once here so
 * no call site has to remember to; double-encoding it was how one of the escapes stayed invisible.
 */
export function v6SignInPath(callbackUrl: string = V6_APP): string {
  return `${V6_SIGNIN}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}
