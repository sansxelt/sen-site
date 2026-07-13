// Stripe dispute/chargeback freeze + webhook event dedupe (revenue-protection blocker 2). Server-only,
// owner-scoped. The freeze is NON-DESTRUCTIVE (founder ruling): a dispute freezes execution access but
// never clears plan_v1 or customer data — it flips v_profiles.billing_access_state to 'frozen_dispute'
// and snapshots the plan into previous_plan_v1 so an operator can restore it verbatim after a WON
// dispute. Restoration is manual only. The launch gate reads isBillingFrozen() to refuse the five spend
// surfaces (new passes, reruns, PAYG, subscription allowance, new free entitlements).

import { getSupabaseAdminClient, isDatabaseConfigured } from "../supabase-admin";

function norm(e: string): string { return e.trim().toLowerCase(); }
function db() { return getSupabaseAdminClient(); }

export const FROZEN_DISPUTE = "frozen_dispute" as const;

// Dedupe a Stripe webhook event by inserting its id ONCE (DB UNIQUE on stripe_event_id is the guarantee,
// not an in-memory check). Returns "fresh" when this delivery is the first to claim the id (caller should
// process), "duplicate" when the id already exists (caller returns 200 and skips reprocessing), or
// "unavailable" when the dedupe table is missing / DB down (caller proceeds — no worse than today, where
// there is no dedupe at all; individual handlers remain idempotent on their own effects).
export type EventClaim = "fresh" | "duplicate" | "unavailable";

export async function claimStripeEvent(eventId: string, eventType: string, objectId: string | null): Promise<EventClaim> {
  if (!eventId || !isDatabaseConfigured()) return "unavailable";
  const { error } = await db().from("stripe_webhook_events" as never)
    .insert({ stripe_event_id: eventId, event_type: eventType, object_id: objectId, result: "processing" } as never);
  if (!error) return "fresh";
  if (error.code === "23505") return "duplicate"; // already claimed by a prior delivery
  return "unavailable"; // 42P01 (table missing) / transient — fall through, handlers stay idempotent
}

// Record the terminal disposition of a processed event (audit only; best-effort).
export async function markStripeEventResult(eventId: string, result: "processed" | "error" | "ignored"): Promise<void> {
  if (!eventId || !isDatabaseConfigured()) return;
  try {
    await db().from("stripe_webhook_events" as never)
      .update({ result } as never).eq("stripe_event_id", eventId);
  } catch { /* audit only */ }
}

// Release a claimed event so Stripe's retry REPROCESSES it. Called when a handler FAILED — otherwise the
// claim-before-process dedupe would permanently swallow the retry of a critical event (e.g. a dispute
// whose freeze never landed because a Stripe API call inside the handler timed out). Deleting the row
// makes the next redelivery a fresh claim. Idempotent handlers make the reprocess safe. Best-effort: if
// the delete itself fails, the event stays deduped (the pre-fix behavior) — logged, not fatal.
export async function releaseStripeEvent(eventId: string): Promise<void> {
  if (!eventId || !isDatabaseConfigured()) return;
  try {
    await db().from("stripe_webhook_events" as never)
      .delete().eq("stripe_event_id", eventId);
  } catch (err) { console.error(`releaseStripeEvent (${eventId}): ${String(err)}`); }
}

// Durable, retry-safe notification dedupe. The webhook returns 500 (retry) when a billing STATE write
// fails, so a handler can re-run; some billing emails are not idempotent and would re-send on that retry.
// This claims a single-send marker keyed by (event id, notification type, recipient) ATOMICALLY BEFORE
// the send: the first caller inserts and returns true (send it); a retry's insert loses the PK and
// returns false (skip — it was already sent). State writes stay authoritative; the email is the
// secondary effect. FAIL-SAFE toward sending: on a DB/table error we return true (a rare duplicate email
// is acceptable; silently dropping a legitimate first email is not). Marking BEFORE the send means the
// worst case is a rare MISSED email (crash between mark and send), never a duplicate — the intended
// direction for a secondary effect.
export async function claimNotification(eventId: string, notificationType: string, recipient: string): Promise<boolean> {
  if (!eventId || !recipient || !isDatabaseConfigured()) return true; // no dedupe substrate -> send
  const { error } = await db().from("stripe_notifications_sent" as never)
    .insert({ stripe_event_id: eventId, notification_type: notificationType, recipient: recipient.trim().toLowerCase() } as never);
  if (!error) return true;            // first claim -> send
  if (error.code === "23505") return false; // already sent for this (event, type, recipient) -> skip
  return true;                        // 42P01 / transient -> fail toward sending (never a silent drop)
}

// Freeze an owner's execution access on a dispute/chargeback. NON-DESTRUCTIVE: snapshots the current
// plan_v1 into previous_plan_v1 (only if not already frozen, so a second dispute event can't overwrite
// the real prior plan with an already-frozen null), flips billing_access_state to 'frozen_dispute', and
// leaves plan_v1 untouched. Idempotent: freezing an already-frozen owner is a no-op on the snapshot.
// Returns true if the owner transitioned into the frozen state on THIS call.
export async function freezeBillingAccess(owner: string, reason: string): Promise<boolean> {
  if (!owner || !isDatabaseConfigured()) return false;
  const uid = norm(owner);
  const s = db();
  // Read current state so we only snapshot the plan on the FIRST freeze (never clobber previous_plan_v1).
  const { data } = await s.from("v_profiles" as never)
    .select("plan_v1, billing_access_state, previous_plan_v1").eq("user_id", uid).maybeSingle();
  const row = data as { plan_v1?: string | null; billing_access_state?: string | null; previous_plan_v1?: string | null } | null;
  const alreadyFrozen = row?.billing_access_state === FROZEN_DISPUTE;
  const payload: Record<string, unknown> = {
    user_id: uid,
    billing_access_state: FROZEN_DISPUTE,
    billing_frozen_at: new Date().toISOString(),
    billing_frozen_reason: reason.slice(0, 280),
  };
  // Snapshot the plan to restore later — only on the first freeze, and only if there is a plan to keep.
  if (!alreadyFrozen && row?.plan_v1) payload.previous_plan_v1 = row.plan_v1;
  const { error } = await s.from("v_profiles" as never).upsert(payload as never, { onConflict: "user_id" } as never);
  if (error) { console.error(`freezeBillingAccess (${uid}): ${error.message} — apply sql/vraelis-preflight-10`); return false; }
  return !alreadyFrozen;
}

// Is the owner's execution access frozen by a dispute? Read owner-scoped. FAIL-CLOSED for a SPEND gate:
// the caller (gatePassLaunch) treats a read error as "assume NOT frozen" ONLY where erring toward blocking
// a paying user would be worse — but for a dispute freeze the safer default is to BLOCK. We therefore
// return the frozen state on a clean read and, on a read error, return false (do not block) to avoid
// locking every user out if the column is missing pre-migration; the dispute freeze still lands via the
// webhook write, and a genuine frozen user is caught on any successful read. (Documented tradeoff: the
// freeze's teeth are the webhook write + the gate read; a transient read error is a brief, self-healing
// gap, not a durable bypass.)
export async function isBillingFrozen(owner: string): Promise<boolean> {
  if (!owner || !isDatabaseConfigured()) return false;
  const { data, error } = await db().from("v_profiles" as never)
    .select("billing_access_state").eq("user_id", norm(owner)).maybeSingle();
  if (error || !data) return false;
  return (data as { billing_access_state?: string | null }).billing_access_state === FROZEN_DISPUTE;
}

// Operator restore after a WON dispute (manual only). Flips billing_access_state back to 'active' and
// clears the freeze metadata. plan_v1 was never cleared, so nothing to re-grant — this just re-opens
// execution. Scoped to a currently-frozen owner so it can't silently no-op-succeed on a wrong id.
export async function restoreBillingAccess(owner: string): Promise<boolean> {
  if (!owner || !isDatabaseConfigured()) return false;
  const { data, error } = await db().from("v_profiles" as never)
    .update({ billing_access_state: "active", billing_frozen_at: null, billing_frozen_reason: null, previous_plan_v1: null } as never)
    .eq("user_id", norm(owner)).eq("billing_access_state", FROZEN_DISPUTE).select("user_id");
  if (error) { console.error(`restoreBillingAccess: ${error.message}`); return false; }
  return Array.isArray(data) && data.length > 0;
}

// Record a dispute-lifecycle event for the operator audit trail (best-effort).
export async function recordDisputeEvent(input: {
  owner: string | null; disputeId: string | null; chargeId: string | null; eventId: string | null;
  kind: "dispute_created" | "dispute_closed" | "refunded"; status?: string | null; amountCents?: number | null; frozeAccess?: boolean;
}): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    await db().from("v_billing_disputes" as never).insert({
      user_id: input.owner ? norm(input.owner) : null,
      stripe_dispute_id: input.disputeId, stripe_charge_id: input.chargeId, stripe_event_id: input.eventId,
      kind: input.kind, status: input.status ?? null, amount_cents: input.amountCents ?? null,
      froze_access: input.frozeAccess ?? false,
    } as never);
  } catch { /* audit only; never blocks the webhook 200 */ }
}
