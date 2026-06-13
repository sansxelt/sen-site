// Twilio inbound SMS webhook. A lead texts the business's Twilio number;
// we route to that workspace, match (or create) the lead, run the SAME AI
// qualification used by chat/email, advance the pipeline, and text the
// reply back. Booking/pay links are injected exactly like the web chat.
//
// Configure in Twilio: Messaging → a Number → "A message comes in" →
//   POST https://vraelis.com/api/vraelis/sms/inbound?secret=<TWILIO_INBOUND_SECRET>
//
// Optional shared-secret gate via ?secret= (set TWILIO_INBOUND_SECRET).

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  addMessage,
  createLead,
  findLeadByContactPhone,
  getLeadWithMessages,
  getWorkspaceByTwilioNumber,
  getWorkspaceOffer,
  getWorkspaceServices,
  touchLeadStatus,
  AI_SETTABLE_STATUSES,
  type LeadStatus,
} from "@/lib/vraelis-db";
import { continueLeadConversation, type ConvoTurn } from "@/lib/vraelis-ai";
import { startWorkspacePayment } from "@/lib/vraelis-connect";
import { sendSms, normalizePhone } from "@/lib/vraelis-sms";
import { notifyOwnerNewLeadEvent, notifyOwnerStatusEvent } from "@/lib/vraelis-notify";
import { allow } from "@/lib/vraelis-ratelimit";
import { captureError } from "@/lib/vraelis-monitor";

const TWIML_EMPTY = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
const xml = () => new NextResponse(TWIML_EMPTY, { status: 200, headers: { "Content-Type": "text/xml" } });

export async function POST(req: NextRequest) {
  const secret = (process.env.TWILIO_INBOUND_SECRET || "").trim();
  if (secret && req.nextUrl.searchParams.get("secret") !== secret) {
    return new NextResponse("forbidden", { status: 403 });
  }

  let from = "";
  let to = "";
  let bodyText = "";
  try {
    const form = await req.formData();
    from = normalizePhone(String(form.get("From") ?? ""));
    to = normalizePhone(String(form.get("To") ?? ""));
    bodyText = String(form.get("Body") ?? "").trim();
  } catch {
    return xml();
  }
  if (!from || !to || !bodyText) return xml();

  // Per-sender rate limit (AI cost / spam protection).
  if (!(await allow(`sms:${from}`, 30, 600))) return xml();

  try {
    const workspace = await getWorkspaceByTwilioNumber(to);
    if (!workspace) return xml(); // number not linked to a workspace

    // Match the existing lead by phone, or create a new SMS lead.
    let lead = await findLeadByContactPhone(workspace.owner_email, from);
    if (!lead) {
      lead = await createLead({
        ownerEmail: workspace.owner_email,
        contactPhone: from,
        source: "sms",
        snippet: bodyText,
      });
      await notifyOwnerNewLeadEvent(workspace.owner_email, { id: lead.id, contact_phone: from, message: bodyText });
    }

    await addMessage({ leadId: lead.id, role: "lead", body: bodyText, channel: "sms" });

    const data = await getLeadWithMessages(workspace.owner_email, lead.id);
    const history: ConvoTurn[] = (data?.messages ?? []).map((m) => ({ role: m.role, body: m.body }));
    if (history.length === 0 || history[history.length - 1].body !== bodyText) {
      history.push({ role: "lead", body: bodyText });
    }

    const connected = workspace.connect_status === "active" && Boolean(workspace.connect_account_id);
    const depositLabel =
      connected && workspace.deposit_enabled && workspace.deposit_amount_cents
        ? `$${(workspace.deposit_amount_cents / 100).toLocaleString()}`
        : null;
    const services = await getWorkspaceServices(workspace.owner_email);
    const agent = await getWorkspaceOffer(workspace.owner_email);

    const ai = await continueLeadConversation({
      businessName: workspace.business_name ?? "",
      businessDescription: workspace.business_description ?? "",
      history,
      businessServices: services ?? undefined,
      canTakePayment: connected,
      depositLabel,
      agentName: agent.agentName,
      agentTone: agent.agentTone,
    });

    const nextStatus: LeadStatus =
      ai.status && AI_SETTABLE_STATUSES.includes(ai.status as LeadStatus)
        ? (ai.status as LeadStatus)
        : lead.status;

    let replyText = ai.reply;
    let injected = false;
    if (ai.payment && connected) {
      const amountCents = ai.payment.kind === "deposit" ? (workspace.deposit_amount_cents ?? 0) : ai.payment.amountCents;
      if (amountCents >= 50) {
        const pay = await startWorkspacePayment(workspace, {
          leadId: lead.id,
          kind: ai.payment.kind,
          amountCents,
          description: ai.payment.label || (ai.payment.kind === "deposit" ? "Deposit to confirm your booking" : "Payment"),
          customerEmail: lead.contact_email,
        });
        if (pay.ok && pay.url) {
          replyText += `\n\nPay securely here: ${pay.url}`;
          injected = true;
        }
      }
    }
    if (!injected && nextStatus === "booking_ready" && workspace.intake_key) {
      replyText += `\n\nGrab a time here: https://vraelis.com/book/${workspace.intake_key}?lead=${lead.id}`;
    }

    await sendSms(from, replyText, workspace.twilio_number ?? undefined);
    await addMessage({ leadId: lead.id, role: "agent", body: replyText, channel: "sms", delivered: true });
    const prevStatus = lead.status;
    await touchLeadStatus(lead.id, nextStatus);
    // Alert the owner on a genuine escalation / hot-lead transition. Fired
    // unconditionally: notifyOwnerStatusEvent only emails for needs_owner /
    // booking_ready AND only when the status actually changed, so a normal
    // new lead (new->contacted/qualifying) sends no second email — but a
    // first-message hot lead or escalation (new->booking_ready/needs_owner)
    // correctly reaches the owner, which the prior isNew skip swallowed.
    await notifyOwnerStatusEvent(workspace.owner_email, lead, prevStatus, nextStatus);
  } catch (e) {
    captureError("sms-inbound", e);
  }
  return xml();
}
