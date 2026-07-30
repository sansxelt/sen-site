// Verifies the STEP-11 pricing cutover UI (docs/pricing-verdict-final.md): the _v1 pricing/plans
// surfaces render EXACTLY the approved ladder, list only implemented entitlements, derive every dollar
// from lib/preflight/pass-pricing.ts (no hardcoded money), and stay entirely behind VRAELIS_PASS_PRICING
// (server-gated page.tsx files; the subscribe route only accepts _v1 keys with the flag on). Static
// source checks + a real static render of the client components (both billing cycles), no DB or network.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PLAN_CATALOG_V1, PASS_INCLUDED_FLOWS, EXTRA_FLOW_CENTS,
  passPriceCents, rerunPriceCents, passPricingEnabled,
} from "../lib/preflight/pass-pricing";
import { usdFromCents, effectiveMonthlyUsd } from "../lib/preflight/pass-pricing-format";
import PricingV1 from "../app/rank/pricing/pricing-v1";
import PlansV1 from "../app/rank/app/plans/plans-v1";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const read = (p: string) => readFileSync(p, "utf8");
// Source scans must judge what a USER can see, not our documentation: comments in these files quote the
// forbidden phrases and retired prices on purpose (to say they are banned). Strip block comments and
// line comments (full-line, or trailing after whitespace so "https://" inside strings survives).
const stripComments = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "")
  .replace(/(\s)\/\/ .*$/gm, "$1");
const readCode = (p: string) => stripComments(read(p));

// ── 0. The catalog itself must yield the founder-approved numbers (locks catalog -> verdict) ──
const byKey = Object.fromEntries(PLAN_CATALOG_V1.map((p) => [p.key, p]));
ok("catalog: builder_v1 formats to $49 / $490", usdFromCents(byKey.builder_v1.monthlyCents) === "$49" && usdFromCents(byKey.builder_v1.yearlyCents) === "$490");
ok("catalog: pro_v1 formats to $149 / $1,490", usdFromCents(byKey.pro_v1.monthlyCents) === "$149" && usdFromCents(byKey.pro_v1.yearlyCents) === "$1,490");
ok("catalog: scale_v1 formats to $399 / $3,990", usdFromCents(byKey.scale_v1.monthlyCents) === "$399" && usdFromCents(byKey.scale_v1.yearlyCents) === "$3,990");
ok("catalog: a base pass formats to $15, an extra flow and a rerun flow to $3",
  usdFromCents(passPriceCents(PASS_INCLUDED_FLOWS)) === "$15" && usdFromCents(EXTRA_FLOW_CENTS) === "$3" && usdFromCents(rerunPriceCents(1)) === "$3");
ok("catalog: builder_v1 effective monthly is $41 (the approved example)", effectiveMonthlyUsd(byKey.builder_v1.yearlyCents) === "$41");

// ── 1. Real renders of both V1 surfaces, both billing cycles ──
const el = (C: unknown, props: Record<string, unknown>) => React.createElement(C as React.ComponentType<Record<string, unknown>>, props);
const renders: Record<string, string> = {
  "pricing monthly": renderToStaticMarkup(el(PricingV1, {})),
  "pricing yearly": renderToStaticMarkup(el(PricingV1, { initialCycle: "yearly" })),
  "plans monthly": renderToStaticMarkup(el(PlansV1, {})),
  "plans yearly": renderToStaticMarkup(el(PlansV1, { initialCycle: "yearly" })),
};

// Rendered JSX wraps wherever the source broke the line, so anything spanning one is compared with
// whitespace collapsed. The words are the property; the line breaks are not.
const flat0 = (h: string) => h.replace(/\s+/g, " ");

for (const surface of ["pricing", "plans"]) {
  const m = renders[`${surface} monthly`], y = renders[`${surface} yearly`];
  ok(`${surface}: monthly renders $49 / $149 / $399`,
    m.includes("$49<small>/mo") && m.includes("$149<small>/mo") && m.includes("$399<small>/mo"));
  // Yearly leads with the lower monthly-effective price as the headline (converts better) and shows the real
  // annual total clearly beneath it — the customer always sees exactly what they're charged, no fine print.
  ok(`${surface}: yearly headlines the effective monthly price ($41/$124/$333)`,
    y.includes("$41<small>/mo") && y.includes("$124<small>/mo") && y.includes("$333<small>/mo"));
  ok(`${surface}: yearly shows the annual total clearly ($490 / $1,490 / $3,990 billed yearly) + Save 17%`,
    y.includes("$490 billed yearly") && y.includes("$1,490 billed yearly") && y.includes("$3,990 billed yearly")
    && y.includes("Save 17%") && !y.includes("2 months free"));
  ok(`${surface}: monthly/yearly segmented toggle present`,
    m.includes(`class="seg"`) && m.includes(">Monthly<") && m.includes("Yearly"));
  // Phase 4 terminology migration: both the public pricing surface and the signed-in plans surface
  // now read "verification(s)". Each surface's copy is asserted verbatim at full strictness.
  const freeLead = "One lifetime free verification";
  const unitPlural = "verifications";
  const paygUnit = "$15 per verification";
  const rerunCap = "Targeted reruns cost $3 per selected failed flow and never more than a comparable full verification";
  // Free leads with the same headline the paid cards use, so the four read as one scale rather than three
  // plans and an oddity beside them. The capacity underneath is unchanged: one verification, three flows,
  // one system.
  ok(`${surface}: free tier is $0, one guarantee, one verification, 3 flows, 1 system, no card`,
    m.includes("$0") && flat0(m).includes("Protects 1 active guarantee")
    && m.includes("1 verification, up to 3 critical flows") && m.includes("1 connected system")
    && m.includes("No card required"));
  // Free is the ONE tier without the API, and that difference has to be legible from the card rather than
  // discovered when a key is refused.
  ok(`${surface}: free states plainly that it has no API`, m.includes("Console only, no API or CLI"));
  // Reframe (2026-07): the pass figures are unchanged, but the lead bullet now reads outcome-first
  // ("Validate N launches a month (N <unit>)") and flows are "verified per run". The figures
  // (10/40/150 runs, 5/10/20 flows, 2/10/∞ apps) must still render on both surfaces.
  // WHAT A PLAN SELLS, AND WHAT IT COSTS TO RUN. The cards lead with protected surface area now, so the
  // guarantee figure is the headline assertion. The capacity underneath still has to render, because a
  // plan that names an outcome count without disclosing the runs behind it is the "fair use" evasion
  // this reframe exists to avoid: anyone evaluating it will ask whether one guarantee can trigger
  // unbounded browser time, and the answer must be a number on the card.
  ok(`${surface}: each plan leads with the guarantees it protects`,
    m.includes("Protects up to 3 active guarantees") && m.includes("Protects up to 10 active guarantees")
    && m.includes("Protects up to 30 active guarantees"));
  ok(`${surface}: and discloses the capacity behind it (runs/flows/systems)`,
    m.includes("10 verifications a month, up to 5 flows each") && m.includes("2 connected systems")
    && m.includes("40 verifications a month, up to 10 flows each") && m.includes("10 connected systems")
    && m.includes("150 verifications a month, up to 20 flows each") && m.includes("Connect any number of systems"));
  // The capability that was Scale-only and unlisted, which is how a Builder customer could install the
  // CLI and be refused by a rule they had no way to read.
  ok(`${surface}: every paid plan states that it includes the API and CLI`,
    (m.match(/API, CLI and webhooks/g) ?? []).length >= 3);
  ok(`${surface}: PAYG band: $15 per run, 5 flows included, $3 extra flow, capped $3 reruns, no subscription`,
    m.includes(paygUnit) && m.includes("5 flows included, $3 per additional flow")
    && m.includes(rerunCap)
    && m.includes("No subscription required") && m.includes("/credits"));
  // WHITESPACE COLLAPSED FIRST. Rendered JSX wraps a paragraph wherever the source happened to break the
  // line, so an exact-string match here fails the moment someone reflows a sentence they did not change
  // the meaning of. The billing terms are the property; the line breaks are not.
  const flat = m.replace(/\s+/g, " ");
  ok(`${surface}: allowance-reset and annual up-front lines present`,
    flat.includes("Unused monthly allowance resets each subscription month")
    && flat.includes("Annual plans are charged up front and release usage monthly"));
}
ok("pricing: paid CTAs go to /checkout?plan=<key>&cycle=<cycle>",
  ["builder_v1", "pro_v1", "scale_v1"].every((k) => renders["pricing monthly"].includes(`plan%3D${k}%26cycle%3Dmonthly`) || renders["pricing monthly"].includes(`plan=${k}&amp;cycle=monthly`))
  && ["builder_v1", "pro_v1", "scale_v1"].every((k) => renders["pricing yearly"].includes(`plan%3D${k}%26cycle%3Dyearly`) || renders["pricing yearly"].includes(`plan=${k}&amp;cycle=yearly`)));
ok("pricing: Pro is the highlighted (most popular) card", renders["pricing monthly"].includes("price price--hot"));
// Manage billing renders only for a signed-in account (state a static render cannot reach), so this
// one is a source check: the portal call and its button label must both be wired in plans-v1.
ok("plans: keeps Manage billing (Stripe portal)",
  readCode("app/rank/app/plans/plans-v1.tsx").includes(`fetch("/api/v/portal", { method: "POST" })`)
  && readCode("app/rank/app/plans/plans-v1.tsx").includes("Manage billing"));

// ── 2. Only implemented entitlements: forbidden benefit phrases never appear on a V1 surface ──
const V1_FILES = [
  "app/rank/pricing/pricing-v1.tsx",
  "app/rank/app/plans/plans-v1.tsx",
  "app/rank/app/checkout/checkout-v1.tsx",
  "lib/preflight/pass-pricing-format.ts",
];
const FORBIDDEN = ["retention", "priority", "queue", "api access", "concurrency", "advanced usage controls"];
for (const phrase of FORBIDDEN) {
  const srcHits = V1_FILES.filter((f) => readCode(f).toLowerCase().includes(phrase));
  const renderHits = Object.entries(renders).filter(([, html]) => html.toLowerCase().includes(phrase)).map(([k]) => k);
  ok(`no V1 surface promises "${phrase}"`, srcHits.length === 0 && renderHits.length === 0, [...srcHits, ...renderHits].join(", "));
}

// ── 3. Every dollar is DERIVED: no hardcoded money in the V1 sources ──
for (const f of V1_FILES) {
  const src = readCode(f);
  const dollarLiterals = src.match(/\$\d[\d,.]*/g) ?? [];
  ok(`${f}: no hardcoded $ amounts in source`, dollarLiterals.length === 0, dollarLiterals.join(", "));
  const centLiterals = src.match(/\b(1000|1500|4900|14900|39900|49000|149000|399000)\b/g) ?? [];
  ok(`${f}: no hardcoded cent constants in source`, centLiterals.length === 0, centLiterals.join(", "));
}
ok("V1 pages import their numbers from lib/preflight/pass-pricing",
  read(V1_FILES[0]).includes(`from "@/lib/preflight/pass-pricing"`) && read(V1_FILES[0]).includes("PLAN_CATALOG_V1")
  && read(V1_FILES[1]).includes(`from "@/lib/preflight/pass-pricing"`) && read(V1_FILES[1]).includes("PLAN_CATALOG_V1"));

// ── 4. The retired $99/$299 preview exists ONLY in the -legacy files (verdict ruling 3) ──
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|md)$/.test(name)) out.push(p);
  }
  return out;
}
const oldPriceHits = walk("app/rank").filter((p) =>
  !/(pricing-legacy|plans-legacy)\.tsx$/.test(p) && /\$(99|299)(?![\d,])/.test(/\.(tsx|ts)$/.test(p) ? stripComments(read(p)) : read(p)));
ok("old $99/$299 preview appears nowhere outside pricing-legacy/plans-legacy", oldPriceHits.length === 0, oldPriceHits.slice(0, 3).join(", "));

// ── 5. The flag gate: both page.tsx files are server gates; the subscribe route gates _v1 keys ──
const pricingGate = read("app/rank/pricing/page.tsx");
const plansGate = read("app/rank/app/plans/page.tsx");
ok("pricing page.tsx is a server gate on passPricingEnabled()",
  pricingGate.includes("passPricingEnabled()") && pricingGate.includes("PricingLegacy") && pricingGate.includes("PricingV1") && !pricingGate.includes(`"use client"`));
ok("plans page.tsx is a server gate on passPricingEnabled()",
  plansGate.includes("passPricingEnabled()") && plansGate.includes("PlansLegacy") && plansGate.includes("PlansV1") && !plansGate.includes(`"use client"`));
ok("legacy components stayed client components, copy intact",
  read("app/rank/pricing/pricing-legacy.tsx").startsWith(`"use client"`) && read("app/rank/app/plans/plans-legacy.tsx").startsWith(`"use client"`)
  && read("app/rank/app/plans/plans-legacy.tsx").includes("$99") && read("app/rank/app/plans/plans-legacy.tsx").includes("$299"));

const subscribe = read("app/api/v/subscribe/route.ts");
ok("subscribe route accepts _v1 keys only behind passPricingEnabled()",
  subscribe.includes("passPricingEnabled()") && subscribe.includes("PLAN_CATALOG_V1") && subscribe.includes("V1_PLANS.has(requested)"));
// user_id in the v_plan metadata is the LOWERCASED owner (not the raw-case session email), so the
// dispute-freeze attribution (blocker 2: ownerForCharge -> metadata.user_id) lands on the exact
// v_profiles/plan_v1 row plan state is stored under. Same for both the subscription and session metadata.
ok("subscribe route keeps the exact v_plan metadata contract for the webhook (user_id = lowercased owner)",
  subscribe.includes(`subscription_data: { metadata: { type: "v_plan", plan, cycle, user_id: owner } }`)
  && subscribe.includes(`metadata: { type: "v_plan", plan, cycle, user_id: owner }`));
ok("subscribe route resolves prices from the env scheme covering the six _v1 vars", subscribe.includes("priceIdFor(plan, cycle)"));
ok("legacy plan keys are still accepted unconditionally", subscribe.includes(`new Set(["starter", "creator", "pro", "scale"])`));

const checkout = read("app/rank/app/checkout/page.tsx");
ok("checkout page recognizes _v1 keys only behind passPricingEnabled(), rendering from PLAN_CATALOG_V1",
  checkout.includes("passPricingEnabled()") && checkout.includes("PLAN_CATALOG_V1") && checkout.includes("v1Included(") && checkout.includes("PlanPriceV1"));

const usage = read("app/api/preflight/usage/route.ts");
ok("usage route is flag-gated, owner-scoped, and reports passes-equivalent + window end",
  usage.includes("passPricingEnabled()") && usage.includes("auth()") && usage.includes("passesEquivalent") && usage.includes("windowEnd"));
const me = read("app/api/v/me/route.ts");
ok("/api/v/me exposes the additive plan_v1 field (null-safe, flag-aware)",
  me.includes("plan_v1:") && me.includes("getPlanV1State") && me.includes("passPricingEnabled()"));

// ── 6. The flag itself: default off in this environment (nothing in the repo flips it) ──
ok("VRAELIS_PASS_PRICING is not flipped by this checkout (flag reads false here)",
  process.env.VRAELIS_PASS_PRICING === undefined ? !passPricingEnabled() : true);

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
