// Single source of truth for the app.vraelis.com <-> internal /rank/app routing split. Used by proxy.ts
// (host mapping + legacy redirects), the shell (which chrome to render), and the auth guards (where to
// send a logged-out deep link). Marketing + auth live on vraelis.com; ONLY the signed-in product lives on
// the app subdomain, at clean paths with no /app prefix.

// First path segments that belong to the signed-in product = the directory names under app/rank/app/
// AFTER the public renames (apps->applications, audit->activity, api-keys->api). "account" also appears in
// the retired-sansxel redirect list, so the product check must always run first.
export const APP_ROOTS = [
  // The product vocabulary. "systems" and "verifications" are the canonical URLs; "applications" and
  // "passes" name the same pages under the older words and stay routable so existing links keep working.
  // "applications" no longer has pages of its own — the tree moved to app/rank/app/systems/ and every
  // /applications/* address now 308s across (legacySystemsPath). It stays listed because the redirect only
  // gets a chance to run on paths the host recognises as the product's; drop it and an old bookmark stops
  // being redirected and starts being bounced to the marketing site instead.
  // A root missing here still builds, but never rewrites on app.vraelis.com, so it 404s only in production.
  // Every entry must map to a real directory under app/rank/app/ — a ghost root only routes into a 404.
  // (/developers is deliberately absent: it is public docs on the marketing host; see proxy.ts.)
  "systems", "verifications", "guarantees", "review", "records", "usage",
  "applications", "passes", "issues", "repairs", "deployments", "activity",
  "team", "organization", "api", "connections", "plans", "credits", "billing", "account", "checkout",
  "admin", "new",
] as const;

const ROOT_SET = new Set<string>(APP_ROOTS);

export function firstSegment(pathname: string): string {
  return pathname.split("/").filter(Boolean)[0] ?? "";
}

// Is this pathname part of the signed-in product? True for the legacy /app prefix (still served for old
// links + localhost dev) and for the clean subdomain paths.
export function isAppPath(pathname: string): boolean {
  if (pathname === "/app" || pathname.startsWith("/app/")) return true;
  return ROOT_SET.has(firstSegment(pathname));
}

// Map a legacy /app/* path to its clean app-subdomain path. Handles the renamed segments:
//   /app                          -> /
//   /app/apps                     -> /systems
//   /app/apps/<id>/runs/<run>     -> /systems/<id>/passes/<run>
//   /app/audit                    -> /activity
//   /app/api-keys                 -> /api
//   /app/<anything else>          -> /<anything else>
//
// "apps" lands on /systems, not /applications. It used to land on /applications, which was correct while
// that was the canonical word; now it is one more legacy spelling, and sending an old link through TWO
// redirects to reach the same page is a hop nobody needs to pay for.
export function legacyToNew(pathname: string): string {
  if (pathname === "/app" || pathname === "/app/") return "/";
  if (!pathname.startsWith("/app/")) return pathname;
  const rest = pathname.slice("/app".length); // "/apps/..."
  const segs = rest.split("/"); // ["", "apps", "<id>", "runs", "<run>"]
  if (segs[1] === "checks") return "/"; // retired checker (deleted) — old links land home
  if (segs[1] === "apps" || segs[1] === "applications") {
    segs[1] = "systems";
    if (segs[3] === "runs") segs[3] = "passes";
  } else if (segs[1] === "audit") segs[1] = "activity";
  else if (segs[1] === "api-keys") segs[1] = "api";
  return segs.join("/") || "/";
}

// The run report route was renamed /runs -> /passes in the subdomain migration, but only the OLD /app
// prefix form (/app/apps/<id>/runs/<run>) is handled by legacyToNew. The NEW clean paths still leak a
// legacy /runs link from old bookmarks, emails, and share pages: /systems/<id>/runs[/<runId>].
// legacyRunsPath maps exactly those to their canonical /passes path, PRESERVING id + runId, and returns
// null for anything else (including /passes itself, so the proxy redirect can never loop). Pure + query-
// agnostic (the proxy carries the query string separately). Only the report route is remapped: a deeper
// path like /systems/<id>/runs/<runId>/anything is left alone (null) rather than guessed at.
//
// It accepts BOTH first segments and always answers with the canonical one, so a link carrying two dead
// words at once (/applications/<id>/runs/<run>, which every share page emitted for months) is corrected in
// a single hop instead of bouncing through /systems/<id>/runs to get there.
export function legacyRunsPath(pathname: string): string | null {
  const segs = pathname.split("/").filter(Boolean); // ["systems", "<id>", "runs", "<runId>?"]
  if ((segs[0] !== "systems" && segs[0] !== "applications") || !segs[1]) return null;
  if (segs[2] !== "runs") return null;               // /passes and every other tab return null (no loop)
  if (segs.length === 3) return `/systems/${segs[1]}/passes`;
  if (segs.length === 4) return `/systems/${segs[1]}/passes/${segs[3]}`;
  return null;                                        // deeper/unknown shape: don't guess
}

// /applications/* -> /systems/*, the last leg of a rename that had been half-done for months: the nav said
// Systems, the URL said applications, and /systems existed only as a file that re-exported the other page,
// so the same screen answered at two addresses and neither was wrong. The pages now live under /systems
// alone and this maps every old address onto them, PRESERVING the rest of the path.
//
// Returns null for anything already canonical, which is what keeps the proxy's 308 from looping.
export function legacySystemsPath(pathname: string): string | null {
  if (pathname === "/applications") return "/systems";
  if (!pathname.startsWith("/applications/")) return null;
  return "/systems" + pathname.slice("/applications".length);
}

// Absolute product URL for auth callbacks and generated links. Production points at the subdomain; dev
// and previews keep the relative path so localhost auth round-trips without DNS.
export function appHostUrl(path: string): string {
  const prod = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
  return prod ? `https://app.vraelis.com${path === "/" ? "" : path}` || "https://app.vraelis.com" : path;
}
