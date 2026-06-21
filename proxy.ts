import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// vraelis.com — Vraelis Rank. Clean public paths map onto the internal /rank
// route group; /rank/* bounce back to their clean alias so /rank never shows.
// Archived products (Flip) and retired lead-agent marketing redirect home.
// /signin, /api/*, and legal pages pass through / are mapped explicitly.

const CLEAN_EXACT: Record<string, string> = {
  "/": "/rank",
  "/how-it-works": "/rank/how-it-works",
  "/pricing": "/rank/pricing",
  "/developers": "/rank/developers",
  "/privacy": "/rank/privacy",
  "/terms": "/rank/terms",
  "/contact": "/rank/contact",
  "/refunds": "/v/refunds",
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

export default function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // 1) Internal /rank/* -> clean alias.
  if (path === "/rank") return go(req, "/", "redirect");
  if (path.startsWith("/rank/")) return go(req, path.slice(5), "redirect"); // /rank/app/x -> /app/x
  const v = VANITY_EXACT[path];
  if (v) return go(req, v, "redirect");

  // 2) Archived / retired -> home.
  if (
    path === "/flip" || path.startsWith("/flip/") ||
    ["/how", "/automates", "/demo", "/showcase", "/v"].includes(path) ||
    path.startsWith("/v/account") || path.startsWith("/v/articles") ||
    path.startsWith("/v/how") || path.startsWith("/v/demo") || path.startsWith("/v/pricing")
  ) {
    return go(req, "/", "redirect");
  }

  // 2b) Retired sansxel "Vraelis AI" surface (the old marketing + app: glasses
  // hero, product, platform, learn, chat, account, pay, …). vraelis.com is
  // Vraelis Rank now, and `/` already serves Rank, so these stray routes just
  // leak another product — send them all home. (Rank's own /app, /vote, /signin,
  // /api, /r, /embed, /og, /auth are untouched.)
  if (SANSXEL.some((p) => path === p || path.startsWith(p + "/"))) {
    return go(req, "/", "redirect");
  }

  // 3) Clean public paths -> internal /rank routes (rewrite — URL stays clean).
  let target = CLEAN_EXACT[path];
  if (!target) {
    if (path === "/app" || path.startsWith("/app/")) target = "/rank" + path;
    else if (path === "/vote" || path.startsWith("/vote/")) target = "/rank" + path;
  }
  if (target) return go(req, target, "rewrite");

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|.*\\.[a-zA-Z0-9]+$).*)"],
};
