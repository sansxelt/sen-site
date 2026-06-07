// Public lead intake endpoint. A website form, embedded snippet, or
// webhook (Zapier etc.) POSTs a lead here with the workspace's intake
// key. We store the lead + their message, have Claude draft an instant
// reply, save it, and try to email it out. Returns the reply so a hosted
// form can show "we already replied".
//
//   POST /api/vraelis/intake
//   body: { key, name?, email?, phone?, message, source? }

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  addMessage,
  createLead,
  getWorkspaceByIntakeKey,
  touchLeadStatus,
} from "@/lib/vraelis-db";
import { generateLeadReply } from "@/lib/vraelis-ai";
import { sendLeadReply } from "@/lib/vraelis-email";
import { notifyOwnerNewLead } from "@/lib/vraelis-sms";
import { limitOr429 } from "@/lib/vraelis-ratelimit";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-vraelis-key",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  // Rate limit: 20 new leads / 10 min per IP.
  const limited = await limitOr429(req, "intake", 20, 600, CORS);
  if (limited) return limited;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400, headers: CORS });
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const key =
    str(body.key) ||
    (req.headers.get("x-vraelis-key") ?? "").trim() ||
    (req.nextUrl.searchParams.get("key") ?? "").trim();
  const name = str(body.name);
  const email = str(body.email);
  const phone = str(body.phone);
  const message = str(body.message) || str(body.note) || str(body.enquiry);
  const source = str(body.source) || "form";

  if (!key) {
    return NextResponse.json({ ok: false, error: "Missing intake key" }, { status: 401, headers: CORS });
  }
  if (!message && !email && !phone && !name) {
    return NextResponse.json({ ok: false, error: "Empty lead" }, { status: 400, headers: CORS });
  }

  const workspace = await getWorkspaceByIntakeKey(key);
  if (!workspace) {
    return NextResponse.json({ ok: false, error: "Invalid intake key" }, { status: 401, headers: CORS });
  }

  try {
    const lead = await createLead({
      ownerEmail: workspace.owner_email,
      name,
      contactEmail: email,
      contactPhone: phone,
      source,
      snippet: message,
    });

    if (message) {
      await addMessage({ leadId: lead.id, role: "lead", body: message, channel: source });
    }

    // Draft + persist the instant AI reply.
    const replyText = await generateLeadReply({
      businessName: workspace.business_name ?? "",
      businessDescription: workspace.business_description ?? "",
      leadName: name,
      leadMessage: message || "(no message — just contact details)",
    });

    let delivered = false;
    if (email) {
      const result = await sendLeadReply({
        to: email,
        businessName: workspace.business_name ?? "Vraelis",
        replyText,
        // When the lead replies, route it to the business owner's inbox
        // so they can take the conversation over from their own email.
        replyTo: workspace.owner_email,
      });
      delivered = result.sent;
    }

    await addMessage({
      leadId: lead.id,
      role: "agent",
      body: replyText,
      channel: delivered ? "email" : "draft",
      delivered,
    });
    await touchLeadStatus(lead.id, "contacted");

    // Text the owner that a new lead landed (fail-soft, no-op if SMS unset).
    await notifyOwnerNewLead(workspace.owner_email, { name, phone, email, message });

    return NextResponse.json(
      { ok: true, leadId: lead.id, reply: replyText, delivered },
      { status: 200, headers: CORS },
    );
  } catch (error) {
    console.error("intake failed:", error);
    return NextResponse.json(
      { ok: false, error: "Could not process lead" },
      { status: 500, headers: CORS },
    );
  }
}
