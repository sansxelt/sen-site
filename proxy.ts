import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next.js 16 proxy. Single job now: host routing.
//
// Host routing splits sansxel.ai / chat.sansxel.ai /
// platform.sansxel.ai into their own zones (workshop, marketing,
// docs).
//
// Auth gating used to live here too but moved into route + layout
// auth() checks; getToken() at the proxy layer disagreed with
// auth() about cookie visibility, which produced false 401s
// (most recently the Top-up Credits modal returning "Sign in to
// continue" while the user was clearly signed in).
//
// Localhost + Vercel preview URLs (random *.vercel.app) skip host
// routing so dev + previews keep working.

const APEX_HOSTS = new Set(["sansxel.ai", "www.sansxel.ai"]);
const CHAT_HOST = "chat.sansxel.ai";
const PLATFORM_HOST = "platform.sansxel.ai";

const CHAT_PATHS = [
  "/app",
  "/account",
  "/checkout",
  "/signin",
  "/auth",
  "/desktop-auth",
];

const MARKETING_PATHS = [
  "/home",
  "/product",
  "/learn",
  "/pricing",
  "/contact",
  "/contribute",
  "/download",
  "/privacy",
  "/terms",
];

function startsWithAny(path: string, prefixes: string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

function hostRoute(req: NextRequest): NextResponse | null {
  const host = (req.headers.get("host") ?? "").toLowerCase();
  const url = req.nextUrl;
  const path = url.pathname;

  // chat.sansxel.ai
  if (host === CHAT_HOST) {
    if (path === "/") {
      // Root = workshop. Rewrite to /app so the URL bar stays at /
      // and the workshop renders. /app's page.tsx now handles its
      // own auth gate via auth() (avoids the proxy getToken mismatch).
      return NextResponse.rewrite(new URL("/app", url));
    }
    if (startsWithAny(path, MARKETING_PATHS)) {
      return NextResponse.redirect(
        new URL(path + url.search, "https://sansxel.ai"),
        302,
      );
    }
    return null; // pass through to auth gate / next handler
  }

  // platform.sansxel.ai
  if (host === PLATFORM_HOST) {
    if (path === "/") {
      return NextResponse.rewrite(new URL("/platform-soon", url));
    }
    if (startsWithAny(path, MARKETING_PATHS)) {
      return NextResponse.redirect(
        new URL(path + url.search, "https://sansxel.ai"),
        302,
      );
    }
    if (startsWithAny(path, CHAT_PATHS)) {
      return NextResponse.redirect(
        new URL(path + url.search, "https://chat.sansxel.ai"),
        302,
      );
    }
    return null;
  }

  // sansxel.ai (apex)
  if (APEX_HOSTS.has(host)) {
    if (host === "www.sansxel.ai") {
      return NextResponse.redirect(
        new URL(path + url.search, "https://sansxel.ai"),
        308,
      );
    }
    if (startsWithAny(path, CHAT_PATHS)) {
      return NextResponse.redirect(
        new URL(path + url.search, "https://chat.sansxel.ai"),
        302,
      );
    }
    return null;
  }

  // Unknown host (preview deploy, localhost, custom) — pass through.
  return null;
}

// Plain async proxy (no auth() wrapper). The wrapper was rewriting
// every NextResponse.rewrite into a 307 redirect to AUTH_URL,
// which broke chat.sansxel.ai/ → /app and platform.sansxel.ai/ →
// /platform-soon because both are rewrites, not redirects. Now
// the proxy stays out of auth entirely; routes + layouts handle
// it via auth() instead.
export default async function proxy(req: NextRequest) {
  // 1. Host routing first.
  const hostResp = hostRoute(req);
  if (hostResp) return hostResp;

  // 2. Auth gate removed at the proxy layer.
  //
  // Used to gate /api/account/* via getToken(), but that produced
  // false negatives whenever getToken's view of cookies disagreed
  // with auth()'s. The Top-up Credits modal hit this: getToken
  // returned no email even when the user was signed in, so the
  // proxy 401'd "Sign in to continue" before the route ever ran.
  //
  // Every /api/account/* route already does its own auth() check
  // (verified by grep) and 401s correctly when there's no session,
  // so the proxy gate was pure noise. /account (the page tree)
  // moved off the proxy for the same reason in v0.1.16.
  return NextResponse.next();
}

export const config = {
  // Catch all paths EXCEPT:
  //   - Next internals (_next/*)
  //   - Anything that looks like a file (favicon.ico, og-image.png, sitemap.xml, etc.)
  // /api/* IS matched so /api/account gating works; auth() is cheap
  // for non-account API routes (cookie+JWT, no DB).
  matcher: ["/((?!_next/|.*\\.[a-zA-Z0-9]+$).*)"],
};
