// Inbound email → AI reply. Point an inbound-email provider (Cloudflare
// Email Routing, Brevo inbound, Postmark/Mailgun/SendGrid parse, etc.) at
// this URL. We match the sender to a lead, save their message, let the AI
// reply, and send it back — so the conversation continues over email
// without the owner having to.
//
// Secured by INBOUND_SECRET (set it in env and include it as ?secret=...
// or an x-inbound-secret header in the provider's webhook URL).

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  addMessage,
  findLeadByContactEmail,
  getLeadWithMessages,
  getOrCreateWorkspace,
  getWorkspaceServices,
  touchLeadStatus,
  AI_SETTABLE_STATUSES,
  type LeadStatus,
} from "@/lib/vraelis-db";
import { continueLeadConversation, type ConvoTurn } from "@/lib/vraelis-ai";
import { sendLeadReply } from "@/lib/vraelis-email";
import { startWorkspacePayment } from "@/lib/vraelis-connect";

const pick = (o: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) if (typeof o[k] === "string" && (o[k] as string).trim()) return (o[k] as string).trim();
  return "";
};

// Trim quoted reply history so the model sees only the new message.
function stripQuoted(text: string): string {
  const cut = text.search(/\n\s*On .+wrote:|\n\s*-----Original|\n>/);
  return (cut > 0 ? text.slice(0, cut) : text).trim();
}

export async function POST(req: NextRequest) {
  const secret = process.env.INBOUND_SECRET;
  const provided = req.nextUrl.searchParams.get("secret") || req.headers.get("x-inbound-secret") || "";
  if (!secret || provided !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Accept JSON or form-encoded (providers differ).
  let from = "";
  let text = "";
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const b = (await req.json()) as Record<string, unknown>;
      from = pick(b, ["from", "sender", "From", "fromEmail", "from_email"]);
      text = pick(b, ["text", "body-plain", "TextBody", "plain", "stripped-text", "strippedText", "body"]);
    } else {
      const fd = await req.formData();
      const g = (k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : "");
      from = g("from") || g("sender") || g("From");
      text = g("text") || g("body-plain") || g("stripped-text") || g("TextBody");
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Unparseable" }, { status: 400 });
  }

  const fromEmail = (from.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [])[0]?.toLowerCase() || "";
  const message = stripQuoted(text);
  if (!fromEmail || !message) {
    return NextResponse.json({ ok: false, error: "Missing sender or body" }, { status: 400 });
  }

  const lead = await findLeadByContactEmail(fromEmail);
  if (!lead) {
    // Not a known lead — ignore (don't auto-engage strangers).
    return NextResponse.json({ ok: true, matched: false });
  }

  try {
    const ws = await getOrCreateWorkspace(lead.owner_email);
    await addMessage({ leadId: lead.id, role: "lead", body: message, channel: "email" });

    const data = await getLeadWithMessages(lead.owner_email, lead.id);
    const history: ConvoTurn[] = (data?.messages ?? []).map((m) => ({ role: m.role, body: m.body }));
    const connected = ws?.connect_status === "active" && Boolean(ws?.connect_account_id);
    const depositLabel =
      connected && ws?.deposit_enabled && ws.deposit_amount_cents
        ? `$${(ws.deposit_amount_cents / 100).toLocaleString()}`
        : null;
    const services = await getWorkspaceServices(lead.owner_email);

    const ai = await continueLeadConversation({
      businessName: ws?.business_name ?? "",
      businessDescription: ws?.business_description ?? "",
      history,
      businessServices: services ?? undefined,
      canTakePayment: connected,
      depositLabel,
    });

    const nextStatus: LeadStatus =
      ai.status && AI_SETTABLE_STATUSES.includes(ai.status as LeadStatus)
        ? (ai.status as LeadStatus)
        : lead.status;

    let replyText = ai.reply;
    let injected = false;
    if (ws && ai.payment && connected) {
      const amountCents = ai.payment.kind === "deposit" ? (ws.deposit_amount_cents ?? 0) : ai.payment.amountCents;
      if (amountCents >= 50) {
        const pay = await startWorkspacePayment(ws, {
          leadId: lead.id,
          kind: ai.payment.kind,
          amountCents,
          description: ai.payment.label || (ai.payment.kind === "deposit" ? "Deposit to confirm your booking" : "Payment"),
          customerEmail: lead.contact_email,
        });
        if (pay.ok && pay.url) {
          replyText += `\n\nYou can ${ai.payment.kind === "deposit" ? "lock in your booking" : "pay securely"} here: ${pay.url}`;
          injected = true;
        }
      }
    }
    if (!injected && nextStatus === "booking_ready" && ws?.intake_key) {
      replyText += `\n\nYou can grab a time here: https://vraelis.com/book/${ws.intake_key}?lead=${lead.id}`;
    }

    const r = await sendLeadReply({
      to: fromEmail,
      businessName: ws?.business_name ?? "Vraelis",
      replyText,
      replyTo: lead.owner_email,
    });
    await addMessage({ leadId: lead.id, role: "agent", body: replyText, channel: r.sent ? "email" : "note", delivered: r.sent });
    await touchLeadStatus(lead.id, nextStatus);

    return NextResponse.json({ ok: true, matched: true, replied: r.sent });
  } catch (error) {
    console.error("inbound email failed:", error);
    return NextResponse.json({ ok: false, error: "Processing failed" }, { status: 500 });
  }
}
