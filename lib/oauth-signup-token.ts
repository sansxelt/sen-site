import { createHmac, timingSafeEqual } from "crypto";

const TTL_MS = 10 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set — cannot sign OAuth signup tokens.");
  }
  return secret;
}

function canonicalPayload(email: string, provider: string, expires: number): string {
  return [email.trim().toLowerCase(), provider, String(expires)].join("|");
}

/**
 * Mint a short-lived signed token for an OAuth user who needs to confirm
 * signup.  The token binds the email + provider, so a valid token can't
 * be reused to create a profile for a different identity.
 */
export function signOAuthSignupToken(payload: {
  email:    string;
  provider: string;
}): string {
  const expires = Date.now() + TTL_MS;
  const mac = createHmac("sha256", getSecret())
    .update(canonicalPayload(payload.email, payload.provider, expires))
    .digest("hex");
  return `${expires}.${mac}`;
}

export function verifyOAuthSignupToken(
  token: string,
  payload: { email: string; provider: string },
): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [expiresStr, providedMac] = parts;
  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;

  const expectedMac = createHmac("sha256", getSecret())
    .update(canonicalPayload(payload.email, payload.provider, expires))
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
