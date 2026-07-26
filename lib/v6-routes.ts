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

export const V6_HOME = V6_BASE;
export const V6_APP = `${V6_BASE}/app`;
export const V6_SIGNIN = `${V6_BASE}/signin`;
export const V6_PRIVACY = `${V6_BASE}/privacy`;
export const V6_TERMS = `${V6_BASE}/terms`;
export const V6_DOCS = `${V6_BASE}/docs`;
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
