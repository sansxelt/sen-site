// Continue an existing lead conversation (multi-turn). The hosted form
// (and, later, the embeddable widget) call this after the initial intake
// to keep the AI talking with the lead in the same thread.
//
//   POST /api/vraelis/intake/continue
//   body: { key, leadId, message }
//
// Auth model: the public form holds the workspace intake `key` and the
// `leadId` returned from /api/vraelis/intake. We only act on a lead that
// actually belongs to that key's workspace — so a session can't reach
// threads that aren't its own, and no other workspace's data is exposed.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  addMessage,
  getLeadWithMessages,
  getWorkspaceByIntakeKey,
  getWorkspaceOffer,
  getWorkspaceServices,
  touchLeadStatus,
  updateLeadContact,
  AI_SETTABLE_STATUSES,
  type LeadStatus,
} from "@/lib/vraelis-db";
import { startWorkspacePayment } from "@/lib/vraelis-connect";
import { continueLeadConversation, type ConvoTurn } from "@/lib/vraelis-ai";
import { notifyOwnerStatusEvent } from "@/lib/vraelis-notify";
import { limitOr429 } from "@/lib/vraelis-ratelimit";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-vraelis-key",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  // Rate limit: 40 AI turns / 10 min per IP (AI-cost abuse protection).
  const limited = await limitOr429(req, "continue", 40, 600, CORS);
  if (limited) return limited;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400, headers: CORS });
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const key = str(body.key) || (req.headers.get("x-vraelis-key") ?? "").trim();
  const leadId = str(body.leadId);
  const message = str(body.message);

  if (!key || !leadId) {
    return NextResponse.json({ ok: false, error: "Missing key or leadId" }, { status: 401, headers: CORS });
  }
  if (!message) {
    return NextResponse.json({ ok: false, error: "Empty message" }, { status: 400, headers: CORS });
  }

  const workspace = await getWorkspaceByIntakeKey(key);
  if (!workspace) {
    return NextResponse.json({ ok: false, error: "Invalid intake key" }, { status: 401, headers: CORS });
  }

  // Scope: the lead must belong to this key's workspace.
  const data = await getLeadWithMessages(workspace.owner_email, leadId);
  if (!data) {
    return NextResponse.json({ ok: false, error: "Thread not found" }, { status: 404, headers: CORS });
  }

  try {
    // Save the lead's new message.
    await addMessage({ leadId, role: "lead", body: message, channel: "chat" });

    // Capture contact details the lead types mid-chat (so the owner has
    // them even if they weren't in the initial form).
    const emailMatch = message.match(/[\w.+-]+@[\w-]+\.[\w-]{2,}/);
    const phoneMatch = message.match(/\+?\d[\d\s().-]{6,}\d/);
    const contactPatch: { contactEmail?: string; contactPhone?: string } = {};
    if (emailMatch && !data.lead.contact_email) contactPatch.contactEmail = emailMatch[0];
    if (phoneMatch && !data.lead.contact_phone) contactPatch.contactPhone = phoneMatch[0].trim();
    if (Object.keys(contactPatch).length > 0) await updateLeadContact(leadId, contactPatch);

    // Build history (prior turns + this new one) for the model.
    const history: ConvoTurn[] = [
      ...data.messages.map((m) => ({ role: m.role, body: m.body })),
      { role: "lead" as const, body: message },
    ];

    // Payment context: only let the AI offer to charge when payouts are live.
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
      qualifyingQuestions: agent.qualifyingQuestions,
      canTakePayment: connected,
      depositLabel,
      agentName: agent.agentName,
      agentTone: agent.agentTone,
    });

    // Apply the AI's suggested status (validated); otherwise just bump
    // the thread's activity timestamp by re-setting the current status.
    const nextStatus: LeadStatus =
      ai.status && AI_SETTABLE_STATUSES.includes(ai.status as LeadStatus)
        ? (ai.status as LeadStatus)
        : data.lead.status;

    let replyText = ai.reply;
    let injected = false;

    // If the AI decided to collect payment and payouts are live, raise a
    // secure on-platform pay/deposit link and drop it into the reply.
    if (ai.payment && connected) {
      const amountCents = ai.payment.kind === "deposit" ? (workspace.deposit_amount_cents ?? 0) : ai.payment.amountCents;
      if (amountCents >= 50) {
        const pay = await startWorkspacePayment(workspace, {
          leadId,
          kind: ai.payment.kind,
          amountCents,
          description: ai.payment.label || (ai.payment.kind === "deposit" ? "Deposit to confirm your booking" : "Payment"),
          customerEmail: data.lead.contact_email,
          cancelUrl: `https://vraelis.com/f/${key}`,
        });
        if (pay.ok && pay.url) {
          replyText += `\n\nYou can ${ai.payment.kind === "deposit" ? "lock in your booking" : "pay securely"} here: ${pay.url}`;
          injected = true;
        }
      }
    }

    // Otherwise, when they're ready to book, share the booking link.
    if (!injected && nextStatus === "booking_ready") {
      replyText += `\n\nYou can grab a time here: https://vraelis.com/book/${key}?lead=${leadId}`;
    }

    await addMessage({ leadId, role: "agent", body: replyText, channel: "chat" });
    await touchLeadStatus(leadId, nextStatus);

    // Alert the owner on a genuine escalation or hot-lead transition.
    await notifyOwnerStatusEvent(workspace.owner_email, { ...data.lead, id: leadId }, data.lead.status, nextStatus);

    return NextResponse.json(
      { ok: true, reply: replyText, status: nextStatus },
      { status: 200, headers: CORS },
    );
  } catch (error) {
    console.error("continue conversation failed:", error);
    return NextResponse.json({ ok: false, error: "Could not continue" }, { status: 500, headers: CORS });
  }
}
