import { createHmac, timingSafeEqual } from "crypto";

/**
 * Signed HTTP-only cookie that marks the browser that *initiated* the
 * credentials signup.  Set at register time, it's what /api/auth/check-
 * signup-status trusts when deciding whether to hand a caller an
 * auto-signin token — only a device that can present a valid claim
 * cookie gets to skip the sign-in screen after verification completes
 * elsewhere.
 *
 * TTL matches the pending_signups expiry (24h), so the cookie is alive
 * for exactly as long as the verification email is usable.
 */
export const SIGNUP_CLAIM_COOKIE = "sx_signup_claim";

const TTL_MS  = 24 * 60 * 60 * 1000;
const TTL_SEC = TTL_MS / 1000;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) {
    throw new Error("AUTH_SECRET is not set — cannot sign signup claim cookies.");
  }
  return s;
}

function canonical(email: string, expires: number): string {
  return [email.trim().toLowerCase(), "signup", String(expires)].join("|");
}

export function signSignupClaim(email: string): { value: string; maxAge: number } {
  const expires = Date.now() + TTL_MS;
  const mac = createHmac("sha256", secret())
    .update(canonical(email, expires))
    .digest("hex");
  const emailB64 = Buffer.from(email.trim().toLowerCase(), "utf8").toString("base64url");
  return {
    value:  `${expires}.${mac}.${emailB64}`,
    maxAge: TTL_SEC,
  };
}

export function verifySignupClaim(value: string | undefined): { email: string } | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;

  const [expiresStr, providedMac, emailB64] = parts;
  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || expires < Date.now()) return null;

  let email: string;
  try {
    email = Buffer.from(emailB64, "base64url").toString("utf8").trim().toLowerCase();
  } catch {
    return null;
  }
  if (!email) return null;

  const expectedMac = createHmac("sha256", secret())
    .update(canonical(email, expires))
    .digest("hex");

  const a = Buffer.from(providedMac, "hex");
  const b = Buffer.from(expectedMac, "hex");
  if (a.length !== b.length) return null;
  try {
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  return { email };
}
