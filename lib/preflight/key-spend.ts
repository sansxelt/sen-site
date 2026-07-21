// Per-key daily spend ceiling. The guard that exists because machine callers change the spend threat model.
//
// The per-OWNER caps already built (daily run cap, concurrency, velocity, the global cost governor) are
// unchanged and still apply. They cannot tell a runaway agent from a busy human, because at that layer both
// are just "the owner". A ceiling attached to the KEY can: it bounds what one credential was trusted with,
// and revoking that key caps the damage without touching the account.
//
// THE INVARIANT: a key ceiling only ever NARROWS. It is checked in addition to every owner-level gate, never
// instead of one, so a key can spend less than its owner could and never more. Nothing here can authorize
// spending; it can only refuse it.
import { getSupabaseAdminClient, isDatabaseConfigured } from "../supabase-admin";

export type CeilingRefusal = { error: string; message: string; status: number; retryAfterSec: number };

// Seconds until the next UTC midnight, when the daily window rolls. Returned as Retry-After so a CI job or
// agent backs off until the ceiling actually resets instead of hammering a wall it cannot pass.
function secondsUntilUtcMidnight(nowMs: number): number {
  const next = Date.UTC(
    new Date(nowMs).getUTCFullYear(), new Date(nowMs).getUTCMonth(), new Date(nowMs).getUTCDate() + 1,
  );
  return Math.max(60, Math.ceil((next - nowMs) / 1000));
}

function utcDayStartIso(nowMs: number): string {
  const d = new Date(nowMs);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

/**
 * What this key has already committed today, in cents, since UTC midnight.
 *
 * Read from v_preflight_runs.api_key_id rather than from the events log. The events log is best-effort by
 * design (logEvent swallows its own failures so analytics can never break a product flow), so a dropped log
 * write would UNDER-count spend and the ceiling would fail open. A run row is written in the same operation
 * as the run itself, so a run that exists is always counted.
 *
 * Returns null when the migration is not applied yet or the read fails. The caller decides what that means;
 * see keyCeilingRefusal, which fails CLOSED.
 */
export async function keySpentTodayCents(keyId: string, nowMs = Date.now()): Promise<number | null> {
  if (!isDatabaseConfigured() || !keyId) return null;
  const { data, error } = await getSupabaseAdminClient()
    .from("v_preflight_runs" as never)
    .select("credits_held, state")
    .eq("api_key_id", keyId)
    .gte("created_at", utcDayStartIso(nowMs));
  if (error) return null;
  const rows = (data as unknown as { credits_held: number | null; state: string | null }[] | null) ?? [];
  // A cancelled or failed run is refunded, but it is still counted here for the day. That is deliberate: the
  // ceiling exists to stop a runaway LOOP, and a loop that fails every time is the exact case it must catch.
  // Refunding the money does not undo the browser sessions the loop consumed.
  return rows.reduce((sum, r) => sum + (Number(r.credits_held) || 0), 0);
}

/**
 * Decide whether this key may commit `costCents` more today.
 *
 * Called BEFORE the hold, so a refusal never leaves money reserved. Returns null to allow.
 *
 * FAILS CLOSED on an unreadable ledger, but only for keys that actually carry a ceiling. A key with no
 * ceiling is unaffected by a read blip (there is nothing to compare against), while a key whose owner
 * deliberately bounded it must not have that bound silently lifted by a transient database error. That is
 * the opposite of the velocity cap's fail-open posture, and intentionally so: velocity is a heuristic guard
 * layered over the hold, whereas this ceiling is an explicit instruction from the owner about a credential.
 */
export async function keyCeilingRefusal(
  key: { id: string | null; dailyCeilingCents: number | null },
  costCents: number,
  nowMs = Date.now(),
): Promise<CeilingRefusal | null> {
  if (!key.id || key.dailyCeilingCents == null) return null; // no ceiling on this key (or a session caller)

  const spent = await keySpentTodayCents(key.id, nowMs);
  const retryAfterSec = secondsUntilUtcMidnight(nowMs);
  if (spent === null) {
    return {
      error: "key_ceiling_unavailable",
      message: "This key has a daily spend limit that could not be checked right now, so the run was not started. Try again shortly.",
      status: 503,
      retryAfterSec: 60,
    };
  }
  if (spent + costCents > key.dailyCeilingCents) {
    const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;
    return {
      error: "key_daily_ceiling",
      message: `This key's daily limit of ${fmt(key.dailyCeilingCents)} would be exceeded: ${fmt(spent)} already spent today and this run costs ${fmt(costCents)}. Use a different key, raise the limit, or wait for the limit to reset.`,
      status: 429,
      retryAfterSec,
    };
  }
  return null;
}
