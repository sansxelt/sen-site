import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Per-host routing for the 3-zone split.
//
//   sansxel.ai           → marketing + /learn (this is where SEO lives)
//   chat.sansxel.ai      → /app + /account + auth + checkout (the product)
//   platform.sansxel.ai  → /docs + /console (developers — placeholder for now)
//
// One Vercel project serves all three hosts; this middleware decides
// which paths render on which host and bounces stray requests so the
// surfaces stay clean.
//
// Localhost + Vercel preview URLs (random *.vercel.app) fall through
// untouched so dev + previews keep working.

const APEX_HOSTS = new Set(["sansxel.ai", "www.sansxel.ai"]);
const CHAT_HOST = "chat.sansxel.ai";
const PLATFORM_HOST = "platform.sansxel.ai";

// Path prefixes that belong on the chat host. The marketing host
// redirects these to the chat subdomain so old bookmarks survive.
const CHAT_PATHS = [
  "/app",
  "/account",
  "/checkout",
  "/signin",
  "/auth",
  "/desktop-auth",
];

// Path prefixes that belong on the marketing host. The chat /
// platform hosts redirect these to apex.
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

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase();
  const url = req.nextUrl;
  const path = url.pathname;

  // ── chat.sansxel.ai ─────────────────────────────────────────────
  if (host === CHAT_HOST) {
    // Root of chat = the workshop. Rewrite (not redirect) so the
    // address bar stays at chat.sansxel.ai/ but the user sees /app.
    if (path === "/") {
      return NextResponse.rewrite(new URL("/app", url));
    }
    // Marketing routes don't belong here — bounce to apex.
    if (startsWithAny(path, MARKETING_PATHS)) {
      return NextResponse.redirect(
        new URL(path + url.search, "https://sansxel.ai"),
        302,
      );
    }
    return NextResponse.next();
  }

  // ── platform.sansxel.ai ─────────────────────────────────────────
  if (host === PLATFORM_HOST) {
    // Docs aren't built yet — root rewrites to a placeholder page.
    if (path === "/") {
      return NextResponse.rewrite(new URL("/platform-soon", url));
    }
    // Marketing → apex; chat surfaces → chat host.
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
    return NextResponse.next();
  }

  // ── sansxel.ai (apex / www) ─────────────────────────────────────
  if (APEX_HOSTS.has(host)) {
    // www → apex. Permanent so search engines collapse.
    if (host === "www.sansxel.ai") {
      return NextResponse.redirect(
        new URL(path + url.search, "https://sansxel.ai"),
        308,
      );
    }
    // Workshop / account / auth / checkout — push to chat subdomain.
    if (startsWithAny(path, CHAT_PATHS)) {
      return NextResponse.redirect(
        new URL(path + url.search, "https://chat.sansxel.ai"),
        302,
      );
    }
    return NextResponse.next();
  }

  // Anything else (preview deploys, localhost, custom domains) —
  // pass through. We only want host routing on production.
  return NextResponse.next();
}

export const config = {
  // Skip Next internals, API routes, and any path that looks like a
  // file (has a dot — favicon, og-image, sitemap, etc.). API routes
  // need to work on EVERY host because the chat client at
  // chat.sansxel.ai calls /api/ai/chat etc. on the same origin.
  matcher: ["/((?!_next/|api/|.*\\.).*)"],
};
