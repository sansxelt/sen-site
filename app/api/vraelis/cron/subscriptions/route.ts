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
import { canonicalTier, fetchLivePlanStatus } from "@/lib/vraelis-plan-sync";
import { releaseAgentNumber } from "@/lib/vraelis-sms";
import { isPaidPlanKey, isPastDueExpired } from "@/lib/vraelis-plans";
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
    // Any PAID tier, not just the two PayPal sells. "agency" carries the lowest cut rate of all, so
    // selecting on isPlanKey exempted the most valuable tier from this backstop.
    if (!isPaidPlanKey(row.plan)) continue; // only paid-plan workspaces
    const storedPlanChecked: string = row.plan as string;

    // 1) Self-heal plan_status AND the tier itself from the provider's live
    //    subscription. The provider's plan_id is authoritative (finding H1): a
    //    stored tier that disagrees with what the customer actually pays for is
    //    corrected here, which is what repairs any row written by the old
    //    record route that trusted a client-supplied plan.
    const storedPlan = storedPlanChecked;
    const storedCycle = row.plan_cycle ?? "monthly";
    const live = await fetchLivePlanStatus(row);
    if (live) {
      const { plan: canonPlan, cycle: canonCycle, tierDiffers, unbacked } = canonicalTier(
        { plan: storedPlan, cycle: storedCycle },
        live,
      );
      const statusDiffers = live.status !== row.plan_status;
      if (statusDiffers || tierDiffers) {
        try {
          await setWorkspacePlan(row.owner_email, {
            plan: canonPlan,
            cycle: canonCycle,
            status: live.status,
            provider: row.plan_provider ?? "stripe",
            subscriptionId: row.plan_subscription_id ?? undefined,
            periodEndISO: live.periodEndISO,
          });
          reconciled += 1;
          if (unbacked) {
            // The provider answered and its plan is not in our catalogue: this workspace was holding a
            // paid tier with nothing behind it. Demoted above; shout about it, because it means either a
            // retired plan id or a forged entitlement.
            console.error(
              "[cron/subscriptions] UNBACKED TIER demoted for",
              row.owner_email,
              `${storedPlan}/${storedCycle} had no matching provider plan -> ${canonPlan}`,
            );
          } else if (tierDiffers) {
            // Loud, because a mismatch means a tier was granted that the
            // provider never billed for. No PII beyond the owner email the
            // rest of this cron already logs on failure.
            console.warn(
              "[cron/subscriptions] tier corrected from provider for",
              row.owner_email,
              `${storedPlan}/${storedCycle} -> ${canonPlan}/${canonCycle}`,
            );
          }
          // A missed webhook just got caught here → email the owner once. Only
          // on a real STATUS transition; a silent tier correction is not a lapse.
          if (statusDiffers && (live.status === "canceled" || live.status === "past_due")) {
            void notifyOwnerPlanLapse(row.owner_email, live.status).catch(() => {});
          }
          // Reflect the change locally so the reap check below is accurate. If we
          // just moved into past_due, the grace clock starts now (don't reap yet).
          const justPastDue = live.status === "past_due" && row.plan_status !== "past_due";
          row.plan_status = live.status;
          row.plan = canonPlan;
          row.plan_cycle = canonCycle;
          if (justPastDue) row.plan_updated_at = new Date().toISOString();
        } catch (e) {
          console.error("[cron/subscriptions] setWorkspacePlan failed for", row.owner_email, e);
        }
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
