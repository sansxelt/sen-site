import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { sendContactConfirmEmail, sendSupportEmail } from "../../../lib/email";
import { checkRateLimit } from "../../../lib/rate-limit";

type ContactPayload = {
  email?: string;
  name?: string;
  subject?: string;
  message?: string;
  // honeypot — bots fill this, humans never see it
  website?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  // ── Rate limit: 5 submissions per IP per 10 minutes ──────────────────────
  const headersList = await headers();
  const ip =
    headersList.get("cf-connecting-ip") ??
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  if (!checkRateLimit(ip, 5, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a few minutes before trying again." },
      { status: 429 },
    );
  }

  let payload: ContactPayload;

  try {
    payload = (await request.json()) as ContactPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // ── Honeypot — if filled, silently drop (bot) ─────────────────────────────
  if (payload.website) {
    return NextResponse.json({ ok: true });
  }

  const email   = payload.email?.trim() ?? "";
  const name    = payload.name?.trim() ?? "";
  const subject = payload.subject?.trim() ?? "";
  const message = payload.message?.trim() ?? "";

  if (!emailPattern.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  if (!subject) {
    return NextResponse.json(
      { error: "Enter a subject." },
      { status: 400 },
    );
  }

  if (!message || message.length < 10) {
    return NextResponse.json(
      { error: "Enter a message (at least 10 characters)." },
      { status: 400 },
    );
  }

  try {
    await Promise.all([
      sendSupportEmail({ email, name, subject, message }),
      sendContactConfirmEmail(email, name, subject),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Contact form send failed:", error);

    return NextResponse.json(
      {
        error:
          "We couldn't send your message right now. Email us directly at help@sansxel.ai.",
      },
      { status: 400 },
    );
  }
}
