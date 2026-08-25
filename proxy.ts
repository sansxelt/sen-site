import { NextResponse } from "next/server";
import { csrfVerdict } from "@/lib/csrf";
import type { NextRequest } from "next/server";
import { isAppPath, legacyToNew, legacyRunsPath, legacySystemsPath } from "./lib/app-routes";
import { v6GroundAtTop, type Ground } from "./lib/v6-routes";
import { stealthConfigured, verifyStealthCookie, STEALTH_COOKIE } from "./lib/stealth";

// vraelis.com: Vraelis Rank. Clean public paths map onto the internal /rank
// route group; /rank/* bounce back to their clean alias so /rank never shows.
// Archived products (Flip) and retired lead-agent marketing redirect home.
// /signin, /api/*, and legal pages pass through / are mapped explicitly.

// ── THE V6 PROMOTION, BEHIND ONE FLAG ──────────────────────────────────────────────────────────────
//
// V6 is a complete public site living under /dev-preview/v6. Promoting it is a mapping change, not a file
// move: the clean public paths already route through this table, so pointing them at the V6 tree swaps the
// whole site at once and swapping back is the same edit in reverse.
//
// NEXT_PUBLIC_VRAELIS_V6_PUBLIC=1 turns it on. Off, nothing here changes and the current site serves
// exactly as before. It is NEXT_PUBLIC_ because lib/v6-routes.ts reads the same flag to decide whether
// constructed navigation points at /dev-preview/v6/... or at the clean paths; both must agree or links and
// routes disagree about where the site lives.
//
// Only routes V6 actually has are listed. A clean path with no V6 page keeps its current target rather than
// rewriting to a 404, which is why this is an explicit map and not a prefix rule.
export const v6Public = () => process.env.NEXT_PUBLIC_VRAELIS_V6_PUBLIC === "1";

// EXPORTED so app/sitemap.ts can derive the public route list from the SAME source that routes it. A
// sitemap with its own hand-written list is a sitemap that eventually advertises a generation of the site
// that no longer serves, which is exactly what happened at promotion: it listed /how-it-works and
// /free-report (both still the previous site) and none of the nine routes design 06 added.
export const V6_EXACT: Record<string, string> = {
  "/": "/dev-preview/v6",
  "/developers": "/dev-preview/v6/developers",
  "/research": "/dev-preview/v6/research",
  "/privacy": "/dev-preview/v6/privacy",
  "/terms": "/dev-preview/v6/terms",
  "/refunds": "/dev-preview/v6/refunds",
  "/subprocessors": "/dev-preview/v6/subprocessors",
  "/security": "/dev-preview/v6/security",
  "/company": "/dev-preview/v6/company",
  "/platform": "/dev-preview/v6/platform",
  "/method": "/dev-preview/v6/method",
  "/agents": "/dev-preview/v6/agents",
  "/integrations": "/dev-preview/v6/integrations",
  "/changelog": "/dev-preview/v6/changelog",
  "/docs": "/dev-preview/v6/docs",
  // Added in the reframe: commercial, honesty and legal surfaces V6 was missing. /sso and /how-it-works are
  // deliberately absent: SSO folded into /enterprise, and how-it-works is superseded by /method + /platform.
  "/pricing": "/dev-preview/v6/pricing",
  "/enterprise": "/dev-preview/v6/enterprise",
  "/limitations": "/dev-preview/v6/limitations",
  "/contact": "/dev-preview/v6/contact",
  "/data-rights": "/dev-preview/v6/data-rights",
  "/trademark": "/dev-preview/v6/trademark",
  "/readme": "/dev-preview/v6/readme",
};

export const CLEAN_EXACT: Record<string, string> = {
  "/": "/rank",
  "/how-it-works": "/rank/how-it-works",
  "/pricing": "/rank/pricing",
  "/free-report": "/rank/free-report",
  "/developers": "/rank/developers",
  "/research": "/rank/research",
  // Was UNMAPPED and 404ing in production while the homepage and every article linked to it. The page has
  // existed for a long time; nothing surfaces an unmapped route until someone clicks the link.
  "/limitations": "/rank/limitations",
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

// THE GROUND THIS REQUEST WILL RENDER ON, decided from the RESOLVED target rather than the incoming path,
// because the target is what actually says which tree renders. The root layout reads this off the request
// and paints <html> with it, which is the only moment early enough to matter: the browser paints its first
// frame from the colour scheme on the opening <html> tag, before any stylesheet or inline <style> has been
// seen. Establishing darkness anywhere further down the document is a white flash by construction.
export const GROUND_HEADER = "x-vraelis-ground";

// THE PATH THE VISITOR ASKED FOR, CARRIED THROUGH THE CURTAIN REWRITE.
//
// Curtained requests are rewritten to /curtain so the real page never renders. That fixed the payload leak
// and cost something nobody noticed: /curtain has no metadata of its own, so the root layout became the only
// thing deciding robots, and the root layout is restrictive. The homepage exemption, which the whole
// argument in robotsMeta() rests on, silently stopped applying.
//
// The rewrite target cannot tell which path was asked for, so it is forwarded. Same mechanism as the ground
// header above, for the same reason: a rewrite loses the question and the answer depends on it.
export const CURTAIN_PATH_HEADER = "x-vraelis-curtained-path";

function groundFor(target: string): Ground {
  if (target.startsWith("/rank/app")) return "graphite";                 // the signed-in product
  if (target === "/signin" || target === "/signup" || target.startsWith("/auth/")) return "graphite";
  if (target === "/dev-preview/v6" || target.startsWith("/dev-preview/v6/")) {
    return v6GroundAtTop(target.slice("/dev-preview/v6".length) || "/");
  }
  // Anything the maps did not claim renders the 404, which is design 06 and therefore graphite. Left as
  // cream, the browser painted a pale first frame behind a near-black page: the same flash that was fixed
  // everywhere else, on the one surface the router cannot describe in advance because its path matched
  // nothing. Unpromoted the 404 is still the previous generation's, so this follows the flag.
  if (v6Public()) return "graphite";
  return "cream";                                                        // the previous generation
}

function withGround(req: NextRequest, target: string) {
  const headers = new Headers(req.headers);
  headers.set(GROUND_HEADER, groundFor(target));
  return { request: { headers } };
}

// WHILE THE CURTAIN IS DOWN, NOTHING IS INDEXABLE. AS A HEADER, NOT A META TAG.
//
// The root layout already returns robots:noindex while stealth is on. It does not hold: Next merges
// metadata from the matched route segments and the DEEPEST one wins, so app/dev-preview/v6/layout.tsx,
// which flips robots on the promotion flag, overrode it. The result was every page serving "Not open yet."
// to a crawler while telling it `index, follow` under a real title like "Pricing | Vraelis". That is worse
// than being absent: it teaches search engines the pages are empty, which is exactly the impression the
// root layout's own comment says must not outlive the launch.
//
// X-Robots-Tag applies to the whole response and cannot be overridden by anything inside the document, so
// it covers every route including ones that do not exist yet. Fixing only the layouts that exist today
// would be the same enumeration mistake that left the stealth curtain with a green scrollbar.
// ── ONE EXCEPTION, AND ONLY ONE: THE HOMEPAGE ────────────────────────────────────────────────────────
//
// Blanket noindex had a consequence nobody had followed through. robots.txt says Allow: / and advertises a
// sitemap, so crawlers arrive, fetch, read noindex on every single page, and drop the lot. The end state
// is vraelis.com absent from search entirely, at which point the ONLY descriptions of this company left
// anywhere are the LinkedIn and X profiles, which still carry the product that was retired. The stale
// answer an AI gives when asked what Vraelis is would stop being a cache artefact and become the only
// thing there is.
//
// The homepage is the one page where being indexed costs nothing. Curtained, it renders "Not open yet",
// the one-sentence description, and no product surface of any kind, so a crawler that indexes it learns
// the company's name and what it does and nothing that stealth exists to hide. Everything else keeps the
// blanket, for the reason above: a real title like "Pricing | Vraelis" over an empty curtain teaches a
// search engine the page is hollow, which is worse than absence.
//
// This is NOT coming out of stealth. Nothing about what a visitor sees changes.
function noindexWhileStealthed(res: NextResponse, pathname?: string) {
  if (!stealthConfigured()) return res;
  if (pathname === "/") return res;
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

function go(req: NextRequest, pathname: string, kind: "redirect" | "rewrite") {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  if (kind === "redirect") return NextResponse.redirect(url);
  return noindexWhileStealthed(NextResponse.rewrite(url, withGround(req, pathname)), req.nextUrl.pathname);
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

  // ── THE CURTAIN IS ENFORCED HERE, BECAUSE A LAYOUT IS TOO LATE ──────────────────────────────────────
  //
  // lib/stealth.ts opens by promising that while stealth is on "the real layout, the real pages and the RSC
  // payload are never generated, so there is nothing to read in the page source". That was not true, and it
  // had not been true in production. The root layout returns the curtain INSTEAD OF children, which decides
  // what is displayed and decides nothing about what is serialized: Next renders the matched page segment
  // regardless and streams it into the flight payload.
  //
  // Measured against production before this change, with no cookie of any kind: the curtained /platform
  // returned 90,867 bytes against the homepage's 17,888, and grepping that response found "One system that
  // follows every responsibility", "What Vraelis observes is the run" and the whole Live-today list. The
  // entire site was readable with curl and a grep by anyone who tried, while appearing to be behind a
  // curtain. Everything published about stealth being a curtain over the site was wrong about the part that
  // matters, and nothing in the visible page would ever have shown it.
  //
  // A layout cannot fix this. By the time a layout runs, the segment it is wrapping is already scheduled to
  // render. The only place that can stop a page from being rendered at all is in front of the renderer,
  // which is here. Rewriting to a route whose page returns null leaves the payload with nothing in it.
  //
  // WHAT STAYS OPEN, unchanged from what lib/stealth.ts already documents: /api, because OAuth callbacks,
  // webhooks and the worker have to keep working behind the curtain; /v1, the versioned public API, which
  // rewrites into /api; /yc, the reviewer entrance, which is how the cookie is obtained in the first place;
  // and /og, whose image routes carry no layout and no product surface and are what a shared link preview
  // renders. Everything else is curtained on BOTH hosts, exactly as before, minus the leak.
  //
  // The cookie is verified, not merely present-checked. Proxy runs on the Node.js runtime in Next 16, so the
  // same HMAC verification the root layout performs runs here too and a forged cookie gets the curtain. A
  // presence check would have handed the whole leak back to anyone who set the cookie to any value at all.
  //
  // noindex still follows the original path via go(), so the homepage keeps the one indexable exemption
  // robotsMeta() documents and every other curtained path keeps its noindex header.
  const curtainExempt =
    path === "/v1" || path.startsWith("/v1/") ||
    path.startsWith("/api/") || path === "/yc" ||
    path === "/og" || path.startsWith("/og/");
  if (
    !curtainExempt && stealthConfigured() &&
    !verifyStealthCookie(req.cookies.get(STEALTH_COOKIE)?.value)
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/curtain";
    const headers = new Headers(req.headers);
    headers.set(GROUND_HEADER, "graphite");
    headers.set(CURTAIN_PATH_HEADER, path);
    return noindexWhileStealthed(NextResponse.rewrite(url, { request: { headers } }), path);
  }

  // 00) The PUBLIC API namespace. /v1/* is the versioned surface machines call; it is served by the route
  //     handlers under /api/v1/*. Rewritten rather than redirected so a client never has to follow a hop
  //     (an agent, a CI runner, or curl -X POST without -L would silently lose its body on a 307/308).
  //     Runs before the host split because the public API answers identically on either host: a caller
  //     should never have to know which hostname the dashboard happens to live on.
  if (path === "/v1" || path.startsWith("/v1/")) return go(req, "/api" + path, "rewrite");

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
    // Legacy clean-path run report -> the renamed /passes route (308, canonical app host, query kept). The
    // target /passes never matches legacyRunsPath, so this cannot loop; runs BEFORE the product rewrite.
    const appHostRuns = legacyRunsPath(path);
    if (appHostRuns) return goAbs(req, `https://app.vraelis.com${appHostRuns}`);
    // The same for the word that moved: /applications/* is now an old spelling of /systems/*, and on this
    // host it must be redirected before the product rewrite below, which would otherwise try to serve a
    // directory that no longer exists. legacyRunsPath already ran, so a link with both dead words is done.
    const appHostSystems = legacySystemsPath(path);
    if (appHostSystems) return goAbs(req, `https://app.vraelis.com${appHostSystems}`);
    // /developers means two different things, on purpose, and the host is what decides which.
    //
    //   vraelis.com/developers      public documentation, no sign-in, indexable
    //   app.vraelis.com/developers  the authenticated console: keys, scopes, ceilings, usage
    //
    // It deliberately is NOT in APP_ROOTS. isAppPath is host-agnostic and the MAIN host uses it to bounce
    // product paths over to the app subdomain, so adding "developers" there would redirect the public
    // documentation to app.vraelis.com and put a sign-in wall in front of the page whose entire job is to
    // be readable before you have an account.
    if (path === "/developers" || path.startsWith("/developers/")) {
      return go(req, "/rank/app/developers" + path.slice("/developers".length), "rewrite");
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
  if (path.startsWith("/api/")) {
    // CSRF: the only place every API request passes through, so the check lives here rather than in 66
    // route handlers. It enforces ONLY when the request both mutates and carries our session cookie —
    // see lib/csrf.ts for why that shape exempts webhooks, cron, API-key, CLI and public-form traffic by
    // construction instead of by a list that would drift.
    const verdict = csrfVerdict({
      method: req.method,
      cookieHeader: req.headers.get("cookie"),
      origin: req.headers.get("origin"),
      secFetchSite: req.headers.get("sec-fetch-site"),
      host: req.headers.get("x-forwarded-host") || req.headers.get("host"),
      proto: req.headers.get("x-forwarded-proto") || "https",
    });
    if (verdict.enforced && !verdict.ok) {
      console.warn("[csrf] refused a cross-origin state change:", verdict.reason, path);
      return NextResponse.json({ error: "cross_origin_blocked" }, { status: 403 });
    }
    return NextResponse.next();
  }

  // ONCE PROMOTED, THE PREVIEW NAMESPACE IS NOT A SECOND ADDRESS FOR THE SITE.
  //
  // The V6 tree lives at /dev-preview/v6 and the clean paths REWRITE onto it, which means that after
  // promotion every page answered at two URLs: /pricing and /dev-preview/v6/pricing, both returning 200 and
  // both emitting index,follow (layout.tsx flips robots on the same flag). The canonical tag on the preview
  // copy already points at the clean path, so search engines would consolidate, but a canonical is a hint
  // and not a directive, and there is no reason to publish a second address at all.
  //
  // So promoted, the preview path permanently redirects to the clean one. This is the same mapping
  // lib/v6-routes.ts performs for constructed navigation: V6_BASE becomes "", so /dev-preview/v6/x is
  // simply /x. Unpromoted nothing changes and the preview stays reachable for review.
  //
  // A rewrite does not re-enter middleware, so redirecting the incoming preview path cannot interfere with
  // the internal rewrite that serves the clean path from this same tree. Only /dev-preview/v6 is claimed;
  // the older design previews under /dev-preview/* are untouched.
  // 308, not the helper's default 307: the preview address is permanently superseded once the site serves
  // from the clean paths, and a permanent redirect is what tells a crawler to drop the old URL rather than
  // keep revisiting it. The query string is preserved by clone().
  if (v6Public() && (path === "/dev-preview/v6" || path.startsWith("/dev-preview/v6/"))) {
    const url = req.nextUrl.clone();
    url.pathname = path.slice("/dev-preview/v6".length) || "/";
    return NextResponse.redirect(url, 308);
  }

  // Reviewer entrance: a clean /yc?k=<code> onto the route handler that opens the stealth curtain. A
  // handler rather than a page, because handlers skip layouts and the stealth gate lives in the root
  // layout. Rewritten (not redirected) so the code never bounces through a visible URL.
  if (path === "/yc") return go(req, "/api/yc", "rewrite");
  if (isProd && (path === "/app" || path.startsWith("/app/"))) {
    return goAbs(req, `https://app.vraelis.com${legacyToNew(path)}`);
  }
  // Legacy clean-path run report -> renamed /passes (308). In prod it also carries onto the canonical app
  // host in one hop; on localhost it redirects in place. Runs BEFORE the isAppPath rewrite; /passes itself
  // never matches legacyRunsPath, so no loop. (The old /app-prefix form is handled by legacyToNew above.)
  const cleanRuns = legacyRunsPath(path);
  if (cleanRuns && !path.startsWith("/app")) {
    if (isProd) return goAbs(req, `https://app.vraelis.com${cleanRuns}`);
    const url = req.nextUrl.clone(); url.pathname = cleanRuns;                // query preserved by clone()
    return NextResponse.redirect(url, 308);
  }
  // /applications/* -> /systems/* (308). The pages moved; this is what keeps every bookmark, webhook
  // payload and shared report URL emitted before the move landing on them. Runs AFTER legacyRunsPath so a
  // link carrying both dead words is corrected in one hop, and BEFORE the isAppPath rewrite because
  // "applications" is still in APP_ROOTS and would otherwise rewrite into a directory that no longer exists.
  const cleanSystems = legacySystemsPath(path);
  if (cleanSystems) {
    if (isProd) return goAbs(req, `https://app.vraelis.com${cleanSystems}`);
    const url = req.nextUrl.clone(); url.pathname = cleanSystems;             // query preserved by clone()
    return NextResponse.redirect(url, 308);
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
  //
  // /security folded into /enterprise in the Rank-era site because there was no security page. V6 has a real
  // one, so once promoted this rule would send readers away from a page that exists. Same shape as the
  // /platform redirect in next.config: a rule that was correct for the site that had no such page, and wrong
  // for the site that does.
  if (!v6Public() && path === "/security") return go(req, "/enterprise", "redirect");

  // ── THE PREVIOUS GENERATION, STILL ANSWERING AT 200 ───────────────────────────────────────────────
  //
  // CLEAN_EXACT is an explicit map so that a clean path with no V6 page keeps its old target rather than
  // 404ing. That was the right call DURING the promotion and became a liability the moment it finished:
  // four paths had no V6 successor, so they quietly went on serving the previous company's site. Searching
  // for Vraelis surfaced vraelis.com/how-it-works, a page from a product generation this repo has
  // replaced, sitting at 200 with its own title template.
  //
  // The sitemap never advertised them, which is why this was invisible: it derives from V6_EXACT and has
  // been correct the whole time. These are indexed leftovers from before promotion, and a page nobody
  // links to is still the first result if it is the one Google already has.
  //
  // 301, not the helper's 307. A permanent redirect is the only status that tells a crawler to DROP the old
  // URL and pass its history to the new one. A temporary redirect keeps the old address in the index
  // indefinitely, which is exactly the state being fixed.
  //
  // Only while V6 is promoted. Unpromoted, these are the live site and must keep working.
  if (v6Public()) {
    const RETIRED: Record<string, string> = {
      "/how-it-works": "/method",       // superseded by /method and /platform
      "/sso": "/enterprise",            // SSO folded into the enterprise page
      "/free-report": "/pricing",       // an offer page for a lead loop that no longer runs
      "/demo": "/contact",              // booking a demo is a conversation, and /contact is where it lives
    };
    const successor = RETIRED[path];
    if (successor) {
      const url = req.nextUrl.clone();
      url.pathname = successor;
      return NextResponse.redirect(url, 301);
    }
  }

  // 2) Archived / retired -> home.
  if (
    path === "/flip" || path.startsWith("/flip/") ||
    ["/how", "/automates", "/showcase"].includes(path) ||
    // All retired Rank /v/* pages -> home. The legal /v/* vanity paths (privacy/terms/refunds/contact)
    // are already redirected to their clean paths by VANITY_EXACT above, so they never reach here; this
    // catch-all closes the gap where /v/automates, /v/showcase, /v/checkout used to fall through and render
    // the retired product.
    path === "/v" || path.startsWith("/v/")
  ) {
    return go(req, "/", "redirect");
  }

  // 2a) Retired "AI output QA" guides — an SEO content section for the retired AI-output-checker product
  // (not the current production-verification product, and orphaned from the live nav). Redirect the index
  // and every guide slug to the current product story so no retired positioning is reachable or indexed.
  if (path === "/guides" || path.startsWith("/guides/")) {
    return go(req, "/how-it-works", "redirect");
  }

  // 2a') Human evaluation is a RETIRED product (different buyer, workflow, vocabulary, data model). /vote was
  // its last surface still rendered and indexable ("you're the judge… Decision Packages"), so it is the one
  // real public leak the audit found. Send it home to the current product. The vote pages themselves were
  // deleted in the retirement (app/rank/vote is gone); this redirect is what keeps old links off a 404.
  if (path === "/vote" || path.startsWith("/vote/")) {
    return go(req, "/", "redirect");
  }

  // 2b) Retired sansxel "Vraelis AI" surface (the old marketing + app: glasses
  // hero, product, platform, learn, chat, account, pay, …). vraelis.com is
  // Vraelis Rank now, and `/` already serves Rank, so these stray routes just
  // leak another product; send them all home. (Rank's own /app, /vote, /signin,
  // /api, /r, /embed, /og, /auth are untouched.)
  // A PROMOTED V6 ROUTE IS NOT A RETIRED ONE. /platform is on this retired list from the sansxel era AND is
  // a main nav item in V6, so with the flag on it was redirected home before the V6 map was ever consulted:
  // a top-level navigation link that bounced to the homepage. The V6 map wins, and anything V6 does not
  // claim is still retired exactly as before.
  if (!(v6Public() && path in V6_EXACT)
      && SANSXEL.some((p) => path === p || path.startsWith(p + "/"))) {
    return go(req, "/", "redirect");
  }

  // 2c) Legacy AI-output checker: RETIRED and deleted (the flag-gated /app/legacy/checks surface is gone).
  // Every historical /app/checks link (emails, bookmarks, share pages) redirects home like the other
  // retired products above.
  if (path === "/app/checks" || path.startsWith("/app/checks/")) {
    return go(req, "/", "redirect");
  }

  // 3) Clean public paths -> the internal route group (rewrite; URL stays clean).
  //
  // With the V6 flag on, its map is consulted FIRST and falls through to the current site for any path V6
  // does not have. So promotion never produces a 404: an unmapped path keeps serving what it serves today.
  let target = v6Public() ? V6_EXACT[path] : undefined;
  if (!target) target = CLEAN_EXACT[path];
  if (!target) {
    // Docs articles live under /docs/<slug> in V6, so the section needs the prefix form too.
    if (v6Public() && path.startsWith("/docs/")) target = "/dev-preview/v6" + path;
    else if (path === "/app" || path.startsWith("/app/")) target = "/rank" + path;
    // Research articles live at /research/<slug>, so the section needs the PREFIX form as well as the exact
    // entry above. A section with only an exact mapping serves its index and 404s every article under it.
    //
    // Promoted, they render in design 06 like everything else. They were the last surface still serving the
    // previous generation: indexed, in the sitemap, and linked from nothing, so a reader arriving from
    // search landed inside the old company with the old navigation. The renderer at
    // app/dev-preview/v6/research/[slug] reads the SAME registry, so this is a presentation change and not
    // a second copy of the writing.
    else if (path.startsWith("/research/")) target = (v6Public() ? "/dev-preview/v6" : "/rank") + path;
  }
  if (target) return go(req, target, "rewrite");

  // /signup IS AN ADDRESS, NOT A ROUTE. Two places above already treat it as one: groundFor() declares it
  // graphite, and the app-host split sends it to the brand site. Neither is wrong, but no app/signup segment
  // exists and it is not in V6_EXACT, so on this host it reached the fall-through below and rendered a 404.
  // Creating an account is a MODE of the sign-in page (app/signin/page.tsx:46 reads ?mode=signup), not a
  // second surface, so the advertised address has to land on that mode rather than on a page of its own.
  //
  // Built by hand rather than through go(), which assigns the whole string to url.pathname and would encode
  // the query into the path. 308 because this alias is permanent and there will never be a route here.
  if (path === "/signup") {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("mode", "signup");
    return NextResponse.redirect(url, 308);
  }

  // Not rewritten: the path renders as itself. /signin and /auth/* arrive here, and they are graphite.
  return noindexWhileStealthed(NextResponse.next(withGround(req, path)), path);
}

export const config = {
  // Run on every path EXCEPT Next internals and genuine static assets. Excluding only a fixed list of
  // asset extensions (not "anything with a dot") is deliberate: the old `.*\.[a-zA-Z0-9]+$` pattern let any
  // dotted path (e.g. /learn/a.b) BYPASS every retirement redirect and render a retired route. A real page
  // path can contain a dot, so we must not skip the proxy for it.
  matcher: ["/((?!_next/|[^?]*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|avif|css|js|mjs|map|txt|xml|json|woff2?|ttf|otf|eot|pdf|mp4|webm|wasm)(?:$|\\?)).*)"],
};
