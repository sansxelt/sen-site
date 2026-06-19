import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// vraelis.com — now Flip Engine. The product pages live under the internal
// /flip route group; this proxy maps clean public paths onto /flip and bounces
// any /flip URL back to its clean alias, so /flip NEVER shows in the URL bar.
// The old lead-agent marketing (/v/*) is retired — its paths redirect home.
// Auth (/signin, /api/auth/*), the API, and Stripe return pages pass through.

// Clean public path -> internal route (rewrite — URL stays clean).
const CLEAN_PATHS: Record<string, string> = {
  "/": "/flip",
  "/app": "/flip/app",
  "/pricing": "/flip/pricing",
  "/connections": "/flip/connections",
  "/account": "/flip/account",
  // legal pages kept (generic) from the old route group
  "/privacy": "/v/privacy",
  "/terms": "/v/terms",
  "/refunds": "/v/refunds",
  "/contact": "/v/contact",
};

// Internal route -> clean public path (redirect) so the internal prefix never
// shows. /flip/billing/* is intentionally absent — Stripe returns there directly.
const VANITY_REDIRECTS: Record<string, string> = {
  "/flip": "/",
  "/flip/app": "/app",
  "/flip/pricing": "/pricing",
  "/flip/connections": "/connections",
  "/flip/account": "/account",
  "/v/privacy": "/privacy",
  "/v/terms": "/terms",
  "/v/refunds": "/refunds",
  "/v/contact": "/contact",
};

// Retired lead-agent marketing — bounce home so old links/SEO don't 404.
const RETIRED = new Set([
  "/how", "/automates", "/demo", "/showcase", "/checkout",
  "/v", "/v/how", "/v/automates", "/v/demo", "/v/showcase", "/v/pricing", "/v/checkout",
]);

export default function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // 1) Retired lead-agent paths -> home.
  if (RETIRED.has(path) || path.startsWith("/v/articles") || path.startsWith("/v/account")) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // 2) Bounce internal route URLs to their clean alias.
  const vanity = VANITY_REDIRECTS[path];
  if (vanity) {
    const url = req.nextUrl.clone();
    url.pathname = vanity;
    return NextResponse.redirect(url);
  }

  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  const isAppSubdomain = host === "app.vraelis.com";

  // 3) Map clean public paths onto internal routes (rewrite — URL stays clean).
  let target = CLEAN_PATHS[path];

  // On app.vraelis.com the root IS the tool, not the marketing home.
  if (isAppSubdomain && path === "/") target = "/flip/app";

  if (target) {
    const url = req.nextUrl.clone();
    url.pathname = target;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  // Match all paths EXCEPT Next internals (_next/*) and anything that looks
  // like a file (favicon.ico, og-image.png, /flip-assets/*.jpg, etc.).
  matcher: ["/((?!_next/|.*\\.[a-zA-Z0-9]+$).*)"],
};
