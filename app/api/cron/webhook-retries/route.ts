// Vercel Cron: re-send failed webhook deliveries whose backoff has elapsed.
// CRON_SECRET-gated. Idempotent + bounded; never blocks anything else.

import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import type { NextRequest } from "next/server";
import { runWebhookRetries } from "@/lib/v-webhooks";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Constant-time, and fails closed on an unset CRON_SECRET (lib/cron-auth.ts).
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const result = await runWebhookRetries();
  return NextResponse.json({ ok: true, ...result });
}
