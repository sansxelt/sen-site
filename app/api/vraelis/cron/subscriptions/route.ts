// Daily subscription maintenance — the self-heal + cleanup backstop for plan
// lifecycle. Webhooks (Stripe + PayPal) are the primary, immediate signal, but
// a missed/dropped delivery (or a PayPal sub created without a custom_id) would
// otherwise leave a lapsed workspace stuck on plan_status='active' forever. This
// sweep:
//   1) re-polls each paid workspace's LIVE provider status and self-heals
//      plan_status + the stored period end (catches missed cancel/past_due), and
//   2) reaps the agent's Twilio number once a plan is truly lapsed (canceled, or
//      past_due beyond the grace window) so it stops billing and is freed.
// Core lead capture (web-chat / email / intake / booking) is untouched — only
// the paid SMS/voice number is reaped. CRON_SECRET-gated; idempotent.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getWorkspaceLapseRows, setWorkspacePlan } from "@/lib/vraelis-db";
import { fetchLivePlanStatus } from "@/lib/vraelis-plan-sync";
import { releaseAgentNumber } from "@/lib/vraelis-sms";
import { isPlanKey, isPastDueExpired } from "@/lib/vraelis-plans";
import { notifyOwnerPlanLapse } from "@/lib/vraelis-notify";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const rows = await getWorkspaceLapseRows();
  let reconciled = 0;
  let reaped = 0;

  for (const row of rows) {
    if (!row.plan || !isPlanKey(row.plan)) continue; // only paid-plan workspaces

    // 1) Self-heal plan_status from the provider's live subscription.
    const live = await fetchLivePlanStatus(row);
    if (live && live.status !== row.plan_status) {
      try {
        await setWorkspacePlan(row.owner_email, {
          plan: row.plan,
          cycle: row.plan_cycle ?? "monthly",
          status: live.status,
          provider: row.plan_provider ?? "stripe",
          subscriptionId: row.plan_subscription_id ?? undefined,
          periodEndISO: live.periodEndISO,
        });
        reconciled += 1;
        // A missed webhook just got caught here → email the owner once.
        if (live.status === "canceled" || live.status === "past_due") {
          void notifyOwnerPlanLapse(row.owner_email, live.status).catch(() => {});
        }
        // Reflect the change locally so the reap check below is accurate. If we
        // just moved into past_due, the grace clock starts now (don't reap yet).
        const justPastDue = live.status === "past_due" && row.plan_status !== "past_due";
        row.plan_status = live.status;
        if (justPastDue) row.plan_updated_at = new Date().toISOString();
      } catch (e) {
        console.error("[cron/subscriptions] setWorkspacePlan failed for", row.owner_email, e);
      }
    }

    // 2) Reap the agent number once truly lapsed. past_due WITHIN grace keeps
    //    its number (recoverable); canceled or past_due-beyond-grace loses it.
    const lapsed =
      row.plan_status === "canceled" || isPastDueExpired(row.plan_status, row.plan_updated_at);
    if (lapsed && row.twilio_number) {
      const ok = await releaseAgentNumber(row.owner_email);
      if (ok) reaped += 1;
    }
  }

  return NextResponse.json({ ok: true, scanned: rows.length, reconciled, reaped });
}
