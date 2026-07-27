// GET /api/v/usage — developer API + webhook usage for the signed-in owner.
// Scoped to the session user; returns only safe aggregates (no keys, hashes,
// secrets, payloads, ip/device data).

import { NextResponse } from "next/server";
import { getPlanV1State } from "@/lib/preflight/entitlements-v1";
import { auth } from "@/auth";
import { getPlan } from "@/lib/v-db";
import { apiAccessAllowed } from "@/lib/v-entitlements";
import { apiUsage, apiRequestCountsByPrefix, recentDevEvents } from "@/lib/v-events";
import { listApiKeys } from "@/lib/v-api-keys";
import { webhookStats } from "@/lib/v-webhooks";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ signedIn: false });

  const [plan, usage, webhook, recent, keys] = await Promise.all([
    getPlan(email),
    apiUsage(email),
    webhookStats(email),
    recentDevEvents(email, 12),
    listApiKeys(email),
  ]);

  // Replace the sampled per-key breakdown with EXACT all-time counts for this owner's actual keys, so the
  // per-key number the console shows is a true total (not "N of the last 2000 events"). The aggregate totals
  // in `usage` are already exact count() queries; only byPrefix was a sample.
  usage.byPrefix = await apiRequestCountsByPrefix(email, keys.map((k) => k.prefix));

  return NextResponse.json({
    signedIn: true,
    plan,
    hasApiAccess: apiAccessAllowed(plan, email, (await getPlanV1State(email.toLowerCase()).catch(() => null))?.plan),
    usage,
    webhook,
    recent,
  });
}
