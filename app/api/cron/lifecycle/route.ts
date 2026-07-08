// Vercel Cron: lifecycle automation — a short, well-timed email sequence, each stage sent
// once per user (idempotent via the event log). Stage 1: accounts that signed up but never
// ran a check (activation). Stage 2: free users who are actively checking and nearly out of
// their 25 signup credits (upgrade nudge). CRON_SECRET-gated (Vercel Cron sends
// Authorization: Bearer <secret>). Bounded, fail-soft, never blocks. Returns safe summary
// counts only (no emails or PII).
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { runActivationNudges, runLowCreditNudges } from "@/lib/v-lifecycle";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const activation = await runActivationNudges(100);
  const lowCredits = await runLowCreditNudges(100);
  return NextResponse.json({ ok: true, activation, lowCredits });
}
