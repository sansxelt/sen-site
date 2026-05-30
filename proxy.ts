import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next.js 16 proxy. Single job now: host routing.
//
// Host routing splits vraelis.com / chat.vraelis.com /
// platform.vraelis.com into their own zones (workshop, marketing,
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

const APEX_HOSTS = new Set(["vraelis.com", "www.vraelis.com"]);
const CHAT_HOST = "chat.vraelis.com";
const PLATFORM_HOST = "platform.vraelis.com";

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

  // chat.vraelis.com
  if (host === CHAT_HOST) {
    if (path === "/") {
      // Root = workshop. Rewrite to /app so the URL bar stays at /
      // and the workshop renders. /app's page.tsx now handles its
      // own auth gate via auth() (avoids the proxy getToken mismatch).
      return NextResponse.rewrite(new URL("/app", url));
    }
    if (startsWithAny(path, MARKETING_PATHS)) {
      return NextResponse.redirect(
        new URL(path + url.search, "https://vraelis.com"),
        302,
      );
    }
    return null;
  }

  // platform.vraelis.com
  if (host === PLATFORM_HOST) {
    if (path === "/") {
      return NextResponse.rewrite(new URL("/platform-soon", url));
    }
    if (startsWithAny(path, MARKETING_PATHS)) {
      return NextResponse.redirect(
        new URL(path + url.search, "https://vraelis.com"),
        302,
      );
    }
    if (startsWithAny(path, CHAT_PATHS)) {
      return NextResponse.redirect(
        new URL(path + url.search, "https://chat.vraelis.com"),
        302,
      );
    }
    return null;
  }

  // vraelis.com (apex)
  if (APEX_HOSTS.has(host)) {
    if (host === "www.vraelis.com") {
      return NextResponse.redirect(
        new URL(path + url.search, "https://vraelis.com"),
        308,
      );
    }
    if (startsWithAny(path, CHAT_PATHS)) {
      return NextResponse.redirect(
        new URL(path + url.search, "https://chat.vraelis.com"),
        302,
      );
    }
    return null;
  }

  // Unknown host (preview deploy, localhost, custom) — pass through.
  return null;
}

export default async function proxy(req: NextRequest) {
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
