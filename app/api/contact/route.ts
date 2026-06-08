import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  resolveSupportInbox,
  sendContactConfirmEmail,
  sendSupportEmail,
} from "../../../lib/email";
import { checkRateLimit } from "../../../lib/rate-limit";

type ContactPayload = {
  email?: string;
  name?: string;
  subject?: string;
  message?: string;
  /** Target inbox, help@, sales@, or privacy@vraelis.com.  Validated server-side. */
  to?: string;
  /** Human-readable channel ("General support", "Teams / sales", etc.).  Surfaced inside the email body. */
  channel?: string;
  // honeypot, bots fill this, humans never see it
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

  // ── Honeypot, if filled, silently drop (bot) ─────────────────────────────
  if (payload.website) {
    return NextResponse.json({ ok: true });
  }

  const email   = payload.email?.trim().toLowerCase() ?? "";
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

  // Validate + normalize the destination inbox (help@/sales@/privacy@ only).
  const to = resolveSupportInbox(payload.to);
  // Channel label, free-form from the client, we just strip to 64 chars.
  const channel = (payload.channel ?? "").trim().slice(0, 64) || null;

  try {
    // sendSupportEmail is the one that actually ships to the routed inbox;
    // we await it and surface real failures.  The confirmation email to
    // the user is best-effort, if it fails (e.g. their inbox bounces),
    // we don't want to lose the actual support request.
    await sendSupportEmail({ email, name, subject, message, to, channel });
    try { await sendContactConfirmEmail(email, name, subject, to); }
    catch (err) { console.warn("Contact confirmation email failed:", err); }

    return NextResponse.json({ ok: true, to });
  } catch (error) {
    console.error("Contact form send failed:", error);
    const detail = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        error:
          `We couldn't send your message. ${detail}. If this keeps happening, email us directly at help@vraelis.com.`,
      },
      { status: 502 },
    );
  }
}
