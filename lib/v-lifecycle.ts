// Lifecycle automation — activation nudges. Finds accounts that signed up but never ran a
// check and emails them once. Idempotent via the event log (a prior "activation_email_sent"
// event for a user means we never nudge again), so re-runs and overlapping crons are safe.
// Bounded and fail-soft: it never throws and never blocks anything.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { isEmailConfigured, sendCheckActivationEmail } from "./email";
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
