// POST /api/auth/two-step: the second step of a sign-in. Used only by components/two-step-challenge.tsx.
//
//   { action: "verify", method: "totp" | "email" | "recovery", code }   check a code
//   { action: "send_email" }                                           mail a sign-in code (email method only)
//   { action: "recheck" }                                              re-read settings that failed to load
//
// This route decides NOTHING itself. It hands the request to Auth.js as a session update (unstable_update),
// which reaches the jwt callback in auth.ts with trigger "update"; lib/two-step-session.ts verifies the code
// there against the stored secret, spends the rate-limited attempt, and either completes the token or leaves
// it pending with a notice. What comes back is the session that callback produced: a user means signed in.
//
// A static path under /api/auth takes precedence over the [...nextauth] catch-all, so Auth.js's own routes
// are untouched. The CSRF origin check in proxy.ts applies (the pending session cookie is present).
import { NextResponse } from "next/server";
import { auth, unstable_update } from "@/auth";

export const runtime = "nodejs";

const ACTIONS = new Set(["verify", "send_email", "recheck"]);

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { action?: unknown; method?: unknown; code?: unknown };
  const action = typeof body.action === "string" && ACTIONS.has(body.action) ? body.action : null;
  if (!action) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });

  const before = await auth();
  if (before?.user?.email) return NextResponse.json({ ok: true, state: "signed_in" });
  if (!before?.twoStep?.pending) return NextResponse.json({ ok: false, state: "signed_out" }, { status: 401 });

  const after = await unstable_update({
    twoStep: {
      action,
      method: typeof body.method === "string" ? body.method : null,
      code: typeof body.code === "string" ? body.code.slice(0, 64) : "",
    },
  } as never);

  if (after?.user?.email) return NextResponse.json({ ok: true, state: "signed_in" });
  // The pending state aged out (15 minutes) or the account's sessions were revoked meanwhile.
  if (!after?.twoStep?.pending) return NextResponse.json({ ok: false, state: "signed_out" }, { status: 401 });
  const t = after.twoStep;
  return NextResponse.json({ ok: false, state: "pending", notice: t.notice, methods: t.methods, emailSentAt: t.emailSentAt });
}
