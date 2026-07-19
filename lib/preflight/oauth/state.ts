import { createHmac, timingSafeEqual, randomBytes } from "crypto";

// Signed OAuth state for connection-OAuth. Unlike the sign-in signup token (which verifies against known
// email+provider), this state CARRIES the data the callback needs — which application to attach the token
// to, the owner, the provider, and a nonce — because the callback runs mid-redirect with nothing but the
// state to go on. The payload is signed (HMAC-SHA256 under AUTH_SECRET) so a client can't forge or tamper
// it, and short-lived so it can't be replayed. The nonce is ALSO set as an httpOnly cookie the callback
// re-checks (belt-and-suspenders); the signature is the real gate.
//
// This replaces the raw-email state the legacy /api/integrations/github flow shipped, which offered no
// CSRF/replay protection and no app binding.

const TTL_MS = 10 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set, cannot sign OAuth state.");
  return secret;
}

// appId is OPTIONAL: an ACCOUNT-level connect signs owner|provider|nonce|expires (4 parts); a per-app
// connect signs appId|owner|provider|nonce|expires (5 parts). verifyOAuthState accepts either and returns
// appId only when it was present.
type StatePayload = { appId?: string; owner: string; provider: string; nonce: string };

// Fields are joined with a delimiter that can't appear in an appId/owner/provider (they're ids/emails/kinds).
function canonical(p: StatePayload, expires: number): string {
  const tail = [p.owner.trim().toLowerCase(), p.provider, p.nonce, String(expires)];
  return (p.appId ? [p.appId, ...tail] : tail).join("|");
}

function b64url(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}
function unb64url(s: string): string {
  return Buffer.from(s, "base64url").toString("utf8");
}

export function newNonce(): string {
  return randomBytes(16).toString("hex");
}

// Mint the state string handed to the provider as ?state=. Encodes the payload + expiry and appends an
// HMAC over both. Format: base64url(appId|owner|provider|nonce|expires).mac
export function signOAuthState(payload: StatePayload): string {
  const expires = Date.now() + TTL_MS;
  const body = canonical(payload, expires);
  const mac = createHmac("sha256", getSecret()).update(body).digest("hex");
  return `${b64url(body)}.${mac}`;
}

// Verify + decode the state returned by the provider. Returns the payload only when the signature matches
// and the token hasn't expired; null otherwise (never throws on bad input). Optionally pins the provider.
export function verifyOAuthState(token: string, opts?: { expectedProvider?: string }): StatePayload | null {
  if (!token || typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const bodyB64 = token.slice(0, dot);
  const providedMac = token.slice(dot + 1);
  let body: string;
  try { body = unb64url(bodyB64); } catch { return null; }
  const parts = body.split("|");
  // 5 parts = per-app (appId first); 4 parts = account-level (no appId).
  if (parts.length !== 5 && parts.length !== 4) return null;
  const appId = parts.length === 5 ? parts[0] : undefined;
  const [owner, provider, nonce, expiresStr] = parts.slice(parts.length === 5 ? 1 : 0);
  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || expires < Date.now()) return null;

  const expectedMac = createHmac("sha256", getSecret()).update(body).digest("hex");
  const a = Buffer.from(providedMac, "hex");
  const b = Buffer.from(expectedMac, "hex");
  if (a.length !== b.length) return null;
  try { if (!timingSafeEqual(a, b)) return null; } catch { return null; }

  if (opts?.expectedProvider && provider !== opts.expectedProvider) return null;
  return { appId, owner, provider, nonce };
}
