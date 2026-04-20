// ────────────────────────────────────────────────────────────────────
// RESET STRIPE CUSTOMERS — keeps ONLY sansxeltech@gmail.com
// ────────────────────────────────────────────────────────────────────
// IRREVERSIBLE. Run locally with:
//   node docs/reset-stripe-customers.mjs
//
// Requires STRIPE_SECRET_KEY in your env (use the same Stripe key
// the live site uses; set STRIPE_DRY_RUN=1 to print without deleting).

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const KEEP = "sansxeltech@gmail.com";
const DRY = process.env.STRIPE_DRY_RUN === "1";

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("STRIPE_SECRET_KEY missing");
  process.exit(1);
}

console.log(`Mode: ${DRY ? "DRY RUN (no deletes)" : "LIVE (will delete)"}`);
console.log(`Keeping email: ${KEEP}`);
console.log("");

let scanned = 0;
let kept = 0;
let cancelled = 0;
let deleted = 0;
let skipped = 0;

let startingAfter;
while (true) {
  const page = await stripe.customers.list({
    limit: 100,
    ...(startingAfter ? { starting_after: startingAfter } : {}),
  });
  for (const c of page.data) {
    scanned++;
    if (c.email && c.email.toLowerCase() === KEEP.toLowerCase()) {
      console.log(`KEEP    ${c.id}  ${c.email}`);
      kept++;
      continue;
    }
    // Cancel non-cancelled subs first so the customer can be deleted cleanly.
    const subs = await stripe.subscriptions.list({ customer: c.id, status: "all", limit: 100 });
    for (const s of subs.data) {
      if (s.status !== "canceled" && s.status !== "incomplete_expired") {
        if (!DRY) {
          try { await stripe.subscriptions.cancel(s.id); } catch {}
        }
        cancelled++;
      }
    }
    if (DRY) {
      console.log(`WOULD   ${c.id}  ${c.email ?? "(no email)"}  (subs cancelled: ${subs.data.length})`);
      continue;
    }
    try {
      await stripe.customers.del(c.id);
      console.log(`DELETE  ${c.id}  ${c.email ?? "(no email)"}`);
      deleted++;
    } catch (err) {
      console.warn(`SKIP    ${c.id}  ${err.message}`);
      skipped++;
    }
  }
  if (!page.has_more) break;
  startingAfter = page.data[page.data.length - 1]?.id;
}

console.log("");
console.log(`Scanned:   ${scanned}`);
console.log(`Kept:      ${kept}`);
console.log(`Cancelled: ${cancelled}  subscriptions`);
console.log(`Deleted:   ${deleted}  customers`);
console.log(`Skipped:   ${skipped}`);
