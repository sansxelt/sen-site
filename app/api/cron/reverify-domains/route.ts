// Vercel Cron: periodically re-check verified org domains against DNS so SSO + auto-provisioning
// trust stays safe over time. CRON_SECRET-gated (Vercel Cron sends `Authorization: Bearer <secret>`).
// Bounded batch; never blocks anything; returns SAFE summary counts only (no domains/tokens).
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { reverifyStaleDomains } from "@/lib/v-domain-reverify";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const summary = await reverifyStaleDomains(50, 24);
  return NextResponse.json({ ok: true, ...summary });
}
