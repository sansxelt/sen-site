// Payment reconciliation sweep. The Stripe webhook is the primary path that
// records an on-platform payment as paid and advances the lead — but a single
// missed/dropped/misconfigured delivery would otherwise lose the payment
// forever (buyer charged, Money tab shows $0). This sweep is the safety net:
// for every pending payment older than a few minutes, it asks Stripe whether
// the session actually paid and, if so, settles it through the SAME idempotent
// path the webhook uses. A webhook that does arrive wins the race harmlessly
// (markPaymentPaid only flips pending->paid once). Vercel Cron; CRON_SECRET-gated.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getPendingPaymentSessions } from "@/lib/vraelis-db";
import { reconcileSessionById } from "@/lib/vraelis-payment-settle";
import { captureEvent } from "@/lib/vraelis-monitor";

export const maxDuration = 60;

// Sweep window. MIN: a webhook that's going to arrive almost always does
// within seconds, so this avoids racing a slow-but-fine delivery. MAX: caps
// how far back we look so the sweep never re-retrieves genuinely-abandoned
// payments forever. The cap can't be ~24h (one session lifetime) because the
// recovery cron regenerates FRESH, payable sessions at the 24h and 72h
// reminder tiers — keyed on the row's original created_at, which never moves.
// Because recovery runs DAILY, its 72h tier can slip up to ~24h, minting a
// fresh session as late as ~96h after created_at; sessions live 24h
// (expires_at pinned in createPaymentCheckout), so a payable session can exist
// up to ~120h. Recovery stops at reminders_sent < 3 (no fresh session after
// the last tier), so beyond that every still-pending row is genuinely dead.
// Kept aligned with the dup-charge guard's PENDING_BLOCK_WINDOW_MS (126h).
const MIN_AGE_MS = 10 * 60 * 1000;
const MAX_AGE_MS = 126 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const olderThan = new Date(now - MIN_AGE_MS).toISOString();
  const newerThan = new Date(now - MAX_AGE_MS).toISOString();
  const pending = await getPendingPaymentSessions(olderThan, newerThan);
  let recovered = 0;

  for (const p of pending) {
    if (!p.stripe_session_id) continue;
    const result = await reconcileSessionById(p.stripe_session_id);
    if (result.settled) {
      recovered += 1;
      captureEvent("payment_reconciled", { paymentId: p.id, session: p.stripe_session_id });
    }
  }

  return NextResponse.json({ ok: true, candidates: pending.length, recovered });
}
