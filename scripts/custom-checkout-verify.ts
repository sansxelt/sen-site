// In-app checkout: the safety properties, asserted structurally.
//
// This exists because the change it guards is not a change of appearance. Moving payment onto our own page
// means the SUBSCRIPTION IS CREATED BEFORE ANY MONEY MOVES, which is the opposite of how Stripe Checkout
// behaves, and every entitlement guard in the webhook was written under the old assumption.
//
// THE HOLE THIS CLOSES. Each guard tested for "canceled | unpaid | incomplete_expired" and treated
// anything else as entitled. A subscription sitting at `incomplete` therefore fell through to the GRANT
// branch in all four product paths (team, rank/_v1, flip, vraelis). It was unreachable while Checkout was
// the only way to subscribe, because Checkout does not create the subscription until payment succeeds. The
// moment anything creates one with payment_behavior "default_incomplete", opening the checkout screen and
// never paying would hand out a paid plan. That is the bug this file is here to keep closed.
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

const webhook = readFileSync("app/api/stripe/webhook/route.ts", "utf8");
const intent = readFileSync("app/api/v/subscribe/intent/route.ts", "utf8");
const flag = readFileSync("lib/custom-checkout.ts", "utf8");
const panel = readFileSync("app/rank/app/checkout/checkout-own.tsx", "utf8");
const page = readFileSync("app/rank/app/checkout/page.tsx", "utf8");
const code = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

console.log("── an unpaid subscription grants nothing, and revokes nothing ──");
{
  const body = code(webhook);
  // The guard has to sit at the TOP of the single subscription entry point, before any product dispatch,
  // or a path added later inherits the old behaviour by default.
  const entry = body.indexOf("async function handleSubscriptionChange");
  const guard = body.indexOf('subscription.status === "incomplete"', entry);
  const firstDispatch = body.indexOf('subscription.metadata?.type === "team_seats"', entry);
  ok("the webhook has a single subscription entry point", entry !== -1);
  ok("it returns early on an unpaid subscription", guard !== -1 && /return;/.test(body.slice(guard, guard + 260)));
  ok("that guard runs BEFORE any product dispatch", guard !== -1 && firstDispatch !== -1 && guard < firstDispatch);
  // Both directions. `incomplete` must not grant; `incomplete_expired` must not REVOKE, because an
  // abandoned upgrade expiring would otherwise cancel the plan the customer is still paying for.
  ok("incomplete_expired is caught by the same early return, so an abandoned upgrade cannot clear a live plan",
    /incomplete_expired/.test(body.slice(guard, guard + 260)));
  // The old dispatch is only safe with the guard above it; prove it is still the shape that needs one.
  ok("the downstream guards still treat anything non-terminal as entitled (which is why the early return matters)",
    /\["canceled", "unpaid", "incomplete_expired"\]/.test(body));
}

console.log("\n── the intent route cannot quietly double-charge ──");
{
  const body = code(intent);
  ok("one subscription per owner (409 rather than a second plan)", /already_subscribed/.test(body) && /getPlanV1State/.test(body));
  ok("an existing unpaid subscription is REUSED, not stacked",
    /status: "incomplete"/.test(body) && /reusable/.test(body));
  ok("reuse matches plan AND cycle AND price, so switching plans mid-flow does not pay the old price",
    /s\.metadata\?\.plan === plan/.test(body) && /s\.metadata\?\.cycle === cycle/.test(body)
    && /price\?\.id === price/.test(body));
  ok("create pins an idempotency key, so a racing double POST yields one subscription",
    /idempotencyKey/.test(body) && /subscriptions\.create\(/.test(body));
  ok("a subscription with no usable intent is cancelled rather than left dangling",
    (body.match(/subscriptions\.cancel\(/g) ?? []).length >= 2);
}

console.log("\n── the webhook is still the only thing that grants a plan ──");
{
  const body = code(intent);
  // The route may create Stripe objects. It may not write entitlement. If it ever does, activation has two
  // authorities and they will disagree the first time a payment fails after the write.
  for (const forbidden of ["setPlanV1(", "setSubscription(", "grantCredits(", "recordVraelisPlan("]) {
    ok(`the intent route never calls ${forbidden}`, !body.includes(forbidden));
  }
  ok("it carries the SAME metadata the webhook dispatches on",
    /type: "v_plan"/.test(body) && /user_id: owner/.test(body));
  ok("the panel does not claim the plan is active on return",
    /only activation authority/.test(panel) || !/plan is (now )?active/i.test(code(panel)));
}

console.log("\n── card data never reaches us ──");
{
  const body = code(panel);
  ok("payment fields are Stripe's PaymentElement, not our inputs", /<PaymentElement/.test(body));
  ok("no raw card field is rendered anywhere in the panel",
    !/name=["'](cardNumber|cvc|number|exp)/i.test(body) && !/autoComplete=["']cc-/i.test(body));
  ok("confirmation goes through stripe.confirmPayment", /stripe\.confirmPayment\(/.test(body));
  ok("a 3D Secure challenge has somewhere to come back to", /return_url/.test(body));
}

console.log("\n── it is off, and off means absent ──");
{
  ok("the flag defaults OFF", /=== "1"/.test(code(flag)) && !/!==/.test(code(flag)));
  // code(), not the raw file: lib/custom-checkout.ts explains in prose that it is deliberately not a
  // NEXT_PUBLIC_ variable, and scanning the comment fails the check the comment exists to document.
  ok("the flag is NOT public, so the server is the only authority on which checkout renders",
    !/NEXT_PUBLIC/.test(code(flag)));
  ok("the endpoint 404s while the flag is off", /customCheckoutEnabled\(\)/.test(code(intent)) && /not_found/.test(code(intent)));
  ok("the page reads the flag on the server", /customCheckoutEnabled\(\)/.test(code(page)));
  ok("with the flag off the page still renders the known-good Checkout path", /<CheckoutClient/.test(code(page)));
  // Scope, stated: subscriptions only. Top-ups and legacy plans keep Checkout, so this change cannot
  // affect them at all.
  ok("only _v1 subscription plans take the new panel", /ownCheckout && v1Plan/.test(code(page)));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
