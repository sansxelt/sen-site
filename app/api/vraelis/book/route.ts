// Create a booking from the public booking page (key-scoped).
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  addMessage,
  createPayment,
  getWorkspaceByIntakeKey,
  setLeadStatus,
  updateLeadContact,
} from "@/lib/vraelis-db";
import { createBooking, getTakenSlots, slotLabel } from "@/lib/vraelis-booking";
import { createPaymentCheckout, expireCheckout } from "@/lib/vraelis-connect";
import { cutRateFor } from "@/lib/vraelis-plans";
import { sendBookingConfirmation } from "@/lib/vraelis-email";
import { limitOr429 } from "@/lib/vraelis-ratelimit";

const ORIGIN = "https://vraelis.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  // Rate limit: 15 booking attempts / 10 min per IP.
  const limited = await limitOr429(req, "book", 15, 600, CORS);
  if (limited) return limited;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400, headers: CORS });
  }
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const key = str(body.key);
  const slot = str(body.slot);
  const name = str(body.name);
  const email = str(body.email);
  const phone = str(body.phone);
  const leadId = str(body.leadId);

  if (!key || !slot) {
    return NextResponse.json({ ok: false, error: "Missing key or slot" }, { status: 400, headers: CORS });
  }
  const workspace = await getWorkspaceByIntakeKey(key);
  if (!workspace) {
    return NextResponse.json({ ok: false, error: "Invalid link" }, { status: 401, headers: CORS });
  }

  // Deposit-to-confirm: if the owner requires a deposit and payouts are live,
  // send the lead to pay first. The booking is created on payment (webhook).
  const depositCents =
    workspace.deposit_enabled &&
    workspace.connect_status === "active" &&
    workspace.connect_account_id &&
    workspace.deposit_amount_cents &&
    workspace.deposit_amount_cents >= 50
      ? workspace.deposit_amount_cents
      : 0;

  if (depositCents) {
    const label = slotLabel(slot);
    // Don't take a deposit for a slot that's already booked (narrows the race
    // with concurrent bookings; the webhook also refunds if it's lost later).
    const taken = await getTakenSlots(workspace.owner_email);
    if (taken.has(new Date(slot).toISOString())) {
      return NextResponse.json({ ok: false, error: "slot_taken" }, { status: 409, headers: CORS });
    }
    try {
      const feeCents = Math.round(depositCents * cutRateFor(workspace.plan, workspace.plan_cycle));
      const { url, sessionId } = await createPaymentCheckout({
        accountId: workspace.connect_account_id!,
        amountCents: depositCents,
        feeCents,
        productName: workspace.business_name || "Vraelis",
        description: `Deposit to confirm ${label}`,
        customerEmail: email || null,
        successUrl: `${ORIGIN}/pay/thanks`,
        cancelUrl: `${ORIGIN}/book/${key}${leadId ? `?lead=${leadId}` : ""}`,
        metadata: { kind: "vraelis_payment", owner_email: workspace.owner_email, lead_id: leadId || "", pay_kind: "deposit" },
      });
      const paymentId = await createPayment({
        ownerEmail: workspace.owner_email,
        leadId: leadId || null,
        kind: "deposit",
        description: workspace.business_name || "Vraelis",
        amountCents: depositCents,
        feeCents,
        sessionId,
        bookingSlot: new Date(slot).toISOString(),
        bookingName: name || null,
        bookingPhone: phone || null,
      });
      if (!paymentId) {
        await expireCheckout(sessionId);
        return NextResponse.json({ ok: false, error: "deposit_failed" }, { status: 500, headers: CORS });
      }
      return NextResponse.json({ ok: true, redirect: url }, { status: 200, headers: CORS });
    } catch (e) {
      console.error("deposit checkout failed:", e);
      return NextResponse.json({ ok: false, error: "deposit_failed" }, { status: 500, headers: CORS });
    }
  }

  const result = await createBooking({
    ownerEmail: workspace.owner_email,
    leadId: leadId || null,
    slotIso: slot,
    name,
    contactEmail: email,
    contactPhone: phone,
  });
  if (!result.ok) {
    const status = result.reason === "slot_taken" ? 409 : 400;
    return NextResponse.json({ ok: false, error: result.reason }, { status, headers: CORS });
  }

  const label = slotLabel(slot);
  try {
    if (leadId) {
      await setLeadStatus(workspace.owner_email, leadId, "booked");
      if (email || name) await updateLeadContact(leadId, { contactEmail: email, name });
      await addMessage({ leadId, role: "agent", body: `Booked: ${label}`, channel: "booking", delivered: true });
    }
    await sendBookingConfirmation({
      businessName: workspace.business_name ?? "Vraelis",
      slotLabel: label,
      leadEmail: email || null,
      leadName: name || null,
      ownerEmail: workspace.owner_email,
    });
  } catch (error) {
    console.error("post-booking steps failed:", error);
  }

  return NextResponse.json({ ok: true, slot, label }, { status: 200, headers: CORS });
}
