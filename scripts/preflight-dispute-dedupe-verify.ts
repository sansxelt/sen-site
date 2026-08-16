// Stripe dispute/chargeback handling + webhook dedupe, verified (revenue-protection blocker 2). Pure
// gate tests + STATIC source checks of the security-critical contracts that need a live DB/Stripe to run:
// the freeze is NON-DESTRUCTIVE, the gate refuses ALL spend when frozen, the resurrect guard suppresses
// an out-of-order re-activation, the webhook dedupes on a DB UNIQUE constraint, and restore is admin-only
// and manual. No DB, no network.
import fs from "node:fs";
import path from "node:path";
import { decidePassGate } from "../lib/preflight/entitlements-v1";
import { planV1 } from "../lib/preflight/pass-pricing";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");

function main(): void {
  // ── The frozen gate is a distinct, non-ok decision (403) that decidePassGate never emits — it is added
  //    by gatePassLaunch BEFORE any spend decision, so all five surfaces are covered by one check. ──
  const builder = planV1("builder_v1")!;
  // Sanity: decidePassGate itself still returns the normal ladder (frozen is layered above it, not inside).
  ok("decidePassGate (no freeze) still returns the subscription decision", decidePassGate({ plan: builder, unitsUsedInWindow: 0, freePassUsed: true, selectedFlows: 3 }).mode === "subscription");
  ok("decidePassGate (no freeze) still returns free for an unused pass", decidePassGate({ plan: null, unitsUsedInWindow: 0, freePassUsed: false, selectedFlows: 3 }).mode === "free");

  const ent = read("lib", "preflight", "entitlements-v1.ts");
  // ── The gate: frozen is checked FIRST and refuses every spend surface. ──
  ok("PassGateDecision has a 'frozen' / billing_frozen 403 refusal variant",
    /mode: "frozen"; ok: false; error: "billing_frozen"[\s\S]*?status: 403/.test(ent));
  ok("gatePassLaunch checks isBillingFrozen FIRST (before getPlanV1State / freePassUsed)",
    /gatePassLaunch[\s\S]*?if \(await isBillingFrozen\(owner\)\)[\s\S]*?return \{ mode: "frozen"[\s\S]*?const state = await getPlanV1State/.test(ent));
  ok("the frozen refusal is a hard 403, not a paid fallthrough",
    /error: "billing_frozen", status: 403/.test(ent));
  // ── Resurrect guard: an out-of-order 'active' after a freeze must not re-activate plan_v1. ──
  ok("setPlanV1 suppresses the write for a frozen (disputed) owner (resurrect guard)",
    /setPlanV1[\s\S]*?billing_access_state[\s\S]*?=== "frozen_dispute"[\s\S]*?return;/.test(ent));

  // ── The freeze is NON-DESTRUCTIVE: plan_v1 preserved, previous_plan_v1 snapshotted, restore manual. ──
  const bf = read("lib", "preflight", "billing-freeze.ts");
  // Scope to just the freezeBillingAccess body (up to the next 'export async function') so the check
  // doesn't leak into restoreBillingAccess, which legitimately sets previous_plan_v1: null.
  const freezeBody = bf.slice(bf.indexOf("export async function freezeBillingAccess"), bf.indexOf("export async function isBillingFrozen"));
  ok("freezeBillingAccess sets billing_access_state='frozen_dispute' and NEVER nulls plan_v1",
    /billing_access_state: FROZEN_DISPUTE/.test(freezeBody) && !/\bplan_v1: null/.test(freezeBody));
  ok("freezeBillingAccess snapshots previous_plan_v1 only on the FIRST freeze (never clobbers it)",
    /if \(!alreadyFrozen && row\?\.plan_v1\) payload\.previous_plan_v1 = row\.plan_v1/.test(bf));
  ok("restoreBillingAccess is scoped to a currently-frozen owner (can't silently succeed on a wrong id)",
    /restoreBillingAccess[\s\S]*?\.eq\("billing_access_state", FROZEN_DISPUTE\)\.select\("user_id"\)/.test(bf));
  ok("restore flips back to 'active' and clears the freeze metadata (no re-grant needed)",
    /billing_access_state: "active", billing_frozen_at: null/.test(bf));

  // ── Webhook dedupe: a DB UNIQUE constraint, not an in-memory check; dup -> 200 without reprocessing. ──
  ok("claimStripeEvent inserts the event id and maps 23505 -> duplicate (DB UNIQUE is the guarantee)",
    /claimStripeEvent[\s\S]*?\.insert\(\{ stripe_event_id: eventId[\s\S]*?23505[\s\S]*?return "duplicate"/.test(bf));
  const wh = read("app", "api", "stripe", "webhook", "route.ts");
  ok("the webhook claims the event BEFORE dispatch and returns 200 on a duplicate without reprocessing",
    /claimStripeEvent\(event\.id[\s\S]*?if \(claim === "duplicate"\) return NextResponse\.json\(\{ received: true, duplicate: true \}\)/.test(wh)
      // The dispatch switch is the LAST 'switch (event.type)' (an earlier one lives in handleSubscriptionChange).
      && wh.indexOf("claimStripeEvent(event.id") < wh.lastIndexOf("switch (event.type)"));
  ok("dispute.created FREEZES access; dispute.closed + refunded are recorded (no auto-restore)",
    /case "charge\.dispute\.created":[\s\S]*?handleDisputeCreated/.test(wh)
      && /case "charge\.dispute\.closed":[\s\S]*?handleDisputeClosed/.test(wh)
      && /case "charge\.refunded":[\s\S]*?handleChargeRefunded/.test(wh));
  ok("handleDisputeCreated calls freezeBillingAccess for the attributed owner",
    /handleDisputeCreated[\s\S]*?freezeBillingAccess\(owner,/.test(wh));
  ok("dispute.closed does NOT auto-restore (manual restore only)",
    /handleDisputeClosed[\s\S]*?manual restore/.test(wh) && !/handleDisputeClosed[\s\S]*?restoreBillingAccess/.test(wh));

  // ── Dropped-freeze fix: a failed critical handler must NOT be permanently deduped. ──
  ok("claimStripeEvent is released on handler failure (releaseStripeEvent) so a retry reprocesses",
    /catch \(err\)[\s\S]*?await releaseStripeEvent\(event\.id\)/.test(wh));
  ok("critical mutating events return 500 on failure so Stripe RETRIES (not a silent 200)",
    /RETRY_ON_FAILURE = new Set\(\[[\s\S]*?"charge\.dispute\.created"[\s\S]*?\]\)[\s\S]*?return NextResponse\.json\(\{ error: "handler_failed_retry" \}, \{ status: 500 \}\)/.test(wh));
  ok("handleDisputeCreated THROWS when it can't attribute/freeze (no silent dropped freeze)",
    /handleDisputeCreated[\s\S]*?throw new Error\(`dispute \$\{dispute\.id\}: could not attribute/.test(wh));
  ok("handleDisputeCreated does NOT swallow the charge-retrieve error (it propagates to the retry path)",
    !/handleDisputeCreated[\s\S]*?catch \(err\) \{ console\.error\("\[stripe webhook\] dispute charge retrieve failed/.test(wh));
  ok("releaseStripeEvent deletes the claim row (makes the redelivery a fresh claim)",
    /releaseStripeEvent[\s\S]*?\.delete\(\)\.eq\("stripe_event_id", eventId\)/.test(bf));

  // ── Attribution key: the _v1 checkout stores the LOWERCASED owner so the freeze lands on the plan row. ──
  const sub = read("app", "api", "v", "subscribe", "route.ts");
  ok("_v1 checkout metadata.user_id is the lowercased owner (matches the plan_v1/v_profiles tenancy key)",
    /metadata: \{ type: "v_plan", plan, cycle, user_id: owner \}/.test(sub) && !/user_id: email \}/.test(sub));

  // ── Retry-safe idempotent emails (the MEDIUM regression fix): durable per-(event,type,recipient)
  //    marker, claimed BEFORE the send, keeps state authoritative while never double-sending. ──
  ok("claimNotification inserts a durable marker keyed by (event id, type, recipient); 23505 -> skip",
    /claimNotification[\s\S]*?\.insert\(\{ stripe_event_id: eventId, notification_type: notificationType, recipient[\s\S]*?=== "23505"\) return false/.test(bf));
  ok("claimNotification fails toward SENDING on a table/DB error (never a silent dropped first email)",
    /claimNotification[\s\S]*?isDatabaseConfigured\(\)\) return true[\s\S]*?return true; +\/\/ 42P01/.test(bf));
  // REPLAY SCENARIO 'state failure after email sent': the activation/renewal emails are gated on the
  // marker, so a 500-retry (state failure) re-runs state but the marker skips the already-sent email.
  // THE SHAPE MOVED, THE PROPERTY DID NOT. The three subscription notices were a switch inline in the
  // route, and that switch sat below the early return for Vraelis Rank, so the product with actual
  // subscribers was never sent any of them. They are now one loop that claims per planned kind, and what
  // is asserted is still exactly what was asserted before: nothing is sent without first claiming a
  // durable (event id, kind, recipient) marker. See scripts/stripe-subscription-lifecycle-verify.ts.
  const sendFn = wh.slice(wh.indexOf("async function sendSubscriptionEmails("));
  const sendBody = sendFn.slice(0, sendFn.indexOf("\n}"));
  ok("subscription emails are gated on claimNotification (retry re-runs state, skips email)",
    /if \(!\(await claimNotification\(event\.id, mail\.kind, ctx\.email\)\)\) continue;/.test(sendBody));
  ok("  and the claim precedes every sender, so no notice can escape it",
    sendBody.length > 0 &&
    ["sendSubscriptionActivatedEmail", "sendSubscriptionCancellationScheduledEmail", "sendSubscriptionEndedEmail"]
      .every((s) => sendBody.includes(s) && sendBody.indexOf("claimNotification(") < sendBody.indexOf(s)));
  ok("renewal_succeeded email is gated on claimNotification (retry re-runs the idempotent grant, skips email)",
    /claimNotification\(eventId, "renewal_succeeded", email\)\) \{[\s\S]*?sendRenewalSucceededEmail/.test(wh));
  ok("cancellation_scheduled + subscription_ended are still distinct claim keys (redelivery re-fires the transition)",
    ["subscription_activated", "cancellation_scheduled", "subscription_ended"]
      .every((k) => read("lib", "stripe-subscription-notify.ts").includes(`"${k}"`)));
  // One update can legitimately be a scheduled cancellation AND an ending. Distinct kinds are what stop a
  // single shared marker from suppressing the second notice.
  ok("the Rank branch notifies before returning (the bug: it returned above the switch entirely)",
    /metadata\?\.type === "v_plan"[\s\S]{0,900}?sendSubscriptionEmails\(/.test(wh));
  // REPLAY SCENARIO 'never mark processed until state persists': a state throw releases the claim and
  // returns 500, so the event is NOT recorded as processed and Stripe retries the unfinished state.
  ok("a state failure returns 500 (event NOT marked processed) so Stripe retries the unfinished state",
    /catch \(err\)[\s\S]*?releaseStripeEvent\(event\.id\)[\s\S]*?RETRY_ON_FAILURE[\s\S]*?status: 500/.test(wh));
  // REPLAY SCENARIO 'duplicate Stripe event': the top-level claim dedupes an exact redelivery to a 200.
  ok("a duplicate Stripe event short-circuits to 200 without reprocessing (top-level dedupe)",
    /if \(claim === "duplicate"\) return NextResponse\.json\(\{ received: true, duplicate: true \}\)/.test(wh));
  // REPLAY SCENARIO 'out-of-order': setPlanV1 resurrect guard already asserted above; the dedupe table
  // + the frozen guard together prevent an out-of-order 'active' from resurrecting a frozen plan.
  ok("audit rows are deduped per event id (a retry does not pile duplicate dispute rows)",
    /create unique index if not exists v_billing_disputes_event_uidx[\s\S]*?\(stripe_event_id\) where stripe_event_id is not null/.test(read("sql", "vraelis-preflight-10-dispute-dedupe.sql")));
  ok("the notification marker table exists with the (event,type,recipient) PRIMARY KEY",
    /create table if not exists public\.stripe_notifications_sent[\s\S]*?primary key \(stripe_event_id, notification_type, recipient\)/.test(read("sql", "vraelis-preflight-10-dispute-dedupe.sql")));

  // ── Hard-crash self-heal: a claim stuck in 'processing' past the TTL is reclaimed so a redelivery
  //    reprocesses (a hard crash inside handleDisputeCreated can't silently drop a freeze forever). ──
  ok("claimStripeEvent reclaims a STALE 'processing' claim (TTL) and retries the insert once",
    /STALE_PROCESSING_MS[\s\S]*?\.eq\("result", "processing"\)\.lt\("processed_at", cutoff\)[\s\S]*?insert\(\{ stripe_event_id: eventId[\s\S]*?return "fresh"/.test(bf));
  ok("the reclaim can NEVER touch a completed event (delete is conditional on result='processing')",
    !/claimStripeEvent[\s\S]*?\.delete\(\)\.eq\("stripe_event_id", eventId\)(?!\.eq\("result", "processing"\))/.test(
      bf.slice(bf.indexOf("export async function claimStripeEvent"), bf.indexOf("export async function markStripeEventResult"))));

  // ── The admin restore route is admin-gated on both verbs. ──
  const admin = read("app", "api", "v", "admin", "billing-restore", "route.ts");
  ok("restore route is admin-gated (isAdmin) on BOTH verbs", (admin.match(/if \(!isAdmin\(/g) ?? []).length >= 2);
  ok("restore returns 409 not_frozen when the owner wasn't actually frozen", /not_frozen/.test(admin));
  ok("restore writes an audit event", /billing_access_restored/.test(admin));

  // ── The migration is additive: dedupe table with the event id as PRIMARY KEY, non-destructive freeze cols. ──
  const mig = read("sql", "vraelis-preflight-10-dispute-dedupe.sql");
  ok("stripe_webhook_events has stripe_event_id as PRIMARY KEY (the DB UNIQUE dedupe)",
    /create table if not exists public\.stripe_webhook_events[\s\S]*?stripe_event_id text primary key/.test(mig));
  ok("v_profiles gains billing_access_state + previous_plan_v1 (non-destructive freeze)",
    /add column if not exists billing_access_state/.test(mig) && /add column if not exists previous_plan_v1/.test(mig));
  ok("the dispute audit table exists", /create table if not exists public\.v_billing_disputes/.test(mig));

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
}

main();
