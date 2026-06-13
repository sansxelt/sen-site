// Sends the agent's reply out to a lead by email. Best-effort: returns
// { sent: false } instead of throwing if email isn't configured or the
// sender domain isn't verified yet — the reply is still saved and shown
// in the pipeline; auto-send turns on once VRAELIS_FROM_EMAIL is a
// verified sender.

import { Resend } from "resend";

let resendClient: Resend | null = null;
function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

// ── Central sender config ────────────────────────────────────────────
// THE single source of truth for the From header on every transactional
// Vraelis email: booking confirmations, lead notifications/replies,
// payment confirmations, calendar emails, recovery emails, and automated
// follow-ups all resolve their sender here (via fromAddress()). To change
// the sender everywhere, edit this one constant (or set VRAELIS_FROM_EMAIL
// in the environment to override without a code change).
export const VRAELIS_FROM = "Vraelis <noreply@vraelis.com>";

// VRAELIS_FROM_EMAIL override accepts a bare address (gets the "Vraelis"
// display name) or a full "Name <addr>" header.
function fromAddress() {
  const configured = (process.env.VRAELIS_FROM_EMAIL ?? "").trim();
  if (configured) {
    return configured.includes("<") ? configured : `Vraelis <${configured}>`;
  }
  return VRAELIS_FROM;
}

// The per-workspace inbound reply address: reply+{intakeKey}@vraelis.com. When
// a lead replies to this, the recipient carries the workspace key, which is how
// the inbound route identifies the tenant (owner-scoped, never a global email
// match).
//
// STAGED — not yet wired into lead-facing sends. Lead emails currently set
// Reply-To to the OWNER's inbox; this becomes the Reply-To only once Cloudflare
// Email Routing is configured to catch reply+*@vraelis.com and POST to
// /api/vraelis/inbound/email (a ~15-min Worker setup). Kept here ready to flip
// in one change. Returns null on an empty key so a send never breaks.
export function inboundReplyTo(intakeKey: string | null | undefined): string | null {
  const key = (intakeKey ?? "").trim();
  if (!key) return null;
  return `reply+${key}@vraelis.com`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Booking confirmation to the lead + a heads-up to the owner.
export async function sendBookingConfirmation(opts: {
  businessName: string;
  slotLabel: string;
  leadEmail?: string | null;
  leadName?: string | null;
  ownerEmail: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  const from = fromAddress();
  if (!from) return;
  const who = opts.leadName ? ` ${opts.leadName}` : "";
  try {
    if (opts.leadEmail) {
      await resend.emails.send({
        from,
        to: opts.leadEmail,
        replyTo: opts.ownerEmail,
        subject: `You're booked with ${opts.businessName || "us"} — ${opts.slotLabel}`,
        text: `Hi${who}, you're booked for ${opts.slotLabel}. We're looking forward to it — reply here if you need to change anything.`,
      });
    }
    await resend.emails.send({
      from,
      to: opts.ownerEmail,
      subject: `New booking — ${opts.slotLabel}`,
      text: `${opts.leadName || opts.leadEmail || "A lead"} just booked ${opts.slotLabel}.${opts.leadEmail ? ` Email: ${opts.leadEmail}.` : ""}`,
    });
  } catch (error) {
    console.error("sendBookingConfirmation failed:", error);
  }
}

// Always-works owner notification (email, via the same verified Resend sender).
// Unlike the SMS owner alert, this fires without Twilio, so escalations and
// hot leads can never sit silently. Fire-and-forget: never throws into the
// caller (a lead handler must not 500 because an alert email failed), and
// dedupes nothing itself — callers fire it only on a genuine transition so the
// owner isn't spammed per message.
export async function sendOwnerAlert(opts: {
  ownerEmail: string;
  subject: string;
  body: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend || !opts.ownerEmail) return;
  const from = fromAddress();
  if (!from) return;
  try {
    await resend.emails.send({
      from,
      to: opts.ownerEmail,
      subject: opts.subject,
      text: opts.body,
    });
  } catch (error) {
    console.error("sendOwnerAlert failed:", error);
  }
}

export async function sendLeadReply(opts: {
  to: string;
  businessName: string;
  replyText: string;
  replyTo?: string | null;
}): Promise<{ sent: boolean; reason?: string }> {
  const resend = getResend();
  if (!resend) return { sent: false, reason: "email_not_configured" };

  const from = fromAddress();
  if (!from) return { sent: false, reason: "sender_not_configured" };
  if (!opts.to) return { sent: false, reason: "no_recipient" };

  const bodyHtml = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1b1a16;white-space:pre-wrap;">${escapeHtml(
    opts.replyText,
  )}</div>`;

  try {
    const result = await resend.emails.send({
      from,
      to: opts.to,
      replyTo: opts.replyTo || undefined,
      subject: `Re: your enquiry to ${opts.businessName || "us"}`,
      html: bodyHtml,
      text: opts.replyText,
    });
    if (result.error) {
      console.error("sendLeadReply rejected:", result.error);
      return { sent: false, reason: "rejected" };
    }
    return { sent: true };
  } catch (error) {
    console.error("sendLeadReply threw:", error);
    return { sent: false, reason: "threw" };
  }
}
