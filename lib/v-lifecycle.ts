// Lifecycle automation — activation nudges. Finds accounts that signed up but never ran a
// check and emails them once. Idempotent via the event log (a prior "activation_email_sent"
// event for a user means we never nudge again), so re-runs and overlapping crons are safe.
// Bounded and fail-soft: it never throws and never blocks anything.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { isEmailConfigured, sendCheckActivationEmail, sendLowCreditsEmail, sendWinbackEmail } from "./email";
import { getPlan } from "./v-db";
import { logEvent } from "./v-events";

const NUDGE_EVENT = "activation_email_sent";
const DAY = 86_400_000;
// Nudge accounts that signed up between 1 and 7 days ago: give them a day to run a check on
// their own first, and don't pester long-dormant accounts.
const MIN_AGE_DAYS = 1;
const MAX_AGE_DAYS = 7;

export type ActivationSummary = { scanned: number; sent: number; alreadyActive: number; alreadyNudged: number };

export async function runActivationNudges(limit = 100): Promise<ActivationSummary> {
  const out: ActivationSummary = { scanned: 0, sent: 0, alreadyActive: 0, alreadyNudged: 0 };
  if (!isDatabaseConfigured() || !isEmailConfigured()) return out;

  try {
    const s = getSupabaseAdminClient();
    const now = Date.now();
    const from = new Date(now - MAX_AGE_DAYS * DAY).toISOString();
    const to = new Date(now - MIN_AGE_DAYS * DAY).toISOString();

    const { data: profs } = await s.from("user_profiles" as never)
      .select("email, created_at")
      .gte("created_at", from).lte("created_at", to)
      .order("created_at", { ascending: false }).limit(limit);
    const rows = (profs as unknown as { email: string | null; created_at: string }[] | null) ?? [];
    const emails = [...new Set(rows.map((r) => (r.email || "").trim().toLowerCase()).filter(Boolean))];
    out.scanned = emails.length;
    if (!emails.length) return out;

    // Who has already run at least one verification (activated)?
    //
    // READS v_preflight_runs, NOT v_checks. All three stages in this file used to derive activity from
    // v_checks, the table behind the retired AI-check product. Nothing has written it since that product was
    // removed — scripts/preflight-account-deletion-verify.ts lists v-checks among the deleted modules — so it
    // answers empty for everybody, and the two stages failed in opposite directions:
    //
    //   stage 1 (here)   concluded every active customer had never run anything, and emailed them
    //                    "You signed up but haven't run a verification yet" while their runs sat in
    //                    v_preflight_runs
    //   stages 2 and 3   build their candidate list FROM it, so `emails` was always empty and both returned
    //                    early at their own guards — the low-balance nudge and the win-back email could not
    //                    reach a single person, silently, every day the cron ran
    //
    // A verification is a row in v_preflight_runs, keyed by the same lowercased-email user_id. No date bound,
    // matching the previous semantics: activation asks "ever", not "recently".
    const { data: runs } = await s.from("v_preflight_runs" as never).select("user_id").in("user_id", emails);
    const active = new Set(((runs as unknown as { user_id: string }[] | null) ?? []).map((c) => c.user_id));

    // Who has already been nudged?
    const { data: sent } = await s.from("v_events" as never).select("user_id").eq("event_type", NUDGE_EVENT).in("user_id", emails);
    const nudged = new Set(((sent as unknown as { user_id: string }[] | null) ?? []).map((e) => e.user_id));

    for (const email of emails) {
      if (active.has(email)) { out.alreadyActive++; continue; }
      if (nudged.has(email)) { out.alreadyNudged++; continue; }
      await sendCheckActivationEmail(email);
      // Log FIRST-effort: even if this write blips, a rare double-send of a friendly nudge is
      // acceptable; a persisted event makes every later run skip this user.
      await logEvent({ userId: email, eventType: NUDGE_EVENT, actorType: "system", source: "cron", metadata: {} });
      out.sent++;
    }
    return out;
  } catch (e) {
    console.error("runActivationNudges:", e);
    return out;
  }
}

// ── Stage 2: low-credits upgrade nudge ─────────────────────────────────────────
// A FREE user who has been actively checking and is nearly out of their 25 signup
// credits is at the natural conversion moment. Email them once ("you're almost out,
// pick a plan"). Targeted so it's timely, not spammy:
//   - ran a check in the last ACTIVE_WINDOW_DAYS (recently engaged, so credits were used)
//   - live balance <= LOW_MAX (almost/entirely out)
//   - plan is "free" (never nudge a paying subscriber mid-cycle)
//   - not already sent (idempotent via the event log)
const LOWCREDIT_EVENT = "lowcredits_email_sent";
const LOW_MAX = 5;              // nudge at or below this many credits left
// "Actively checking" = a check within the last QUIET_AFTER_DAYS. Kept equal to the
// win-back threshold so stages 2 and 3 are disjoint: active users get the upgrade nudge,
// quiet users get win-back, and nobody gets both in the same run.
const ACTIVE_WINDOW_DAYS = 14;

export type LowCreditSummary = { scanned: number; sent: number; skippedPaid: number; skippedBalance: number; alreadySent: number };

// One query → live (non-expired) balance per user, mirroring lib/v-credits balance().
async function liveBalances(s: ReturnType<typeof getSupabaseAdminClient>, emails: string[]): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  if (!emails.length) return m;
  const { data } = await s.from("v_credit_ledger" as never).select("user_id, delta, expires_at").in("user_id", emails);
  const now = Date.now();
  for (const r of ((data as unknown as { user_id: string; delta: number; expires_at: string | null }[] | null) ?? [])) {
    if (r.expires_at && new Date(r.expires_at).getTime() <= now) continue;
    m.set(r.user_id, (m.get(r.user_id) ?? 0) + (r.delta ?? 0));
  }
  return m;
}

export async function runLowCreditNudges(limit = 100): Promise<LowCreditSummary> {
  const out: LowCreditSummary = { scanned: 0, sent: 0, skippedPaid: 0, skippedBalance: 0, alreadySent: 0 };
  if (!isDatabaseConfigured() || !isEmailConfigured()) return out;

  try {
    const s = getSupabaseAdminClient();
    const since = new Date(Date.now() - ACTIVE_WINDOW_DAYS * DAY).toISOString();

    // Recently-active users (deduped, capped). These have run verifications, so they've spent balance.
    // v_preflight_runs, not the retired v_checks — see the note in runActivationNudges. Reading the dead
    // table here meant this entire stage returned at the guard below on every single run.
    const { data: runs } = await s.from("v_preflight_runs" as never)
      .select("user_id").gte("created_at", since).limit(2000);
    const emails = [...new Set(((runs as unknown as { user_id: string }[] | null) ?? [])
      .map((c) => (c.user_id || "").trim().toLowerCase()).filter(Boolean))].slice(0, limit);
    out.scanned = emails.length;
    if (!emails.length) return out;

    // Already nudged? (idempotent)
    const { data: sent } = await s.from("v_events" as never).select("user_id").eq("event_type", LOWCREDIT_EVENT).in("user_id", emails);
    const already = new Set(((sent as unknown as { user_id: string }[] | null) ?? []).map((e) => e.user_id));

    const balances = await liveBalances(s, emails);

    for (const email of emails) {
      if (already.has(email)) { out.alreadySent++; continue; }
      const bal = balances.get(email) ?? 0;
      if (bal > LOW_MAX) { out.skippedBalance++; continue; }
      // Only free users — a paying subscriber's low mid-cycle balance is not an upsell moment.
      if ((await getPlan(email)) !== "free") { out.skippedPaid++; continue; }
      await sendLowCreditsEmail(email, Math.max(0, bal));
      await logEvent({ userId: email, eventType: LOWCREDIT_EVENT, actorType: "system", source: "cron", metadata: { remaining: bal } });
      out.sent++;
    }
    return out;
  } catch (e) {
    console.error("runLowCreditNudges:", e);
    return out;
  }
}

// ── Stage 3: win-back ──────────────────────────────────────────────────────────
// A user who ran checks, then went quiet (no check in QUIET_AFTER_DAYS but active within
// QUIET_MAX_DAYS) and still has credits gets one "your credits are waiting" nudge. Disjoint
// from stage 2 by the QUIET_AFTER_DAYS boundary (stage 2 targets active users, this targets
// quiet ones). Idempotent via the event log.
const WINBACK_EVENT = "winback_email_sent";
const QUIET_AFTER_DAYS = 14; // no check in this many days = "quiet" (matches ACTIVE_WINDOW_DAYS)
const QUIET_MAX_DAYS = 60;   // but active within this window — don't chase long-gone accounts

export type WinbackSummary = { scanned: number; sent: number; skippedRecent: number; skippedBalance: number; alreadySent: number };

export async function runWinbackNudges(limit = 100): Promise<WinbackSummary> {
  const out: WinbackSummary = { scanned: 0, sent: 0, skippedRecent: 0, skippedBalance: 0, alreadySent: 0 };
  if (!isDatabaseConfigured() || !isEmailConfigured()) return out;

  try {
    const s = getSupabaseAdminClient();
    const now = Date.now();
    const from = new Date(now - QUIET_MAX_DAYS * DAY).toISOString();
    const quietBefore = now - QUIET_AFTER_DAYS * DAY;

    // Verifications in the last QUIET_MAX_DAYS, newest first. The first row per user (desc order)
    // is their latest run — robust to the cap, since only the oldest rows drop if hit.
    // v_preflight_runs, not the retired v_checks — see the note in runActivationNudges.
    const { data: runs } = await s.from("v_preflight_runs" as never)
      .select("user_id, created_at").gte("created_at", from)
      .order("created_at", { ascending: false }).limit(5000);
    const latest = new Map<string, number>();
    for (const r of ((runs as unknown as { user_id: string; created_at: string }[] | null) ?? [])) {
      const email = (r.user_id || "").trim().toLowerCase();
      if (!email) continue;
      if (!latest.has(email)) latest.set(email, new Date(r.created_at).getTime());
    }

    // Quiet = latest verification older than QUIET_AFTER_DAYS. (Users active more recently are
    // stage 2's / nobody's, not win-back's.)
    const quiet = [...latest].filter(([, t]) => t <= quietBefore).map(([e]) => e);
    out.scanned = quiet.length;
    out.skippedRecent = latest.size - quiet.length;
    const emails = quiet.slice(0, limit);
    if (!emails.length) return out;

    const { data: sent } = await s.from("v_events" as never).select("user_id").eq("event_type", WINBACK_EVENT).in("user_id", emails);
    const already = new Set(((sent as unknown as { user_id: string }[] | null) ?? []).map((e) => e.user_id));

    const balances = await liveBalances(s, emails);

    for (const email of emails) {
      if (already.has(email)) { out.alreadySent++; continue; }
      const bal = balances.get(email) ?? 0;
      if (bal <= 0) { out.skippedBalance++; continue; } // nothing concrete to return to
      await sendWinbackEmail(email, bal);
      await logEvent({ userId: email, eventType: WINBACK_EVENT, actorType: "system", source: "cron", metadata: { remaining: bal } });
      out.sent++;
    }
    return out;
  } catch (e) {
    console.error("runWinbackNudges:", e);
    return out;
  }
}
