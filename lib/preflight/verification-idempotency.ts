// Idempotency for /v1/verifications, decided BEFORE any expensive or side-effecting work.
//
// The endpoint crawls, synthesizes (a model call), creates a contract with requirements and flows, and
// launches a run that takes a hold. Deciding idempotency AFTER all that only stops a double charge; it still
// pays for synthesis and orphans a contract on every retry. This module moves the decision to the front, and
// makes it atomic so two simultaneous identical requests cannot both begin synthesis.
//
// THE RESERVATION is a row in v_verification_idempotency keyed on (user_id, idem_key). INSERT ON CONFLICT DO
// NOTHING means exactly one concurrent request wins the insert and owns execution; the rest read the winner.
//
// DEGRADES SAFELY: if the table is missing (migration 17 not applied), reserve() returns "unavailable" and
// the route falls back to the post-hoc reconciliation already in production. A deploy that lands before the
// migration keeps working, just without the pre-synthesis saving.
import { getSupabaseAdminClient, isDatabaseConfigured } from "../supabase-admin";
import { createHash } from "node:crypto";

function norm(e: string): string { return e.trim().toLowerCase(); }
function db() { return getSupabaseAdminClient(); }

// A pending reservation older than this is treated as abandoned (its owner died mid-synthesis) and may be
// reclaimed. Longer than the worst-case crawl+synthesis, shorter than a person's patience: a genuinely
// concurrent duplicate resolves in seconds, so this only ever fires on a real crash.
export const STALE_PENDING_MS = 3 * 60_000;

export type ReservationState = "pending" | "launched" | "failed";
export type ExistingReservation = { fingerprint: string; state: ReservationState; runId: string | null; createdAtMs: number };

// The canonical request fingerprint. Same deployment + same claim (canonicalized) -> same fingerprint. A
// changed claim or url -> a different one, which is exactly what distinguishes a genuine retry from a
// reused key on a different request. The claim canonicalization matches the /v1 route (_shared.canonicalClaim):
// trim and collapse internal whitespace, nothing more.
export function verificationFingerprint(deploymentUrl: string, claim: string): string {
  const canonicalClaim = (claim ?? "").trim().replace(/\s+/g, " ");
  const canonicalUrl = (deploymentUrl ?? "").trim();
  return createHash("sha256").update(`${canonicalUrl}\n${canonicalClaim}`).digest("hex").slice(0, 32);
}

// The decision, as a PURE function of the existing row (if any) and the incoming fingerprint. Factored out so
// every branch is unit-testable without a database, because this is the part where a subtle mistake silently
// double-charges or wrongly rejects.
export type Decision =
  | { action: "replay"; runId: string }   // launched, same request -> return the original, no work
  | { action: "conflict" }                // same key, different request -> 409, no work
  | { action: "wait" }                    // a fresh pending reservation for the same request is in flight
  | { action: "take_over" };              // failed, or an abandoned stale pending -> reclaim and proceed

export function decideExisting(existing: ExistingReservation, fingerprint: string, nowMs: number, staleMs = STALE_PENDING_MS): Decision {
  // A different request under the same key is refused regardless of the reservation's state. This is the
  // payload-binding guarantee, now enforced BEFORE synthesis.
  if (existing.fingerprint !== fingerprint) return { action: "conflict" };

  if (existing.state === "launched" && existing.runId) return { action: "replay", runId: existing.runId };

  // A prior attempt that failed before a run existed never poisons the key: the request may take it over.
  if (existing.state === "failed") return { action: "take_over" };

  // Pending: either a genuinely concurrent duplicate (wait for it) or an abandoned reservation (reclaim it).
  if (existing.state === "pending") {
    return nowMs - existing.createdAtMs > staleMs ? { action: "take_over" } : { action: "wait" };
  }

  // launched with no run id should not happen; treat it as reclaimable rather than trusting a half-written row.
  return { action: "take_over" };
}

export type ReserveOutcome =
  | { outcome: "owned" }                       // we won the reservation; proceed to synthesize + launch
  | { outcome: "replay"; runId: string }       // an identical request already launched; return it, do no work
  | { outcome: "conflict" }                    // same key, different request; 409, do no work
  | { outcome: "pending" }                     // an identical request is concurrently in flight; retry shortly
  | { outcome: "unavailable" };                // table not migrated; caller falls back to post-hoc reconciliation

/**
 * Atomically reserve (owner, idemKey) for this request, or discover what already holds it.
 *
 * Called BEFORE synthesis. Only an "owned" outcome may proceed to do work.
 */
export async function reserve(owner: string, idemKey: string, fingerprint: string, nowMs = Date.now()): Promise<ReserveOutcome> {
  if (!isDatabaseConfigured() || !idemKey) return { outcome: "unavailable" };
  const uid = norm(owner);

  // The atomic reservation: insert, and do nothing if the row already exists. `select` after the upsert tells
  // us whether WE created it. Supabase's insert with ignoreDuplicates returns the inserted rows only.
  const ins = await db().from("v_verification_idempotency" as never)
    .upsert({ user_id: uid, idem_key: idemKey, fingerprint, state: "pending", created_at: new Date(nowMs).toISOString() } as never,
            { onConflict: "user_id,idem_key", ignoreDuplicates: true })
    .select("user_id");
  // A missing table is the only error we tolerate as "unavailable"; anything else is a real failure and also
  // degrades to the fallback rather than blocking a paid feature on the idempotency layer.
  if (ins.error) return { outcome: "unavailable" };
  if ((ins.data as unknown[] | null)?.length) return { outcome: "owned" }; // our row was inserted

  // The row already existed: read it and decide.
  const { data } = await db().from("v_verification_idempotency" as never)
    .select("fingerprint, state, run_id, created_at").eq("user_id", uid).eq("idem_key", idemKey).maybeSingle();
  const r = data as { fingerprint: string; state: ReservationState; run_id: string | null; created_at: string } | null;
  if (!r) return { outcome: "unavailable" }; // vanished under us (rollback?); fall back rather than guess

  const existing: ExistingReservation = { fingerprint: r.fingerprint, state: r.state, runId: r.run_id, createdAtMs: new Date(r.created_at).getTime() };
  const d = decideExisting(existing, fingerprint, nowMs);

  if (d.action === "replay") return { outcome: "replay", runId: d.runId };
  if (d.action === "conflict") return { outcome: "conflict" };
  if (d.action === "wait") return { outcome: "pending" };

  // take_over: reclaim the row ATOMICALLY. The conditional update on the observed created_at means only one
  // request can win the reclaim; a loser sees zero rows updated and reports pending (let the winner finish).
  const reclaimed = await db().from("v_verification_idempotency" as never)
    .update({ fingerprint, state: "pending", run_id: null, created_at: new Date(nowMs).toISOString(), updated_at: new Date(nowMs).toISOString() } as never)
    .eq("user_id", uid).eq("idem_key", idemKey).eq("created_at", r.created_at)
    .select("user_id");
  if (reclaimed.error) return { outcome: "unavailable" };
  return (reclaimed.data as unknown[] | null)?.length ? { outcome: "owned" } : { outcome: "pending" };
}

/** Record that the reserved request launched a run. Replays return this run id without doing any work. */
export async function markLaunched(owner: string, idemKey: string, runId: string): Promise<void> {
  if (!isDatabaseConfigured() || !idemKey) return;
  await db().from("v_verification_idempotency" as never)
    .update({ state: "launched", run_id: runId, updated_at: new Date().toISOString() } as never)
    .eq("user_id", norm(owner)).eq("idem_key", idemKey);
}

/**
 * Record that the reserved request failed before a run existed. The key is left reclaimable, not launched, so
 * a retry can safely resume rather than being permanently poisoned by a transient synthesis or launch error.
 */
export async function markFailed(owner: string, idemKey: string): Promise<void> {
  if (!isDatabaseConfigured() || !idemKey) return;
  await db().from("v_verification_idempotency" as never)
    .update({ state: "failed", updated_at: new Date().toISOString() } as never)
    .eq("user_id", norm(owner)).eq("idem_key", idemKey);
}
