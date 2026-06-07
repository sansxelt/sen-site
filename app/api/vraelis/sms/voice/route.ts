// Twilio voice webhook — missed-call text-back. When someone calls the
// business's Twilio number, we try to connect the owner; if they don't
// answer (or no owner phone is set), we text the caller so the lead isn't
// lost, and create an SMS lead the AI can then handle.
//
// Configure in Twilio: a Number → "A call comes in" →
//   POST https://vraelis.com/api/vraelis/sms/voice?secret=<TWILIO_INBOUND_SECRET>

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  addMessage,
  createLead,
  findLeadByContactPhone,
  getWorkspaceByTwilioNumber,
  getWorkspaceContact,
} from "@/lib/vraelis-db";
import { sendSms, normalizePhone, notifyOwnerNewLead } from "@/lib/vraelis-sms";
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
  if (!existing) {
    await createLead({
      ownerEmail: workspace.owner_email,
      contactPhone: callerNumber,
      source: "missed_call",
      snippet: "Missed call",
    });
    await notifyOwnerNewLead(workspace.owner_email, { phone: callerNumber, message: "Missed call" });
  }
  const leadId = existing?.id;
  const body = "Sorry we missed your call! Reply here and we'll help you right away.";
  await sendSms(callerNumber, body, workspace.twilio_number ?? undefined);
  if (leadId) await addMessage({ leadId, role: "agent", body, channel: "sms", delivered: true });
}

export async function POST(req: NextRequest) {
  const secret = (process.env.TWILIO_INBOUND_SECRET || "").trim();
  const secretQ = secret ? `&secret=${secret}` : "";
  if (secret && req.nextUrl.searchParams.get("secret") !== secret) {
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
