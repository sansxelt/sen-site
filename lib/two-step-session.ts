// Two-step verification at sign-in: the state machine the jwt callback in auth.ts runs.
//
// THE SHAPE. Sessions are JWTs (Auth.js, strategy "jwt"), so the second step is a state carried IN the token:
//
//   fresh sign-in (any provider: password, Google, GitHub, SSO)  ->  two-step on?  ->  token.twoStep = "pending"
//   pending + a correct code, checked here on the server          ->  token.twoStep = "ok"
//
// While pending, the session callback hands out a session WITH NO USER (see pendingSessionView), so every
// existing `session?.user?.email` check in the product reads the person as signed out, with no change to any
// of them. Only /signin looks further, sees session.twoStep.pending and renders the code screen.
//
// THE ONLY WAY FORWARD is an Auth.js session UPDATE (trigger "update"), which reaches the jwt callback with the
// submitted data. That is either POST /api/auth/two-step (which calls unstable_update) or Auth.js's own
// POST /api/auth/session. Both land in advanceTwoStep, which treats the data as untrusted input: it reads only
// an action, a method and a code, verifies the code itself against the stored secret, and spends a rate
// limited attempt before comparing anything. Nothing the client sends can set a token field directly, and the
// issue second of an emailed code is taken from the token, never from the request.
//
// Tokens minted before this existed carry no twoStep field and are treated as complete: the gate applies from
// each account's next sign-in, which is the only moment a JWT session can be re-decided anyway.
import type { JWT } from "next-auth/jwt";
import { maskEmail, type TwoStepMethod, type ProofMethod } from "./two-step";
import { readTwoStepStatus, methodsOf, sendEmailCode, verifyProof } from "./two-step-db";

// A half-finished sign-in is worth nothing to anyone, so it does not linger: fifteen minutes to enter a code,
// after which the token is discarded and the person signs in again.
export const PENDING_TTL_S = 15 * 60;

export type TwoStepNotice =
  | "invalid" | "expired" | "rate_limited" | "unavailable"
  | "sent" | "send_failed" | "send_limited";

export type PendingTwoStepView = {
  pending: true;
  // null when the settings could not be read at sign-in: the screen then offers to try again.
  methods: TwoStepMethod[] | null;
  emailHint: string;
  emailSentAt: number | null;
  notice: TwoStepNotice | null;
};

const nowS = () => Math.floor(Date.now() / 1000);

function clearPending(token: JWT) {
  delete token.twoStepMethods;
  delete token.twoStepSince;
  delete token.twoStepEmailAt;
  delete token.twoStepNotice;
}

function markVerified(token: JWT) {
  clearPending(token);
  token.twoStep = "ok";
  token.twoStepAt = nowS();
}

export function isTwoStepPending(token: JWT | null | undefined): boolean {
  return token?.twoStep === "pending";
}

// Fresh sign-in. Called ONLY when Auth.js passes an `account`, which it does for every provider on the sign-in
// request and never afterwards. A settings read that fails does NOT waive the step: the token is held pending
// with unknown methods, and the code screen re-reads them when asked.
export async function stampTwoStepOnSignIn(token: JWT, email: string): Promise<void> {
  clearPending(token);
  delete token.twoStep;
  delete token.twoStepAt;
  const read = await readTwoStepStatus(email);
  if (read.ok && !read.status.enabled) return;
  token.twoStep = "pending";
  token.twoStepSince = nowS();
  token.twoStepMethods = read.ok ? methodsOf(read.status) : null;
  // Email is the only method: send the code now, so the person finds it waiting instead of having to ask.
  if (read.ok && !read.status.totp && read.status.email) {
    const sent = await sendEmailCode(email, "sign_in");
    if (sent.ok) token.twoStepEmailAt = sent.issuedAt;
  }
}

// Every ordinary read of a pending token (page renders, API calls). Expires a stale pending state and drops the
// one-shot notice, so a message about the last attempt is shown once rather than on every reload.
export function settlePendingOnRead(token: JWT): JWT | null {
  if (nowS() - Number(token.twoStepSince ?? 0) > PENDING_TTL_S) return null;
  delete token.twoStepNotice;
  return token;
}

type Request = { action: "verify" | "send_email" | "recheck"; method: ProofMethod | null; code: string };

function parseRequest(data: unknown): Request | null {
  const d = (data && typeof data === "object" ? (data as Record<string, unknown>).twoStep : null) as Record<string, unknown> | null;
  if (!d || typeof d !== "object") return null;
  const action = d.action;
  if (action !== "verify" && action !== "send_email" && action !== "recheck") return null;
  const m = d.method;
  const method = m === "totp" || m === "email" || m === "recovery" ? m : null;
  return { action, method, code: typeof d.code === "string" ? d.code.slice(0, 64) : "" };
}

// A session update while pending. Returns the token to keep (still pending, or now complete) or null to end
// the half-finished sign-in.
export async function advanceTwoStep(token: JWT, email: string, data: unknown): Promise<JWT | null> {
  if (nowS() - Number(token.twoStepSince ?? 0) > PENDING_TTL_S) return null;
  delete token.twoStepNotice;
  const req = parseRequest(data);
  if (!req) return token;

  // The settings could not be read at sign-in. Read them now; if two-step verification turns out to be off,
  // the sign-in simply completes, exactly as it would have.
  if (!Array.isArray(token.twoStepMethods)) {
    const read = await readTwoStepStatus(email);
    if (!read.ok) { token.twoStepNotice = "unavailable"; return token; }
    if (!read.status.enabled) { markVerified(token); return token; }
    token.twoStepMethods = methodsOf(read.status);
    if (req.action !== "verify") return token;
  }
  const methods = token.twoStepMethods as TwoStepMethod[];

  if (req.action === "recheck") return token;

  if (req.action === "send_email") {
    if (!methods.includes("email")) { token.twoStepNotice = "invalid"; return token; }
    const sent = await sendEmailCode(email, "sign_in");
    if (sent.ok) { token.twoStepEmailAt = sent.issuedAt; token.twoStepNotice = "sent"; }
    else token.twoStepNotice = sent.reason === "rate_limited" ? "send_limited" : "send_failed";
    return token;
  }

  // verify. A method the account does not have is refused before any attempt is spent on it; recovery codes are
  // always accepted, which is what they are for.
  const method = req.method;
  if (!method || (method !== "recovery" && !methods.includes(method))) { token.twoStepNotice = "invalid"; return token; }
  if (method === "email" && !token.twoStepEmailAt) { token.twoStepNotice = "expired"; return token; }
  const r = await verifyProof(email, { method, code: req.code, issuedAt: method === "email" ? Number(token.twoStepEmailAt) : null }, "sign_in");
  if (r.ok) { markVerified(token); return token; }
  // Turned off since this sign-in started (from another device): nothing is left to check.
  if (r.reason === "not_enabled") { markVerified(token); return token; }
  token.twoStepNotice = r.reason;
  return token;
}

// What a pending token may show. Deliberately no `user`: see the header.
export function pendingSessionView(token: JWT): PendingTwoStepView {
  const methods = Array.isArray(token.twoStepMethods) ? (token.twoStepMethods as TwoStepMethod[]) : null;
  const notice = typeof token.twoStepNotice === "string" ? (token.twoStepNotice as TwoStepNotice) : null;
  return {
    pending: true,
    methods,
    emailHint: maskEmail(typeof token.email === "string" ? token.email : ""),
    emailSentAt: typeof token.twoStepEmailAt === "number" ? token.twoStepEmailAt : null,
    notice,
  };
}
