// Vercel Cron: re-send failed webhook deliveries whose backoff has elapsed.
// CRON_SECRET-gated. Idempotent + bounded; never blocks anything else.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { runWebhookRetries } from "@/lib/v-webhooks";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const result = await runWebhookRetries();
  return NextResponse.json({ ok: true, ...result });
}
