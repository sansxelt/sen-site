import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// vraelis.com only. The marketing AND app pages live under the internal /v
// route group — that prefix exists so they can coexist with leftover sansxel
// routes (/account, /terms, …) without colliding. This proxy maps clean public
// paths onto /v and bounces any /v URL back to its clean alias, so /v NEVER
// shows in the URL bar. Everything else (/signin, /api/*, /book, /f, …) passes
// straight through.

// Clean public path -> internal /v route (exact matches).
const CLEAN_PATHS: Record<string, string> = {
  "/": "/v",
  "/how": "/v/how",
  "/automates": "/v/automates",
  "/pricing": "/v/pricing",
  "/contact": "/v/contact",
  "/privacy": "/v/privacy",
  "/terms": "/v/terms",
  "/refunds": "/v/refunds",
  "/checkout": "/v/checkout",
  "/showcase": "/v/showcase",
  "/demo": "/v/demo",
};

// Internal /v alias -> clean public path (exact matches) for the redirect.
// Prefix families (/v/account*, /v/articles*) are handled in code below.
const VANITY_REDIRECTS: Record<string, string> = {
  "/v": "/",
  "/v/how": "/how",
  "/v/automates": "/automates",
  "/v/pricing": "/pricing",
  "/v/contact": "/contact",
  "/v/privacy": "/privacy",
  "/v/terms": "/terms",
  "/v/refunds": "/refunds",
  "/v/checkout": "/checkout",
  "/v/showcase": "/showcase",
  "/v/demo": "/demo",
};

export default function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // 1) Bounce any internal /v URL to its clean alias so /v never shows in the
  //    bar. Exact aliases above, plus the /v/account* and /v/articles* families
  //    (slice off the leading "/v", preserving the subpath + query).
  let vanity = VANITY_REDIRECTS[path];
  if (
    !vanity &&
    (path === "/v/account" ||
      path.startsWith("/v/account/") ||
      path === "/v/articles" ||
      path.startsWith("/v/articles/"))
  ) {
    vanity = path.slice(2); // "/v/account/leads/1" -> "/account/leads/1"
  }
  if (vanity) {
    const url = req.nextUrl.clone();
    url.pathname = vanity;
    return NextResponse.redirect(url);
  }

  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  const isAppSubdomain = host === "app.vraelis.com";

  // 2) Map clean public paths onto the internal /v routes (rewrite — URL stays
  //    clean). Account/articles preserve their real subpaths; any other old
  //    sansxel /account|/app surface collapses to the vraelis dashboard.
  let target = CLEAN_PATHS[path];
  if (!target) {
    if (path === "/articles" || path.startsWith("/articles/")) {
      target = `/v${path}`;
    } else if (path === "/account" || path === "/app") {
      target = "/v/account";
    } else if (path.startsWith("/account/leads/") || path === "/account/find") {
      target = `/v${path}`; // real vraelis app subpaths
    } else if (path.startsWith("/account/") || path.startsWith("/app/")) {
      target = "/v/account"; // leftover sansxel subpaths -> dashboard
    }
  }

  // On app.vraelis.com the root IS the signed-in app, not the marketing home.
  if (isAppSubdomain && path === "/") target = "/v/account";

  if (target) {
    const url = req.nextUrl.clone();
    url.pathname = target;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  // Match all paths EXCEPT Next internals (_next/*) and anything that looks
  // like a file (favicon.ico, og-image.png, etc.).
  matcher: ["/((?!_next/|.*\\.[a-zA-Z0-9]+$).*)"],
};
