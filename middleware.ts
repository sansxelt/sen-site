import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next.js 16 renamed middleware → proxy, but proxy is Node.js-only
// and OpenNext on Cloudflare Workers only supports the Edge runtime
// (the Worker runtime IS the Edge runtime, basically). So we keep
// using the legacy `middleware.ts` filename + `middleware` function
// to stay on Edge. Per the v16 upgrade docs:
//
//   "The edge runtime is NOT supported in proxy. The proxy runtime
//    is nodejs, and it cannot be configured. If you want to continue
//    using the edge runtime, keep using middleware."
//
// Single job here: host routing.
//
// Host routing splits sansxel.ai / chat.sansxel.ai /
// platform.sansxel.ai into their own zones (workshop, marketing,
// docs).
//
// Auth gating used to live here too but moved into route + layout
// auth() checks; getToken() at the middleware layer disagreed with
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
      // own auth gate via auth() (avoids the middleware getToken mismatch).
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

// Plain async middleware (no auth() wrapper). The wrapper was
// rewriting every NextResponse.rewrite into a 307 redirect to
// AUTH_URL, which broke chat.sansxel.ai/ → /app and
// platform.sansxel.ai/ → /platform-soon because both are rewrites,
// not redirects. Routes + layouts handle auth via auth() instead.
export default async function middleware(req: NextRequest) {
  const hostResp = hostRoute(req);
  if (hostResp) return hostResp;
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
