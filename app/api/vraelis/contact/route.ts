// Contact / sales form submissions. Stores the inquiry in Supabase
// (so nothing is lost) and best-effort emails sales@vraelis.com.
//
// SECURITY (finding H4): this route was an unauthenticated open email relay. It had no rate limit, no
// honeypot and no real validation, and it sent TWO Resend messages per request — one to the fixed sales
// inbox and one acknowledgement to an address the CALLER named, from a vraelis.com verified sender. That
// is both an inbox-bombing primitive aimed at third parties and an uncapped spend vector.
//
// The controls now applied, in order: honeypot, per-IP rate limit, strict schema validation, then a
// SECOND per-recipient limit before the acknowledgement (rotating source IPs must not be able to re-bomb
// one mailbox). Every value that reaches a header — subject, replyTo — is stripped of CR/LF so nothing the
// caller sends can inject a header or add a recipient. The sender, the sales recipient and both templates
// are server constants.
//
// Note the limiter choice: this uses lib/vraelis-ratelimit (Postgres-backed, shared across serverless
// instances), NOT lib/rate-limit, whose in-memory Map resets on every cold start and is per-instance.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Resend } from "resend";
import { createContact } from "@/lib/vraelis-db";
import { allowStrict, limitOr429 } from "@/lib/vraelis-ratelimit";
import { canonicalizeEmail } from "@/lib/user-credentials";

const SALES_INBOX = "sales@vraelis.com";

// Deliberately strict: printable ASCII only, one @, a dot in the domain, and none of , ; < > ( ) [ ] \ "
// — comma and semicolon separate recipients for some mail APIs, and the rest are RFC5322 address
// delimiters, so "a@b.com>" or a quoted local part could smuggle a second recipient.
//
// The character CLASS matters as much as the delimiters: an earlier form excluded only \s, which let NUL,
// C0 controls and U+0085 (NEL) through into replyTo and the acknowledgement recipient. \x21-\x7e is the
// printable-ASCII range, so every control character is rejected by construction rather than stripped
// later. This is stricter than RFC5322 permits (no internationalised addresses); that is the intended
// trade for an unauthenticated endpoint that hands the value to a mail API.
const EMAIL_RE = /^[\x21-\x7e]{1,64}@[\x21-\x7e]{1,190}$/;
// Second gate: structure and the delimiter blocklist, applied to the same value.
const EMAIL_SHAPE = /^[^\s@,;<>()[\]\\"]+@[^\s@,;<>()[\]\\"]+\.[^\s@,;<>()[\]\\"]+$/;
const validEmail = (v: string) => EMAIL_RE.test(v) && EMAIL_SHAPE.test(v);
const TOPICS = ["sales", "support", "partnership", "press", "other"] as const;

// Strip anything that could break out of a header value or a single-line field.
const oneLine = (v: string, max: number) =>
  v.replace(/[\r\n\u2028\u2029\0]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  // Per-IP limit before any DB write or mail send.
  const limited = await limitOr429(req, "vcontact", 3, 600);
  if (limited) return limited;

  // Honeypot: bots fill it, humans never see it. Evaluated here but ACTED ON only after validation, so a
  // tripped honeypot cannot be told apart from a clean submission. Returning early used to answer 200 for
  // a payload that would otherwise 400 or 429, which made it a free oracle for probing the other rules.
  const honeypotTripped = typeof body.website === "string" && body.website.trim() !== "";

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const name = oneLine(str(body.name), 100);
  const email = str(body.email).toLowerCase().slice(0, 254);
  const company = oneLine(str(body.company), 120);
  const message = str(body.message).slice(0, 5000);
  const rawTopic = str(body.topic).toLowerCase();
  const topic = (TOPICS as readonly string[]).includes(rawTopic) ? rawTopic : "sales";

  if (!validEmail(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }
  if (message.length < 10) {
    return NextResponse.json(
      { ok: false, error: "Enter a message (at least 10 characters)." },
      { status: 400 },
    );
  }

  // Honeypot acts HERE — after validation, so the response is indistinguishable from a clean submission.
  // Nothing is stored and nothing is sent.
  if (honeypotTripped) {
    return NextResponse.json({ ok: true });
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
      // topic is allowlisted and company is CR/LF-stripped, so the subject is single-line by construction.
      await resend.emails.send({
        from: fromHeader,
        to: SALES_INBOX,
        replyTo: email,
        subject: oneLine(`New ${topic} enquiry${company ? ` — ${company}` : ""}`, 160),
        text: `Name: ${name || "—"}\nEmail: ${email}\nCompany: ${company || "—"}\nTopic: ${topic}\n\n${message}`,
      });

      // Acknowledgement to the person who reached out. THIS is the relay surface: the recipient is
      // caller-supplied, so it gets its own per-mailbox budget that rotating IPs cannot refill. Failing
      // the mailbox limit is silent — the sales notification above already went out.
      // canonicalizeEmail folds gmail dots/+tags, so victim+1@, v.i.c.t.i.m@ and @googlemail.com all
      // share ONE bucket. Keyed on the raw address, an attacker minted a fresh bucket per alias.
      // allowStrict, not allow: this gate is the only thing standing between a caller-named third party
      // and a send, so a limiter outage must DENY the acknowledgement rather than restore the relay.
      if (await allowStrict(`vcontact-to:${canonicalizeEmail(email)}`, 1, 3600)) {
        await resend.emails.send({
          from: fromHeader,
          to: email,
          replyTo: SALES_INBOX,
          subject: "We got your message — Vraelis",
          // Deliberately NO caller-supplied text. The recipient here is an address the CALLER named, so
          // any interpolated field becomes attacker-chosen prose delivered to a third party under
          // vraelis.com DKIM — a phishing lure with our reputation behind it. The greeting is generic;
          // the submitted name still reaches the sales inbox above, which is where it belongs.
          text: `Hi,\n\nThanks for reaching out to Vraelis — we've got your message and someone from our team will reply to this email shortly.\n\nIn the meantime, you can reply here with anything else you'd like us to know.\n\n— The Vraelis team`,
        });
      } else {
        console.warn("[vraelis/contact] acknowledgement suppressed by per-mailbox limit");
      }
    } catch (error) {
      console.error("contact email failed:", error);
    }
  }

  // Uniform response: the caller learns nothing about whether mail was configured, sent, or suppressed.
  return NextResponse.json({ ok: true });
}
