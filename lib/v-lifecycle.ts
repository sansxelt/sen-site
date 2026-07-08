// Lifecycle automation — activation nudges. Finds accounts that signed up but never ran a
// check and emails them once. Idempotent via the event log (a prior "activation_email_sent"
// event for a user means we never nudge again), so re-runs and overlapping crons are safe.
// Bounded and fail-soft: it never throws and never blocks anything.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { isEmailConfigured, sendCheckActivationEmail, sendLowCreditsEmail } from "./email";
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

    // Who has already run at least one check (activated)?
    const { data: checks } = await s.from("v_checks" as never).select("user_id").in("user_id", emails);
    const active = new Set(((checks as unknown as { user_id: string }[] | null) ?? []).map((c) => c.user_id));

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
const ACTIVE_WINDOW_DAYS = 30;  // only users who ran a check within this window

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

    // Recently-active users (deduped, capped). These have run checks, so they've spent credits.
    const { data: checks } = await s.from("v_checks" as never)
      .select("user_id").gte("created_at", since).limit(2000);
    const emails = [...new Set(((checks as unknown as { user_id: string }[] | null) ?? [])
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
