// Twilio voice webhook — missed-call text-back. When someone calls the
// business's Twilio number, we try to connect the owner; if they don't
// answer (or no owner phone is set), we text the caller so the lead isn't
// lost, and create an SMS lead the AI can then handle.
//
// Configure in Twilio: a Number → "A call comes in" →
//   POST https://vraelis.com/api/vraelis/sms/voice?secret=<TWILIO_INBOUND_SECRET>

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { limitOr429 } from "@/lib/vraelis-ratelimit";
import type { NextRequest } from "next/server";
import {
  addMessage,
  createLead,
  findLeadByContactPhone,
  getWorkspaceByTwilioNumber,
  getWorkspaceContact,
} from "@/lib/vraelis-db";
import { sendSms, normalizePhone } from "@/lib/vraelis-sms";
import { notifyOwnerNewLeadEvent } from "@/lib/vraelis-notify";
import { captureError } from "@/lib/vraelis-monitor";

const ORIGIN = "https://vraelis.com";
const twiml = (inner: string) =>
  new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));

async function textBack(toNumber: string, callerNumber: string) {
  const workspace = await getWorkspaceByTwilioNumber(toNumber);
  if (!workspace) return;
  const existing = await findLeadByContactPhone(workspace.owner_email, callerNumber);
  let newLeadId: string | undefined;
  if (!existing) {
    const created = await createLead({
      ownerEmail: workspace.owner_email,
      contactPhone: callerNumber,
      source: "missed_call",
      snippet: "Missed call",
    });
    newLeadId = created.id;
    await notifyOwnerNewLeadEvent(workspace.owner_email, { id: created.id, contact_phone: callerNumber, message: "Missed call" });
  }
  const leadId = existing?.id ?? newLeadId;
  const body = "Sorry we missed your call! Reply here and we'll help you right away.";
  await sendSms(callerNumber, body, workspace.twilio_number ?? undefined);
  if (leadId) await addMessage({ leadId, role: "agent", body, channel: "sms", delivered: true });
}


// Constant-time compare so the shared secret cannot be recovered a character at a time.
function timingSafeStrEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

export async function POST(req: NextRequest) {
  // FAIL CLOSED. This used to read `if (secret && ...)`, so an unset TWILIO_INBOUND_SECRET skipped the
  // check entirely and left the voice webhook open to the internet. An absent secret now means the
  // endpoint is CLOSED, the same convention the cron routes already use.
  // Rate limited as well as secret-gated: the secret travels in a query string (so it reaches logs and
  // Referer headers), and every accepted request can drive an outbound Twilio call leg plus an SMS.
  const limited = await limitOr429(req, "sms-voice", 60, 600);
  if (limited) return limited;

  const secret = (process.env.TWILIO_INBOUND_SECRET || "").trim();
  const secretQ = secret ? `&secret=${secret}` : "";
  const provided = req.nextUrl.searchParams.get("secret") ?? "";
  if (!secret || !timingSafeStrEqual(provided, secret)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  let from = "";
  let to = "";
  let dialStatus = "";
  try {
    const form = await req.formData();
    from = normalizePhone(String(form.get("From") ?? ""));
    to = normalizePhone(String(form.get("To") ?? ""));
    dialStatus = String(form.get("DialCallStatus") ?? "");
  } catch {
    return twiml("");
  }

  const stage = req.nextUrl.searchParams.get("stage");
  try {
    // Stage 2: the owner-dial finished. If it wasn't answered, text the caller.
    if (stage === "missed") {
      if (dialStatus !== "completed" && from && to) await textBack(to, from);
      return twiml("");
    }

    // Stage 1: incoming call. Try the owner first if we have their number.
    const workspace = to ? await getWorkspaceByTwilioNumber(to) : null;
    const contact = workspace ? await getWorkspaceContact(workspace.owner_email) : null;
    if (contact?.owner_phone) {
      const action = `${ORIGIN}/api/vraelis/sms/voice?stage=missed${secretQ}`;
      return twiml(
        `<Dial timeout="18" action="${action}" method="POST"><Number>${esc(normalizePhone(contact.owner_phone))}</Number></Dial>`,
      );
    }
    // No owner number — text back immediately.
    if (from && to) await textBack(to, from);
    return twiml(`<Say voice="Polly.Joanna-Neural">Thanks for calling! We're sending you a text right now so we can help you out. Talk soon.</Say>`);
  } catch (e) {
    captureError("sms-voice", e);
    return twiml("");
  }
}
