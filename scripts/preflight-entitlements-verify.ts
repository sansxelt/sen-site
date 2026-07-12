// The pricing ENFORCEMENT layer, verified (companion to scripts/pass-pricing-verify.ts, which proves the
// pure money math). Two halves: (1) pure tests of the metering/gating rules in
// lib/preflight/entitlements-v1.ts with injected rows and injected env; (2) static source checks that the
// wiring honors the flag contract — the legacy credit path is untouched and gates only appear under
// passPricingEnabled(), the signup grant is cut only under the flag, reruns price via rerunPriceCents,
// flow units are recorded, the webhook sets plan_v1 only for _v1 prices and never grants credits for
// them, the conversion script is dry-run-by-default and never deletes, and no public pricing surface
// gained an unenforced-benefit claim (retention/priority/API/concurrency). No DB, no network.
import fs from "node:fs";
import path from "node:path";
import {
  runConsumesAllowance, meteredUnits, countMeterableUnits, freePassConsumed,
  decidePassGate, resolvePlanV1FromPriceId, gatePassLaunch, type MeterableRun,
} from "../lib/preflight/entitlements-v1";
import { planV1, passPriceCents, rerunPriceCents } from "../lib/preflight/pass-pricing";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
const count = (src: string, phrase: string) => src.toLowerCase().split(phrase.toLowerCase()).length - 1;

async function main(): Promise<void> {
  // ── runConsumesAllowance: metering mirrors the money rule exactly ──
  const run = (state: string, failureCode: string | null, executedAnyFlow: boolean) => ({ state, failureCode, executedAnyFlow });
  ok("completed run consumes allowance", runConsumesAllowance(run("completed", null, true)));
  ok("in-flight runs consume (queued/running/analyzing hold their units)",
    runConsumesAllowance(run("queued", null, false)) && runConsumesAllowance(run("running", null, false)) && runConsumesAllowance(run("analyzing", null, false)));
  ok("target_mismatch is NEVER metered, even though its browser ran (operator-invalidated + refunded)",
    runConsumesAllowance(run("failed", "target_mismatch", true)) === false);
  ok("flow_selection_invalid is never metered (fails before any browser session)",
    runConsumesAllowance(run("failed", "flow_selection_invalid", false)) === false);
  ok("lease_expired after exhaustion with NO executed flow is not metered (worker refunded it)",
    runConsumesAllowance(run("failed", "lease_expired", false)) === false);
  ok("lease_expired AFTER work began is metered (hold retained = charge)",
    runConsumesAllowance(run("failed", "lease_expired", true)) === true);
  ok("provider failure before the browser is not metered", runConsumesAllowance(run("failed", "provider_unavailable", false)) === false);
  ok("executed-then-failed run IS metered", runConsumesAllowance(run("failed", "run_error", true)) === true);
  ok("cancelled before execution is not metered", runConsumesAllowance(run("cancelled", null, false)) === false
    && runConsumesAllowance(run("failed", "cancelled", false)) === false);
  ok("cancelled after work began IS metered (matches 'settle completed work')",
    runConsumesAllowance(run("failed", "cancelled", true)) === true);

  // ── meteredUnits: flow_units with the flow_ids fallback ──
  ok("recorded flow_units wins", meteredUnits({ flowUnits: 2, flowIdsLength: 5 }) === 2);
  ok("null flow_units falls back to the flow_ids selection length", meteredUnits({ flowUnits: null, flowIdsLength: 3 }) === 3);
  ok("legacy row (no units, no selection) meters 0", meteredUnits({ flowUnits: null, flowIdsLength: 0 }) === 0);

  // ── countMeterableUnits: a subscription month of mixed runs ──
  const month: MeterableRun[] = [
    { state: "completed", failureCode: null, flowUnits: 5, flowIdsLength: 5, executedAnyFlow: true },   // full pass: 5
    { state: "failed", failureCode: "provider_unavailable", flowUnits: 3, flowIdsLength: 3, executedAnyFlow: false }, // infra: 0
    { state: "completed", failureCode: null, flowUnits: 2, flowIdsLength: 2, executedAnyFlow: true },   // targeted rerun: 2, not a pass
    { state: "queued", failureCode: null, flowUnits: null, flowIdsLength: 4, executedAnyFlow: false },  // in-flight: 4 via fallback
    { state: "failed", failureCode: "target_mismatch", flowUnits: 5, flowIdsLength: 5, executedAnyFlow: true }, // invalidated: 0
  ];
  ok("month meters 11 units (5 pass + 2 rerun + 4 in-flight; infra + invalidated excluded)", countMeterableUnits(month) === 11);

  // ── freePassConsumed: the lifetime pass follows the same rule ──
  ok("no runs -> free pass available", freePassConsumed([]) === false);
  ok("only an infra-failed run -> free pass still available", freePassConsumed([run("failed", "provider_unavailable", false)]) === false);
  ok("a cancelled-before-execution run -> still available", freePassConsumed([run("cancelled", null, false)]) === false);
  ok("a completed run consumed it", freePassConsumed([run("completed", null, true)]) === true);
  ok("a queued run already consumes it (no double-spend while in flight)", freePassConsumed([run("queued", null, false)]) === true);

  // ── decidePassGate: the flag-on ladder ──
  const builder = planV1("builder_v1")!;
  {
    const g = decidePassGate({ plan: builder, unitsUsedInWindow: 0, freePassUsed: true, selectedFlows: 5 });
    ok("subscription pass within allowance -> ok, consumes its flow count", g.mode === "subscription" && g.ok && g.unitsAfter === 5);
  }
  {
    const g = decidePassGate({ plan: builder, unitsUsedInWindow: 0, freePassUsed: true, selectedFlows: 6 });
    ok("subscription over the flow cap -> flow_cap 400", g.mode === "subscription" && !g.ok && g.error === "flow_cap" && g.status === 400);
  }
  {
    const g = decidePassGate({ plan: builder, unitsUsedInWindow: 50, freePassUsed: true, selectedFlows: 1 });
    ok("exhausted allowance -> allowance_exhausted 402, NEVER an auto-charge", g.mode === "subscription" && !g.ok && g.error === "allowance_exhausted" && g.status === 402);
  }
  {
    const g = decidePassGate({ plan: builder, unitsUsedInWindow: 5, freePassUsed: true, selectedFlows: 2, rerun: true });
    ok("subscription rerun deducts ONLY the selected flows (5 -> 7 units, not a full pass)", g.mode === "subscription" && g.ok && g.unitsAfter === 7);
  }
  ok("free tier: unused lifetime pass covers up to 3 flows",
    decidePassGate({ plan: null, unitsUsedInWindow: 0, freePassUsed: false, selectedFlows: 3 }).mode === "free");
  {
    const g = decidePassGate({ plan: null, unitsUsedInWindow: 0, freePassUsed: false, selectedFlows: 4 });
    ok("4 flows exceeds the free pass -> PAYG at the pass price", g.mode === "payg" && g.ok && g.cents === passPriceCents(4));
  }
  {
    const g = decidePassGate({ plan: null, unitsUsedInWindow: 0, freePassUsed: true, selectedFlows: 3 });
    ok("free pass used -> PAYG ($15 base)", g.mode === "payg" && g.ok && g.cents === 1500);
  }
  {
    const g = decidePassGate({ plan: null, unitsUsedInWindow: 0, freePassUsed: true, selectedFlows: 1, rerun: true });
    ok("PAYG targeted rerun of 1 flow -> $3 (rerunPriceCents)", g.mode === "payg" && g.ok && g.cents === rerunPriceCents(1) && g.cents === 300);
  }
  {
    const g = decidePassGate({ plan: null, unitsUsedInWindow: 0, freePassUsed: true, selectedFlows: 10, rerun: true });
    ok("PAYG rerun of 10 flows capped at the comparable pass ($30)", g.mode === "payg" && g.ok && g.cents === 3000 && g.cents <= passPriceCents(10));
  }

  // ── The flag: gatePassLaunch is inert (mode 'legacy', no DB read) until the operator flips it ──
  delete process.env.VRAELIS_PASS_PRICING;
  ok("flag off -> gatePassLaunch returns { mode: 'legacy' }", (await gatePassLaunch("x@example.com", 3)).mode === "legacy");

  // ── resolvePlanV1FromPriceId: the six operator-created prices, injected env ──
  process.env.STRIPE_PRICE_BUILDER_V1_MONTHLY = "price_t_b1m";
  process.env.STRIPE_PRICE_BUILDER_V1_YEARLY = "price_t_b1y";
  process.env.STRIPE_PRICE_PRO_V1_MONTHLY = "price_t_p1m";
  process.env.STRIPE_PRICE_SCALE_V1_YEARLY = "price_t_s1y";
  process.env.STRIPE_PRICE_PRO_MONTHLY = "price_t_legacy_pro"; // legacy env name must NOT resolve as _v1
  ok("builder_v1 monthly price resolves", JSON.stringify(resolvePlanV1FromPriceId("price_t_b1m")) === JSON.stringify({ key: "builder_v1", cycle: "monthly" }));
  ok("builder_v1 yearly price resolves", JSON.stringify(resolvePlanV1FromPriceId("price_t_b1y")) === JSON.stringify({ key: "builder_v1", cycle: "yearly" }));
  ok("pro_v1 monthly price resolves", JSON.stringify(resolvePlanV1FromPriceId("price_t_p1m")) === JSON.stringify({ key: "pro_v1", cycle: "monthly" }));
  ok("scale_v1 yearly price resolves", JSON.stringify(resolvePlanV1FromPriceId("price_t_s1y")) === JSON.stringify({ key: "scale_v1", cycle: "yearly" }));
  ok("a LEGACY plan's price id never resolves as _v1 (fresh keys, ruling 2)", resolvePlanV1FromPriceId("price_t_legacy_pro") === null);
  ok("unknown/absent price ids fail closed", resolvePlanV1FromPriceId("price_unknown") === null && resolvePlanV1FromPriceId(null) === null);
  delete process.env.STRIPE_PRICE_BUILDER_V1_MONTHLY; delete process.env.STRIPE_PRICE_BUILDER_V1_YEARLY;
  delete process.env.STRIPE_PRICE_PRO_V1_MONTHLY; delete process.env.STRIPE_PRICE_SCALE_V1_YEARLY;
  delete process.env.STRIPE_PRICE_PRO_MONTHLY;

  // ── static: both run routes keep the legacy hold path UNMODIFIED and gate only under the flag ──
  for (const [name, file] of [
    ["launch route", path.join("app", "api", "preflight", "apps", "[id]", "runs", "route.ts")],
    ["rerun route", path.join("app", "api", "preflight", "runs", "[runId]", "rerun", "route.ts")],
  ] as const) {
    const src = read(file);
    ok(`${name}: legacy hold line is byte-identical`, src.includes("const ok = await hold(owner, reservationId, estCredits);"));
    ok(`${name}: legacy insufficient-credits refusal is intact`, src.includes(`{ error: "insufficient_credits", message: "You do not have enough credits to launch this preflight run." }, { status: 402 }`));
    ok(`${name}: legacy path still sets creditsHeld = estCredits`, src.includes("creditsHeld = estCredits;"));
    const iFlag = src.indexOf("if (passPricingEnabled())");
    const iGate = src.indexOf("gatePassLaunch(");
    const iLegacyHold = src.indexOf("const ok = await hold(owner, reservationId, estCredits);");
    ok(`${name}: pass gate exists ONLY inside the passPricingEnabled() branch, before the legacy path`,
      iFlag >= 0 && iGate > iFlag && iGate < iLegacyHold);
    ok(`${name}: exactly one gatePassLaunch call`, count(src, "gatePassLaunch(") === 1);
    ok(`${name}: PAYG holds CENTS via the ledger (unit='cent'), keyed by the same reservation`,
      src.includes(`await hold(owner, reservationId, gate.cents, "cent")`));
    ok(`${name}: failure refunds use the hold's own amount (creditsHeld), covering both units`,
      count(src, "await refund(owner, reservationId, creditsHeld);") === 2 && !src.includes("await refund(owner, reservationId, estCredits);"));
    ok(`${name}: records flow_units on the created run, only under the flag`,
      src.includes("recordRunPassUsage(owner, created.runId,") && src.lastIndexOf("if (passPricingEnabled())") < src.indexOf("recordRunPassUsage(owner, created.runId,"));
  }
  {
    const rerun = read(path.join("app", "api", "preflight", "runs", "[runId]", "rerun", "route.ts"));
    ok("rerun route gates with { rerun: true } (rerunPriceCents, capped at the comparable pass)", rerun.includes("gatePassLaunch(owner, flowIds.length, { rerun: true })"));
    const launch = read(path.join("app", "api", "preflight", "apps", "[id]", "runs", "route.ts"));
    ok("launch route gates WITHOUT the rerun price (full pass price)", launch.includes("gatePassLaunch(owner, flowIds.length)"));
  }

  // ── static: entitlements-v1 prices reruns via rerunPriceCents and records both usage columns ──
  {
    const src = read("lib", "preflight", "entitlements-v1.ts");
    ok("decidePassGate uses rerunPriceCents for reruns, passPriceCents otherwise",
      src.includes("input.rerun ? rerunPriceCents(input.selectedFlows) : passPriceCents(input.selectedFlows)"));
    ok("recordRunPassUsage writes flow_units and held_cents", src.includes("flow_units: usage.flowUnits") && src.includes("patch.held_cents = usage.heldCents"));
    ok("pure decisions are imported from pass-pricing (canRunPass), not re-implemented",
      src.includes("canRunPass(input.plan, input.unitsUsedInWindow, input.selectedFlows)"));
  }

  // ── static: the signup grant is cut ONLY under the flag; flag off keeps granting ──
  {
    const src = read("lib", "v-credits.ts");
    const fn = src.slice(src.indexOf("export async function ensureSignupGrant"), src.indexOf("export async function hold"));
    ok("ensureSignupGrant no-ops under passPricingEnabled()", fn.includes("if (passPricingEnabled()) return;"));
    ok("ensureSignupGrant still grants SIGNUP_FREE_CREDITS when the flag is off", fn.includes(`grant(userId, SIGNUP_FREE_CREDITS, "signup"`));
    ok("hold() gained an optional unit param defaulting 'credit' (every legacy call site unchanged)",
      src.includes(`unit: "credit" | "cent" = "credit"`));
    ok("flag-off liveRows keeps the exact legacy select (no unit column touched pre-migration)",
      src.includes(`? "delta, bucket, expires_at, ext_ref, reason, ref_type, ref_id"`));
    ok("refund derives the unit from the hold's own rows (worker call sites unchanged)",
      src.includes(`const unit = held[0]?.unit ?? "credit";`));
  }

  // ── static: the webhook sets plan_v1 only for _v1 prices and NEVER grants credits for them ──
  {
    const src = read("lib", "v-subscriptions.ts");
    const invoiceV1 = src.slice(src.indexOf("export async function handleRankInvoicePaid"), src.indexOf("// Resolve the Rank plan"));
    ok("invoice.paid resolves _v1 via the price-id resolver first", invoiceV1.includes("v1FromPriceOrMeta(linePriceId(inv), subMeta(inv))"));
    ok("the _v1 invoice branch returns handled BEFORE the legacy grant path", invoiceV1.includes("return true; // handled"));
    ok("the _v1 invoice branch grants NO credits (allowance is metered, not granted)",
      !invoiceV1.includes("grantMonthly") && !invoiceV1.includes("recordInvoiceGrant"));
    ok("anchor = current_period_start of the FIRST period; renewals never move it",
      invoiceV1.includes(`anchorOnlyIfUnset: inv.billing_reason !== "subscription_create"`));
    const sub = src.slice(src.indexOf("export async function handleRankSubChange"));
    ok("plan_v1 is cleared only on a true termination (deletion event)",
      sub.includes("clearPlanV1(userId)") && sub.includes(`event.type === "customer.subscription.deleted"`));
    ok("legacy plan behavior below the _v1 branch is intact (grantMonthly + expireMonthly + setSubscription)",
      src.includes("grantMonthly(userId, credits, periodEnd") && src.includes("expireMonthly(userId, undefined, `cancel:${subscription.id}`)") && src.includes("setSubscription({"));
  }

  // ── static: the conversion script never deletes/updates rows and is dry-run by default ──
  {
    const src = read("scripts", "preflight-balance-convert.ts");
    ok("conversion script contains no delete", !src.includes(".delete("));
    ok("conversion script never updates existing rows (append-only pairs)", !src.includes(".update("));
    ok("conversion is dry-run by default; --apply opts in", src.includes(`const APPLY = process.argv.includes("--apply");`));
    ok("conversion is gated like the other operator tools (PREFLIGHT_SEED_RUN)", src.includes(`process.env.PREFLIGHT_SEED_RUN !== "1"`));
    ok("conversion legs are idempotent per owner via ext_ref migration:<owner>", src.includes("migration:${owner}"));
    ok("promotional balance is labeled (conversion_promo) at the same $0.10 rate",
      src.includes(`"conversion_promo"`) && src.includes("CENTS_PER_CREDIT = 10"));
  }

  // ── static: the migration carries every column with its rule, additive + idempotent ──
  {
    const src = read("sql", "vraelis-preflight-6-pass-pricing.sql");
    ok("migration adds v_credit_ledger.unit defaulting 'credit'", src.includes("alter table v_credit_ledger add column if not exists unit text not null default 'credit'"));
    ok("migration adds v_preflight_runs.flow_units + held_cents", src.includes("add column if not exists flow_units int") && src.includes("add column if not exists held_cents int"));
    ok("migration adds v_profiles plan_v1 / anchor / cycle", src.includes("add column if not exists plan_v1 text") && src.includes("add column if not exists plan_v1_anchor timestamptz") && src.includes("add column if not exists plan_v1_cycle text"));
    ok("migration adds the owner/time index on v_preflight_runs", src.includes("create index if not exists v_preflight_runs_user_time_idx on v_preflight_runs (user_id, created_at desc)"));
    ok("migration is additive (no drop table/column)", !/drop\s+(table|column)/i.test(src));
    ok("balance RPCs become unit-aware (credit sums exclude cent rows)", count(src, "coalesce(unit, 'credit') = 'credit'") >= 6);
  }

  // ── static: no public pricing surface displays an unenforced benefit (ruling 10) — absent or
  // unchanged from today's baseline (the plans page's DISABLED preview already carried these; this
  // build must not add any) ──
  {
    const pricing = read("app", "rank", "pricing", "page.tsx");
    const plans = read("app", "rank", "app", "plans", "page.tsx");
    ok("public pricing page: no retention/priority/concurrency claims; 'API access' only in the future-tense line",
      count(pricing, "retention") === 0 && count(pricing, "priority") === 0 && count(pricing, "concurrency") === 0 && count(pricing, "api access") === 1);
    ok("plans page: unenforced-benefit phrases unchanged (2 retention, 1 priority, 1 api access, 0 concurrency)",
      count(plans, "retention") === 2 && count(plans, "priority") === 1 && count(plans, "api access") === 1 && count(plans, "concurrency") === 0);
    ok("plans page still renders those only as a disabled preview", plans.includes("Not available yet"));
  }

  console.log(`\n${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(`entitlements-verify crashed: ${(e as Error).message}`); process.exit(1); });
