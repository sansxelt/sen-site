// Regression tests for the pricing correction: the old feedback-network credit economics ($1 = 10 credits,
// a credit per approved flow, 1 credit = 1 AI check, human-judgment credits) must never reappear on a
// surface a user can read: public marketing, signed-in app, metadata, checkout copy, onboarding emails.
// The live ledger mechanics (hold/refund/credits_held) are NOT copy and are exempt; the legacy checker
// under app/rank/app/legacy is flag-gated and exempt. Static source checks; no DB, no network.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { passPriceCents, PASS_INCLUDED_FLOWS, PASS_BASE_CENTS } from "../lib/preflight/pass-pricing";
function readAll(dir: string): string {
  let out = "";
  for (const e of readdirSync(dir)) {
    const p2 = join(dir, e);
    if (statSync(p2).isDirectory()) out += readAll(p2);
    else if (/\.(ts|tsx)$/.test(e)) out += readFileSync(p2, "utf8");
  }
  return out;
}

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
const surfaces = [...walk("app/rank"), "app/layout.tsx", "lib/email.ts",
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
// The retired vocabulary was "a real production review"; the migration replaced it with "verification".
// Asserted as a property (it sells a real verification and names what comes back) so the guard survives the
// next wording pass instead of going red on copy that says exactly what it is supposed to say.
ok("pricing carries the new subtitle",
  /Run your AI-built \w+ through a real verification/.test(pricing)
  && pricing.includes("explainable decision"));
ok("free tier: one complete verification, up to 3 critical flows, no card",
  pricing.includes("One complete verification") && pricing.includes("Up to 3 critical flows") && pricing.includes("No card required"));
ok("pay as you go: $10 per pass with 5 flows included and $3 per additional",
  pricing.includes("$10") && pricing.includes("Includes up to 5 approved critical flows") && pricing.includes("$3 per additional approved flow"));
ok("unimplemented monthly plans have NO checkout on the public page", !pricing.includes("checkout?plan="));
ok("early-access billing note is present (checkout not yet migrated)", pricing.includes("Early access"));

const pricingMeta = read("app/rank/pricing/layout.tsx");
ok("pricing metadata no longer sells judgments or credit packs", !pricingMeta.includes("judgment") && !pricingMeta.includes("credits"));

const plans = read("app/rank/app/plans/plans-legacy.tsx");
ok("signed-in plans: future Pro/Scale render as a disabled preview, no subscription checkout",
  plans.includes("Not available yet") && !plans.includes("checkout?plan="));
ok("signed-in plans show the per-verification model", plans.includes("$10") && plans.includes("$10<small>/verification</small>"));

const credits = read("app/rank/app/credits/page.tsx");
// This used to REQUIRE the credits page to say "early access" and "$10 per verification". Both were wrong.
// The early-access base exists in the catalog but no caller has ever asked for it, so every launch is
// charged at the public price, and the page was quoting a number nobody pays. An assertion that pins a
// specific wrong price in place is worse than no assertion, so what is pinned now is the property: the page
// explains per-verification pricing and gets the figure from the same function that charges it.
ok("credits page explains per-verification pricing", /per[- ]verification pricing/i.test(credits));
ok("credits page takes its figure from the pricing catalog, not from a typed number",
  credits.includes("passPriceCents(PASS_INCLUDED_FLOWS)"));
ok("credits page keeps the honest refund rule", credits.includes("Nothing ran, nothing charged"));


// ── A PRICE A CUSTOMER READS MUST NOT DISAGREE WITH THE PRICE THEY ARE CHARGED ────────────────────────
// /credits said "$10 per verification". Every charging path calls passPriceCents with no options, and
// nothing in production has ever passed earlyAccess, so the amount actually taken is $15. /plans and
// /pricing were right because they derive from the function; /credits had the number typed in.
{
  const charged = passPriceCents(PASS_INCLUDED_FLOWS);
  ok("the charged pass price is the public one, not the early-access one",
    charged === PASS_BASE_CENTS, `${charged} cents`);

  // The early-access base is still in the catalog. It has never been anyone's price, because no caller
  // asks for it. If one ever does, the pages below start understating what is taken, so this notices.
  const productSource = ["lib", "app", "worker"].map((d) => readAll(d)).join("\n");
  ok("nothing in the product asks for early-access pricing",
    !/earlyAccess:\s*true/.test(productSource));

  // A dollar amount typed next to "per verification" is a number that cannot follow the catalog.
  const HARDCODED = /\$\s?\d+(\.\d+)?\s*(per verification|per pass)/i;
  for (const f of ["app/rank/app/credits/page.tsx", "app/rank/app/plans/plans-v1.tsx", "app/rank/pricing/pricing-v1.tsx"]) {
    const src = readFileSync(f, "utf8");
    const withoutComments = src.replace(/^\s*\/\/.*$/gm, "");
    ok(`${f} does not hard-code a per-verification dollar amount`, !HARDCODED.test(withoutComments));
    ok(`${f} derives the price from passPriceCents`, src.includes("passPriceCents("));
  }
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
