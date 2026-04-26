import { createHmac, timingSafeEqual } from "crypto";

/**
 * Very short-lived (60 s) HMAC token the /api/auth/verify endpoint hands
 * back to the user so the freshly-promoted account can log in *on the
 * same device that clicked the email link*, without needing to re-enter
 * the password they just set.
 *
 * The token is accepted by the Credentials provider in place of the
 * password field.  Short TTL and one-hop use (the auto-signin page fires
 * it immediately on mount) keeps the window of replay minimal.
 */
const TTL_MS = 60 * 1000;

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set, cannot sign auto-signin tokens.");
  }
  return secret;
}

function canonicalPayload(email: string, expires: number): string {
  return [email.trim().toLowerCase(), "autosignin", String(expires)].join("|");
}

export function signAutoSigninToken(email: string): string {
  const expires = Date.now() + TTL_MS;
  const mac = createHmac("sha256", getSecret())
    .update(canonicalPayload(email, expires))
    .digest("hex");
  return `${expires}.${mac}`;
}

export function verifyAutoSigninToken(token: string, email: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [expiresStr, providedMac] = parts;
  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;

  const expectedMac = createHmac("sha256", getSecret())
    .update(canonicalPayload(email, expires))
    .digest("hex");

  const a = Buffer.from(providedMac, "hex");
  const b = Buffer.from(expectedMac, "hex");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
