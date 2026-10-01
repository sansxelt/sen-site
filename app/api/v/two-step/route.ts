// Two-step verification settings for the signed-in account. Used by the Account page
// (app/rank/app/account/two-step-section.tsx). Session-gated on the caller's own identity: a pending sign-in
// has no user, so it can never reach this.
//
//   GET                                          { status, emailHint }
//   POST { action: "totp_begin", proof? }        a new authenticator secret, its QR code, and a sealed ticket
//   POST { action: "totp_confirm", ticket, code } turn the authenticator on once a code from it checks out
//   POST { action: "email_begin", proof? }        mail a code to turn email codes on; returns a sealed ticket
//   POST { action: "email_resend", ticket }       mail a fresh setup code under the same (unexpired) ticket
//   POST { action: "email_confirm", ticket, code } turn email codes on once that code checks out
//   POST { action: "send_code" }                  mail a code to confirm a change (email method only)
//   POST { action: "remove", method, proof }      turn one method off (the last one turns everything off)
//   POST { action: "disable", proof }             turn two-step verification off
//   POST { action: "recovery_new", proof }        replace the recovery codes
//
// `proof` is { method: "totp" | "email" | "recovery", code, issuedAt? } and is required for every change once
// two-step verification is on. The rules live in lib/two-step-db.ts; this file only routes and maps errors.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  readTwoStepStatus, beginTotpSetup, confirmTotpSetup, beginEmailSetup, resendEmailSetup, confirmEmailSetup,
  sendEmailCode, removeMethod, turnOff, regenerateRecoveryCodes, type Failure, type Proof,
} from "@/lib/two-step-db";
import { maskEmail } from "@/lib/two-step";

export const runtime = "nodejs";

const STATUS: Record<Failure, number> = { invalid: 400, expired: 400, rate_limited: 429, unavailable: 503, not_enabled: 409 };
const fail = (reason: Failure) => NextResponse.json({ ok: false, error: reason }, { status: STATUS[reason] ?? 400 });

async function caller(): Promise<string | null> {
  const email = (await auth())?.user?.email;
  return email ? email.trim().toLowerCase() : null;
}

function readProof(raw: unknown): Proof | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const method = p.method === "totp" || p.method === "email" || p.method === "recovery" ? p.method : null;
  if (!method || typeof p.code !== "string") return null;
  const issuedAt = Number(p.issuedAt);
  return { method, code: p.code.slice(0, 64), issuedAt: Number.isFinite(issuedAt) ? issuedAt : null };
}

export async function GET() {
  const email = await caller();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const read = await readTwoStepStatus(email);
  if (!read.ok) return fail("unavailable");
  return NextResponse.json({ ok: true, status: read.status, emailHint: maskEmail(email) });
}

export async function POST(req: Request) {
  const email = await caller();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const proof = readProof(body.proof);
  const code = typeof body.code === "string" ? body.code.slice(0, 64) : "";

  switch (body.action) {
    case "totp_begin": {
      const r = await beginTotpSetup(email, proof);
      return r.ok ? NextResponse.json({ ok: true, setup: r.setup }) : fail(r.reason);
    }
    case "totp_confirm": {
      const r = await confirmTotpSetup(email, body.ticket, code);
      return r.ok ? NextResponse.json({ ok: true, status: r.status, recoveryCodes: r.recoveryCodes }) : fail(r.reason);
    }
    case "email_begin": {
      const r = await beginEmailSetup(email, proof);
      return r.ok ? NextResponse.json({ ok: true, ticket: r.ticket, emailHint: r.emailHint }) : fail(r.reason);
    }
    case "email_resend": {
      const r = await resendEmailSetup(email, body.ticket);
      return r.ok ? NextResponse.json({ ok: true, ticket: r.ticket, emailHint: r.emailHint }) : fail(r.reason);
    }
    case "email_confirm": {
      const r = await confirmEmailSetup(email, body.ticket, code);
      return r.ok ? NextResponse.json({ ok: true, status: r.status, recoveryCodes: r.recoveryCodes }) : fail(r.reason);
    }
    case "send_code": {
      // Only an account with email codes on can confirm a change by email.
      const read = await readTwoStepStatus(email);
      if (!read.ok) return fail("unavailable");
      if (!read.status.email) return fail("not_enabled");
      const r = await sendEmailCode(email, "confirm");
      return r.ok ? NextResponse.json({ ok: true, issuedAt: r.issuedAt, emailHint: maskEmail(email) }) : fail(r.reason);
    }
    case "remove": {
      const method = body.method === "totp" || body.method === "email" ? body.method : null;
      if (!method || !proof) return fail("invalid");
      const r = await removeMethod(email, method, proof);
      return r.ok ? NextResponse.json({ ok: true, status: r.status }) : fail(r.reason);
    }
    case "disable": {
      if (!proof) return fail("invalid");
      const r = await turnOff(email, proof);
      return r.ok ? NextResponse.json({ ok: true, status: r.status }) : fail(r.reason);
    }
    case "recovery_new": {
      if (!proof) return fail("invalid");
      const r = await regenerateRecoveryCodes(email, proof);
      return r.ok ? NextResponse.json({ ok: true, status: r.status, recoveryCodes: r.recoveryCodes }) : fail(r.reason);
    }
    default:
      return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
}
