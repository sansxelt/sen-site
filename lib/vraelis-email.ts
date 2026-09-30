// Sends the agent's reply out to a lead by email. Best-effort: returns
// { sent: false } instead of throwing if email isn't configured or the
// sender domain isn't verified yet — the reply is still saved and shown
// in the pipeline; auto-send turns on once VRAELIS_FROM_EMAIL is a
// verified sender.

import { Resend } from "resend";
// The same shell as every other Vraelis email (lib/email/shell.ts), so an owner alert and a billing receipt
// look like they came from the same company.
import { shell, h1, p, button, status, quote, escapeHtml, type StatusTone } from "./email/shell";

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

// ── Owner notices ────────────────────────────────────────────────────
// An alert to the workspace owner, written once as structure and rendered twice: a plain-text part (what
// these always sent) and an HTML part in the shared shell. Every string here is plain text; the HTML
// renderer escapes it, so a lead's name or message can never become markup in the owner's inbox.
export type OwnerNotice = {
  subject: string;
  /** The headline. */
  heading: string;
  /** Hidden inbox preview line. */
  preheader: string;
  /** A one-line state, shown as a status row (HTML) or the first line (text). */
  status?: { tone: StatusTone; text: string } | null;
  paragraphs: string[];
  /** Someone else's words (a lead's message), shown quoted after the first paragraph. */
  quote?: string | null;
  action?: { label: string; url: string } | null;
};

export function ownerNoticeText(n: OwnerNotice): string {
  const parts: string[] = [];
  if (n.status) parts.push(n.status.text);
  n.paragraphs.forEach((t, i) => {
    parts.push(t);
    if (i === 0 && n.quote) parts.push(`"${n.quote}"`);
  });
  if (n.paragraphs.length === 0 && n.quote) parts.push(`"${n.quote}"`);
  if (n.action) parts.push(`${n.action.label}:\n${n.action.url}`);
  return parts.join("\n\n");
}

export function ownerNoticeHtml(n: OwnerNotice): string {
  const body = n.paragraphs.map((t, i) => p(escapeHtml(t)) + (i === 0 && n.quote ? quote(n.quote) : "")).join("");
  return shell(`
    ${h1(escapeHtml(n.heading))}
    ${n.status ? status(n.status.tone, escapeHtml(n.status.text)) : ""}
    ${body}${n.paragraphs.length === 0 && n.quote ? quote(n.quote) : ""}
    ${n.action ? button(n.action.url, escapeHtml(n.action.label)) : ""}
  `, { preheader: n.preheader });
}

/** Sends an OwnerNotice as a multipart email. Fire-and-forget like sendOwnerAlert. */
export async function sendOwnerNotice(ownerEmail: string, n: OwnerNotice): Promise<void> {
  await sendOwnerAlert({ ownerEmail, subject: n.subject, body: ownerNoticeText(n), html: ownerNoticeHtml(n) });
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
    // The lead's copy is a plain note in the business's voice, not a Vraelis-branded email: the lead booked
    // with the business, and replies go to the owner.
    if (opts.leadEmail) {
      await resend.emails.send({
        from,
        to: opts.leadEmail,
        replyTo: opts.ownerEmail,
        subject: `You're booked with ${opts.businessName || "us"}: ${opts.slotLabel}`,
        text: `Hi${who}, you're booked for ${opts.slotLabel}. We're looking forward to it. Reply here if you need to change anything.`,
      });
    }
    const booked: OwnerNotice = {
      subject: `New booking: ${opts.slotLabel}`,
      heading: `New booking: ${opts.slotLabel}`,
      preheader: `${opts.leadName || opts.leadEmail || "A lead"} just booked ${opts.slotLabel}.`,
      paragraphs: [
        `${opts.leadName || opts.leadEmail || "A lead"} just booked ${opts.slotLabel}.`,
        ...(opts.leadEmail ? [`Email: ${opts.leadEmail}`] : []),
      ],
    };
    await resend.emails.send({
      from,
      to: opts.ownerEmail,
      subject: booked.subject,
      text: ownerNoticeText(booked),
      html: ownerNoticeHtml(booked),
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
  /** Optional HTML part. The plain-text body is always sent alongside it. */
  html?: string;
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
      ...(opts.html ? { html: opts.html } : {}),
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

  // A plain letter in the business's voice, deliberately without the Vraelis shell: it is the business
  // answering its own lead. Only the type follows the shared stack.
  const bodyHtml = `<div style="font-family:'IBM Plex Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#3F3F46;white-space:pre-wrap;">${escapeHtml(
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
