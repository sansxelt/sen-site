// A NUMBER ON A PRICING CARD IS A PROMISE.
//
// Plans now lead with how many active guarantees they protect: 1 free, 3 Builder, 10 Pro, 30 Scale. That
// figure is the headline a customer chooses a tier by, which makes it the one number on the page that
// absolutely cannot be decorative. A cap printed and enforced nowhere is exactly the class of claim this
// product exists to catch, and the person who would catch it is the customer who paid for the tier.
//
// The reverse matters too. A cap enforced but not stated is a wall someone hits with no warning, which is
// how a product gets a reputation for being arbitrary.
import { readFileSync } from "node:fs";
import { PLAN_CATALOG_V1, FREE_TIER } from "../lib/preflight/pass-pricing";
import { planHeadline, planCapacity } from "../lib/preflight/pass-pricing-format";
import { apiAccessAllowed } from "../lib/v-entitlements";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

console.log("── every tier names a real number ──");
ok("free protects at least one guarantee", FREE_TIER.maxGuarantees >= 1);
for (const p of PLAN_CATALOG_V1) {
  ok(`${p.name} declares a guarantee cap`, Number.isInteger(p.maxGuarantees) && p.maxGuarantees > 0, String(p.maxGuarantees));
}
// "Unlimited" invites the obvious question of whether one guarantee can trigger unbounded browser time,
// and a word is not an answer to it. Every tier, including the top one, states a figure.
ok("no tier claims unlimited guarantees",
  PLAN_CATALOG_V1.every((p) => Number.isFinite(p.maxGuarantees)));
// A ladder that does not climb is three prices for the same thing.
ok("the caps increase with price", (() => {
  const byPrice = [...PLAN_CATALOG_V1].sort((a, b) => a.monthlyCents - b.monthlyCents);
  return byPrice.every((p, i) => i === 0 || p.maxGuarantees > byPrice[i - 1].maxGuarantees)
    && byPrice[0].maxGuarantees > FREE_TIER.maxGuarantees;
})(), PLAN_CATALOG_V1.map((p) => `${p.name}:${p.maxGuarantees}`).join(" "));

console.log("\n── the number on the card is the number enforced ──");
{
  const ent = readFileSync("lib/preflight/entitlements-v1.ts", "utf8");
  const route = readFileSync("app/api/preflight/apps/[id]/guarantees/route.ts", "utf8");
  ok("a cap check exists", /export async function guaranteeCapReached/.test(ent));
  // It has to read the SAME field the card renders, or the two can disagree while both look right.
  ok("and reads the same catalog field the card does", /plan\.maxGuarantees/.test(ent) && /FREE_TIER\.maxGuarantees/.test(ent));
  // Counting every row, including archived ones, would refuse someone for guarantees they retired.
  ok("it counts ACTIVE guarantees only", /\.eq\("status", "active"\)/.test(ent));
  // v_guarantees stores status as text. A boolean `active` column does not exist, and filtering on one
  // would have matched nothing, reported every account as zero, and never fired.
  ok("and filters on the column that actually exists", !/\.eq\("active",/.test(ent));
  // AWAITED AND BRANCHED ON, not merely imported. This checked that the name appeared anywhere in the
  // file, which an import satisfies: mutation replaced the whole condition with `if (false)` and the
  // assertion stayed green while the cap did nothing at all. Comments stripped first, for the same reason
  // three other guards in this repo needed it.
  const routeCode = route.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  ok("the creation route actually calls it, as the condition of a refusal",
    /if \(await guaranteeCapReached\(/.test(routeCode));
  // 402, not 400: this is a payment-shaped refusal and a client should be able to tell it apart from a
  // malformed request.
  ok("and refuses with a payment-required status", /status: 402/.test(route));
  // Someone who hits a limit is owed the limit and their plan, not the word "upgrade".
  ok("the refusal names the plan and the number", /\$\{cap\}/.test(route) && /plan \? plan\.name/.test(route));
}

console.log("\n── what a plan sells is said once ──");
{
  const surfaces = [
    "app/rank/app/plans/plans-v1.tsx",
    "app/rank/pricing/pricing-v1.tsx",
  ].map((f) => readFileSync(f, "utf8"));
  // Three copies of this text is how API access ended up Scale-only and stated on none of them.
  for (const s of surfaces) {
    ok("a pricing surface renders the shared headline", /planHeadline\(p\)/.test(s));
    ok("and the shared capacity list", /planCapacity\(p\)/.test(s));
    ok("rather than defining its own", !/function planFeatures/.test(s));
  }
  const b = PLAN_CATALOG_V1[0];
  ok("the headline states the guarantee count", planHeadline(b).includes(String(b.maxGuarantees)));
  // Naming an outcome count without disclosing the runs behind it is the "fair use" evasion this reframe
  // exists to avoid.
  ok("the capacity list discloses runs and flows",
    planCapacity(b).some((l) => l.includes(String(b.passesPerMonth)) && l.includes(String(b.flowsPerPass))));
  ok("and states the API, which was previously sold to nobody", planCapacity(b).some((l) => /API/.test(l)));
}

console.log("\n── there is a way past the top self-serve tier ──");
{
  // An agency or a platform team reads the cards, sees a ceiling and no way to say "we need more than
  // that, and we need a contract", and leaves. The capability existed the whole time and was reachable
  // only from a marketing page nobody in that position had a reason to visit.
  const SURFACES = [
    "app/rank/app/plans/plans-v1.tsx",
    "app/rank/pricing/pricing-v1.tsx",
    "app/dev-preview/v6/pricing/page.tsx",
  ];
  for (const f of SURFACES) {
    const src = readFileSync(f, "utf8");
    ok(`${f.split("/").slice(-2).join("/")} offers an enterprise route`, /Enterprise: more than/.test(src));
    ok("  and gives the address rather than another page to click", /sales@vraelis\.com/.test(src));
  }
  // ONLY WHAT /enterprise MARKS OPERATIONAL. SAML is Preview there and SCIM is Planned, and a card that
  // presents a preview as shipped is the exact failure this product exists to catch. Enterprise buyers are
  // also the readers most likely to check.
  const ent = readFileSync("app/dev-preview/v6/enterprise/page.tsx", "utf8");
  const notShipped = Array.from(ent.matchAll(/\["([^"]+)", "wait"/g)).map((m) => m[1]);
  ok("the enterprise page still marks some capabilities as not shipped", notShipped.length > 0, notShipped.join(", "));
  for (const f of SURFACES) {
    const src = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const claim of notShipped) {
      const word = claim.split(" ")[0];
      ok(`  pricing does not sell "${word}", which is not shipped`, !new RegExp(word, "i").test(src));
    }
  }
}

console.log("\n── a subscriber can get back off ──");
{
  // Every paid card says "Switch in billing" when you are on another plan. Free said "Open applications",
  // which is not an action on this plan at all, so somebody on Scale who wanted to stop paying had no path
  // from the one page whose entire job is choosing a plan. It also still said "applications" for a page
  // renamed to Systems, which is the same halfway rename being cleaned up everywhere else.
  const plans = readFileSync("app/rank/app/plans/plans-v1.tsx", "utf8");
  ok("the free card offers a way to cancel when you are subscribed", /Cancel in billing/.test(plans));
  ok("and no longer sends a subscriber sightseeing instead", !/Open applications/.test(plans));
}

console.log("\n── the API is on every paid plan ──");
// It was Scale-only at $399 and listed on no card, while the console shipped a CLI, an installer for two
// platforms and a documented CI gate. A Builder customer following any of it was refused by a rule they
// had no way to read.
for (const p of PLAN_CATALOG_V1) {
  ok(`${p.name} can use the API`, apiAccessAllowed("free", "a@b.c", p.key));
}
ok("free cannot, or the paid tiers sell nothing", !apiAccessAllowed("free", "a@b.c", null));

console.log(fail === 0 ? `\nALL PASS  ${pass} passed, 0 failed` : `\nFAILURES  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
