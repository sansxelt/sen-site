// Single source of truth for the app.vraelis.com <-> internal /rank/app routing split. Used by proxy.ts
// (host mapping + legacy redirects), the shell (which chrome to render), and the auth guards (where to
// send a logged-out deep link). Marketing + auth live on vraelis.com; ONLY the signed-in product lives on
// the app subdomain, at clean paths with no /app prefix.

// First path segments that belong to the signed-in product = the directory names under app/rank/app/
// AFTER the public renames (apps->applications, audit->activity, api-keys->api). "account" also appears in
// the retired-sansxel redirect list, so the product check must always run first.
export const APP_ROOTS = [
  "applications", "passes", "issues", "repairs", "deployments", "activity",
  "team", "organization", "api", "connections", "plans", "credits", "billing", "account", "checkout",
  "data", "data-quality", "projects", "shared", "sandbox", "legacy", "admin", "tests", "new", "_workspace",
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
//   /app/apps                     -> /applications
//   /app/apps/<id>/runs/<run>     -> /applications/<id>/passes/<run>
//   /app/audit                    -> /activity
//   /app/api-keys                 -> /api
//   /app/<anything else>          -> /<anything else>
export function legacyToNew(pathname: string): string {
  if (pathname === "/app" || pathname === "/app/") return "/";
  if (!pathname.startsWith("/app/")) return pathname;
  const rest = pathname.slice("/app".length); // "/apps/..."
  const segs = rest.split("/"); // ["", "apps", "<id>", "runs", "<run>"]
  if (segs[1] === "checks") return "/legacy/checks" + segs.slice(2).map((s) => "/" + s).join(""); // retired checker
  if (segs[1] === "apps") {
    segs[1] = "applications";
    if (segs[3] === "runs") segs[3] = "passes";
  } else if (segs[1] === "audit") segs[1] = "activity";
  else if (segs[1] === "api-keys") segs[1] = "api";
  return segs.join("/") || "/";
}

// The run report route was renamed /runs -> /passes in the subdomain migration, but only the OLD /app
// prefix form (/app/apps/<id>/runs/<run>) is handled by legacyToNew. The NEW clean paths still leak a
// legacy /runs link from old bookmarks, emails, and share pages: /applications/<id>/runs[/<runId>].
// legacyRunsPath maps exactly those to their canonical /passes path, PRESERVING id + runId, and returns
// null for anything else (including /passes itself, so the proxy redirect can never loop). Pure + query-
// agnostic (the proxy carries the query string separately). Only the report route is remapped: a deeper
// path like /applications/<id>/runs/<runId>/anything is left alone (null) rather than guessed at.
export function legacyRunsPath(pathname: string): string | null {
  const segs = pathname.split("/").filter(Boolean); // ["applications", "<id>", "runs", "<runId>?"]
  if (segs[0] !== "applications" || !segs[1]) return null;
  if (segs[2] !== "runs") return null;               // /passes and every other tab return null (no loop)
  if (segs.length === 3) return `/applications/${segs[1]}/passes`;
  if (segs.length === 4) return `/applications/${segs[1]}/passes/${segs[3]}`;
  return null;                                        // deeper/unknown shape: don't guess
}

// Absolute product URL for auth callbacks and generated links. Production points at the subdomain; dev
// and previews keep the relative path so localhost auth round-trips without DNS.
export function appHostUrl(path: string): string {
  const prod = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
  return prod ? `https://app.vraelis.com${path === "/" ? "" : path}` || "https://app.vraelis.com" : path;
}
