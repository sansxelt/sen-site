// GET /api/v/usage — developer API + webhook usage for the signed-in owner.
// Scoped to the session user; returns only safe aggregates (no keys, hashes,
// secrets, payloads, ip/device data).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPlan } from "@/lib/v-db";
import { apiAccessAllowed } from "@/lib/v-entitlements";
import { apiUsage, recentDevEvents } from "@/lib/v-events";
import { webhookStats } from "@/lib/v-webhooks";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ signedIn: false });

  const [plan, usage, webhook, recent] = await Promise.all([
    getPlan(email),
    apiUsage(email),
    webhookStats(email),
    recentDevEvents(email, 12),
  ]);

  return NextResponse.json({
    signedIn: true,
    plan,
    hasApiAccess: apiAccessAllowed(plan, email),
    usage,
    webhook,
    recent,
  });
}
