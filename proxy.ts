import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAppPath, legacyToNew, firstSegment } from "./lib/app-routes";

// vraelis.com: Vraelis Rank. Clean public paths map onto the internal /rank
// route group; /rank/* bounce back to their clean alias so /rank never shows.
// Archived products (Flip) and retired lead-agent marketing redirect home.
// /signin, /api/*, and legal pages pass through / are mapped explicitly.

const CLEAN_EXACT: Record<string, string> = {
  "/": "/rank",
  "/how-it-works": "/rank/how-it-works",
  "/pricing": "/rank/pricing",
  "/free-report": "/rank/free-report",
  "/developers": "/rank/developers",
  "/privacy": "/rank/privacy",
  "/terms": "/rank/terms",
  "/data-rights": "/rank/data-rights",
  "/trademark": "/rank/trademark",
  "/contact": "/rank/contact",
  "/demo": "/rank/demo",
  "/sso": "/rank/sso",
  "/enterprise": "/rank/enterprise",
  "/refunds": "/rank/refunds",
  "/subprocessors": "/rank/subprocessors",
};
// Retired sansxel product routes (exact path or any subpath) -> redirect home.
const SANSXEL = [
  "/home", "/product", "/platform", "/platform-soon", "/learn", "/lens",
  "/whisper", "/workshop", "/copilot", "/download", "/desktop-auth",
  "/contribute", "/chat", "/account", "/book", "/pay",
];
const VANITY_EXACT: Record<string, string> = {
  "/v/privacy": "/privacy",
  "/v/terms": "/terms",
  "/v/refunds": "/refunds",
  "/v/contact": "/contact",
};

function go(req: NextRequest, pathname: string, kind: "redirect" | "rewrite") {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  return kind === "redirect" ? NextResponse.redirect(url) : NextResponse.rewrite(url);
}

function goAbs(req: NextRequest, absolute: string) {
  const url = new URL(absolute, req.nextUrl);
  url.search = req.nextUrl.search;
  return NextResponse.redirect(url, 308);
}

export default function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const host = (req.headers.get("host") || "").toLowerCase();
  const isAppHost = host === "app.vraelis.com" || host.startsWith("app.localhost");
  const isProd = host.endsWith("vraelis.com");

  // 0) app.vraelis.com: ONLY the signed-in product, at clean paths (no /app prefix).
  //    Auth pages live on the main host; API routes serve both hosts unchanged.
  if (isAppHost) {
    if (path.startsWith("/api/") || path.startsWith("/r/") || path.startsWith("/og")) return NextResponse.next();
    if (path === "/signin" || path === "/signup" || path.startsWith("/auth/")) {
      return goAbs(req, `https://vraelis.com${path}`);                    // auth on the brand site
    }
    if (path === "/app" || path.startsWith("/app/")) {
      return goAbs(req, `https://${host}${legacyToNew(path)}`);           // never show doubled /app here
    }
    if (path === "/" || isAppPath(path)) {
      return go(req, "/rank/app" + (path === "/" ? "" : path), "rewrite"); // the product itself
    }
    return goAbs(req, `https://vraelis.com${path}`);                      // marketing never renders here
  }

  // 0b) Main host: the product moved to the subdomain. Old /app/* links (bookmarks, emails) and the new
  //     clean roots both redirect across IN PRODUCTION; localhost keeps serving them directly (rewrites
  //     below) so dev needs no subdomain DNS. Runs BEFORE the retired-sansxel list ("/account" collides).
  //     CRITICAL: "/api/<anything>" is the real API namespace (NextAuth, preflight routes) and must never
  //     be redirected or rewritten — only the EXACT "/api" path is the product's API & Webhooks page.
  if (path.startsWith("/api/")) return NextResponse.next();
  if (isProd && (path === "/app" || path.startsWith("/app/"))) {
    return goAbs(req, `https://app.vraelis.com${legacyToNew(path)}`);
  }
  if (isAppPath(path) && !path.startsWith("/app")) {
    if (isProd) return goAbs(req, `https://app.vraelis.com${path}`);
    return go(req, "/rank/app" + path, "rewrite");                        // localhost dev convenience
  }
  if (!isProd && path.startsWith("/app/")) {
    // dev parity with the prod redirects: old /app/* paths land on the same renamed clean paths.
    return go(req, legacyToNew(path), "redirect");
  }
  if (!isProd && path === "/app") return go(req, "/rank/app", "rewrite"); // localhost overview

  // 1) Internal /rank/* -> clean alias.
  if (path === "/rank") return go(req, "/", "redirect");
  if (path.startsWith("/rank/")) return go(req, path.slice(5), "redirect"); // /rank/app/x -> /app/x
  const v = VANITY_EXACT[path];
  if (v) return go(req, v, "redirect");

  // Moved routes -> redirect to the new clean path.
  if (path === "/security") return go(req, "/enterprise", "redirect");

  // 2) Archived / retired -> home.
  if (
    path === "/flip" || path.startsWith("/flip/") ||
    ["/how", "/automates", "/showcase", "/v"].includes(path) ||
    path.startsWith("/v/account") || path.startsWith("/v/articles") ||
    path.startsWith("/v/how") || path.startsWith("/v/demo") || path.startsWith("/v/pricing")
  ) {
    return go(req, "/", "redirect");
  }

  // 2b) Retired sansxel "Vraelis AI" surface (the old marketing + app: glasses
  // hero, product, platform, learn, chat, account, pay, …). vraelis.com is
  // Vraelis Rank now, and `/` already serves Rank, so these stray routes just
  // leak another product; send them all home. (Rank's own /app, /vote, /signin,
  // /api, /r, /embed, /og, /auth are untouched.)
  if (SANSXEL.some((p) => path === p || path.startsWith(p + "/"))) {
    return go(req, "/", "redirect");
  }

  // 2c) Legacy AI-output checker: the checker moved out of the primary product to /app/legacy/checks
  // (flag-gated there). Every historical /app/checks link (emails, bookmarks, share pages) redirects in.
  if (path === "/app/checks" || path.startsWith("/app/checks/")) {
    return go(req, "/app/legacy/checks" + path.slice("/app/checks".length), "redirect");
  }

  // 3) Clean public paths -> internal /rank routes (rewrite; URL stays clean).
  let target = CLEAN_EXACT[path];
  if (!target) {
    if (path === "/app" || path.startsWith("/app/")) target = "/rank" + path;
    else if (path === "/vote" || path.startsWith("/vote/")) target = "/rank" + path;
    else if (path === "/guides" || path.startsWith("/guides/")) target = "/rank" + path; // programmatic QA guides
  }
  if (target) return go(req, target, "rewrite");

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|.*\\.[a-zA-Z0-9]+$).*)"],
};
