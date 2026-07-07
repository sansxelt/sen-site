// Vercel Cron: lifecycle automation. Emails accounts that signed up but haven't run their
// first check (activation nudge), once each. CRON_SECRET-gated (Vercel Cron sends
// Authorization: Bearer <secret>). Bounded, idempotent, never blocks anything. Returns safe
// summary counts only (no emails).
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { runActivationNudges } from "@/lib/v-lifecycle";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const activation = await runActivationNudges(100);
  return NextResponse.json({ ok: true, activation });
}
