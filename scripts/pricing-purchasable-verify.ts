// A PRICE WITH NOTHING TO CLICK IS NOT AN OFFER.
//
// The public pricing page rendered all three plans, their monthly and yearly prices, and what each includes,
// and gave a reader no way to choose one. The only action on the page was a single "Open Vraelis" at the
// bottom, so someone who had decided on Pro signed in, landed on the app overview, and had to go looking
// through Settings for where plans live. The plans WERE visible. They were not purchasable.
import { readFileSync } from "node:fs";
import { PLAN_CATALOG_V1 } from "../lib/preflight/pass-pricing";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

const pub = readFileSync("app/dev-preview/v6/pricing/page.tsx", "utf8");
const app = readFileSync("app/rank/pricing/pricing-v1.tsx", "utf8");

console.log("── the public pricing page can be bought from ──");
ok("it renders a card per catalog plan", pub.includes("PLAN_CATALOG_V1.map("));
ok("each card carries a checkout link", /href=\{`\/checkout\?plan=\$\{p\.key\}/.test(pub));
ok("the link names the plan, so three cards do not read as one button",
  /Choose \{p\.name\}/.test(pub));
ok("the price still comes from the billing catalog, not from this page",
  pub.includes("money(p.monthlyCents)") && !/\$\d{2,}/.test(pub.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")));

// The signed-in pricing page has always had these. It is the reference, so it must keep them.
console.log("\n── the signed-in pricing page keeps its own ──");
ok("it links to checkout per plan", app.includes("checkoutHref(p.key)"));
ok("and routes a signed-out visitor through sign-in first", app.includes("/signin?callbackUrl="));

// Nothing here should hard-code a plan key: a new catalog entry must appear on the page by itself.
console.log("\n── adding a plan cannot leave it unbuyable ──");
for (const p of PLAN_CATALOG_V1) {
  ok(`${p.key} is not hard-coded into the public page`, !pub.includes(`"${p.key}"`) || pub.includes("PLAN_CATALOG_V1.map("));
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
