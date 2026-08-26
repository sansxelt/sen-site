// Finding H1 — PayPal tier escalation.
//
// The bug: app/api/vraelis/paypal/record/route.ts took `plan` and `cycle` from
// the REQUEST BODY, validated them only as syntactically valid enum members,
// fetched the subscription from PayPal but read only {status, billing_info} —
// never plan_id — and then stored the client's claimed tier. Any account
// holding the cheapest subscription could post plan:"growth" and cut the
// platform's take (cutRateFor) from 20% to 5% on every booking and payment.
// APPROVED was also accepted, i.e. before the first charge settled.
//
// These are behavioural tests against the real production functions, plus
// static assertions that the route cannot regress to reading the body tier.
// Pure: no DB, no network.
import { readFileSync } from "node:fs";
import {
  PAYPAL_PLANS,
  cutRateFor,
  isPaidPlanKey,
  vraelisPlanFromPaypalPlanId,
  vraelisPlanStatusFromPaypal,
} from "../lib/vraelis-plans";
import { canonicalTier } from "../lib/vraelis-plan-sync";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const read = (p: string) => readFileSync(p, "utf8");

const SOLO_M = PAYPAL_PLANS.solo.monthly;
const SOLO_Y = PAYPAL_PLANS.solo.yearly;
const GROWTH_M = PAYPAL_PLANS.growth.monthly;

// The exact decision the record route now makes, driven by the real functions.
function grant(sub: { status?: string; plan_id?: string }, forged: { plan?: string; cycle?: string }) {
  const tier = vraelisPlanFromPaypalPlanId(sub.plan_id);
  if (!tier) return { granted: false as const, reason: "unrecognized_plan" };
  const status = vraelisPlanStatusFromPaypal(sub.status);
  if (status !== "active") return { granted: false as const, reason: `not_active:${sub.status}` };
  void forged; // the forged body tier is structurally unreachable here
  return { granted: true as const, plan: tier.plan, cycle: tier.cycle };
}

// ── 1. A forged "growth" claim on a cheaper subscription stays solo ──────────
console.log("── forged tier is ignored ──");
{
  const g = grant({ status: "ACTIVE", plan_id: SOLO_M }, { plan: "growth", cycle: "monthly" });
  ok("forged growth on a solo/monthly subscription yields solo", g.granted && g.plan === "solo");
  ok("forged growth does not change the cycle", g.granted && g.cycle === "monthly");
  // 6. The platform cut cannot be reduced through client-controlled data.
  ok(
    "platform cut stays at the solo rate, not growth's",
    g.granted && cutRateFor(g.plan, g.cycle) === 0.07,
    `growth would be ${cutRateFor("growth", "monthly")}`,
  );
  ok("growth's cheaper cut is genuinely different (guards the assertion above)", cutRateFor("growth", "monthly") === 0.05);
}

// ── 2. A forged billing cycle is ignored ────────────────────────────────────
console.log("── forged cycle is ignored ──");
{
  const g = grant({ status: "ACTIVE", plan_id: SOLO_Y }, { plan: "solo", cycle: "monthly" });
  ok("forged monthly on a yearly subscription yields yearly", g.granted && g.cycle === "yearly");
  const g2 = grant({ status: "ACTIVE", plan_id: SOLO_M }, { plan: "solo", cycle: "lifetime" });
  ok("forged 'lifetime' on a monthly subscription yields monthly", g2.granted && g2.cycle === "monthly");
  ok(
    "the lifetime cut rate cannot be reached from a subscription plan_id",
    g2.granted && cutRateFor(g2.plan, g2.cycle) === 0.07,
  );
}

// ── 3. Unknown PayPal plan ids fail closed ──────────────────────────────────
console.log("── unknown plan ids fail closed ──");
for (const bad of ["P-UNKNOWN123", "", "   ", "P-8D4470953F530660SNIPFS4B", "null", "undefined"]) {
  ok(`plan_id ${JSON.stringify(bad)} does not resolve`, vraelisPlanFromPaypalPlanId(bad) === null);
  ok(`plan_id ${JSON.stringify(bad)} grants nothing`, grant({ status: "ACTIVE", plan_id: bad }, {}).granted === false);
}
for (const bad of [null, undefined]) {
  ok(`plan_id ${String(bad)} does not resolve`, vraelisPlanFromPaypalPlanId(bad) === null);
}
ok("a Stripe price id is not accepted as a PayPal plan id", vraelisPlanFromPaypalPlanId("price_1TdjlyIHI0UhMM0RrOMJryG7") === null);

// ── 4. Non-paid subscription states cannot grant an entitlement ─────────────
console.log("── only a live, paid subscription entitles ──");
for (const s of ["APPROVED", "APPROVAL_PENDING", "SUSPENDED", "CANCELLED", "EXPIRED", "", "active", "Active", "bogus"]) {
  ok(`status ${JSON.stringify(s)} does not grant`, grant({ status: s, plan_id: GROWTH_M }, {}).granted === false);
}
ok("status ACTIVE does grant", grant({ status: "ACTIVE", plan_id: GROWTH_M }, {}).granted === true);
ok("APPROVED maps to null, never 'active'", vraelisPlanStatusFromPaypal("APPROVED") === null);
ok("SUSPENDED maps to past_due", vraelisPlanStatusFromPaypal("SUSPENDED") === "past_due");
ok("CANCELLED maps to canceled", vraelisPlanStatusFromPaypal("CANCELLED") === "canceled");
ok("EXPIRED maps to canceled", vraelisPlanStatusFromPaypal("EXPIRED") === "canceled");
ok("a canceled subscription is not 'active' for entitlement", vraelisPlanStatusFromPaypal("CANCELLED") !== "active");

// ── 5. Reconciliation corrects a historically mismatched tier ───────────────
console.log("── reconcile corrects a mismatched tier ──");
{
  // A row written by the OLD route: stored growth, actually paying for solo.
  const c = canonicalTier({ plan: "growth", cycle: "monthly" }, { plan: "solo", cycle: "monthly" });
  ok("stored growth + live solo → corrected to solo", c.plan === "solo");
  ok("the correction is flagged so the cron writes it", c.tierDiffers === true);
  ok("corrected row pays the solo cut", cutRateFor(c.plan, c.cycle) === 0.07);

  const cy = canonicalTier({ plan: "solo", cycle: "yearly" }, { plan: "solo", cycle: "monthly" });
  ok("a mismatched cycle is corrected too", cy.cycle === "monthly" && cy.tierDiffers === true);

  const same = canonicalTier({ plan: "solo", cycle: "monthly" }, { plan: "solo", cycle: "monthly" });
  ok("an already-correct row is not rewritten", same.tierDiffers === false);

  // Provider gave us nothing authoritative → never clobber a good stored tier.
  const keep = canonicalTier({ plan: "growth", cycle: "yearly" }, { plan: null, cycle: null });
  ok("unresolvable live tier leaves the stored tier untouched", keep.plan === "growth" && keep.cycle === "yearly");
  ok("unresolvable live tier is not reported as a change", keep.tierDiffers === false);
  const keep2 = canonicalTier({ plan: "growth", cycle: "yearly" }, {});
  ok("absent live tier fields leave the stored tier untouched", keep2.plan === "growth" && keep2.tierDiffers === false);
}

// ── 6. Static: the route can never read a tier from the body again ──────────
console.log("── route source guarantees ──");
{
  const src = read("app/api/vraelis/paypal/record/route.ts");
  ok("route no longer reads body.plan", !/body\.plan\b/.test(src));
  ok("route no longer reads body.cycle", !/body\.cycle\b/.test(src));
  ok("route derives the tier from plan_id", src.includes("vraelisPlanFromPaypalPlanId(sub.plan_id)"));
  ok("route reads plan_id off the verified subscription", /plan_id\?:\s*string/.test(src));
  ok("route fails closed on an unrecognised plan", /if\s*\(!tier\)/.test(src));
  ok("route requires an active status", src.includes('status !== "active"'));
  ok("route no longer treats APPROVED as entitling", !/"APPROVED"/.test(src));
  ok("route binds the subscription to one workspace", src.includes("isSubscriptionClaimedByAnother"));
  ok("route checks the PayPal response was ok", src.includes("subRes.ok"));

  const cron = read("app/api/vraelis/cron/subscriptions/route.ts");
  ok("cron uses the canonical tier helper", cron.includes("canonicalTier("));
  ok("cron writes the canonical plan, not the stored one", /plan:\s*canonPlan/.test(cron));
  ok("cron writes on a tier change, not only a status change", cron.includes("statusDiffers || tierDiffers"));

  const hook = read("app/api/paypal/webhook/route.ts");
  ok("webhook derives the Vraelis tier from plan_id", hook.includes("vraelisPlanFromPaypalPlanId(subscription.plan_id)"));
  ok("webhook stores the derived plan", /plan:\s*vraelisPlan/.test(hook));
  ok("webhook stores the derived cycle", /cycle:\s*vraelisCycle/.test(hook));

  const pkg = read("package.json");
  ok("package.json exposes paypal:tier:test", pkg.includes(`"paypal:tier:test"`) && pkg.includes("paypal-tier-integrity-verify.ts"));
}


// ── 7. Bypasses found by independent re-attack of the first fix ─────────────
// The record route was closed, but the same escalation was reachable one route over. These assertions
// pin each of those closures.
console.log("── re-attack closures ──");
{
  const hook = read("app/api/paypal/webhook/route.ts");
  ok("webhook has NO custom_id tier fallback", !/derivedTier\?\.plan \?\? \(isPlanKey/.test(hook));
  ok("webhook takes the tier only from plan_id", hook.includes("const vraelisPlan = derivedTier?.plan ?? null;"));
  ok("webhook logs a refused custom_id tier claim", hook.includes("refusing Vraelis tier from custom_id"));

  const setup = read("app/api/paypal/setup-plans/route.ts");
  ok("setup-plans is admin-gated, not merely signed-in", setup.includes("isAdminEmail(email)"));
  ok("setup-plans no longer accepts any signed-in user", !/if \(!session\?\.user\?\.email\) \{\s*return NextResponse\.json\(\{ error: "Sign in first\." \}/.test(setup));

  const sync = read("lib/vraelis-plan-sync.ts");
  ok("LivePlan distinguishes unbacked from unavailable", sync.includes(`tierSource?: "resolved" | "unbacked" | "unavailable"`));
  ok("an unrecognised PayPal plan_id is marked unbacked", sync.includes(`tierSource: tier ? "resolved" : "unbacked"`));
  ok("canonicalTier demotes an unbacked tier", sync.includes(`if (live.tierSource === "unbacked")`));
  ok("the cron poll encodes the stored subscription id", sync.includes("encodeURIComponent(row.plan_subscription_id)"));

  const cron = read("app/api/vraelis/cron/subscriptions/route.ts");
  ok("cron selects every PAID tier, not just solo/growth", cron.includes("isPaidPlanKey(row.plan)"));
  ok("cron shouts about an unbacked demotion", cron.includes("UNBACKED TIER demoted"));

  ok("a UNIQUE index backs the subscription-claim guard",
    read("sql/vraelis-subscription-id-unique.sql").includes("create unique index concurrently"));
}

// Behavioural: an unbacked live tier must DEMOTE, and an unavailable one must PRESERVE.
console.log("── unbacked vs unavailable ──");
{
  const forged = canonicalTier({ plan: "growth", cycle: "yearly" }, { plan: null, cycle: null, tierSource: "unbacked" });
  ok("unbacked growth is demoted to the free tier", forged.plan === "starter", `got ${forged.plan}`);
  ok("unbacked demotion is flagged so the cron writes it", forged.tierDiffers === true && forged.unbacked === true);
  ok("a demoted row pays the FULL platform cut", cutRateFor(forged.plan, forged.cycle) === 0.2);

  const offline = canonicalTier({ plan: "growth", cycle: "yearly" }, { plan: null, cycle: null, tierSource: "unavailable" });
  ok("unavailable leaves a paid tier untouched", offline.plan === "growth" && offline.cycle === "yearly");
  ok("unavailable is not treated as a change", offline.tierDiffers === false && offline.unbacked === false);

  const stripeShaped = canonicalTier({ plan: "solo", cycle: "monthly" }, {});
  ok("a Stripe row (no tier fields at all) is untouched", stripeShaped.plan === "solo" && stripeShaped.tierDiffers === false);

  const resolved = canonicalTier({ plan: "growth", cycle: "monthly" }, { plan: "solo", cycle: "monthly", tierSource: "resolved" });
  ok("a resolved mismatch still corrects to the provider tier", resolved.plan === "solo" && resolved.unbacked === false);
}

// isPaidPlanKey must cover every tier cutRateFor honours, or the backstop has a blind spot.
console.log("── paid-tier selection covers every cut rate ──");
for (const p of ["solo", "growth", "agency"]) {
  ok(`${p} is selected by the reconcile sweep`, isPaidPlanKey(p));
  ok(`${p} has a cut rate cheaper than starter`, cutRateFor(p, "monthly") < 0.2);
}
ok("starter is not swept (it is the free tier)", !isPaidPlanKey("starter"));
ok("null is not swept", !isPaidPlanKey(null));
ok("an inherited key is not swept", !isPaidPlanKey("constructor"));

console.log(`\n${pass}/${pass + fail} passed (final)`);
process.exit(fail ? 1 : 0);
