import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "./auth";
import { getSafeRedirectPath } from "./lib/auth-ui";

// Single Next.js 16 proxy that does TWO things:
//
//   1. Host routing — splits sansxel.ai / chat.sansxel.ai /
//      platform.sansxel.ai into their own zones (workshop, marketing,
//      docs).
//   2. Auth gating — gates /account and /api/account paths behind a
//      session redirect to /signin (replicates what the previous
//      `export { auth as proxy }` did for the narrow matcher).
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
  "/features",
  "/function",
  "/learn",
  "/pricing",
  "/contact",
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

// auth() wrapper exposes req.auth (the session) inside the callback,
// so we can replicate the existing /account gate without a separate
// proxy file.
export default auth((req) => {
  // 1. Host routing first.
  const hostResp = hostRoute(req);
  if (hostResp) return hostResp;

  // 2. Auth gate for /account + /api/account, mirroring the old
  //    `authorized` callback that fired when the matcher was narrow.
  const { pathname, search } = req.nextUrl;
  const requiresAuth =
    pathname.startsWith("/account") || pathname.startsWith("/api/account");
  if (requiresAuth && !req.auth?.user?.email) {
    const callbackUrl = getSafeRedirectPath(`${pathname}${search}`);
    const signInUrl = new URL("/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", callbackUrl);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Catch all paths EXCEPT:
  //   - Next internals (_next/*)
  //   - Anything that looks like a file (favicon.ico, og-image.png, sitemap.xml, etc.)
  // /api/* IS matched so /api/account gating works; auth() is cheap
  // for non-account API routes (cookie+JWT, no DB).
  matcher: ["/((?!_next/|.*\\.[a-zA-Z0-9]+$).*)"],
};
