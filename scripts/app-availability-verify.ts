import assert from "node:assert/strict";
import "next/dist/server/node-environment-baseline";
import { NextRequest } from "next/server";
// The installed Next 16 package still exports the matcher utility under its previous name.
import { unstable_doesMiddlewareMatch as unstable_doesProxyMatch } from "next/experimental/testing/server";
import proxy, { config } from "../proxy";
import { isClosedProductApi, isClosedProductPage, isProductEntryHref } from "../lib/app-availability";
import { APP_ROOTS } from "../lib/app-routes";

async function main() {
  const pages = ["/app", "/app/systems/demo", "/systems/demo.json", "/verifications/recorded", "/billing",
    "/checkout", "/rank/app", "/rank/app/systems/demo", "/dev-preview/v6/app", "/dev-preview/recorded-app",
    "/console", "/r/report", "/signin", "/signup", "/dev-preview/v6/signin", "/auth/signin", "/auth/auto-signin",
    ...APP_ROOTS.flatMap(root => [`/${root}`, `/${root}/record.json`])];
  for (const path of pages) {
    assert(isClosedProductPage(path, "vraelis.com"));
    assert(unstable_doesProxyMatch({ config, nextConfig: {}, url: `https://vraelis.com${path}` }), `matcher covers ${path}`);
    for (const headers of [new Headers({ host: "vraelis.com" }), new Headers({ host: "vraelis.com", rsc: "1", cookie: "__Secure-authjs.session-token=existing-session" })]) {
      const res = proxy(new NextRequest(`https://vraelis.com${path}?callbackUrl=private&token=private`, { headers }));
      assert.equal(res.status, 307);
      assert.equal(res.headers.get("location"), "https://vraelis.com/beta");
      assert.equal(res.headers.get("cache-control"), "no-store");
    }
  }
  for (const host of ["app.vraelis.com", "console.vraelis.com"]) {
    for (const path of ["/", "/developers", "/records", "/unknown"]) {
      assert.equal(proxy(new NextRequest(`https://${host}${path}`, { headers: { host } })).headers.get("location"), "https://vraelis.com/beta");
    }
  }
  assert.equal(proxy(new NextRequest("http://app.localhost:3100/", { headers: { host: "app.localhost:3100" } })).headers.get("location"), "http://localhost:3100/beta");
  const apis = ["/api/fixtures/strike", "/api/fixtures/drone", "/api/preflight/apps/x/runs", "/api/v/checkout", "/api/v/keys", "/api/v/workspace", "/api/v1/verifications",
    "/api/mcp", "/api/oauth/token", "/api/auth/register", "/api/auth/callback/google", "/api/auth/callback/credentials",
    "/api/v1/verifications/x.json", "/api/stripe/payment-intent", "/api/vraelis/checkout"];
  for (const path of apis) {
    assert(isClosedProductApi(path));
    assert(unstable_doesProxyMatch({ config, nextConfig: {}, url: `https://vraelis.com${path}` }));
    for (const host of ["vraelis.com", "app.vraelis.com"]) {
      const res = proxy(new NextRequest(`https://${host}${path}`, { method: "POST", headers: { host, cookie: "__Secure-authjs.session-token=existing-session" } }));
      assert.equal(res.status, 503);
      assert.equal((await res.json()).error, "app_access_closed");
      assert.equal(res.headers.get("cache-control"), "no-store");
    }
  }
  for (const path of ["/", "/beta", "/contact", "/docs", "/developers", "/developers/api", "/pricing", "/auth/reset-password"]) {
    assert(!isClosedProductPage(path, "vraelis.com"), `${path} remains public`);
  }
  for (const path of ["/api/contact", "/api/vraelis/contact", "/api/stripe/webhook", "/api/v/paypal/webhook", "/api/paypal/webhook",
    "/api/cron/lifecycle", "/api/v/account/delete", "/api/v/data-requests", "/api/auth/reset-password", "/api/auth/session", "/api/auth/signout"]) {
    assert(!isClosedProductApi(path), `${path} remains operational`);
  }
  for (const href of ["/app", "/signin?mode=signup", "/checkout?plan=x", "/dev-preview/v6/app", "https://app.vraelis.com", "https://console.vraelis.com/"]) assert(isProductEntryHref(href));
  for (const href of ["/docs", "/beta", "/developers/api", "https://example.com/signin", "mailto:sales@vraelis.com"]) assert(!isProductEntryHref(href));
  console.log("PASS app closure: direct routes, subdomains, RSC/session requests, product APIs, dotted paths and public/service exceptions");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
