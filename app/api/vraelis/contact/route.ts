// Contact / sales form submissions. Stores the inquiry in Supabase
// (so nothing is lost) and best-effort emails sales@vraelis.com.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Resend } from "resend";
import { createContact } from "@/lib/vraelis-db";

const SALES_INBOX = "sales@vraelis.com";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const name = str(body.name);
  const email = str(body.email);
  const company = str(body.company);
  const message = str(body.message);
  const topic = str(body.topic) || "sales";

  if (!email || !message) {
    return NextResponse.json({ ok: false, error: "Email and message required" }, { status: 400 });
  }

  // Persist first — this must not depend on email being configured.
  try {
    await createContact({ name, email, company, message, topic });
  } catch (error) {
    console.error("createContact failed:", error);
  }

  // Best-effort notify sales. vraelis.com is verified in Resend.
  const from = (process.env.VRAELIS_FROM_EMAIL ?? "").trim() || "hello@vraelis.com";
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const fromHeader = from.includes("<") ? from : `Vraelis <${from}>`;
      await resend.emails.send({
        from: fromHeader,
        to: SALES_INBOX,
        replyTo: email,
        subject: `New ${topic} enquiry${company ? ` — ${company}` : ""}`,
        text: `Name: ${name || "—"}\nEmail: ${email}\nCompany: ${company || "—"}\nTopic: ${topic}\n\n${message}`,
      });
      // Confirmation back to the person who reached out.
      await resend.emails.send({
        from: fromHeader,
        to: email,
        replyTo: SALES_INBOX,
        subject: "We got your message — Vraelis",
        text: `Hi${name ? ` ${name}` : ""},\n\nThanks for reaching out to Vraelis — we've got your message and someone from our team will reply to this email shortly.\n\nIn the meantime, you can reply here with anything else you'd like us to know.\n\n— The Vraelis team`,
      });
    } catch (error) {
      console.error("contact email failed:", error);
    }
  }

  return NextResponse.json({ ok: true });
}
