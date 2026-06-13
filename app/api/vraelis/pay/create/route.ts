// Owner-initiated payment request. Creates an on-platform Checkout
// (destination charge + application fee) for a lead and returns the pay
// link. The link is emailed to the lead and dropped into the conversation
// so it's tracked. The Vraelis cut is taken automatically at payment time.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import {
  getOrCreateWorkspace,
  getWorkspaceOffer,
  getLeadWithMessages,
  leadOpenPaymentStatus,
  addMessage,
  createPayment,
} from "@/lib/vraelis-db";
import { createPaymentCheckout, expireCheckout } from "@/lib/vraelis-connect";
import { cutRateFor } from "@/lib/vraelis-plans";
import { sendLeadReply } from "@/lib/vraelis-email";

const ORIGIN = "https://vraelis.com";

export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ ok: false, needSignin: true }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const amountCents = Math.round(Number(body.amount) * 100);
  const description = String(body.description ?? "").trim().slice(0, 300);
  const leadId = body.leadId ? String(body.leadId) : null;
  if (!Number.isFinite(amountCents) || amountCents < 50) {
    return NextResponse.json({ ok: false, error: "Amount must be at least $0.50" }, { status: 400 });
  }

  const ws = await getOrCreateWorkspace(email);
  if (!ws?.connect_account_id || ws.connect_status !== "active") {
    return NextResponse.json({ ok: false, error: "connect_required" }, { status: 400 });
  }

  const feeCents = Math.round(amountCents * cutRateFor(ws.plan, ws.plan_cycle));

  // Resolve the lead (owner-scoped) for the customer email + tracking.
  let customerEmail: string | null = null;
  let validLeadId: string | null = null;
  if (leadId) {
    const d = await getLeadWithMessages(email, leadId);
    if (d) {
      validLeadId = d.lead.id;
      customerEmail = d.lead.contact_email;
    }
  }

  // Duplicate-charge guard (P0 #4): when this request targets a lead, never
  // mint a second live link for one that already has a pending link or has
  // paid. A leadId-less call (ad-hoc link) can't be deduped by lead and is
  // allowed through, same as before.
  if (validLeadId) {
    const open = await leadOpenPaymentStatus(email, validLeadId);
    if (open === "paid") {
      return NextResponse.json({ ok: false, error: "already_paid" }, { status: 409 });
    }
    if (open === "pending") {
      return NextResponse.json({ ok: false, error: "payment_pending" }, { status: 409 });
    }
  }

  // Buyer sees the OFFER as the product on Stripe (what they're buying),
  // not the business brand. Falls back to the brand, then "Vraelis".
  const offer = await getWorkspaceOffer(email);
  const productName = offer.offerName || ws.business_name || "Vraelis";
  try {
    const { url, sessionId } = await createPaymentCheckout({
      accountId: ws.connect_account_id,
      amountCents,
      feeCents,
      productName,
      description: description || "Payment",
      customerEmail,
      successUrl: `${ORIGIN}/pay/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${ORIGIN}/pay/thanks?canceled=1`,
      metadata: {
        kind: "vraelis_payment",
        owner_email: email,
        lead_id: validLeadId ?? "",
        pay_kind: "full",
      },
    });

    const paymentId = await createPayment({
      ownerEmail: email,
      leadId: validLeadId,
      kind: "full",
      description: description || null,
      amountCents,
      feeCents,
      sessionId,
    });
    // If we couldn't record the payment, expire the session so the link can't
    // be paid without a ledger row (which would be invisible + un-fulfilled).
    if (!paymentId) {
      await expireCheckout(sessionId);
      return NextResponse.json({ ok: false, error: "payment_record_failed" }, { status: 500 });
    }

    if (url && customerEmail) {
      try {
        await sendLeadReply({
          // Email subject is a BRAND surface ("Re: your enquiry to X"), so it
          // uses the business name — NOT productName (the offer, for Stripe).
          to: customerEmail,
          businessName: ws.business_name || "Vraelis",
          replyText: `${description ? description + "\n\n" : ""}You can pay securely here:\n${url}`,
          replyTo: email,
        });
      } catch (e) {
        console.error("pay link email failed:", e);
      }
    }
    if (url && validLeadId) {
      try {
        await addMessage({
          leadId: validLeadId,
          role: "agent",
          body: `Sent a secure payment link${description ? ` — ${description}` : ""}: ${url}`,
          channel: "system",
          delivered: Boolean(customerEmail),
        });
      } catch (e) {
        console.error("pay link message failed:", e);
      }
    }

    return NextResponse.json({ ok: true, url });
  } catch (err) {
    console.error("pay/create failed:", err);
    return NextResponse.json({ ok: false, error: "stripe_error" }, { status: 500 });
  }
}
