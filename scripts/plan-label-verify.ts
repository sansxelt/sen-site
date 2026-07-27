// ONE ACCOUNT MUST GET ONE ANSWER TO "WHAT PLAN AM I ON?".
//
// It was computed independently on four surfaces and they disagreed about the same signed-in account at the
// same moment:
//
//   top bar    capitalised the raw key                        -> "Scale_v1"
//   /billing   consulted the versioned catalog                -> "Scale"
//   /usage     consulted only legacy v_subscriptions          -> "Free plan"
//   /account   consulted only legacy v_subscriptions          -> "Free", plus "Monthly plans are coming"
//
// The account was on scale_v1 and had no legacy subscription row, which is the normal shape for a versioned
// plan, so three of the four were wrong and one of them advertised a product it was already selling.
//
// These are behavioural: the decision is a pure function, so it can be exercised directly rather than
// inspected as text.
import { planLabel, isOnAPaidPlan } from "../lib/plan-label";
import { PLAN_CATALOG_V1 } from "../lib/preflight/pass-pricing";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

// ── the exact shape that produced the disagreement ────────────────────────────────────────────────────
ok("a versioned plan with NO legacy subscription is named, not called Free",
  planLabel("scale_v1", "free") === "Scale", planLabel("scale_v1", "free"));
ok("it is never the raw key", planLabel("scale_v1", "free") !== "Scale_v1");
ok("and that account counts as paying", isOnAPaidPlan("scale_v1", "free"));

// Every catalog plan resolves to its catalog name, so adding one cannot reintroduce the raw key.
for (const p of PLAN_CATALOG_V1) {
  ok(`${p.key} is named "${p.name}"`, planLabel(p.key, "free") === p.name, planLabel(p.key, "free"));
  ok(`${p.key} is not rendered as its key`, planLabel(p.key, "free") !== p.key);
}

// ── the legacy path still works, because accounts are still on it ─────────────────────────────────────
ok("a legacy plan is still capitalised", planLabel(null, "pro") === "Pro");
ok("a legacy scale plan is not confused with the versioned one", planLabel(null, "scale") === "Scale");
ok("free is Free", planLabel(null, "free") === "Free");
ok("absent everything is Free", planLabel(null, null) === "Free");
ok("empty strings are Free", planLabel("", "") === "Free");
ok("free is not a paid plan", !isOnAPaidPlan(null, "free"));
ok("nothing at all is not a paid plan", !isOnAPaidPlan(null, null));
ok("a legacy plan is a paid plan", isOnAPaidPlan(null, "pro"));

// ── the versioned plan wins, because that is the one that is actually charged ─────────────────────────
ok("a versioned plan beats a stale legacy row", planLabel("pro_v1", "starter") === "Pro");

// ── an unknown key is reported, not dressed up ────────────────────────────────────────────────────────
// Inventing a name for a plan we do not have would be a confident wrong answer about money.
ok("an unrecognised versioned key is shown as-is rather than capitalised into a product name",
  planLabel("enterprise_v9", "free") === "enterprise_v9");
ok("an unrecognised key still counts as paying", isOnAPaidPlan("enterprise_v9", "free"));

// ── whitespace is not a plan ──────────────────────────────────────────────────────────────────────────
ok("a whitespace-only key falls through to the legacy plan", planLabel("   ", "pro") === "Pro");
ok("a whitespace-only key is not treated as paying on its own", !isOnAPaidPlan("   ", "free"));

// ── the label and the paid flag must never disagree ───────────────────────────────────────────────────
// "Free" beside "Change plan" or "Scale" beside "Upgrade" is the same class of defect as the original.
for (const [v1, legacy] of [["scale_v1", "free"], [null, "pro"], [null, "free"], ["pro_v1", "starter"], ["", ""]] as const) {
  const label = planLabel(v1, legacy);
  const paid = isOnAPaidPlan(v1, legacy);
  ok(`label and paid flag agree for (${JSON.stringify(v1)}, ${JSON.stringify(legacy)})`,
    paid === (label !== "Free"), `${label} / paid=${paid}`);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
