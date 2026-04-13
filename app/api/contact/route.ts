import { NextResponse } from "next/server";
import { sendContactConfirmEmail, sendSupportEmail } from "../../../lib/email";

type ContactPayload = {
  email?: string;
  name?: string;
  subject?: string;
  message?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let payload: ContactPayload;

  try {
    payload = (await request.json()) as ContactPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = payload.email?.trim() ?? "";
  const name = payload.name?.trim() ?? "";
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
