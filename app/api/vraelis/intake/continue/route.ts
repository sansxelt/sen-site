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
import { authorizeAgentPayment, leadFacingRefusal } from "@/lib/vraelis-payment-authz";
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
import { leadAgentEnabled } from "@/lib/v-entitlements";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-vraelis-key",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  // Retired lead-agent conversation endpoint: uniform 404 unless the product is explicitly enabled (default off).
  if (!leadAgentEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404, headers: CORS });
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
      // SECURITY: the model does not authorize money. authorizeAgentPayment derives the amount from
      // owner-configured data (a deposit is taken verbatim from the workspace and the model's number is
      // discarded), enforces a per-request ceiling plus rolling day and billing-cycle caps, and fails
      // closed when any of those cannot be established. Above the automatic band a human decides.
      const authz = await authorizeAgentPayment(workspace, {
        kind: ai.payment.kind,
        proposedCents: ai.payment.amountCents,
      });
      if (!authz.ok) {
        console.warn(
          "[intake/continue] agent payment not authorized:",
          authz.reason,
          `proposed=${authz.proposedCents ?? "n/a"} ceiling=${authz.ceilingCents ?? "n/a"}`,
        );
        // The lead is told a human will follow up, and nothing about the limit that stopped it.
        replyText += `\n\n${leadFacingRefusal()}`;
        injected = true;
      } else {
        const pay = await startWorkspacePayment(workspace, {
          leadId,
          kind: ai.payment.kind,
          amountCents: authz.amountCents,
          // The model writes this label and the payer sees it on the Stripe page, so it is clamped to a
          // single line of bounded length rather than passed through.
          description:
            (ai.payment.label || "").replace(/[\r\n\u2028\u2029\0]/g, " ").trim().slice(0, 120) ||
            (ai.payment.kind === "deposit" ? "Deposit to confirm your booking" : "Payment"),
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
