// Twilio SMS — dependency-free (Twilio REST API over fetch). All sends are
// fail-soft: if Twilio isn't configured or a send fails, nothing throws.
//
// Env:
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_PHONE_NUMBER   (the platform default sender, E.164 e.g. +15551234567)
//
// Architecture:
//   - Each workspace can store its own `twilio_number`; inbound SMS/voice to
//     that number is routed to that workspace (see /api/vraelis/sms/*).
//   - Outbound sends use the workspace number when set, else the platform
//     default TWILIO_PHONE_NUMBER.
//   - SMS conversations reuse the SAME lead + messages + AI qualification as
//     chat/email (channel = "sms").

import { captureError } from "./vraelis-monitor";
import { getWorkspaceContact } from "./vraelis-db";

export function isTwilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER,
  );
}

export function normalizePhone(p: string): string {
  const t = p.trim();
  if (t.startsWith("+")) return t.replace(/[^\d+]/g, "");
  const digits = t.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`; // default to US
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits ? `+${digits}` : "";
}

// Low-level send via Twilio REST. Returns true on success.
export async function sendSms(to: string, body: string, from?: string): Promise<boolean> {
  if (!isTwilioConfigured()) return false;
  const sid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
  const token = (process.env.TWILIO_AUTH_TOKEN || "").trim();
  const sender = (from || process.env.TWILIO_PHONE_NUMBER || "").trim();
  const dest = normalizePhone(to);
  if (!dest || !sender) return false;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: dest, From: sender, Body: body.slice(0, 1500) }),
    });
    if (!res.ok) {
      captureError("twilio", new Error(`SMS send ${res.status}`), { to: dest, detail: (await res.text()).slice(0, 200) });
      return false;
    }
    return true;
  } catch (e) {
    captureError("twilio", e, { to: dest });
    return false;
  }
}

// Text the business owner that a new lead came in.
export async function notifyOwnerNewLead(
  ownerEmail: string,
  lead: { name?: string; phone?: string; email?: string; message?: string },
): Promise<void> {
  if (!isTwilioConfigured()) return;
  try {
    const contact = await getWorkspaceContact(ownerEmail);
    if (!contact?.owner_phone) return;
    const who = lead.name || lead.phone || lead.email || "Someone";
    const msg = lead.message ? ` — "${lead.message.slice(0, 90)}"` : "";
    await sendSms(contact.owner_phone, `New Vraelis lead: ${who}${msg}. Vraelis is replying now.`, contact.twilio_number ?? undefined);
  } catch (e) {
    captureError("twilio", e, { ownerEmail });
  }
}
