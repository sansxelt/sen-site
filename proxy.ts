import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// It's just vraelis.com. The marketing pages live under the internal
// /v route group; map the clean public paths onto them so the URL bar
// stays clean (vraelis.com/pricing → /v/pricing). Everything else —
// /signin, /api/*, /account, and the /v/* routes themselves — passes
// straight through untouched.
const CLEAN_PATHS: Record<string, string> = {
  "/": "/v",
  "/how": "/v/how",
  "/automates": "/v/automates",
  "/pricing": "/v/pricing",
  "/contact": "/v/contact",
  "/privacy": "/v/privacy",
  "/terms": "/v/terms",
  "/refunds": "/v/refunds",
};

// Marketing /v/* paths should never show in the URL bar — bounce them to
// their clean alias (the rewrite above then serves the same content). App
// paths (/v/account*, /v/checkout, /v/showcase) are intentionally left alone.
const VANITY_REDIRECTS: Record<string, string> = {
  "/v": "/",
  "/v/how": "/how",
  "/v/automates": "/automates",
  "/v/pricing": "/pricing",
  "/v/contact": "/contact",
  "/v/privacy": "/privacy",
  "/v/terms": "/terms",
  "/v/refunds": "/refunds",
};

// The old sansxel app surfaces (/account workshop, /app) still exist as
// routes in this codebase, but on vraelis they must NEVER show — the
// clean /account and /app URLs serve the vraelis account area instead.
function isSansxelApp(path: string): boolean {
  return (
    path === "/account" ||
    path.startsWith("/account/") ||
    path === "/app" ||
    path.startsWith("/app/")
  );
}

export default function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Redirect internal marketing /v paths to their clean alias so the URL bar
  // never shows /v. (Rewrites of clean → /v below don't re-trigger this.)
  const vanity =
    VANITY_REDIRECTS[path] ??
    (path === "/v/articles" || path.startsWith("/v/articles/") ? path.slice(2) : undefined);
  if (vanity) {
    const url = req.nextUrl.clone();
    url.pathname = vanity;
    return NextResponse.redirect(url);
  }

  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  const isAppSubdomain = host === "app.vraelis.com";

  let target =
    CLEAN_PATHS[path] ??
    (path === "/articles" || path.startsWith("/articles/")
      ? `/v${path}`
      : isSansxelApp(path)
        ? "/v/account"
        : undefined);

  // On app.vraelis.com the root IS the signed-in app/account, not the
  // marketing home. (vraelis.com stays the marketing site.)
  if (isAppSubdomain && path === "/") {
    target = "/v/account";
  }

  if (target) {
    const url = req.nextUrl.clone();
    url.pathname = target;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  // Match all paths EXCEPT Next internals (_next/*) and anything that
  // looks like a file (favicon.ico, og-image.png, etc.).
  matcher: ["/((?!_next/|.*\\.[a-zA-Z0-9]+$).*)"],
};
