// CANCELLING HAS TO WORK AS WELL AS SUBSCRIBING DOES.
//
// The pricing page now offers a subscriber a way down: the Free card opens the billing portal instead of
// linking somewhere irrelevant. A button is the easy half. The half that decides whether anyone trusts
// this product is what happens after it is pressed:
//
//   cancel or downgrade  ->  subscription state updates
//                        ->  paid entitlements end at the RIGHT TIME, not immediately
//                        ->  the account becomes Free
//                        ->  everything they already proved stays readable
//
// The last line is a printed promise. "Cancel anytime. Your record stays readable after you do." sits on
// the plans page under On every plan, and until now nothing checked it. A product whose entire claim is
// that a Verified is trustworthy cannot be the thing that quietly makes a customer's history disappear
// when they stop paying, and the person who would discover it is someone who already left.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { subscriptionIsTerminal, TERMINAL_SUB_STATUSES } from "../lib/v-subscriptions";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

const read = (f: string) => readFileSync(f, "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// The body of one exported function, so a guard can ask what that function does rather than what its
// file happens to contain. Ends at the next top-level export.
function fnBody(src: string, name: string): string {
  const i = src.indexOf(`export async function ${name}`) >= 0
    ? src.indexOf(`export async function ${name}`)
    : src.indexOf(`export function ${name}`);
  if (i < 0) return "";
  const rest = src.slice(i + 10);
  const j = rest.search(/\nexport /);
  return j < 0 ? rest : rest.slice(0, j);
}

console.log("── a plan ends when it is paid up, not when it is cancelled ──");
{
  // Pressing cancel does not end anything. Stripe keeps a cancel_at_period_end subscription in status
  // "active" until the period the customer already paid for actually elapses, and only then sends the
  // deletion event. Ending on the request would take away access somebody bought.
  ok("asking to cancel does not end the plan", !subscriptionIsTerminal("customer.subscription.updated", "active"));
  ok("neither does a trial still running", !subscriptionIsTerminal("customer.subscription.updated", "trialing"));
  // past_due means a card failed and Stripe is retrying. Pulling the plan mid-dunning punishes somebody
  // whose bank declined once, and they are still inside a period they paid for.
  ok("nor does one failed payment, while Stripe is still retrying", !subscriptionIsTerminal("customer.subscription.updated", "past_due"));

  ok("the period running out does end it", subscriptionIsTerminal("customer.subscription.deleted", "active"));
  for (const s of TERMINAL_SUB_STATUSES) {
    ok(`  and so does status "${s}"`, subscriptionIsTerminal("customer.subscription.updated", s));
  }
  // A status nobody has taught this rule about must not silently end a paying customer's plan.
  ok("an unrecognised status is not treated as an ending", !subscriptionIsTerminal("customer.subscription.updated", "paused"));

  // ONE RULE, ONE PLACE. This was written out twice as an inline expression, once for the _v1 plans and
  // once for the legacy ladder. Two copies of a billing rule is the shape it takes right before they
  // stop agreeing, and the disagreement would be invisible: each branch looks correct on its own.
  const subs = strip(read("lib/v-subscriptions.ts"));
  const inline = subs.match(/\["canceled", "unpaid", "incomplete_expired"\]/g) ?? [];
  ok("the rule is written once, not copied per branch", inline.length === 1, `${inline.length} occurrences`);
  ok("and both webhook branches call it", (subs.match(/subscriptionIsTerminal\(/g) ?? []).length >= 3);
}

console.log("\n── ending a plan ends the plan, and nothing else ──");
{
  // The tables holding what a customer actually produced. If cancellation ever touched one of these, the
  // promise on the pricing page becomes a lie and the evidence behind every past Verified becomes
  // conditional on a payment method still being on file.
  const RECORD_TABLES = ["v_guarantees", "v_applications", "v_preflight_runs", "v_flow_runs", "v_issues", "v_events"];

  const ent = read("lib/preflight/entitlements-v1.ts");
  const body = fnBody(ent, "clearPlanV1");
  ok("clearing a plan is implemented", body.length > 0);
  // Every column it writes is plan state. Written as "what may be touched" rather than "what may not",
  // so a new column added to the update has to be justified here instead of slipping past a blocklist.
  const written = Array.from(body.matchAll(/(\w+):\s*null/g)).map((m) => m[1]);
  ok("it writes only plan columns", written.length > 0 && written.every((c) => c.startsWith("plan_v1")), written.join(", "));
  ok("and updates rather than deletes a row", /\.update\(/.test(body) && !/\.delete\(/.test(body));

  // The whole webhook path, not just the one function: nothing anywhere in the subscription lifecycle
  // may reach for a record table.
  const subs = strip(read("lib/v-subscriptions.ts"));
  for (const t of RECORD_TABLES) {
    ok(`  the cancellation path never touches ${t}`, !subs.includes(t));
  }
}

console.log("\n── what they proved stays readable when they stop paying ──");
{
  // A CENSUS, NOT A SPOT CHECK. The question is not whether some particular page still loads; it is
  // whether ANY read anywhere asks what the customer is paying before showing them their own work.
  // Enumerating every call site and naming the ones allowed to gate is the only version of this guard
  // that keeps holding as routes are added.
  const CREATION_GATES = ["guaranteeCapReached", "applicationCapReached"];
  const files = sourceFiles();
  for (const g of CREATION_GATES) {
    const callers = files.filter((f) => !f.startsWith("lib/preflight/entitlements-v1") && !f.startsWith("scripts/") && strip(read(f)).includes(g));
    ok(`${g} is called from exactly one route`, callers.length === 1, callers.join(", ") || "none");
    const src = callers[0] ? strip(read(callers[0])) : "";
    // Inside the create handler. A cap on POST is a plan limit; the same cap on a read would be a paywall
    // in front of somebody's own history.
    //
    // Counted, not "absent from GET". Asking whether a GET body mentions the gate passes for free in a
    // file that has no GET, which is every one of these today, so the guard would sit here reading like
    // protection and holding nothing. Comparing the whole file against the POST body means a gate added
    // to ANY other handler, or at module scope, fails this.
    // Imports do not gate anything; one route statically imports the cap and another pulls it in with a
    // dynamic import inside the handler. Counting the import line as a call site would make this fail on
    // a route that is doing nothing wrong, and a guard that cries wolf gets deleted.
    const callsOnly = (s: string) => (s.replace(/^\s*import .*$/gm, "").match(new RegExp(g, "g")) ?? []).length;
    const inPost = callsOnly(fnBody(src, "POST"));
    const inFile = callsOnly(src);
    ok("  and only from the handler that CREATES something", inPost > 0);
    ok("  with no mention of it anywhere else in the route", inFile === inPost, `${inFile} in file, ${inPost} in POST`);
  }

  // The claim itself, on the surface the customer reads before they buy.
  const plans = read("app/rank/app/plans/plans-v1.tsx");
  ok("the plans page promises the record survives cancellation", /Cancel anytime/.test(plans) && /stays readable/.test(plans));
}

console.log("\n── the ladder ends somewhere, in the units it started in ──");
{
  // Every card leads with how many guarantees it protects. Leaving the last one blank ends the ladder
  // mid-sentence; filling it with "Unlimited" answers a question about cost with a word, and the first
  // serious buyer asks what one guarantee can cost in browser time. Custom is the true answer: capacity
  // there depends on volume, retention and support, so a public number would underprice the first real
  // contract or promise something nobody agreed to.
  for (const f of ["app/rank/app/plans/plans-v1.tsx", "app/rank/pricing/pricing-v1.tsx", "app/dev-preview/v6/pricing/page.tsx"]) {
    const src = strip(read(f));
    ok(`${f.split("/").slice(-2).join("/")} states the enterprise capacity`, /Custom guarantee capacity/.test(src));
    ok("  without claiming it is unlimited", !/[Uu]nlimited/.test(src));
    ok("  and without a made-up price beside it", !/Enterprise[\s\S]{0,400}?\$\d/.test(src));
  }
}

// Every tracked source file under app/ and lib/. git rather than a hand-kept list, so a route added
// tomorrow is censused without anyone remembering to add it here.
function sourceFiles(): string[] {
  return execFileSync("git", ["ls-files", "app", "lib"], { encoding: "utf8" })
    .split("\n").map((s) => s.trim()).filter((s) => /\.(ts|tsx)$/.test(s));
}

console.log(fail === 0 ? `\nALL PASS  ${pass} passed, 0 failed` : `\nFAILURES  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
