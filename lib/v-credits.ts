// Vraelis Rank — credit engine. The append-only ledger (v_credit_ledger) is the
// source of truth; balance is derived. Launching a test ESCROWS (holds) credits;
// unfilled credits are refunded on completion. Buyers only pay for valid votes.
//
// Idempotency: grants that carry an `extRef` (Stripe invoice/session id) are
// deduped by a partial unique index on (user_id, reason, ext_ref), so a replayed
// or raced webhook can never double-grant. Spends against the expiring "monthly"
// bucket are tagged with that bucket's expiry so they fall out of balance with
// the credits they consumed (no negative carry-over across a cycle reset).

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { SIGNUP_FREE_CREDITS } from "./v-entitlements";
import { passPricingEnabled } from "./preflight/pass-pricing";

function norm(email: string): string {
  return email.trim().toLowerCase();
}

type LedgerRow = { delta: number; bucket: string | null; expires_at: string | null; ext_ref: string | null; reason?: string | null; ref_type?: string | null; ref_id?: string | null; unit?: string | null };

// ── The unit + expiry rule, in ONE place ────────────────────────────────────────────────────────────
//
// Units (per-pass pricing, VRAELIS_PASS_PRICING): post-flip the ledger carries BOTH 'credit' and 'cent'
// rows (sql/vraelis-preflight-6-pass-pricing.sql), and a balance is only meaningful PER UNIT. With the
// flag OFF and credits requested, the legacy query (no unit column selected) runs instead so behavior is
// byte-identical on a pre-migration database. Flag ON requires the phase-6 migration: the unit-selecting
// query fails closed (empty rows) when the column is missing.
//
// THESE THREE HELPERS EXIST BECAUSE THE RULE WAS RESTATED SOMEWHERE ELSE AND GOT IT WRONG.
// lib/v-lifecycle.ts had its own batch balance that selected `delta, expires_at` with no unit column and
// no unit filter, summing legacy 'cent' rows into a credit total — while its comment claimed to mirror
// balance(). Nothing caught it because a second copy of a rule is invisible to the tests that guard the
// first. Both readers now go through the same predicates, so a unit rule can only be changed in one place.
function isLegacyRead(unit: string | null): boolean {
  return unit === "credit" && !passPricingEnabled();
}

function ledgerColumns(legacy: boolean): string {
  return legacy
    ? "delta, bucket, expires_at, ext_ref, reason, ref_type, ref_id"
    : "delta, bucket, expires_at, ext_ref, reason, ref_type, ref_id, unit";
}

export function rowIsLive(r: { expires_at: string | null }, now: number): boolean {
  return r.expires_at === null || new Date(r.expires_at).getTime() > now;
}

// A row with no `unit` is a 'credit' row: the column defaults to 'credit' and pre-migration rows predate
// it entirely. Reading it as anything else would silently reclassify every legacy row.
export function rowInUnit(r: { unit?: string | null }, unit: string): boolean {
  return (r.unit ?? "credit") === unit;
}

// All ledger rows for a user that are not yet expired. `unit` selects which rows to return; null returns
// every live row WITH its unit so the caller can partition (refund derives the hold's own unit from the
// escrow rows).
async function liveRows(userId: string, unit: string | null = "credit"): Promise<LedgerRow[]> {
  if (!userId || !isDatabaseConfigured()) return [];
  const s = getSupabaseAdminClient();
  const legacy = isLegacyRead(unit);
  const { data } = await s
    .from("v_credit_ledger" as never)
    .select(ledgerColumns(legacy))
    .eq("user_id", norm(userId));
  const rows = (data as unknown as LedgerRow[]) ?? [];
  const now = Date.now();
  const live = rows.filter((r) => rowIsLive(r, now));
  if (legacy || unit === null) return live;
  return live.filter((r) => rowInUnit(r, unit));
}

export async function balance(userId: string): Promise<number> {
  const rows = await liveRows(userId);
  return rows.reduce((sum, r) => sum + r.delta, 0);
}

// balance() for MANY users in one query. Same expiry rule, same unit rule, same default unit — the only
// difference is the `.in()` and the grouping, which is the whole reason this exists rather than a caller
// looping balance() a hundred times inside a cron.
//
// Users with no live rows are ABSENT from the map rather than present with 0, so a caller can tell "no
// ledger history" from "spent to zero" if it ever needs to. Every current caller treats absent as 0.
export async function balances(userIds: string[], unit: string = "credit"): Promise<Map<string, number>> {
  const ids = [...new Set(userIds.map(norm).filter(Boolean))];
  if (!ids.length || !isDatabaseConfigured()) return new Map();
  const s = getSupabaseAdminClient();
  const legacy = isLegacyRead(unit);
  const { data } = await s
    .from("v_credit_ledger" as never)
    .select(`user_id, ${ledgerColumns(legacy)}`)
    .in("user_id", ids);
  const rows = (data as unknown as (LedgerRow & { user_id: string })[]) ?? [];
  return foldBalances(rows, { legacy, unit, now: Date.now() });
}

/** The fold behind balances(), separated so the expiry and unit rules can be exercised on fixture rows
 *  rather than proxied through a live ledger. This is the code that actually runs, not a copy of it. */
export function foldBalances(
  rows: (LedgerRow & { user_id: string })[],
  opts: { legacy: boolean; unit: string; now: number },
): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) {
    if (!rowIsLive(r, opts.now)) continue;
    if (!opts.legacy && !rowInUnit(r, opts.unit)) continue;
    out.set(r.user_id, (out.get(r.user_id) ?? 0) + (r.delta ?? 0));
  }
  return out;
}

type GrantOpts = { bucket?: string; expiresAt?: string | null; refType?: string; refId?: string; extRef?: string | null; unit?: string };

// Append a ledger row. Returns false if it was a duplicate (extRef already used)
// or failed — true on a fresh insert. Idempotent when extRef is provided.
// `unit` (per-pass pricing): 'cent' rows carry it explicitly; 'credit' (or absent) omits the column
// entirely so every legacy call site produces the exact pre-migration insert payload (the column
// default supplies 'credit' post-migration).
export async function grant(userId: string, delta: number, reason: string, opts: GrantOpts = {}): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const s = getSupabaseAdminClient();
  const { error } = await s.from("v_credit_ledger" as never).insert({
    user_id: norm(userId),
    delta,
    reason,
    bucket: opts.bucket ?? "purchased",
    expires_at: opts.expiresAt ?? null,
    ref_type: opts.refType ?? null,
    ref_id: opts.refId ?? null,
    ext_ref: opts.extRef ?? null,
    ...(opts.unit && opts.unit !== "credit" ? { unit: opts.unit } : {}),
  } as never);
  if (error) {
    if ((error as { code?: string }).code === "23505") return false; // already granted — idempotent no-op
    console.error("grant:", error.message);
    return false;
  }
  return true;
}

// One-time free credits for a brand-new account.
export async function ensureSignupGrant(userId: string): Promise<void> {
  // Per-pass pricing cutover (docs/pricing-verdict-final.md, ruling 4 / step 10): at the flag flip the
  // 25-credit signup grant is CUT — the free tier becomes ONE lifetime pass of up to 3 flows, enforced
  // by gatePassLaunch (lib/preflight/entitlements-v1.ts). No new signup credits are minted while the
  // flag is on; with the flag off this keeps granting exactly as before.
  if (passPricingEnabled()) return;
  if (!userId || !isDatabaseConfigured()) return;
  const s = getSupabaseAdminClient();
  const { count } = await s
    .from("v_credit_ledger" as never)
    .select("*", { count: "exact", head: true })
    .eq("user_id", norm(userId))
    .eq("reason", "signup");
  if ((count ?? 0) > 0) return;
  // ext_ref makes this atomic against a race: if two concurrent calls both pass the count
  // check, the second grant() hits the ext_ref unique constraint and no-ops (23505). The
  // count check above is just a fast path; the unique index is the real guard.
  await grant(userId, SIGNUP_FREE_CREDITS, "signup", { bucket: "purchased", extRef: `signup:${norm(userId)}` });
}

// Escrow `amount` credits for a test launch. Returns false if insufficient.
// Spends the expiring monthly bucket first, tagging that portion of the debit
// with the monthly expiry so it expires alongside the credits it consumed.
// `unit` (per-pass pricing): 'cent' escrows dollars-as-cents against the CENT balance only — the same
// hold semantics, keyed by the same reservation, never mixing units. Every legacy call site passes no
// unit and behaves exactly as before.
export async function hold(userId: string, testId: string, amount: number, unit: "credit" | "cent" = "credit"): Promise<boolean> {
  if (amount <= 0) return true;

  // ATOMIC PATH. The TypeScript below reads the balance, decides the bucket split, and then writes — three
  // round trips with nothing serialising them, so two concurrent launches both read the same balance, both
  // decide they can afford it, and both debit. The ledger is append-only and the balance is a SUM, so the
  // result is a negative balance: credits spent that were never held. No amount of care after the read
  // fixes a decision made from a stale one.
  //
  // v_hold_credits does the read and the write in one transaction under a per-user advisory lock. When it
  // is present it is the only path taken. When it is absent — an older database, or the migration not yet
  // applied — we fall back to the original code rather than failing the launch, and say so once.
  const atomic = await holdAtomic(userId, testId, amount, unit);
  if (atomic !== "unavailable") return atomic;

  const rows = await liveRows(userId, unit);
  const bal = rows.reduce((s, r) => s + r.delta, 0);
  if (bal < amount) return false;

  const monthlyNet = rows.filter((r) => r.bucket === "monthly").reduce((s, r) => s + r.delta, 0);
  const monthlyExpiry = latestMonthlyExpiry(rows);
  const fromMonthly = Math.max(0, Math.min(amount, monthlyNet));
  const fromPurchased = amount - fromMonthly;

  // THE DEBITS DECIDE WHETHER THE HOLD HAPPENED. Both grant() calls used to be awaited and DISCARDED, and
  // this returned true unconditionally after the balance check.
  //
  // grant() returns false when the ledger insert fails; it logs and moves on. So a transient failure left
  // hold() reporting success with nothing debited, and the caller then set creditsHeld and a reservation id
  // for money it did not have. Both ends of that are wrong:
  //
  //   - the run proceeds and the worker settles by RETAINING a hold that was never taken, so the run is free
  //   - any later failure path calls refund(), which reads the actual held rows, finds none, treats the whole
  //     amount as the monthly remainder and GRANTS it. That mints credits out of a failed insert.
  //
  // A hold is now true only when every debit it needed actually landed.
  if (fromMonthly > 0) {
    const ok = await grant(userId, -fromMonthly, "hold", { bucket: "monthly", expiresAt: monthlyExpiry, refType: "test", refId: testId, unit });
    if (!ok) return false;                                   // nothing was debited; the caller takes no hold
  }
  if (fromPurchased > 0) {
    const ok = await grant(userId, -fromPurchased, "hold", { bucket: "purchased", refType: "test", refId: testId, unit });
    if (!ok) {
      // COMPENSATE THE LEG THAT DID LAND. Returning false here without this would leave the monthly debit in
      // the ledger for a hold the caller believes it never took, so nothing would ever release it and the
      // customer would silently lose those credits. Written as a `hold` row so it nets against its own
      // negative in every computation that reads them, and keyed so a retry cannot double-compensate.
      if (fromMonthly > 0) {
        await grant(userId, fromMonthly, "hold", {
          bucket: "monthly", expiresAt: monthlyExpiry, refType: "test", refId: testId, unit,
          extRef: `hold_rollback:${testId}:m`,
        });
      }
      return false;
    }
  }
  return true;
}

export async function refund(userId: string, testId: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  const s = getSupabaseAdminClient();

  // Compatibility guard: older refunds used a single ext_ref `refund:<testId>`.
  // This function now writes split keys (`:p`/`:m`), which would NOT collide with a
  // pre-existing legacy row — so a test already refunded before this deploy could be
  // refunded twice. If the legacy row exists, this refund already happened; no-op.
  const { count: legacy } = await s.from("v_credit_ledger" as never)
    .select("*", { count: "exact", head: true })
    .eq("user_id", norm(userId)).eq("reason", "refund").eq("ext_ref", `refund:${testId}`);
  if ((legacy ?? 0) > 0) return;

  // Refund each escrowed credit back to the SAME bucket it was held from, so we
  // never mint permanent credit out of monthly credit. A monthly-sourced hold that
  // already expired with its cycle is simply gone — refunding it as purchased would
  // resurrect expired value as never-expiring credit (the laundering we prevent).
  //
  // Unit (per-pass pricing): the hold's OWN rows decide what is refunded — a 'cent' reservation (PAYG
  // pass) is reversed as cents, a legacy 'credit' one as credits, so the worker's unchanged
  // refund(user, reservation, credits_held) settles both. One reservation is always one unit. With the
  // flag off there are no cent rows and this collapses to the exact legacy computation.
  const all = await liveRows(userId, passPricingEnabled() ? null : "credit");
  const held = all.filter((r) => r.reason === "hold" && r.ref_type === "test" && r.ref_id === testId);
  const unit = held[0]?.unit ?? "credit";
  const rows = all.filter((r) => (r.unit ?? "credit") === unit);
  // hold deltas are negative; live purchased hold magnitude = -sum(purchased holds).
  const purchasedHeld = -held.filter((r) => r.bucket === "purchased").reduce((sum, r) => sum + r.delta, 0);
  const exp = latestMonthlyExpiry(rows);

  const toPurchased = Math.min(amount, Math.max(0, purchasedHeld));
  const remainder = amount - toPurchased; // the monthly-sourced portion

  // extRef (split :p/:m) keeps each leg idempotent per test, so a completion race
  // can't refund twice.
  if (toPurchased > 0) {
    await grant(userId, toPurchased, "refund", { bucket: "purchased", refType: "test", refId: testId, extRef: `refund:${testId}:p`, unit });
  }
  // Only refund the monthly remainder if a live monthly bucket still exists to hold
  // it (with that bucket's expiry). If the cycle already ended, the held monthly
  // credit expired — drop it rather than converting it to permanent credit.
  if (remainder > 0 && exp) {
    await grant(userId, remainder, "refund", { bucket: "monthly", expiresAt: exp, refType: "test", refId: testId, extRef: `refund:${testId}:m`, unit });
  }
}

// Spend `amount` credits for a single AI check (default 1) — the AI Output Check
// money path. Monthly bucket first (tagged with its expiry), then purchased. This is
// the pre-migration JS FALLBACK for the atomic v_spend_credit RPC (see v-checks.ts):
// check-then-write, so it is only app-level race-guarded. Idempotent per check via
// the split ext_ref keys. Returns false if the balance is insufficient.
export async function spend(userId: string, checkId: string, amount = 1): Promise<boolean> {
  if (amount <= 0) return true;
  const rows = await liveRows(userId);
  const bal = rows.reduce((s, r) => s + r.delta, 0);
  if (bal < amount) return false;

  const monthlyNet = rows.filter((r) => r.bucket === "monthly").reduce((s, r) => s + r.delta, 0);
  const monthlyExpiry = latestMonthlyExpiry(rows);
  const fromMonthly = Math.max(0, Math.min(amount, monthlyNet));
  const fromPurchased = amount - fromMonthly;

  if (fromMonthly > 0) await grant(userId, -fromMonthly, "check", { bucket: "monthly", expiresAt: monthlyExpiry, refType: "check", refId: checkId, extRef: `check:${checkId}:m` });
  if (fromPurchased > 0) await grant(userId, -fromPurchased, "check", { bucket: "purchased", refType: "check", refId: checkId, extRef: `check:${checkId}:p` });
  return true;
}

// Refund a check's charge — used on any post-charge failure, so the customer is never
// charged for a check they didn't get. Correctness rests on the ledger NET, not on the
// grant booleans: grant() returns false both on a real error AND on a 23505 duplicate
// (already refunded), so a caller that gated on the boolean would treat an
// already-refunded check as a failure and (with the finishCheck gating) re-sweep it
// forever. Instead we read every row for this check, and if the net is already >= 0 the
// charge is reversed — idempotent SUCCESS regardless of who wrote the refund. Reverses
// each debited leg to its own bucket, re-using the debit's OWN expiry for the monthly
// leg (a since-expired monthly credit is refunded already-expired and drops out, never
// laundered into permanent credit). Idempotent per check via ext_ref. Returns true only
// when the charge is CONFIRMED fully reversed (or nothing was charged); false on a read
// failure or an incomplete reversal, so the caller can leave the check for a later retry.
export async function refundCheck(userId: string, checkId: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const s = getSupabaseAdminClient();
  const uid = norm(userId);

  // Read all ledger rows for this check (negative 'check' debits + positive 'refund'
  // legs), retrying once. Surfacing errors (unlike liveRows, which returns [] on a blip)
  // so a failed read is never mistaken for "nothing charged".
  const readRows = async (): Promise<LedgerRow[] | null> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data, error } = await s.from("v_credit_ledger" as never)
        .select("delta, bucket, expires_at, ext_ref, reason, ref_type, ref_id")
        .eq("user_id", uid).eq("ref_type", "check").eq("ref_id", checkId);
      if (error) { console.error(`refundCheck read failed (attempt ${attempt + 1}) for check ${checkId}:`, error.message); continue; }
      return (data as unknown as LedgerRow[]) ?? [];
    }
    return null;
  };

  const rows = await readRows();
  if (rows === null) { console.error(`REFUND UNRESOLVED for check ${checkId}: ledger read failed; manual reconciliation may be needed`); return false; }
  // Net >= 0 ⇒ the charge is already fully reversed (or never committed): idempotent success.
  if (rows.reduce((sum, r) => sum + r.delta, 0) >= 0) return true;

  const debits = rows.filter((r) => r.reason === "check");
  const monthly = debits.filter((r) => r.bucket === "monthly");
  const purchased = debits.filter((r) => r.bucket === "purchased");
  const monthlyAmt = -monthly.reduce((sum, r) => sum + r.delta, 0);     // debits are negative
  const purchasedAmt = -purchased.reduce((sum, r) => sum + r.delta, 0);
  const monthlyExp = monthly.map((r) => r.expires_at).filter(Boolean).sort().pop() ?? null;
  if (purchasedAmt > 0) await grant(uid, purchasedAmt, "refund", { bucket: "purchased", refType: "check", refId: checkId, extRef: `refundcheck:${checkId}:p` });
  if (monthlyAmt > 0) await grant(uid, monthlyAmt, "refund", { bucket: "monthly", expiresAt: monthlyExp, refType: "check", refId: checkId, extRef: `refundcheck:${checkId}:m` });

  // Confirm from the ledger (grant booleans can't tell a 23505-duplicate from a failure).
  const after = await readRows();
  const settled = after !== null && after.reduce((sum, r) => sum + r.delta, 0) >= 0;
  if (!settled) console.error(`REFUND INCOMPLETE for check ${checkId}: charge not fully reversed; manual reconciliation may be needed`);
  return settled;
}

function latestMonthlyExpiry(rows: LedgerRow[]): string | null {
  return rows
    .filter((r) => r.bucket === "monthly" && r.delta > 0 && r.expires_at)
    .map((r) => r.expires_at as string)
    .sort()
    .pop() ?? null;
}

// Monthly subscription credits — the "monthly" bucket, expiring at the period
// end. extRef (the invoice id) makes the grant idempotent. The next cycle grants
// a fresh bucket; the old one expires (so monthly credits reset). Purchased
// top-up credits use the "purchased" bucket and persist.
export async function grantMonthly(userId: string, credits: number, expiresAt: string, extRef?: string): Promise<boolean> {
  if (credits <= 0) return false;
  return grant(userId, credits, "monthly_reset", { bucket: "monthly", expiresAt, extRef });
}

// Zero out the user's remaining (unspent) monthly bucket. `exceptExtRef` spares
// the rows from a specific invoice grant — so calling this right AFTER a fresh
// monthly grant clears only the PRIOR tier (mid-cycle plan change) and never the
// credits just granted. With no exception it clears all monthly (early/hard cancel).
//
// `clawbackRef` makes the -net debit idempotent (ledger ext_ref unique index):
// Stripe is at-least-once and Vercel runs webhooks concurrently, so a redelivered
// or raced cancel/invoice event could otherwise read the same `net` twice and
// double-debit (spilling past the monthly bucket into paid purchased credits).
// Callers pass a key that is STABLE across redeliveries of the same termination
// (e.g. cancel:<subscription_id>) so the second delivery hits 23505 and no-ops.
export async function expireMonthly(userId: string, exceptExtRef?: string, clawbackRef?: string): Promise<void> {
  // ATOMIC PATH, for the same reason hold() has one. This read the live monthly net and then wrote -net
  // with nothing serialising the two, and it is reachable concurrently from the Stripe and PayPal
  // subscription webhooks and from a launch on the same account — so two runs could both read the same
  // positive net and both claw it back, expiring the same credits twice and driving the balance negative.
  //
  // v_expire_monthly does it in one transaction under the SAME advisory-lock key as v_hold_credits, so an
  // expiry and a hold cannot interleave either. Falls back to the original path only when the function is
  // not deployed.
  const atomic = await expireMonthlyAtomic(userId, exceptExtRef, clawbackRef);
  if (atomic !== "unavailable") return;

  const rows = await liveRows(userId);
  const net = rows
    .filter((r) => r.bucket === "monthly" && (!exceptExtRef || r.ext_ref !== exceptExtRef))
    .reduce((s, r) => s + r.delta, 0);
  if (net > 0) await grant(userId, -net, "monthly_reset", { bucket: "monthly", extRef: clawbackRef });
}

// Single-statement expiry via the v_expire_monthly RPC (sql/vraelis-expire-monthly-atomic.sql).
// Returns "done" when the RPC answered (including a legitimate no-op or a duplicate replay), or
// "unavailable" when the function is not deployed so the caller can fall back.
let atomicExpireMissingLogged = false;
async function expireMonthlyAtomic(
  userId: string,
  exceptExtRef?: string,
  clawbackRef?: string,
): Promise<"done" | "unavailable"> {
  if (!isDatabaseConfigured()) return "unavailable";
  try {
    const s = getSupabaseAdminClient();
    const { error } = await s.rpc("v_expire_monthly" as never, {
      p_user: norm(userId),
      p_except_ref: exceptExtRef ?? null,
      p_clawback_ref: clawbackRef ?? null,
      p_unit: "credit",
    } as never);
    if (error) {
      const code = (error as { code?: string }).code ?? "";
      if (code === "42883" || code === "PGRST202" || /could not find the function/i.test(error.message ?? "")) {
        if (!atomicExpireMissingLogged) {
          atomicExpireMissingLogged = true;
          console.warn("[credits] v_expire_monthly is not deployed; monthly expiry is using the non-atomic path");
        }
        return "unavailable";
      }
      // A real error is NOT a reason to run the racy path as well — that would risk a double clawback on
      // top of whatever failed. Report and stop; the next reset will retry.
      console.error("[credits] v_expire_monthly failed:", error.message);
      return "done";
    }
    return "done";
  } catch (e) {
    console.error("[credits] v_expire_monthly threw:", e);
    return "done";
  }
}

// Count credits earned via vote-to-earn today (UTC) — used to cap farming.
export async function rewardsToday(userId: string): Promise<number> {
  if (!userId || !isDatabaseConfigured()) return 0;
  const s = getSupabaseAdminClient();
  const since = new Date(); since.setUTCHours(0, 0, 0, 0);
  const { data } = await s
    .from("v_credit_ledger" as never)
    .select("delta")
    .eq("user_id", norm(userId))
    .eq("reason", "reward")
    .gte("created_at", since.toISOString());
  const rows = (data as unknown as { delta: number }[]) ?? [];
  return rows.reduce((sum, r) => sum + r.delta, 0);
}

// Single-statement hold via the v_hold_credits RPC (sql/vraelis-credit-hold-atomic.sql).
//
// Returns true/false when the RPC answered, or "unavailable" when the function is not deployed so the
// caller can fall back to the legacy path. Distinguishing those three is the point: treating a missing
// function as "no credit" would block every launch on a database that has not run the migration, and
// treating it as "held" would give away runs for free.
let atomicHoldMissingLogged = false;
async function holdAtomic(
  userId: string,
  testId: string,
  amount: number,
  unit: "credit" | "cent",
): Promise<boolean | "unavailable"> {
  if (!isDatabaseConfigured()) return "unavailable";
  try {
    const s = getSupabaseAdminClient();
    const { data, error } = await s.rpc("v_hold_credits" as never, {
      p_user: norm(userId),
      p_test: testId,
      p_amount: amount,
      p_unit: unit,
    } as never);
    if (error) {
      // 42883 = undefined_function; PostgREST also reports a missing RPC as PGRST202.
      const code = (error as { code?: string }).code ?? "";
      if (code === "42883" || code === "PGRST202" || /could not find the function/i.test(error.message ?? "")) {
        if (!atomicHoldMissingLogged) {
          atomicHoldMissingLogged = true;
          console.warn("[credits] v_hold_credits is not deployed; holds are using the non-atomic path");
        }
        return "unavailable";
      }
      // A real error is NOT a fallback: retrying the racy path after the atomic one failed would be the
      // worst of both. Refuse the hold.
      console.error("[credits] v_hold_credits failed:", error.message);
      return false;
    }
    const res = (data ?? {}) as { ok?: boolean };
    return res.ok === true;
  } catch (e) {
    console.error("[credits] v_hold_credits threw:", e);
    return false;
  }
}
