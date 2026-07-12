// Regression tests for the pricing correction: the old feedback-network credit economics ($1 = 10 credits,
// a credit per approved flow, 1 credit = 1 AI check, human-judgment credits) must never reappear on a
// surface a user can read: public marketing, signed-in app, metadata, checkout copy, onboarding emails.
// The live ledger mechanics (hold/refund/credits_held) are NOT copy and are exempt; the legacy checker
// under app/rank/app/legacy is flag-gated and exempt. Static source checks; no DB, no network.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const read = (p: string) => readFileSync(p, "utf8");

// ── The stale phrases, checked across every user-facing tree ──
const STALE = [
  "$1 buys 10 credits", "$1 = 10 credits", "/10 credits", "every dollar adds ten credits",
  "a credit per approved flow", "credit per approved flow", "1 credit = 1 AI check",
  "credit per valid human judgment", "1 credit = 1 valid judgment", "free credits",
];
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (p.includes(join("app", "rank", "app", "legacy"))) continue; // flag-gated legacy checker
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|md)$/.test(name)) out.push(p);
  }
  return out;
}
const surfaces = [...walk("app/rank"), "app/layout.tsx", "lib/email.ts", "lib/rank-guides.ts",
  "app/api/v/checkout/route.ts", "docs/user-guide-production-pass.md"];
for (const phrase of STALE) {
  const hits = surfaces.filter((p) => read(p).includes(phrase));
  ok(`no user-facing surface says "${phrase}"`, hits.length === 0, hits.slice(0, 3).join(", "));
}

// ── The new model, present where it must be ──
// Pricing cutover (step 11): page.tsx is now a server gate on VRAELIS_PASS_PRICING, so the flag-OFF
// copy these checks guard lives verbatim in pricing-legacy.tsx / plans-legacy.tsx. The stale-phrase
// walk above already sweeps the flag-ON files (pricing-v1.tsx / plans-v1.tsx) since they sit under
// app/rank; their approved-ladder copy is verified by scripts/pricing-v1-ui-verify.ts.
const pricing = read("app/rank/pricing/pricing-legacy.tsx");
ok("pricing keeps the headline: priced by the run, not the seat", pricing.includes("Priced by the") && pricing.includes("not the seat"));
ok("pricing carries the new subtitle", pricing.includes("Run your AI-built application through a real production review"));
ok("free tier: one complete Production Pass, up to 3 critical flows, no card",
  pricing.includes("One complete Production Pass") && pricing.includes("Up to 3 critical flows") && pricing.includes("No card required"));
ok("pay as you go: $10 per pass with 5 flows included and $2 per additional",
  pricing.includes("$10") && pricing.includes("Includes up to 5 approved critical flows") && pricing.includes("$2 per additional approved flow"));
ok("unimplemented monthly plans have NO checkout on the public page", !pricing.includes("checkout?plan="));
ok("early-access billing note is present (checkout not yet migrated)", pricing.includes("Early access"));

const pricingMeta = read("app/rank/pricing/layout.tsx");
ok("pricing metadata no longer sells judgments or credit packs", !pricingMeta.includes("judgment") && !pricingMeta.includes("credits"));

const plans = read("app/rank/app/plans/plans-legacy.tsx");
ok("signed-in plans: future Pro/Scale render as a disabled preview, no subscription checkout",
  plans.includes("Not available yet") && !plans.includes("checkout?plan="));
ok("signed-in plans show the per-pass model", plans.includes("$10") && plans.includes("Production Pass"));

const credits = read("app/rank/app/credits/page.tsx");
ok("credits page frames the balance as early access funding passes", credits.includes("early access") && credits.includes("Production Pass"));
ok("credits page keeps the honest refund rule", credits.includes("Nothing ran, nothing charged"));

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
