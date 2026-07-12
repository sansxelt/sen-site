// Verifies the V1.1 S1 first-party payment experience (docs/v1.1-program-plan.md sections 7 + 9):
// the single return-URL allowlist (lib/return-urls.ts) rejects every open-redirect shape and yields the
// canonical four billing return routes; the subscribe/checkout/portal routes build their Stripe return
// URLs ONLY from that module; the /billing/success page never activates from the redirect (webhook
// authority + poll); the duplicate-checkout guard is present (409 already_subscribed + 10-minute session
// reuse); and the billing page renders raw provider IDs only inside the Technical details disclosure.
// Pure unit tests + static source checks; no DB, no network.
import { readFileSync, existsSync } from "node:fs";
import { safeReturnPath, familyUrl, billingReturnUrls, topupReturnUrl, stripeReturnUrl, BILLING_RETURN_PATHS } from "../lib/return-urls";
import { getSafeRedirectPath } from "../lib/auth-ui";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const read = (p: string) => readFileSync(p, "utf8");

// ── 1. safeReturnPath: every open-redirect shape collapses to "/", real deep links pass through ──
console.log("── safeReturnPath ──");
const KEEP = [
  "/",
  "/plans",
  "/billing/success?session_id=cs_test_a1B2c3",
  "/applications/abc-123/passes/42?tab=evidence#screenshots",
  "/signin?callbackUrl=%3Fx%3D1",
];
for (const p of KEEP) ok(`preserves deep link ${p}`, safeReturnPath(p) === p);
const REJECT: [string, unknown][] = [
  ["protocol-relative", "//evil.com/phish"],
  ["backslash origin trick", "/\\evil.com"],
  ["double backslash", "\\\\evil.com"],
  ["backslash inside path", "/ok/\\evil"],
  ["absolute https", "https://evil.com/x"],
  ["absolute family host (relative-only helper)", "https://app.vraelis.com/billing"],
  ["scheme smuggle", "javascript:alert(1)"],
  ["dot-segment traversal", "/a/../admin"],
  ["lone dot segment", "/./x"],
  ["encoded slashes", "/%2F%2Fevil.com"],
  ["encoded backslash", "/%5Cevil.com"],
  ["encoded dot traversal", "/a/%2e%2e/b"],
  ["newline injection", "/ok\nSet-Cookie: x"],
  ["carriage return", "/ok\rx"],
  ["null byte", "/ok" + String.fromCharCode(0) + "x"],
  ["empty string", ""],
  ["non-string (number)", 42],
  ["non-string (null)", null],
  ["non-string (undefined)", undefined],
  ["overlong path", "/" + "a".repeat(2001)],
];
for (const [name, v] of REJECT) ok(`rejects ${name}`, safeReturnPath(v) === "/");

// getSafeRedirectPath (auth-ui) now delegates here: the backslash trick must not survive it either.
ok("getSafeRedirectPath keeps a clean deep link", getSafeRedirectPath("/billing") === "/billing");
ok("getSafeRedirectPath rejects the backslash origin trick", getSafeRedirectPath("/\\evil.com") === "/account");
ok("getSafeRedirectPath rejects protocol-relative", getSafeRedirectPath("//evil.com") === "/account");
ok("getSafeRedirectPath keeps its /account default", getSafeRedirectPath(undefined) === "/account" && getSafeRedirectPath("https://evil.com") === "/account");

// ── 2. familyUrl: only https vraelis.com + subdomains ──
console.log("\n── familyUrl ──");
ok("accepts apex vraelis.com", familyUrl("https://vraelis.com/pricing") === "https://vraelis.com/pricing");
ok("accepts app.vraelis.com", familyUrl("https://app.vraelis.com/billing/success") === "https://app.vraelis.com/billing/success");
ok("accepts other vraelis.com subdomains", familyUrl("https://www.vraelis.com/") === "https://www.vraelis.com/");
ok("rejects evil.com", familyUrl("https://evil.com/") === null);
ok("rejects vraelis.com.evil.com (suffix spoof)", familyUrl("https://vraelis.com.evil.com/") === null);
ok("rejects evilvraelis.com (no-dot suffix spoof)", familyUrl("https://evilvraelis.com/") === null);
ok("rejects plain http downgrade", familyUrl("http://vraelis.com/") === null);
ok("rejects embedded credentials", familyUrl("https://user:pw@vraelis.com/") === null);
ok("rejects userinfo host spoof", familyUrl("https://vraelis.com@evil.com/") === null);
ok("rejects explicit port", familyUrl("https://vraelis.com:8443/") === null);
ok("rejects relative input", familyUrl("/billing") === null);
ok("rejects garbage", familyUrl("not a url") === null && familyUrl(null) === null && familyUrl(7) === null);

// ── 3. billingReturnUrls: the four canonical routes; absolute in production, relative in dev ──
console.log("\n── billingReturnUrls ──");
{
  const urls = billingReturnUrls();
  const keys = Object.keys(urls).sort();
  ok("exactly the four canonical keys", JSON.stringify(keys) === JSON.stringify(["cancelled", "paymentFailed", "portalReturn", "success"]), keys.join(","));
  ok("paths are the canonical /billing/* routes",
    BILLING_RETURN_PATHS.success === "/billing/success" && BILLING_RETURN_PATHS.cancelled === "/billing/cancelled"
    && BILLING_RETURN_PATHS.paymentFailed === "/billing/payment-failed" && BILLING_RETURN_PATHS.portalReturn === "/billing/portal-return");
  for (const [k, v] of Object.entries(urls)) {
    ok(`${k} ends with its canonical path`, v.endsWith(BILLING_RETURN_PATHS[k as keyof typeof BILLING_RETURN_PATHS]));
  }

  const savedVercel = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "production";
  const prod = billingReturnUrls();
  ok("production: absolute app-host URLs",
    prod.success === "https://app.vraelis.com/billing/success"
    && prod.cancelled === "https://app.vraelis.com/billing/cancelled"
    && prod.paymentFailed === "https://app.vraelis.com/billing/payment-failed"
    && prod.portalReturn === "https://app.vraelis.com/billing/portal-return");
  ok("production: top-ups keep returning to /credits", topupReturnUrl() === "https://app.vraelis.com/credits");
  ok("production: stripeReturnUrl passes absolute URLs through", stripeReturnUrl(prod.success) === prod.success);
  if (savedVercel === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = savedVercel;

  if (process.env.NODE_ENV !== "production") {
    ok("dev: stays relative (appHostUrl pattern)", billingReturnUrls().success === "/billing/success" && topupReturnUrl() === "/credits");
    const savedSite = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://dev.example.test/";
    ok("dev: stripeReturnUrl absolutizes against the dev origin (Stripe requires absolute)",
      stripeReturnUrl("/billing/success") === "https://dev.example.test/billing/success");
    if (savedSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL; else process.env.NEXT_PUBLIC_SITE_URL = savedSite;
  }

  // The four canonical pages actually exist as app routes.
  for (const p of ["success", "cancelled", "payment-failed", "portal-return"]) {
    ok(`app/rank/app/billing/${p}/page.tsx exists`, existsSync(`app/rank/app/billing/${p}/page.tsx`));
  }
}

// ── 4. Static: the three payment routes build returns ONLY from the module ──
console.log("\n── routes use the module ──");
{
  const subscribe = read("app/api/v/subscribe/route.ts");
  const checkout = read("app/api/v/checkout/route.ts");
  const portal = read("app/api/v/portal/route.ts");
  ok("subscribe: imports lib/return-urls", subscribe.includes(`from "@/lib/return-urls"`));
  ok("subscribe: return_url from billingReturnUrls().success (+ session_id template kept)",
    subscribe.includes("billingReturnUrls().success") && subscribe.includes("session_id={CHECKOUT_SESSION_ID}"));
  ok("subscribe: no inline SITE_URL/APP_URL return", !subscribe.includes("SITE_URL") && !subscribe.includes("APP_URL"));
  ok("checkout (top-up): return via topupReturnUrl(), /credits?session_id flow preserved",
    checkout.includes(`from "@/lib/return-urls"`) && checkout.includes("topupReturnUrl()") && checkout.includes("session_id={CHECKOUT_SESSION_ID}"));
  ok("checkout (top-up): no inline SITE_URL/APP_URL return", !checkout.includes("SITE_URL") && !checkout.includes("APP_URL"));
  ok("portal: return via billingReturnUrls().portalReturn",
    portal.includes(`from "@/lib/return-urls"`) && portal.includes("billingReturnUrls().portalReturn"));
  ok("portal: no inline SITE_URL/APP_URL return", !portal.includes("SITE_URL") && !portal.includes("APP_URL"));
  ok("credits page still polls the legacy ?session_id= return", read("app/rank/app/credits/page.tsx").includes(`params.get("session_id")`));

  // Duplicate-checkout guard (V1.1 S1 item 5).
  ok("subscribe: 409 already_subscribed guard on an existing plan_v1",
    subscribe.includes(`"already_subscribed"`) && subscribe.includes("getPlanV1State") && subscribe.includes("409"));
  ok("subscribe: 10-minute session reuse via checkout_session_created events",
    subscribe.includes("checkout_session_created") && subscribe.includes("10 * 60") && subscribe.includes("recentEventsByType")
    && subscribe.includes(`prev.status === "open"`) && subscribe.includes("prev.client_secret"));
  ok("subscribe: logs the created session id for the reuse window", subscribe.includes("session_id: checkout.id"));
  ok("checkout client surfaces already_subscribed with a Billing pointer",
    read("app/rank/app/checkout/checkout-client.tsx").includes("already_subscribed"));
}

// ── 5. Static: /billing/success never activates from the redirect ──
console.log("\n── success page: webhook authority + poll ──");
{
  const page = read("app/rank/app/billing/success/page.tsx");
  const poller = read("app/rank/app/billing/success/activation-poller.tsx");
  ok("success page documents the webhook as the only activation authority",
    page.toLowerCase().includes("webhook is the only activation authority"));
  ok("success page treats ?session_id as display-only and ownership-checks it",
    page.includes("DISPLAY ONLY") || page.includes("display-only"));
  ok("poller polls /api/v/me", poller.includes(`fetch("/api/v/me"`));
  ok("poller cadence: every 2s up to 60s", poller.includes("POLL_MS = 2000") && poller.includes("MAX_POLLS = 30"));
  ok("poller watches plan_v1 and balance change", poller.includes("plan_v1") && poller.includes("balance"));
  ok("no mutation anywhere in the success surface (observe-only)",
    !page.includes(`method: "POST"`) && !poller.includes(`method: "POST"`));
  ok("still-processing state is honest with a support path",
    poller.includes("activation still completing") && poller.includes("help@vraelis.com"));
  ok("activated state links /plans and /applications", poller.includes(`href="/plans"`) && poller.includes(`href="/applications"`));

  const cancelled = read("app/rank/app/billing/cancelled/page.tsx");
  ok("cancelled page: nothing charged + back to /plans", cancelled.includes("No charge was made") && cancelled.includes(`href="/plans"`));
  const failed = read("app/rank/app/billing/payment-failed/page.tsx");
  ok("payment-failed page: decline guidance + retry via /plans", failed.includes("declined") && failed.includes(`href="/plans"`) && failed.includes("help@vraelis.com"));
  const portalReturn = read("app/rank/app/billing/portal-return/page.tsx");
  ok("portal-return page: re-fetches subscription state", portalReturn.includes("auth()") && portalReturn.includes("liveV1Subscription") && portalReturn.includes("getSubscription"));
  ok("portal-return page renders no raw provider ids", !portalReturn.includes(".subscriptionId") && !portalReturn.includes(".customerId") && !portalReturn.includes("stripe_subscription_id}"));
}

// ── 6. Static: billing page renders raw IDs only inside Technical details ──
console.log("\n── billing page: technical-details discipline ──");
{
  const page = read("app/rank/app/billing/page.tsx");
  const tech = read("app/rank/app/billing/technical-details.tsx");
  ok("billing page uses the TechnicalDetails disclosure", page.includes("<TechnicalDetails"));
  ok("technical-details is a collapsed <details> named Technical details", tech.includes("<details") && tech.includes("Technical details"));
  const jsxStart = page.indexOf("return (");
  const techIdx = page.indexOf("<TechnicalDetails");
  ok("billing page has a JSX body and the disclosure", jsxStart !== -1 && techIdx !== -1 && techIdx > jsxStart);
  const idRe = /stripe_subscription_id|\.subscriptionId|\.customerId/g;
  let m: RegExpExecArray | null;
  let leaked = 0;
  while ((m = idRe.exec(page))) {
    // Raw ids may appear in the logic section (reads) or inside the TechnicalDetails props, never in
    // the JSX between them (which is what actually renders to a normal user).
    if (m.index > jsxStart && m.index < techIdx) leaked++;
  }
  ok("no raw provider id rendered between the JSX start and Technical details", leaked === 0, `${leaked} leaks`);
  ok("billing page shows the past_due banner with retry guidance",
    page.includes("past_due") && page.includes("Your last payment failed") && page.includes("PaymentMethodButton"));
  ok("billing page renders native invoice history with hosted-invoice fallback",
    page.includes("listCustomerInvoices") && page.includes("hostedInvoiceUrl") && page.includes("Payment history"));
  ok("billing page reads the _v1 plan server-side (plan, cycle, renewal, cancellation)",
    page.includes("getPlanV1State") && page.includes("liveV1Subscription") && page.includes("cancelAtPeriodEnd"));
}

// ── 7. Review screen: renewal + cancellation behavior stated before payment ──
console.log("\n── native review screen ──");
{
  const v1 = read("app/rank/app/checkout/checkout-v1.tsx");
  const page = read("app/rank/app/checkout/page.tsx");
  ok("checkout renders V1RenewalTerms before payment", page.includes("<V1RenewalTerms") && v1.includes("export function V1RenewalTerms"));
  ok("terms state renewal until cancelled", v1.includes("until cancelled"));
  ok("terms state cancel-anytime with access through the paid period",
    v1.includes("Cancel anytime") && v1.includes("continue until then"));
  ok("yearly terms state up-front charge with monthly usage release",
    v1.includes("charged up front for the year") && v1.includes("monthly buckets"));
  ok("terms promise no overage billing (refuse, never surprise-charge)", v1.includes("No overage charges"));
}

// ── 8. Wiring: the suite is runnable from package.json ──
{
  const pkg = read("package.json");
  ok(`package.json exposes billing:returns:test`, pkg.includes(`"billing:returns:test"`) && pkg.includes("billing-returns-verify.ts"));
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
