// Server-side submission idempotency (Pass 2A Phase 5). Backed by v_check_idempotency whose composite
// PRIMARY KEY (user_id, submission_id) makes reservation atomic: concurrent identical submissions race
// on the insert and exactly one wins. Never relies on client state / a disabled button / an in-memory
// lock. Stores only owner identity, submission id, status, check id, timestamps, and a redacted error
// category -- never request content.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";

const TABLE = "v_check_idempotency";
export type ReserveResult = { reserved: true } | { reserved: false; status: string; checkId: string | null };

// Atomic reserve. Insert the (owner, submission) row; on PK conflict return the EXISTING state so a
// replay or concurrent duplicate never starts a second evaluation or a second charge.
export async function reserveSubmission(userId: string, submissionId: string): Promise<ReserveResult> {
  if (!isDatabaseConfigured() || !submissionId) return { reserved: true };
  const s = getSupabaseAdminClient();
  const { error } = await s.from(TABLE as never).insert({ user_id: userId, submission_id: submissionId, status: "reserved" } as never);
  if (!error) return { reserved: true };
  const { data } = await s.from(TABLE as never).select("status, check_id").eq("user_id", userId).eq("submission_id", submissionId).maybeSingle();
  const row = data as { status: string; check_id: string | null } | null;
  if (row) return { reserved: false, status: row.status, checkId: row.check_id };
  return { reserved: false, status: "error", checkId: null };
}

async function patch(userId: string, submissionId: string, fields: Record<string, unknown>): Promise<void> {
  if (!isDatabaseConfigured() || !submissionId) return;
  await getSupabaseAdminClient().from(TABLE as never).update({ ...fields, updated_at: new Date().toISOString() } as never).eq("user_id", userId).eq("submission_id", submissionId);
}
export const markEvaluating = (u: string, id: string) => patch(u, id, { status: "evaluating" });
export const markPersisting = (u: string, id: string) => patch(u, id, { status: "persisting" });
export const completeSubmission = (u: string, id: string, checkId: string) => patch(u, id, { status: "completed", check_id: checkId });
// A recoverable failure releases the reservation so a deliberate retry with the SAME id can proceed;
// a terminal failure keeps 'failed' so a replay returns the failed state (retry needs a new id).
export const failSubmission = (u: string, id: string, errorCategory: string, recoverable = false) =>
  recoverable ? deleteSubmission(u, id) : patch(u, id, { status: "failed", error_category: errorCategory });

export async function deleteSubmission(userId: string, submissionId: string): Promise<void> {
  if (!isDatabaseConfigured() || !submissionId) return;
  await getSupabaseAdminClient().from(TABLE as never).delete().eq("user_id", userId).eq("submission_id", submissionId);
}
