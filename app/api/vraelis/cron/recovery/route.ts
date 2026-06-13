// Abandoned-payment recovery sweep. A pending payment = a lead who opened a
// pay/deposit link but didn't finish (the warmest possible lead). We nudge
// them at 1h, 24h, and 72h via SMS + email, regenerating a FRESH checkout
// link each time (Stripe sessions expire after 24h, so we never re-send a
// dead link). Vercel Cron hourly; CRON_SECRET-gated.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getPaymentsToRecover,
  updatePaymentSession,
  bumpPaymentReminder,
  getOrCreateWorkspace,
  getLeadWithMessages,
  getWorkspaceContact,
  addMessage,
} from "@/lib/vraelis-db";
import { createPaymentCheckout } from "@/lib/vraelis-connect";
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

      // Fresh, always-valid checkout link for the same amount.
      const { url, sessionId } = await createPaymentCheckout({
        accountId: ws.connect_account_id,
        amountCents: p.amount_cents,
        feeCents: p.fee_cents,
        productName: ws.business_name || "Vraelis",
        description: p.description || (p.kind === "deposit" ? "Deposit" : "Payment"),
        customerEmail: lead.contact_email,
        successUrl: `${ORIGIN}/pay/thanks?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${ORIGIN}/pay/thanks?canceled=1`,
        metadata: { kind: "vraelis_payment", owner_email: p.owner_email, lead_id: p.lead_id, pay_kind: p.kind },
      });
      if (!url) continue;
      await updatePaymentSession(p.id, sessionId, url);

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
