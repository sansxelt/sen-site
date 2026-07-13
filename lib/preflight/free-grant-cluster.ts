// Free-pass abuse controls (revenue-protection blocker 1) — the canonical-cluster resolver, the operator
// comp/override check, and the risk-signal recorder. Server-only, owner-scoped. Everything here degrades
// FAIL-CLOSED: when eligibility cannot be confirmed, the caller treats the lifetime free pass as already
// used and routes to PAYG (never leaks a free run on a transient error). The operator override table is
// the safety valve that lets a wrongly-charged legitimate user be comped out of band.
//
// The ONLY hard-denial key for the free pass is the canonical email (one lifetime free pass per real
// inbox). IP / device / ASN are recorded via recordFreeGrantRisk as SIGNALS ONLY — they raise a review
// flag and feed velocity heuristics but never deny a free run on their own (founder ruling).

import { createHash } from "crypto";
import { getSupabaseAdminClient, isDatabaseConfigured } from "../supabase-admin";
import { canonicalizeEmail } from "../user-credentials";

function norm(e: string): string { return e.trim().toLowerCase(); }
function db() { return getSupabaseAdminClient(); }

// Salted, one-way hash of a raw IP / device string so the risk table never stores a raw identifier. The
// salt keeps the hash from being a rainbow-table lookup of the small IPv4 space. Returns null for empty
// or the "unknown" sentinel (nothing to correlate). SIGNAL ONLY — never a denial key.
export function hashRiskSignal(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v || v === "unknown") return null;
  const salt = process.env.FREE_GRANT_RISK_SALT || process.env.SIGNUP_IP_SALT || "vraelis-free-grant";
  return createHash("sha256").update(`${salt}:${v}`).digest("hex").slice(0, 32);
}

// The canonical cluster for an owner: every account email that resolves to the same real inbox. `ok`
// carries the RELIABILITY of the resolution — false means the lookup could not be trusted (DB error, or
// the canonical_email column is not present yet), which the free-pass gate reads as "assume used" and
// routes to PAYG. `members` always includes the owner's own lowercased email, so a clean single-account
// user degrades to exactly today's per-email behavior.
export type CanonicalCluster = { canonical: string; members: string[]; ok: boolean };

export async function resolveCanonicalCluster(owner: string): Promise<CanonicalCluster> {
  const self = norm(owner);
  const canonical = canonicalizeEmail(self);
  // No DB: we cannot verify the cluster. Fail-closed reliability, but the member set still contains self
  // so freePassUsed's own-email scan (which has its own DB guards) is unaffected in dev/no-db.
  if (!isDatabaseConfigured()) return { canonical, members: [self], ok: false };
  const { data, error } = await db().from("user_profiles" as never)
    .select("email").eq("canonical_email", canonical).limit(500);
  if (error) {
    // Missing column (42703) or transient: unreliable -> fail-closed. Still return self so the caller can
    // fall back to a plain per-email check if it chooses; the gate treats ok=false as "assume used".
    return { canonical, members: [self], ok: false };
  }
  const members = new Set<string>([self]);
  for (const row of (data as { email?: string }[] | null) ?? []) {
    if (typeof row.email === "string" && row.email.trim()) members.add(norm(row.email));
  }
  return { canonical, members: [...members], ok: true };
}

// Is there an ACTIVE, unconsumed operator comp for this owner's cluster? The safety valve for the
// fail-closed gate: an operator can explicitly grant a free pass to a legitimate user who was wrongly
// routed to PAYG (e.g. by a transient eligibility error). Consumed or expired overrides do not count.
// Degrades to false on any error (no override => normal gate behavior; never a false grant on error).
export async function activeFreeGrantOverride(owner: string, canonical: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const nowIso = new Date().toISOString();
  // Keyed on canonical_email ALONE (not an .or over user_id): grantFreeGrantOverride always stamps
  // canonical_email = canonicalizeEmail(owner), and every alias in a cluster canonicalizes to that same
  // value, so a canonical match finds the comp for any alias. This also avoids interpolating a raw,
  // user-supplied email into a PostgREST .or() filter (a comma/paren in an address could break parsing).
  // `owner` stays in the signature for the audit/consume call sites and future per-user scoping.
  void owner;
  const { data, error } = await db().from("v_free_grant_overrides" as never)
    .select("id, expires_at")
    .eq("canonical_email", canonical)
    .is("consumed_at", null)
    .limit(20);
  if (error || !data) return false;
  return (data as { expires_at?: string | null }[]).some((r) => !r.expires_at || r.expires_at > nowIso);
}

// Mark the owner's active operator comp as consumed (single use). Called AFTER a free run is created so a
// comped user gets exactly one free pass, not an unlimited one. Consumes the oldest active, unexpired
// override for the owner or their cluster. Best-effort: a failure here means a comp might be reusable
// until an operator clears it — logged, never blocks the run. Returns true if one was consumed.
export async function consumeFreeGrantOverride(owner: string, canonical: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  void owner; // keyed on canonical_email alone (see activeFreeGrantOverride) — no raw email in the filter
  const nowIso = new Date().toISOString();
  const { data, error } = await db().from("v_free_grant_overrides" as never)
    .select("id, expires_at")
    .eq("canonical_email", canonical)
    .is("consumed_at", null)
    .order("created_at", { ascending: true })
    .limit(20);
  if (error || !data) return false;
  const target = (data as { id: string; expires_at?: string | null }[])
    .find((r) => !r.expires_at || r.expires_at > nowIso);
  if (!target) return false;
  // The .is('consumed_at', null) guard on the UPDATE makes the consume ATOMIC: if two concurrent free
  // runs both selected this row, only the first UPDATE matches (the row is no longer null-consumed for
  // the second), so the comp is single-use even under a race. We select the changed rows so a lost race
  // returns false rather than a misleading true.
  const { data: updated, error: upErr } = await db().from("v_free_grant_overrides" as never)
    .update({ consumed_at: nowIso } as never).eq("id", target.id).is("consumed_at", null).select("id");
  if (upErr) { console.warn(`consumeFreeGrantOverride (${target.id}): ${upErr.message}`); return false; }
  return Array.isArray(updated) && updated.length > 0;
}

// Grant an operator comp: an explicit, audited free pass for a legitimate user wrongly routed to PAYG by
// a fail-closed eligibility error. Operator-only (callers must gate on an admin check). One row = one
// single-use free pass. Returns the row id, or null on failure.
export async function grantFreeGrantOverride(input: {
  owner: string; grantedBy: string; reason: string; expiresAt?: string | null;
}): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;
  const canonical = canonicalizeEmail(input.owner);
  const { data, error } = await db().from("v_free_grant_overrides" as never)
    .insert({
      user_id: norm(input.owner), canonical_email: canonical,
      reason: input.reason, granted_by: norm(input.grantedBy), expires_at: input.expiresAt ?? null,
    } as never)
    .select("id").single();
  if (error || !data) { console.error(`grantFreeGrantOverride: ${error?.message ?? "no row"}`); return null; }
  return (data as { id: string }).id;
}

// ── Atomic free-pass claim (closes the concurrent-launch double-spend race) ──────────────────────────
// freePassUsed() is check-then-write; the run that marks the pass "consumed" is written only afterward,
// so two free launches from one cluster in the same window can both pass the check. This claim is the
// DB-level guard: exactly one claim row can exist per canonical inbox (v_free_pass_claims PK). The free
// launch path claims BEFORE queueing the run — the insert either WINS or loses to a concurrent/prior
// claim, and only one insert can win the unique PK.
//
// Tri-state so the caller can react precisely:
//   "won"            -> this launch owns the cluster's one free pass; proceed free.
//   "already_claimed"-> another run holds it (race lost, or the cluster already used it) -> re-price PAYG.
//   "unavailable"    -> the claims table is missing (code-ahead-of-migration) or a transient DB error;
//                       the caller proceeds on the pre-existing freePassUsed decision (no worse than the
//                       status quo before this table existed — the race window is the old behavior).
export type FreePassClaim = "won" | "already_claimed" | "unavailable";

// A claim left unattached (run_id null) for longer than this was almost certainly orphaned by a failed
// releaseFreePass (its swallowed catch) — the run insert failed but the delete also failed. Reclaim it so
// a legitimate owner is not permanently re-priced to PAYG. Long enough that a genuinely in-flight
// free run (which attaches within the same request) is never mistaken for an orphan.
const STALE_CLAIM_MS = 60 * 60 * 1000; // 1 hour

export async function claimFreePass(owner: string, canonical: string): Promise<FreePassClaim> {
  if (!isDatabaseConfigured()) return "unavailable";
  const { error } = await db().from("v_free_pass_claims" as never)
    .insert({ canonical_email: canonical, user_id: norm(owner) } as never);
  if (!error) return "won";
  // 42P01 = undefined_table (migration not applied yet) / anything else: cannot enforce -> unavailable.
  if (error.code !== "23505") return "unavailable";
  // 23505 = unique_violation: a claim already exists. Before re-pricing to PAYG, self-heal an ORPHANED
  // claim (unattached + older than STALE_CLAIM_MS): delete it and retry the insert ONCE. The delete is
  // conditional on run_id IS NULL and the age, so a live/attached claim is never cleared; the retry
  // insert re-serializes on the PK, so two racers reclaiming at once still yield at most one winner.
  // Belt-and-suspenders: even if a still-live run's claim were wrongly reclaimed (attach failed but the
  // run is queued), freePassUsed's independent run-history check still reads that run as consuming the
  // pass, so the second launch is routed to PAYG regardless — the claim table is not the only guard.
  const cutoff = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
  try {
    const { data: cleared } = await db().from("v_free_pass_claims" as never)
      .delete().eq("canonical_email", canonical).is("run_id", null).lt("claimed_at", cutoff).select("canonical_email");
    if (Array.isArray(cleared) && cleared.length > 0) {
      const { error: retry } = await db().from("v_free_pass_claims" as never)
        .insert({ canonical_email: canonical, user_id: norm(owner) } as never);
      if (!retry) return "won";
      if (retry.code === "23505") return "already_claimed"; // another racer re-won it first
    }
  } catch { /* self-heal is best-effort; fall through to already_claimed (fail closed / PAYG) */ }
  return "already_claimed";
}

// Attach the created run to the claim (audit link). Best-effort; the claim already guarantees uniqueness.
export async function attachRunToClaim(canonical: string, runId: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    await db().from("v_free_pass_claims" as never)
      .update({ run_id: runId } as never).eq("canonical_email", canonical).is("run_id", null);
  } catch { /* audit link is non-critical */ }
}

// Release a claim (delete the row) when the run insert FAILED after the claim was won — otherwise a
// legitimate user would be permanently locked out of their free pass by a transient queue error. Scoped
// to the exact owner that made the claim so a release can never delete another account's live claim.
export async function releaseFreePass(owner: string, canonical: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    await db().from("v_free_pass_claims" as never)
      .delete().eq("canonical_email", canonical).eq("user_id", norm(owner)).is("run_id", null);
  } catch { /* best-effort; an orphaned unattached claim is operator-clearable */ }
}

// Record a risk SIGNAL for a free-run launch. Advisory only — this NEVER blocks the run and NEVER feeds a
// hard denial. It exists so an operator can review clustered abuse (shared IP/device/ASN velocity) after
// the fact. Best-effort: a missing table or column is swallowed. Callers pass already-hashed IP/device
// (raw values must never reach this table).
export async function recordFreeGrantRisk(input: {
  owner: string; canonical?: string | null; runId?: string | null;
  ipHash?: string | null; asn?: string | null; deviceHash?: string | null;
  signal?: string; riskFlags?: string[];
}): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    const row: Record<string, unknown> = {
      user_id: norm(input.owner),
      canonical_email: input.canonical ?? canonicalizeEmail(input.owner),
      run_id: input.runId ?? null,
      ip_hash: input.ipHash ?? null,
      asn: input.asn ?? null,
      device_hash: input.deviceHash ?? null,
      signal: input.signal ?? "free_launch",
      risk_flags: input.riskFlags ?? [],
    };
    await db().from("v_free_grant_risk" as never).insert(row as never);
  } catch { /* signal capture never affects the run */ }
}
