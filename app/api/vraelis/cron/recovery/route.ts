// Abandoned-payment recovery sweep. A pending payment = a lead who opened a
// pay/deposit link but didn't finish (the warmest possible lead). We nudge
// them at 1h, 24h, and 72h via SMS + email, regenerating a FRESH checkout
// link each time (Stripe sessions expire after 24h, so we never re-send a
// dead link). The OLD session is superseded (expired) and atomically swapped
// before each new link, so a payment never has two live links. Vercel Cron
// (daily per vercel.json); CRON_SECRET-gated.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getPaymentsToRecover,
  swapPaymentSession,
  bumpPaymentReminder,
  getOrCreateWorkspace,
  getWorkspaceOffer,
  getLeadWithMessages,
  getWorkspaceContact,
  addMessage,
} from "@/lib/vraelis-db";
import { createPaymentCheckout, expireCheckout, supersedeCheckoutSession } from "@/lib/vraelis-connect";
import { sendSms } from "@/lib/vraelis-sms";
import { sendLeadReply } from "@/lib/vraelis-email";
import { captureError, captureEvent } from "@/lib/vraelis-monitor";

export const maxDuration = 60;
const ORIGIN = "https://vraelis.com";
const HOUR = 3600 * 1000;

// tier index → minimum age before that reminder fires
const TIER_AGE = [1 * HOUR, 24 * HOUR, 72 * HOUR];

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const pending = await getPaymentsToRecover();
  let recovered = 0;
  const now = Date.now();

  for (const p of pending) {
    try {
      const tier = p.reminders_sent; // 0→1h, 1→24h, 2→72h
      if (tier > 2) continue;
      const age = now - new Date(p.created_at).getTime();
      if (age < TIER_AGE[tier]) continue;
      if (!p.lead_id) continue;

      const ws = await getOrCreateWorkspace(p.owner_email);
      if (!ws?.connect_account_id || ws.connect_status !== "active") continue;

      const data = await getLeadWithMessages(p.owner_email, p.lead_id);
      const lead = data?.lead;
      if (!lead) continue;
      // Don't chase a lead who already paid/booked/closed.
      if (["won", "booked", "lost"].includes(lead.status)) continue;

      // Supersede the OLD session BEFORE minting a new one, so we never leave
      // two payable links for the same payment. If the old session was already
      // paid (webhook in flight or missed), skip entirely — minting a new link
      // would risk a double charge, and the webhook/reconcile will settle the
      // original against the session id still on the row.
      const supersede = await supersedeCheckoutSession(p.stripe_session_id ?? "");
      if (supersede === "paid") {
        captureEvent("payment_recovery_skipped", { reason: "already_paid", paymentId: p.id, leadId: p.lead_id });
        continue;
      }
      if (supersede === "unknown") {
        // Couldn't confirm the old link is dead — don't risk a second live
        // link for the same payment. Try again next sweep.
        captureEvent("payment_recovery_skipped", { reason: "supersede_unknown", paymentId: p.id, leadId: p.lead_id });
        continue;
      }

      // Buyer sees the OFFER as the Stripe product; brand is the fallback.
      const offer = await getWorkspaceOffer(p.owner_email);
      // Fresh checkout link for the same amount (old one is now expired).
      const { url, sessionId } = await createPaymentCheckout({
        accountId: ws.connect_account_id,
        amountCents: p.amount_cents,
        feeCents: p.fee_cents,
        productName: offer.offerName || ws.business_name || "Vraelis",
        description: p.description || (p.kind === "deposit" ? "Deposit" : "Payment"),
        customerEmail: lead.contact_email,
        successUrl: `${ORIGIN}/pay/thanks?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${ORIGIN}/pay/thanks?canceled=1`,
        metadata: { kind: "vraelis_payment", owner_email: p.owner_email, lead_id: p.lead_id, pay_kind: p.kind },
      });
      if (!url) continue;
      // Atomically claim the row: only swap if it still holds the session id
      // we just superseded. This both (a) detects a concurrent recovery run
      // that already swapped (loser sees false), and (b) guarantees we never
      // leave the row pointing at a dead session while a live link is out — if
      // the swap fails for ANY reason (lost race, DB error), we expire the
      // just-minted session and bail BEFORE sending it, so no unrecorded live
      // link ever reaches the buyer. The row keeps its prior session id and
      // stays pending; the next sweep retries cleanly.
      const swapped = await swapPaymentSession(p.id, p.stripe_session_id ?? null, sessionId, url);
      if (!swapped) {
        await expireCheckout(sessionId);
        captureEvent("payment_recovery_skipped", { reason: "swap_failed", paymentId: p.id, leadId: p.lead_id });
        continue;
      }

      const verb = p.kind === "deposit" ? "lock in your booking" : "finish your payment";
      const tierCopy = tier === 0 ? "Just following up —" : tier === 1 ? "Still want to grab your spot?" : "Last nudge —";
      const smsBody = `${tierCopy} you can ${verb} here: ${url}`;
      const emailBody = `${tierCopy}\n\nYou can ${verb} securely here:\n${url}`;

      const contact = await getWorkspaceContact(p.owner_email);
      let sent = false;
      if (lead.contact_phone) sent = (await sendSms(lead.contact_phone, smsBody, contact?.twilio_number ?? undefined)) || sent;
      if (lead.contact_email) {
        const r = await sendLeadReply({
          to: lead.contact_email,
          businessName: ws.business_name || "Vraelis",
          replyText: emailBody,
          replyTo: p.owner_email,
        });
        sent = r.sent || sent;
      }

      await bumpPaymentReminder(p.id, p.reminders_sent + 1);
      await addMessage({ leadId: p.lead_id, role: "agent", body: `Sent payment reminder (#${tier + 1}).`, channel: "system", delivered: sent });
      captureEvent("payment_recovery", { tier: tier + 1, paymentId: p.id, leadId: p.lead_id, sent });
      if (sent) recovered += 1;
    } catch (e) {
      captureError("recovery", e, { paymentId: p.id });
    }
  }

  return NextResponse.json({ ok: true, candidates: pending.length, reminded: recovered });
}
