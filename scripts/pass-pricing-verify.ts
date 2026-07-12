// The approved pricing verdict, executable (docs/pricing-verdict-final.md). Every ruling that is money
// math gets a test here; the enforcement wiring is tested by preflight-entitlements-verify. Pure, no DB.
import {
  passPriceCents, rerunPriceCents, PLAN_CATALOG_V1, FREE_TIER, planV1,
  flowUnitsPerMonth, monthlyWindow, canRunPass, passesEquivalent, passPricingEnabled,
  PASS_BASE_CENTS, EARLY_ACCESS_PASS_BASE_CENTS,
} from "../lib/preflight/pass-pricing";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

// ── PAYG pass pricing (ruling: $15 base incl. 5 flows, $3 per extra; early access keeps $10) ──
ok("3 flows -> $15 (base covers up to 5)", passPriceCents(3) === 1500);
ok("5 flows -> $15", passPriceCents(5) === 1500);
ok("6 flows -> $18", passPriceCents(6) === 1800);
ok("10 flows -> $30", passPriceCents(10) === 3000);
ok("20 flows -> $60", passPriceCents(20) === 6000);
ok("early access base stays $10", passPriceCents(3, { earlyAccess: true }) === 1000 && EARLY_ACCESS_PASS_BASE_CENTS === 1000 && PASS_BASE_CENTS === 1500);

// ── Targeted reruns: $3 x selected, NEVER more than the comparable full pass ──
ok("rerun of 1 flow -> $3", rerunPriceCents(1) === 300);
ok("rerun of 4 flows -> $12 (cheaper than the $15 pass)", rerunPriceCents(4) === 1200);
ok("rerun of 5 flows -> $15 (capped at the pass price, not $15 by accident: 5x$3=$15)", rerunPriceCents(5) === 1500);
ok("rerun of 6 flows -> $18 both ways (cap binds exactly)", rerunPriceCents(6) === 1800 && passPriceCents(6) === 1800);
ok("rerun of 10 flows -> $30 (capped; 10x$3 would also be $30)", rerunPriceCents(10) === 3000);
ok("early-access rerun of 5 capped at the $10 early pass", rerunPriceCents(5, { earlyAccess: true }) === 1000);
ok("rerun never exceeds the comparable pass at ANY count 1..25",
  Array.from({ length: 25 }, (_, i) => i + 1).every((n) => rerunPriceCents(n) <= passPriceCents(n)));

// ── Plan catalog: fresh versioned keys, approved numbers, annual = 10x monthly ──
ok("plan keys are fresh _v1 keys (legacy meanings never reused)", PLAN_CATALOG_V1.every((p) => p.key.endsWith("_v1")));
const b = planV1("builder_v1")!, p = planV1("pro_v1")!, s = planV1("scale_v1")!;
ok("builder_v1: $49/$490, 10 passes, 5 flows, 2 apps", b.monthlyCents === 4900 && b.yearlyCents === 49000 && b.passesPerMonth === 10 && b.flowsPerPass === 5 && b.maxApplications === 2);
ok("pro_v1: $149/$1,490, 40 passes, 10 flows, 10 apps", p.monthlyCents === 14900 && p.yearlyCents === 149000 && p.passesPerMonth === 40 && p.flowsPerPass === 10 && p.maxApplications === 10);
ok("scale_v1: $399/$3,990, 150 passes, 20 flows", s.monthlyCents === 39900 && s.yearlyCents === 399000 && s.passesPerMonth === 150 && s.flowsPerPass === 20);
ok("every plan's yearly price is exactly 10 months (two months free)", PLAN_CATALOG_V1.every((x) => x.yearlyCents === x.monthlyCents * 10));
ok("free tier: ONE lifetime pass, 3 flows, 1 application", FREE_TIER.lifetimePasses === 1 && FREE_TIER.flowsPerPass === 3 && FREE_TIER.maxApplications === 1);
ok("unknown plan key resolves to null (fail closed)", planV1("pro") === null && planV1("scale") === null && planV1("starter") === null);

// ── Subscription month windows: annual releases usage MONTHLY from the anchor, no scheduler ──
const w1 = monthlyWindow("2026-01-15T10:00:00Z", "2026-07-20T00:00:00Z");
ok("mid-month anchor: July window runs Jul 15 -> Aug 15", w1.start.startsWith("2026-07-15") && w1.end.startsWith("2026-08-15"));
const w2 = monthlyWindow("2026-01-15T10:00:00Z", "2026-07-10T00:00:00Z");
ok("before the anchor day, the window began the previous month", w2.start.startsWith("2026-06-15") && w2.end.startsWith("2026-07-15"));
const w3 = monthlyWindow("2026-01-31T00:00:00Z", "2026-02-10T00:00:00Z");
ok("Jan 31 anchor clamps to Feb 28 (Stripe-style anchor clamping)", w3.start.startsWith("2026-01-31") && w3.end.startsWith("2026-02-28"));
const w4 = monthlyWindow("2025-08-01T00:00:00Z", "2026-07-12T00:00:00Z");
ok("an ANNUAL subscription 11 months in still meters a one-month window", w4.start.startsWith("2026-07-01") && w4.end.startsWith("2026-08-01"));

// ── Entitlement gate: flow caps + allowance in flow units; reruns deduct only selected flows ──
ok("builder allowance = 50 flow units (10 passes x 5 flows)", flowUnitsPerMonth(b) === 50);
ok("a 6-flow pass on builder is refused by the flow cap", canRunPass(b, 0, 6).ok === false && (canRunPass(b, 0, 6) as { error: string }).error === "flow_cap");
ok("a 5-flow pass consumes 5 units", (() => { const g = canRunPass(b, 0, 5); return g.ok && g.unitsAfter === 5; })());
ok("a 1-flow targeted rerun consumes 1 unit, not a whole pass (ruling)", (() => { const g = canRunPass(b, 5, 1); return g.ok && g.unitsAfter === 6; })());
ok("the 50th unit is allowed, the 51st is refused", canRunPass(b, 49, 1).ok === true && canRunPass(b, 50, 1).ok === false);
ok("exhaustion names the reset and the PAYG path", (canRunPass(b, 50, 1) as { message: string }).message.includes("pay-as-you-go"));
ok("passes-equivalent display: 17 units on builder reads as 3.4 passes", passesEquivalent(17, b) === 3.4);

// ── The flag: everything above is inert until the operator flips it ──
delete process.env.VRAELIS_PASS_PRICING;
ok("pass pricing is OFF by default", passPricingEnabled() === false);
process.env.VRAELIS_PASS_PRICING = "1";
ok("flag flips it on", passPricingEnabled() === true);
process.env.VRAELIS_PASS_PRICING = "";

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
