// Daily backstop for agent-number provisioning. Provisioning normally fires on
// onboarding completion or a plan-activation webhook, but those are events — an
// account that's already paid + onboarded when Twilio creds (or A2P) go live, or
// a webhook that didn't fire, would otherwise never get a number. This sweep
// catches every eligible-but-unassigned workspace once a day.
//
// Each call is gated + idempotent (maybeProvisionAgentNumber re-checks paid +
// onboarded + no-number and buys at most once), so re-running is safe.
//
// Auth: Vercel sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is
// set — required so the endpoint can't be triggered by anyone.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAllWorkspaces } from "@/lib/vraelis-db";
import { maybeProvisionAgentNumber } from "@/lib/vraelis-sms";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const workspaces = await getAllWorkspaces();
  // Pre-filter to PAID + active here (those columns are on the workspace row).
  // maybeProvisionAgentNumber then re-checks onboarding AND the existing number
  // (via getWorkspaceContact) and buys at most once — so an already-assigned
  // workspace is a safe no-op even though we don't filter on the number here.
  const PAID = new Set(["solo", "growth", "agency"]);
  const candidates = workspaces.filter(
    (w) => w.plan && PAID.has(w.plan) && w.plan_status === "active",
  );

  let attempted = 0;
  for (const ws of candidates) {
    attempted += 1;
    await maybeProvisionAgentNumber(ws.owner_email); // self-catching, idempotent
  }

  return NextResponse.json({ ok: true, scanned: workspaces.length, paidCandidates: attempted });
}
