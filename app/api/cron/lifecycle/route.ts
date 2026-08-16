// Vercel Cron: lifecycle automation, a short, well-timed email sequence, each stage sent
// once per user (idempotent via the event log). Stage 1: accounts that signed up but never
// ran a check (activation). Stage 2: free users actively verifying whose balance can no
// longer buy a launch (upgrade nudge). Stage 3: users who ran checks, went quiet, and still
// hold enough to launch (win-back). The stages used to be described here as "nearly out of
// their 25 signup credits", a denomination that stopped existing when pass pricing landed
// and signup stopped minting anything. Stages 2 and 3 are disjoint by the 14-day
// active/quiet boundary and by the balance, which is one standard pass on both sides.
// CRON_SECRET-gated (Vercel Cron sends Authorization: Bearer <secret>). Bounded, fail-soft,
// never blocks. Returns safe summary counts only (no emails or PII).
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { runActivationNudges, runLowCreditNudges, runWinbackNudges } from "@/lib/v-lifecycle";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const activation = await runActivationNudges(100);
  const lowCredits = await runLowCreditNudges(100);
  const winback = await runWinbackNudges(100);
  return NextResponse.json({ ok: true, activation, lowCredits, winback });
}
