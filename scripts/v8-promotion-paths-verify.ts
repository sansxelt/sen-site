// What a promoted v8 (NEXT_PUBLIC_VRAELIS_V8_PUBLIC=1 in production) does to the paths that are not v8 pages.
//
// Preparing the promotion (2026-10-11) found v8 rewriting every path it did not know into its own 404, including
// account recovery (/auth/reset-password and the confirm link in emails already sent) and the retired installers
// that answer 410. This pins the behaviour the live site already has: the cleanup stays closed, recovery stays open.
process.env.NEXT_PUBLIC_VRAELIS_V8_PUBLIC = "1";
process.env.NEXT_PUBLIC_VRAELIS_V6_PUBLIC = "1";
process.env.VERCEL_ENV = "production";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

async function main() {
  const { default: proxy } = await import("../proxy");
  const at = (path: string, host = "vraelis.com", method = "GET") =>
    proxy(new NextRequest(`https://${host}${path}`, { method, headers: { host } }));
  const rewrite = (r: Response) => { const v = r.headers.get("x-middleware-rewrite"); return v ? new URL(v).pathname : null; };

  // Account recovery renders as itself, not as a v8 page.
  for (const path of ["/auth/reset-password", "/auth/reset-password/confirm", "/auth/verify-email", "/auth/confirm-signup", "/auth/verified", "/auth/error"]) {
    const r = at(path);
    assert.equal(r.headers.get("location"), null, `${path} is not redirected`);
    assert(!rewrite(r)?.startsWith("/dev-preview/v8"), `${path} is not swallowed by v8`);
  }
  // The retired installers reach their 410 routes (the CLI file never reaches the proxy: .mjs is skipped).
  for (const path of ["/install", "/install.ps1"]) {
    const r = at(path);
    assert.equal(r.headers.get("location"), null);
    assert(!rewrite(r)?.startsWith("/dev-preview/v8"), `${path} keeps its 410 route`);
  }
  // Closed product pages and the invite link still go to /beta (which v8 then sends to /contact).
  for (const path of ["/invite/x", "/signin", "/auth/signin", "/auth/auto-signin", "/r/x", "/console", "/app"]) {
    assert.equal(at(path).headers.get("location"), "https://vraelis.com/beta", `${path} stays closed`);
  }
  assert.equal(at("/beta").headers.get("location"), "https://vraelis.com/contact");
  // Closed APIs still answer 503 under v8; operational ones pass through.
  for (const path of ["/api/waitlist", "/api/paypal/setup-plans", "/api/paypal/create-subscription"]) assert.equal(at(path, "vraelis.com", "POST").status, 503, path);
  for (const path of ["/api/contact", "/api/auth/reset-password", "/api/v/data-requests", "/api/stripe/webhook", "/api/paypal/webhook"]) {
    assert.notEqual(at(path, "vraelis.com", "POST").status, 503, `${path} stays operational`);
  }
  // v8 itself: home and pages rewrite into v8, docs move to the docs host, app.vraelis.com stays closed.
  assert.equal(rewrite(at("/")), "/dev-preview/v8");
  assert.equal(rewrite(at("/contour")), "/dev-preview/v8/contour");
  assert.equal(at("/docs/contour").headers.get("location"), "https://docs.vraelis.com/contour");
  assert.equal(at("/", "app.vraelis.com").headers.get("location"), "https://vraelis.com/beta");
  console.log("PASS v8 promotion keeps account recovery open, the retired installers at 410, and every closure in place");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
