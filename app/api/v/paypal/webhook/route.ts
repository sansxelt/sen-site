// POST /api/v/paypal/webhook — Rank-aware PayPal webhook. Grants monthly plan credits + sets
// subscription state for Vraelis Rank PayPal subscriptions (custom_id.type "v_plan"). Signature
// is verified with PayPal (PAYPAL_WEBHOOK_ID). Point PayPal's webhook at THIS url (the old
// /api/paypal/webhook belongs to the retired product). Always 200s a verified event so PayPal
// doesn't retry-storm on our own transient errors.

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { verifyPaypalWebhook } from "@/lib/paypal";
import { handleVraelisPaypalSubEvent } from "@/lib/v-paypal-subs";

export const runtime = "nodejs";

type WebhookEvent = { event_type?: string; resource?: unknown };

export async function POST(request: Request) {
  const bodyText = await request.text();
  const h = await headers();
  const headerMap: Record<string, string | null> = {
    "paypal-auth-algo": h.get("paypal-auth-algo"),
    "paypal-cert-url": h.get("paypal-cert-url"),
    "paypal-transmission-id": h.get("paypal-transmission-id"),
    "paypal-transmission-sig": h.get("paypal-transmission-sig"),
    "paypal-transmission-time": h.get("paypal-transmission-time"),
  };

  let event: WebhookEvent;
  try { event = JSON.parse(bodyText) as WebhookEvent; } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  // Refuse rather than silently accept if we can't verify (PAYPAL_WEBHOOK_ID unset -> false).
  const verified = await verifyPaypalWebhook({ headers: headerMap, body: event });
  if (!verified) {
    console.warn("[v paypal webhook] signature verification failed:", event.event_type);
    return NextResponse.json({ error: "unverified" }, { status: 400 });
  }

  try {
    await handleVraelisPaypalSubEvent(event);
  } catch (err) {
    // Verified but the handler threw: 200 anyway so PayPal doesn't retry-storm our own bug.
    console.error(`[v paypal webhook] handler failed for ${event.event_type}:`, err);
  }
  return NextResponse.json({ received: true });
}
