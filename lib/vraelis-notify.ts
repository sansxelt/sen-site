// Owner notifications — the single place the three lead events route through:
//   1. a new lead arrives
//   2. the agent escalates (needs_owner) and wants a human
//   3. a lead goes high-intent / close to payment (booking_ready)
//
// Always sends an EMAIL (verified Resend sender, works without Twilio), so a
// hot lead or an escalation can never sit silently. SMS is sent too when the
// owner has Twilio configured, as a bonus — never required. Fire-and-forget:
// these helpers never throw into a lead handler (a notification failure must
// not 500 the conversation).

import { sendOwnerAlert } from "./vraelis-email";
import { notifyOwnerNewLead } from "./vraelis-sms";

const ORIGIN = "https://vraelis.com";

function leadLabel(lead: { name?: string | null; contact_email?: string | null; contact_phone?: string | null }): string {
  return lead.name || lead.contact_email || lead.contact_phone || "A new lead";
}

function leadUrl(leadId: string): string {
  return `${ORIGIN}/v/account/leads/${leadId}`;
}

const ACCOUNT_URL = `${ORIGIN}/v/account`;

// The owner's own subscription lapsed. Fired ONCE on a real status transition
// (callers gate on setWorkspacePlan's statusChanged). past_due → nudge to fix
// the card before features pause; canceled → plan ended, reactivate to restore
// text/voice + payments. Fail-soft like the other notify helpers.
export async function notifyOwnerPlanLapse(
  ownerEmail: string,
  status: "past_due" | "canceled",
): Promise<void> {
  try {
    if (status === "past_due") {
      await sendOwnerAlert({
        ownerEmail,
        subject: "Action needed: your Vraelis payment didn't go through",
        body: `A renewal payment for your Vraelis plan failed.\n\nYour agent keeps working for a few days, but text & voice will pause if it isn't fixed. Update your card here:\n${ACCOUNT_URL}`,
      });
    } else {
      await sendOwnerAlert({
        ownerEmail,
        subject: "Your Vraelis plan has ended",
        body: `Your Vraelis plan has ended. Your agent still captures leads over chat, email, and the web — but text/voice and your agent number are paused.\n\nReactivate anytime to turn them back on:\n${ACCOUNT_URL}`,
      });
    }
  } catch {
    /* notifications must never throw into a webhook / cron */
  }
}

// A new lead arrived on any channel. Email always; SMS when configured (the
// existing notifyOwnerNewLead is SMS-only and no-ops without Twilio, so we
// keep it for the text and add the reliable email here).
export async function notifyOwnerNewLeadEvent(
  ownerEmail: string,
  lead: { id: string; name?: string | null; contact_email?: string | null; contact_phone?: string | null; message?: string | null },
): Promise<void> {
  const who = leadLabel(lead);
  const snippet = lead.message ? `\n\n"${lead.message.slice(0, 200)}"` : "";
  await sendOwnerAlert({
    ownerEmail,
    subject: `New lead: ${who}`,
    body: `Your agent just picked up a new lead — ${who}.${snippet}\n\nYour agent is already replying. See the conversation:\n${leadUrl(lead.id)}`,
  });
  // Bonus SMS (no-op unless Twilio + owner phone are set).
  await notifyOwnerNewLead(ownerEmail, {
    name: lead.name ?? undefined,
    phone: lead.contact_phone ?? undefined,
    email: lead.contact_email ?? undefined,
    message: lead.message ?? undefined,
  });
}

// A lead's status just transitioned to needs_owner (the agent escalated) or
// booking_ready (high intent / close to payment). Callers pass prev + next and
// only fire on a genuine change, so the owner isn't pinged per message.
export async function notifyOwnerStatusEvent(
  ownerEmail: string,
  lead: { id: string; name?: string | null; contact_email?: string | null; contact_phone?: string | null },
  prevStatus: string,
  nextStatus: string,
): Promise<void> {
  if (nextStatus === prevStatus) return;
  const who = leadLabel(lead);

  if (nextStatus === "needs_owner") {
    await sendOwnerAlert({
      ownerEmail,
      subject: `Your agent needs you: ${who}`,
      body: `Your agent flagged ${who} for you — it hit something it couldn't handle on its own and is waiting on you.\n\nOpen the conversation and take over:\n${leadUrl(lead.id)}`,
    });
    return;
  }

  if (nextStatus === "booking_ready") {
    await sendOwnerAlert({
      ownerEmail,
      subject: `Hot lead — ready to move: ${who}`,
      body: `${who} is ready to book or pay. Your agent is handling it, but this is your warmest lead right now.\n\nSee the conversation:\n${leadUrl(lead.id)}`,
    });
    return;
  }
}
