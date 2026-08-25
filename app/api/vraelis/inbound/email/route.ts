// Inbound email → AI reply. Point an inbound-email provider (Cloudflare
// Email Routing, Brevo inbound, Postmark/Mailgun/SendGrid parse, etc.) at
// this URL. We match the sender to a lead, save their message, let the AI
// reply, and send it back — so the conversation continues over email
// without the owner having to.
//
// Secured by INBOUND_SECRET (set it in env and include it as ?secret=...
// or an x-inbound-secret header in the provider's webhook URL).

import { timingSafeEqual } from "node:crypto";
import { limitOr429 } from "@/lib/vraelis-ratelimit";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  addMessage,
  findLeadByContactEmail,
  getLeadWithMessages,
  getWorkspaceByIntakeKey,
  getWorkspaceOffer,
  getWorkspaceServices,
  touchLeadStatus,
  AI_SETTABLE_STATUSES,
  type LeadStatus,
} from "@/lib/vraelis-db";
import { continueLeadConversation, type ConvoTurn } from "@/lib/vraelis-ai";
import { sendLeadReply } from "@/lib/vraelis-email";
import { notifyOwnerStatusEvent } from "@/lib/vraelis-notify";
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
  // Rate limited even though it is secret-gated: each accepted POST costs one Anthropic call plus one
  // Resend send, and the secret travels in a query string, so it leaks into logs and Referer headers
  // more readily than a header-only credential would.
  const limited = await limitOr429(req, "inbound-email", 60, 600);
  if (limited) return limited;

  const secret = process.env.INBOUND_SECRET;
  const provided = req.nextUrl.searchParams.get("secret") || req.headers.get("x-inbound-secret") || "";
  // Constant-time compare so the shared secret cannot be recovered a character at a time.
  const sBuf = Buffer.from(secret ?? ''), pBuf = Buffer.from(provided);
  if (!secret || sBuf.length !== pBuf.length || !timingSafeEqual(sBuf, pBuf)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Accept JSON or form-encoded (providers differ). We read the RECIPIENT too
  // (the address the lead replied to), because that is what identifies the
  // workspace — lead-facing emails set Reply-To: reply+{intakeKey}@vraelis.com,
  // so the inbound recipient carries the workspace's intake key.
  let from = "";
  let text = "";
  let to = "";
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const b = (await req.json()) as Record<string, unknown>;
      from = pick(b, ["from", "sender", "From", "fromEmail", "from_email"]);
      text = pick(b, ["text", "body-plain", "TextBody", "plain", "stripped-text", "strippedText", "body"]);
      to = pick(b, ["to", "To", "recipient", "recipients", "toEmail", "to_email", "delivered-to", "Delivered-To"]);
    } else {
      const fd = await req.formData();
      const g = (k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : "");
      from = g("from") || g("sender") || g("From");
      text = g("text") || g("body-plain") || g("stripped-text") || g("TextBody");
      to = g("to") || g("To") || g("recipient") || g("recipients") || g("delivered-to");
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Unparseable" }, { status: 400 });
  }

  const fromEmail = (from.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [])[0]?.toLowerCase() || "";
  const message = stripQuoted(text);
  if (!fromEmail || !message) {
    return NextResponse.json({ ok: false, error: "Missing sender or body" }, { status: 400 });
  }

  // Resolve the WORKSPACE from the recipient address. The To header may list
  // several addresses; find the vraelis reply address and pull the intake key
  // from its local part: reply+{intakeKey}@vraelis.com. Keys are url-safe
  // (the local-part charset already excludes the '+' separator and '@').
  const intakeKey = (to.toLowerCase().match(/reply\+([a-z0-9._-]+)@vraelis\.com/) || [])[1] || "";
  if (!intakeKey) {
    // No vraelis reply address on the recipient → we can't tell which workspace
    // this belongs to. FAIL SAFE: never global-match by email, never guess a
    // workspace (that would let one tenant's agent answer another's lead).
    return NextResponse.json({ ok: true, matched: false, reason: "no_workspace_key" });
  }
  const ws = await getWorkspaceByIntakeKey(intakeKey);
  if (!ws) {
    return NextResponse.json({ ok: true, matched: false, reason: "workspace_not_found" });
  }

  // Owner-scoped lead lookup: only a lead belonging to THIS workspace can match.
  const lead = await findLeadByContactEmail(ws.owner_email, fromEmail);
  if (!lead) {
    // Known recipient workspace, but no lead with that email in it — ignore
    // (don't auto-engage a stranger emailing the reply address).
    return NextResponse.json({ ok: true, matched: false, reason: "lead_not_found" });
  }

  try {
    await addMessage({ leadId: lead.id, role: "lead", body: message, channel: "email" });

    const data = await getLeadWithMessages(lead.owner_email, lead.id);
    const history: ConvoTurn[] = (data?.messages ?? []).map((m) => ({ role: m.role, body: m.body }));
    const connected = ws?.connect_status === "active" && Boolean(ws?.connect_account_id);
    const depositLabel =
      connected && ws?.deposit_enabled && ws.deposit_amount_cents
        ? `$${(ws.deposit_amount_cents / 100).toLocaleString()}`
        : null;
    const services = await getWorkspaceServices(lead.owner_email);
    const agent = await getWorkspaceOffer(lead.owner_email);

    const ai = await continueLeadConversation({
      businessName: ws?.business_name ?? "",
      businessDescription: ws?.business_description ?? "",
      history,
      businessServices: services ?? undefined,
      qualifyingQuestions: agent.qualifyingQuestions,
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
      businessName: ws.business_name ?? "Vraelis",
      replyText,
      // Route the lead's next reply to the owner's inbox. (Switches to the
      // per-workspace reply+{key}@vraelis.com agent address once Cloudflare
      // inbound routing is wired — see inboundReplyTo in lib/vraelis-email.)
      replyTo: lead.owner_email,
    });
    await addMessage({ leadId: lead.id, role: "agent", body: replyText, channel: r.sent ? "email" : "note", delivered: r.sent });
    const prevStatus = lead.status;
    await touchLeadStatus(lead.id, nextStatus);
    // Alert the owner on a genuine escalation / hot-lead transition.
    await notifyOwnerStatusEvent(ws.owner_email, lead, prevStatus, nextStatus);

    return NextResponse.json({ ok: true, matched: true, replied: r.sent });
  } catch (error) {
    console.error("inbound email failed:", error);
    return NextResponse.json({ ok: false, error: "Processing failed" }, { status: 500 });
  }
}
