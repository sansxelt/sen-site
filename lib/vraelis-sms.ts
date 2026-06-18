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
import { getWorkspaceContact, getOrCreateWorkspace, isWorkspaceOnboarded, claimTwilioNumber, setWorkspaceContact } from "./vraelis-db";
import { isPaidPlan } from "./vraelis-plans";
import { APP_URL } from "./stripe";

export function isTwilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER,
  );
}

// Texting only counts as LIVE once A2P 10DLC registration is approved at the
// carrier. The Twilio creds being present is NOT enough — a number can be owned
// (voice works, inbound routes) while SMS is still carrier-blocked. Flip
// TWILIO_A2P_APPROVED=true in prod env the moment 10DLC clears; until then the
// UI shows assigned numbers as "reserved, texting pending" rather than ON.
export function isSmsLive(): boolean {
  return isTwilioConfigured() && process.env.TWILIO_A2P_APPROVED === "true";
}

// Provisioning needs the account creds (not the platform sender), so it's its
// own check — we can buy + own a number for a workspace even before the
// platform default sender is set.
function hasTwilioAccount(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

function twilioAuthHeader(): string {
  const sid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
  const token = (process.env.TWILIO_AUTH_TOKEN || "").trim();
  return "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
}

// Buy + configure ONE dedicated US number for a workspace and save it as the
// agent's twilio_number. Fully idempotent and cost-safe:
//   - returns the existing number if the workspace already has one (NEVER buys
//     a second),
//   - no-ops (returns null) if Twilio account creds aren't configured,
//   - only the CALLER decides who's eligible (paid + onboarded) — this function
//     just does the purchase when asked.
// Voice works immediately on the new number; SMS stays gated by A2P approval at
// the carrier level (the number is "reserved" until 10DLC clears), so no code
// here changes that — we just own the line and wire the webhooks.
// fetch with a hard timeout so a slow/hanging Twilio API can never block an
// onboarding redirect or a payment webhook. AbortController kills it at 6s.
async function twFetch(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// Release a number back to Twilio. Used both to roll back a purchase we couldn't
// persist (so a failed save never leaks a paid number) and to reap the agent
// number when a plan lapses. Returns true ONLY when the number is confirmed gone
// from the account (DELETE 204, already-404, or not owned by us) — false on any
// unconfirmed/failed release, so callers never clear the DB ahead of a real
// Twilio release (which would desync and keep the line billing silently).
async function releaseNumber(sid: string, e164: string, email: string): Promise<boolean> {
  try {
    // Look up the number's SID, then DELETE it.
    const listRes = await twFetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(e164)}`,
      { headers: { Authorization: twilioAuthHeader() } },
    );
    if (!listRes.ok) {
      // Couldn't even confirm ownership — don't claim success (caller retries).
      captureError("twilio-provision", new Error(`release list ${listRes.status}`), { email, number: e164 });
      return false;
    }
    const numSid = ((await listRes.json()) as { incoming_phone_numbers?: { sid?: string }[] })
      .incoming_phone_numbers?.[0]?.sid;
    if (!numSid) {
      // Number isn't owned by this account (already released / never ours) →
      // nothing to bill, safe to treat as released.
      return true;
    }
    const delRes = await twFetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers/${numSid}.json`, {
      method: "DELETE",
      headers: { Authorization: twilioAuthHeader() },
    });
    // Twilio returns 204 on success; 404 means it's already gone. Anything else
    // means the number is still owned + charged — a real (visible) leak.
    if (delRes.ok || delRes.status === 404) return true;
    captureError("twilio-provision", new Error(`release DELETE ${delRes.status}`), { email, number: e164, numSid });
    return false;
  } catch (err) {
    // Couldn't release — log loudly so it can be freed by hand (cost leak).
    captureError("twilio-provision", err, { email, number: e164, stage: "release_failed" });
    return false;
  }
}

// Reap a workspace's assigned agent number when its plan lapses (canceled, or
// past_due beyond grace) or its account is deleted. Looks up the saved number,
// releases it at Twilio, and clears the DB column ONLY after a confirmed
// release. Idempotent + self-catching; safe to fire-and-forget. Eligibility
// (is this plan actually lapsed?) is the CALLER's decision — this just executes.
export async function releaseAgentNumber(email: string): Promise<boolean> {
  try {
    if (!email || !hasTwilioAccount()) return false;
    const contact = await getWorkspaceContact(email);
    const number = contact?.twilio_number;
    if (!number) return false; // nothing assigned → nothing to release
    const sid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
    const released = await releaseNumber(sid, number, email);
    if (released) {
      // Clear the column only AFTER a confirmed release, so a failed release
      // never leaves the DB saying "no number" while Twilio keeps billing it.
      await setWorkspaceContact(email, { twilioNumber: null });
    }
    return released;
  } catch (e) {
    captureError("twilio-provision", e, { email, stage: "release_agent" });
    return false;
  }
}

export async function provisionAgentNumber(
  email: string,
): Promise<{ ok: boolean; number: string | null; reason?: string }> {
  if (!email) return { ok: false, number: null, reason: "no_email" };
  if (!hasTwilioAccount()) return { ok: false, number: null, reason: "twilio_not_configured" };

  // Idempotency gate #1 (DB): already saved a number → never buy again.
  const contact = await getWorkspaceContact(email);
  if (contact?.twilio_number) return { ok: true, number: contact.twilio_number };

  const sid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
  const secret = (process.env.TWILIO_INBOUND_SECRET || "").trim();
  const secretQ = secret ? `?secret=${encodeURIComponent(secret)}` : "";
  const smsUrl = `${APP_URL}/api/vraelis/sms/inbound${secretQ}`;
  const voiceUrl = `${APP_URL}/api/vraelis/sms/voice${secretQ}`;
  const friendlyName = `Vraelis agent — ${email}`;

  // Atomically claim a bought number for this workspace. claimTwilioNumber only
  // writes if no number is set yet (CAS on twilio_number IS NULL), so two
  // concurrent provision calls can't both win:
  //   - "won":  we set it → keep this number.
  //   - "lost": another number is already set (a concurrent call won, or a
  //             prior save did) → release OUR number and return the winner.
  //   - "error": the write couldn't be confirmed → DON'T release (the number
  //             may actually be live; gate #2 reconciles on the next attempt).
  async function claimOrRelease(number: string): Promise<{ ok: boolean; number: string | null; reason?: string }> {
    const result = await claimTwilioNumber(email, number);
    if (result === "won") return { ok: true, number };
    if (result === "lost") {
      await releaseNumber(sid, number, email); // a different number already won
      const winner = await getWorkspaceContact(email);
      return { ok: true, number: winner?.twilio_number ?? null };
    }
    // "error" — leave the number owned (FriendlyName-tagged); gate #2 recovers.
    captureError("twilio-provision", new Error("claim write unconfirmed — leaving owned for gate #2"), { email, number });
    return { ok: false, number: null, reason: "save_unconfirmed" };
  }

  try {
    // Idempotency gate #2 (Twilio is the source of truth): if a prior attempt
    // already BOUGHT a number for this workspace but failed to save it, find it
    // by FriendlyName and reuse it instead of buying a second one.
    const ownedRes = await twFetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json?FriendlyName=${encodeURIComponent(friendlyName)}`,
      { headers: { Authorization: twilioAuthHeader() } },
    );
    if (ownedRes.ok) {
      const owned = (await ownedRes.json()) as { incoming_phone_numbers?: { phone_number?: string }[] };
      const existing = owned.incoming_phone_numbers?.[0]?.phone_number;
      if (existing) return await claimOrRelease(existing);
    }

    // 1) Find an available US local number that does SMS + voice.
    const availRes = await twFetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/AvailablePhoneNumbers/US/Local.json?SmsEnabled=true&VoiceEnabled=true&Limit=1`,
      { headers: { Authorization: twilioAuthHeader() } },
    );
    if (!availRes.ok) {
      captureError("twilio-provision", new Error(`avail ${availRes.status}`), { email, detail: (await availRes.text()).slice(0, 200) });
      return { ok: false, number: null, reason: "no_available_number" };
    }
    const avail = (await availRes.json()) as { available_phone_numbers?: { phone_number?: string }[] };
    const candidate = avail.available_phone_numbers?.[0]?.phone_number;
    if (!candidate) return { ok: false, number: null, reason: "no_available_number" };

    // 2) Purchase it + point its SMS/voice webhooks at our routes. FriendlyName
    //    tags it to this workspace so gate #2 above can recover it on retry.
    const buyRes = await twFetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json`,
      {
        method: "POST",
        headers: { Authorization: twilioAuthHeader(), "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          PhoneNumber: candidate,
          FriendlyName: friendlyName,
          SmsUrl: smsUrl,
          SmsMethod: "POST",
          VoiceUrl: voiceUrl,
          VoiceMethod: "POST",
        }),
      },
    );
    if (!buyRes.ok) {
      captureError("twilio-provision", new Error(`buy ${buyRes.status}`), { email, candidate, detail: (await buyRes.text()).slice(0, 200) });
      return { ok: false, number: null, reason: "purchase_failed" };
    }
    const bought = (await buyRes.json()) as { phone_number?: string };
    // Only trust the number Twilio confirms it sold us — never fall back to the
    // candidate (saving an unowned number would silently break SMS later).
    const number = bought.phone_number;
    if (!number) {
      captureError("twilio-provision", new Error("buy: response missing phone_number"), { email, candidate });
      return { ok: false, number: null, reason: "purchase_unconfirmed" };
    }

    // 3) Atomically claim it. The CAS handles the concurrent-buy race: if a
    //    parallel call already claimed a different number, this releases ours.
    return await claimOrRelease(number);
  } catch (e) {
    captureError("twilio-provision", e, { email });
    return { ok: false, number: null, reason: "exception" };
  }
}

// Eligibility-gated provisioning. Assigns an agent number ONLY when the
// workspace is (a) on a PAID, active plan, (b) finished onboarding, and (c)
// doesn't already have a number. Safe to call from multiple triggers (plan
// activation webhook, onboarding completion) and orderings — it's idempotent
// and never buys for free or unfinished accounts. Fire-and-forget friendly.
export async function maybeProvisionAgentNumber(email: string): Promise<void> {
  try {
    if (!email || !hasTwilioAccount()) return;
    const ws = await getOrCreateWorkspace(email);
    if (!ws) return;
    if (!isPaidPlan(ws.plan, ws.plan_status)) return; // free tier → no number
    if (!(await isWorkspaceOnboarded(email))) return; // wait until set up
    await provisionAgentNumber(email); // idempotent: no-ops if already assigned
  } catch (e) {
    captureError("twilio-provision", e, { email, stage: "maybe" });
  }
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
